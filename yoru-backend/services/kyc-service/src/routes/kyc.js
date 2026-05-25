import { prisma } from '../prisma.js';
import { publishEvent } from '../broker.js';
import { presignPut, presignGet } from '../s3.js';

export default async function kycRoutes(fastify) {

  // POST /api/kyc/presigned-urls
  // Devuelve URLs firmadas para que el cliente suba INE (PDF) y selfie (JPEG)
  // directamente a MinIO sin pasar por este servicio.
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

  // GET /api/kyc/download-url?key=<s3-key>
  // Para que el revisor humano pueda descargar/ver el documento.
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
  // Crea (o re-abre) la solicitud KYC para un usuario.
  // Por ahora recibe las URLs de los archivos ya subidos a S3 desde el cliente.
  fastify.post('/requests', async (request, reply) => {
    const { userId, refIneS3, refSelfieS3 } = request.body ?? {};

    if (!userId) {
      return reply.code(400).send({ ok: false, error: 'userId requerido.' });
    }

    const req = await prisma.kycRequest.upsert({
      where: { userId },
      create: { userId, refIneS3, refSelfieS3 },
      update: { refIneS3, refSelfieS3, estado: 'pendiente', motivoRechazo: null },
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
  // Aprueba la solicitud manualmente o por validación automática.
  // Publica kyc.completed para que telecom active la línea.
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
}
