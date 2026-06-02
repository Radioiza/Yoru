import { prisma } from '../prisma.js';
import { publishEvent } from '../broker.js';
import { requireAuth } from '../middleware.js';

export default async function pkiRoutes(fastify) {

  // POST /api/pki/keys
  // Registra una llave publica. Llamado desde el orquestador (auth/registro/finalizar)
  // o desde el flujo de regeneracion despues de revocar (en cuyo caso el usuario
  // ya esta autenticado y solo tendra llaves revocadas).
  fastify.post('/keys', async (request, reply) => {
    const { userId, publicKeyPem, curva = 'P-256', committed = true } = request.body ?? {};

    if (!userId || !publicKeyPem) {
      return reply.code(400).send({
        ok: false,
        error: 'userId y publicKeyPem son obligatorios.',
      });
    }

    // Buscamos solo entre llaves committeadas para evitar falsos positivos
    // por drafts abandonados.
    const llaveActiva = await prisma.publicKey.findFirst({
      where: { userId, revocada: false, committed: true },
    });

    if (llaveActiva) {
      // Hay una llave ACTIVA (no revocada) ya. Esto es un intento sospechoso.
      publishEvent('pki.new_key_attempt', {
        userId,
        previousKeyId: llaveActiva.id,
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });
    }

    const nueva = await prisma.publicKey.create({
      data: { userId, publicKeyPem, curva, committed },
      select: { id: true, userId: true, curva: true, createdAt: true },
    });

    publishEvent('pki.key_registered', {
      userId: nueva.userId,
      publicKeyId: nueva.id,
      curva: nueva.curva,
    });

    return reply.code(201).send({ ok: true, key: nueva });
  });

  // GET /api/pki/user-ids — lista los userId distintos con llaves registradas.
  // Lo usa el reconciliador de auth para detectar y purgar huerfanos (p.ej.
  // si un usuario fue borrado directamente en la BD / Prisma Studio).
  fastify.get('/user-ids', async () => {
    const rows = await prisma.publicKey.findMany({ distinct: ['userId'], select: { userId: true } });
    return { ok: true, userIds: rows.map((r) => r.userId) };
  });

  // GET /api/pki/keys/:userId — devuelve la llave activa.
  fastify.get('/keys/:userId', async (request, reply) => {
    const { userId } = request.params;
    const key = await prisma.publicKey.findFirst({
      where: { userId, revocada: false, committed: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!key) return reply.code(404).send({ ok: false, error: 'Sin llave activa.' });
    return { ok: true, key };
  });

  // POST /api/pki/verify
  fastify.post('/verify', async (request, reply) => {
    const { userId, payload, signatureB64, challengeId } = request.body ?? {};

    if (!userId || !payload || !signatureB64) {
      return reply.code(400).send({
        ok: false,
        error: 'userId, payload y signatureB64 son obligatorios.',
      });
    }

    const key = await prisma.publicKey.findFirst({
      where: { userId, revocada: false, committed: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!key) return reply.code(404).send({ ok: false, error: 'Usuario sin llave activa.' });

    let valida = false;
    try {
      const publicKey = await importPublicKeyPem(key.publicKeyPem);
      const sigBytes = Buffer.from(signatureB64, 'base64');
      const dataBytes = new TextEncoder().encode(payload);
      valida = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        publicKey,
        sigBytes,
        dataBytes
      );
    } catch (err) {
      request.log.error({ err }, 'fallo verificando firma');
      valida = false;
    }

    const payloadHash = await sha256Hex(payload);

    await prisma.signature.create({
      data: {
        publicKeyId: key.id,
        challengeId: challengeId ?? null,
        payloadHash,
        resultado: valida ? 'valida' : 'invalida',
      },
    });

    if (!valida) {
      publishEvent('auth.failed_attempt', { userId, motivo: 'firma invalida' });
    }

    return { ok: true, valida };
  });

  // POST /api/pki/keys/:id/revoke (PROTEGIDO)
  fastify.post('/keys/:id/revoke', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params;
    try {
      const key = await prisma.publicKey.findUnique({ where: { id } });
      if (!key) return reply.code(404).send({ ok: false, error: 'Llave no encontrada.' });
      if (key.userId !== request.user.sub) {
        return reply.code(403).send({ ok: false, error: 'No puedes revocar llaves de otro usuario.' });
      }

      const actualizada = await prisma.publicKey.update({
        where: { id },
        data: { revocada: true, revokedAt: new Date() },
      });
      publishEvent('pki.key_revoked', { publicKeyId: actualizada.id, userId: actualizada.userId });
      return { ok: true, key: actualizada };
    } catch (err) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  // POST /api/pki/users/:userId/revoke-all
  // Revoca TODAS las llaves activas del usuario. Lo usa el flujo de
  // revocacion del auth-service tras validar el codigo por correo.
  fastify.post('/users/:userId/revoke-all', async (request, reply) => {
    const { userId } = request.params;
    const result = await prisma.publicKey.updateMany({
      where: { userId, revocada: false },
      data: { revocada: true, revokedAt: new Date() },
    });
    publishEvent('pki.user_keys_revoked', { userId, cantidad: result.count });
    return { ok: true, revocadas: result.count };
  });

  // DELETE /api/pki/users/:userId — cascada (usado por consumer auth.user_deleted)
  fastify.delete('/users/:userId', async (request, reply) => {
    const { userId } = request.params;
    const result = await prisma.publicKey.deleteMany({ where: { userId } });
    return { ok: true, borradas: result.count };
  });
}

async function importPublicKeyPem(pem) {
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Buffer.from(b64, 'base64');
  return crypto.subtle.importKey(
    'spki',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Buffer.from(hash).toString('hex');
}
