import { prisma } from '../prisma.js';
import { publishEvent } from '../broker.js';
import { validarRegistro } from '../validators.js';
import { signJwt } from '../jwt.js';
import { requireAuth } from '../middleware.js';

const PKI_URL = process.env.PKI_URL ?? 'http://localhost:3002';

export default async function authRoutes(fastify) {

  // POST /api/auth/register
  // Crea un usuario en estado "pendiente" — el resto del flujo lo activa.
  fastify.post('/register', async (request, reply) => {
    const { telefono, curp, nombre } = request.body ?? {};

    const errores = validarRegistro({ telefono, curp });
    if (Object.keys(errores).length > 0) {
      return reply.code(400).send({ ok: false, errores });
    }

    const curpUpper = curp.toUpperCase();
    // nombre es opcional; lo limpiamos y limitamos longitud.
    const nombreLimpio = typeof nombre === 'string'
      ? nombre.trim().slice(0, 50) || null
      : null;

    const existente = await prisma.user.findFirst({
      where: { OR: [{ telefono }, { curp: curpUpper }] },
    });
    if (existente) {
      const conflicto = existente.telefono === telefono ? 'telefono' : 'curp';
      return reply.code(409).send({
        ok: false,
        errores: { [conflicto]: 'Ya existe un registro con este valor.' },
      });
    }

    const user = await prisma.user.create({
      data: { telefono, curp: curpUpper, nombre: nombreLimpio },
      select: { id: true, telefono: true, curp: true, nombre: true, estado: true, createdAt: true },
    });

    publishEvent('auth.user_created', {
      userId: user.id,
      telefono: user.telefono,
      curp: user.curp,
      nombre: user.nombre,
      createdAt: user.createdAt,
    });

    return reply.code(201).send({ ok: true, user });
  });

  // GET /api/auth/users/:id
  fastify.get('/users/:id', async (request, reply) => {
    const { id } = request.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, telefono: true, curp: true, estado: true, createdAt: true },
    });
    if (!user) return reply.code(404).send({ ok: false, error: 'Usuario no encontrado.' });
    return { ok: true, user };
  });

  // POST /api/auth/challenge
  // Genera un nonce que el cliente firmará con su llave privada ECDSA.
  fastify.post('/challenge', async (request, reply) => {
    const { userId } = request.body ?? {};
    if (!userId) return reply.code(400).send({ ok: false, error: 'userId requerido.' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.code(404).send({ ok: false, error: 'Usuario no encontrado.' });

    const nonce = crypto.randomUUID() + '.' + Date.now();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

    const challenge = await prisma.challenge.create({
      data: { userId, nonce, expiresAt },
      select: { id: true, nonce: true, expiresAt: true },
    });

    return { ok: true, challenge };
  });

  // ============================================================
  // POST /api/auth/login
  // El cliente firma un challenge previo y manda la firma.
  // Auth llama internamente a PKI /verify; si valida, emite JWT.
  // ============================================================
  fastify.post('/login', async (request, reply) => {
    const { userId, challengeId, signatureB64 } = request.body ?? {};

    if (!userId || !challengeId || !signatureB64) {
      return reply.code(400).send({
        ok: false,
        error: 'userId, challengeId y signatureB64 son obligatorios.',
      });
    }

    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge || challenge.userId !== userId) {
      return reply.code(404).send({ ok: false, error: 'Challenge no encontrado.' });
    }
    if (challenge.usado) {
      return reply.code(401).send({ ok: false, error: 'Challenge ya fue usado.' });
    }
    if (challenge.expiresAt < new Date()) {
      return reply.code(401).send({ ok: false, error: 'Challenge expirado.' });
    }

    // Llamar al PKI para verificar la firma. La fuente de verdad criptográfica.
    let valida = false;
    try {
      const r = await fetch(`${PKI_URL}/api/pki/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          payload: challenge.nonce,
          signatureB64,
          challengeId,
        }),
      });
      const data = await r.json();
      valida = data.valida === true;
    } catch (err) {
      request.log.error({ err }, 'PKI no disponible');
      return reply.code(503).send({ ok: false, error: 'PKI no disponible.' });
    }

    if (!valida) {
      publishEvent('auth.failed_attempt', { userId, motivo: 'firma invalida en login' });
      return reply.code(401).send({ ok: false, error: 'Firma inválida.' });
    }

    // Marcar challenge como usado para evitar replay attacks.
    await prisma.challenge.update({
      where: { id: challengeId },
      data: { usado: true },
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.code(404).send({ ok: false, error: 'Usuario no encontrado.' });

    // Recuperar el id de la llave pública activa para meterlo en el JWT.
    let publicKeyId = null;
    try {
      const r = await fetch(`${PKI_URL}/api/pki/keys/${userId}`);
      if (r.ok) {
        const data = await r.json();
        publicKeyId = data.key?.id ?? null;
      }
    } catch { /* ignorar */ }

    // Emitir el token.
    const token = signJwt({
      sub: user.id,
      telefono: user.telefono,
      nombre: user.nombre,
      publicKeyId,
    });
    const expiresAt2 = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await prisma.session.create({
      data: { userId: user.id, token, expiresAt: expiresAt2 },
    });

    publishEvent('auth.login_success', { userId: user.id });

    return {
      ok: true,
      token,
      expiresIn: 3600,
      user: {
        id: user.id,
        telefono: user.telefono,
        curp: user.curp,
        nombre: user.nombre,
        estado: user.estado,
      },
    };
  });

  // GET /api/auth/me — devuelve la info del usuario del JWT.
  fastify.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true, telefono: true, curp: true, nombre: true, estado: true, createdAt: true },
    });
    if (!user) return reply.code(404).send({ ok: false, error: 'Usuario no encontrado.' });
    return { ok: true, user, tokenClaims: request.user };
  });
}
