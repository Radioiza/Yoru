import { prisma } from '../prisma.js';
import { publishEvent } from '../broker.js';
import { requireAuth } from '../middleware.js';

export default async function pkiRoutes(fastify) {

  // POST /api/pki/keys
  // Registra una llave pública para un usuario. Si ya tenía una activa,
  // emite evento new_key_attempt para que telecom evalúe el kill switch.
  fastify.post('/keys', async (request, reply) => {
    const { userId, publicKeyPem, curva = 'P-256' } = request.body ?? {};

    if (!userId || !publicKeyPem) {
      return reply.code(400).send({
        ok: false,
        error: 'userId y publicKeyPem son obligatorios.',
      });
    }

    const llaveActiva = await prisma.publicKey.findFirst({
      where: { userId, revocada: false },
    });

    if (llaveActiva) {
      publishEvent('pki.new_key_attempt', {
        userId,
        previousKeyId: llaveActiva.id,
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });
    }

    const nueva = await prisma.publicKey.create({
      data: { userId, publicKeyPem, curva },
      select: { id: true, userId: true, curva: true, createdAt: true },
    });

    publishEvent('pki.key_registered', {
      userId: nueva.userId,
      publicKeyId: nueva.id,
      curva: nueva.curva,
    });

    return reply.code(201).send({ ok: true, key: nueva });
  });

  // GET /api/pki/keys/:userId — consulta la llave pública activa
  fastify.get('/keys/:userId', async (request, reply) => {
    const { userId } = request.params;
    const key = await prisma.publicKey.findFirst({
      where: { userId, revocada: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!key) return reply.code(404).send({ ok: false, error: 'Sin llave activa.' });
    return { ok: true, key };
  });

  // POST /api/pki/verify
  // Verifica una firma ECDSA P-256 contra un payload (nonce del challenge).
  // El resultado se almacena en signatures como log auditable.
  fastify.post('/verify', async (request, reply) => {
    const { userId, payload, signatureB64, challengeId } = request.body ?? {};

    if (!userId || !payload || !signatureB64) {
      return reply.code(400).send({
        ok: false,
        error: 'userId, payload y signatureB64 son obligatorios.',
      });
    }

    const key = await prisma.publicKey.findFirst({
      where: { userId, revocada: false },
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

  // POST /api/pki/keys/:id/revoke — marca una llave como revocada (PROTEGIDO)
  // Solo el dueño de la llave (validado vía JWT) puede revocarla.
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
}

// --- helpers ---

async function importPublicKeyPem(pem) {
  // Acepta PEM SPKI estándar
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
