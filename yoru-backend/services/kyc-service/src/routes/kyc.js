import { prisma } from '../prisma.js';
import { publishEvent } from '../broker.js';
import { presignPut, presignGet, deleteObject } from '../s3.js';

export default async function kycRoutes(fastify) {

  // POST /api/kyc/presigned-urls
  fastify.post('/presigned-urls', async (request, reply) => {
    const { userId } = request.body ?? {};
    if (!userId) return reply.code(400).send({ ok: false, error: 'userId requerido.' });

    const stamp = Date.now();
    const ineKey    = `ine/${userId}/${stamp}-ine.pdf`;
    const selfieKey = `selfies/${userId}/${stamp}-selfie.jpg`;

    try {
      const [ineUploadUrl, selfieUploadUrl] = await Promise.all([
        presignPut({ key: ineKey,    contentType: 'application/pdf' }),
        presignPut({ key: selfieKey, contentType: 'image/jpeg' }),
      ]);
      return {
        ok: true,
        ineUploadUrl,
        selfieUploadUrl,
        ineKey,
        selfieKey,
        expiresIn: 300,
      };
    } catch (err) {
      request.log.error({ err }, 'fallo generando presigned URLs');
      return reply.code(500).send({ ok: false, error: 'No se pudo generar las URLs.' });
    }
  });

  // POST /api/kyc/foto-perfil/presigned-url
  // URL para subir SOLO la foto de perfil (no la selfie original).
  fastify.post('/foto-perfil/presigned-url', async (request, reply) => {
    const { userId, contentType = 'image/jpeg' } = request.body ?? {};
    if (!userId) return reply.code(400).send({ ok: false, error: 'userId requerido.' });

    const ext = contentType === 'image/png' ? 'png' : 'jpg';
    const key = `foto-perfil/${userId}/${Date.now()}-perfil.${ext}`;

    try {
      const url = await presignPut({ key, contentType });
      return { ok: true, uploadUrl: url, key, expiresIn: 300 };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  // POST /api/kyc/foto-perfil — guarda la ref en BD (la selfie original NO se toca)
  fastify.post('/foto-perfil', async (request, reply) => {
    const { userId, refFotoPerfilS3 } = request.body ?? {};
    if (!userId || !refFotoPerfilS3) {
      return reply.code(400).send({ ok: false, error: 'userId y refFotoPerfilS3 requeridos.' });
    }
    const req = await prisma.kycRequest.findUnique({ where: { userId } });
    if (!req) return reply.code(404).send({ ok: false, error: 'Sin KYC.' });

    const actualizada = await prisma.kycRequest.update({
      where: { userId },
      data: { refFotoPerfilS3 },
    });
    return { ok: true, request: actualizada };
  });

  // GET /api/kyc/foto-perfil/:userId — URL temporal para mostrar la foto
  fastify.get('/foto-perfil/:userId', async (request, reply) => {
    const { userId } = request.params;
    const req = await prisma.kycRequest.findUnique({ where: { userId } });
    if (!req) return reply.code(404).send({ ok: false, error: 'Sin KYC.' });

    // Usa la foto de perfil si existe; si no, la selfie original como default.
    const key = req.refFotoPerfilS3 ?? req.refSelfieS3;
    if (!key) return reply.code(404).send({ ok: false, error: 'Sin foto.' });
    try {
      const url = await presignGet({ key });
      return { ok: true, url, esSelfie: !req.refFotoPerfilS3 };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  // GET /api/kyc/selfie/:userId — selfie original (read-only, no se puede cambiar)
  fastify.get('/selfie/:userId', async (request, reply) => {
    const { userId } = request.params;
    const req = await prisma.kycRequest.findUnique({ where: { userId } });
    if (!req || !req.refSelfieS3) return reply.code(404).send({ ok: false, error: 'Sin selfie.' });
    try {
      const url = await presignGet({ key: req.refSelfieS3 });
      return { ok: true, url };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  // GET /api/kyc/download-url?key=
  fastify.get('/download-url', async (request, reply) => {
    const { key } = request.query;
    if (!key) return reply.code(400).send({ ok: false, error: 'key requerido.' });
    try {
      const url = await presignGet({ key });
      return { ok: true, url, expiresIn: 600 };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  // POST /api/kyc/requests
  fastify.post('/requests', async (request, reply) => {
    const { userId, refIneS3, refSelfieS3, committed = false } = request.body ?? {};
    if (!userId) return reply.code(400).send({ ok: false, error: 'userId requerido.' });

    const req = await prisma.kycRequest.upsert({
      where: { userId },
      create: { userId, refIneS3, refSelfieS3, committed },
      update: { refIneS3, refSelfieS3, estado: 'pendiente', motivoRechazo: null, committed },
    });

    return reply.code(201).send({ ok: true, request: req });
  });

  // GET /api/kyc/requests/:userId
  fastify.get('/requests/:userId', async (request, reply) => {
    const { userId } = request.params;
    const req = await prisma.kycRequest.findUnique({ where: { userId } });
    if (!req) return reply.code(404).send({ ok: false, error: 'Sin solicitud KYC.' });
    return { ok: true, request: req };
  });

  // POST /api/kyc/requests/:userId/approve
  fastify.post('/requests/:userId/approve', async (request, reply) => {
    const { userId } = request.params;
    const { scoreMatch } = request.body ?? {};

    try {
      const req = await prisma.kycRequest.update({
        where: { userId },
        data: { estado: 'aprobado', scoreMatch, motivoRechazo: null },
      });

      publishEvent('kyc.completed', {
        userId: req.userId,
        aprobado: true,
        scoreMatch: req.scoreMatch,
      });

      return { ok: true, request: req };
    } catch (err) {
      return reply.code(404).send({ ok: false, error: 'Solicitud no encontrada.' });
    }
  });

  // POST /api/kyc/requests/:userId/reject
  fastify.post('/requests/:userId/reject', async (request, reply) => {
    const { userId } = request.params;
    const { motivoRechazo } = request.body ?? {};

    try {
      const req = await prisma.kycRequest.update({
        where: { userId },
        data: { estado: 'rechazado', motivoRechazo: motivoRechazo ?? 'sin especificar' },
      });

      publishEvent('kyc.rejected', {
        userId: req.userId,
        motivoRechazo: req.motivoRechazo,
      });

      return { ok: true, request: req };
    } catch (err) {
      return reply.code(404).send({ ok: false, error: 'Solicitud no encontrada.' });
    }
  });

  // DELETE /api/kyc/users/:userId — cascada
  fastify.delete('/users/:userId', async (request, reply) => {
    const { userId } = request.params;
    const req = await prisma.kycRequest.findUnique({ where: { userId } });
    if (!req) return { ok: true, borrado: 0 };

    // Intentamos borrar los archivos en MinIO. Si falla, seguimos.
    for (const key of [req.refIneS3, req.refSelfieS3, req.refFotoPerfilS3]) {
      if (!key) continue;
      try { await deleteObject(key); } catch (err) {
        request.log.warn({ err, key }, 'no pude borrar objeto S3');
      }
    }

    await prisma.kycRequest.delete({ where: { userId } });
    return { ok: true, borrado: 1 };
  });
}
