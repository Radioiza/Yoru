import { prisma } from '../prisma.js';
import { publishEvent } from '../broker.js';
import { requireAuth } from '../middleware.js';

export default async function telecomRoutes(fastify) {

  // POST /api/telecom/lineas — vincula una línea a un usuario
  fastify.post('/lineas', async (request, reply) => {
    const { telefono, userId, publicKeyId } = request.body ?? {};

    if (!telefono || !userId) {
      return reply.code(400).send({ ok: false, error: 'telefono y userId requeridos.' });
    }

    try {
      const linea = await prisma.linea.create({
        data: {
          telefono,
          userId,
          publicKeyId: publicKeyId ?? null,
          eventos: {
            create: { tipo: 'vinculada', detalle: { origen: 'api' } },
          },
        },
        include: { eventos: true },
      });

      return reply.code(201).send({ ok: true, linea });
    } catch (err) {
      if (err.code === 'P2002') {
        return reply.code(409).send({
          ok: false,
          error: 'Este teléfono ya está vinculado.',
        });
      }
      throw err;
    }
  });

  // GET /api/telecom/lineas/:telefono
  fastify.get('/lineas/:telefono', async (request, reply) => {
    const { telefono } = request.params;
    const linea = await prisma.linea.findUnique({
      where: { telefono },
      include: { eventos: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!linea) return reply.code(404).send({ ok: false, error: 'Línea no encontrada.' });
    return { ok: true, linea };
  });

  // POST /api/telecom/lineas/:telefono/kill-switch — activa kill switch (PROTEGIDO)
  // Solo el dueño de la línea puede activarlo manualmente.
  fastify.post('/lineas/:telefono/kill-switch', { preHandler: requireAuth }, async (request, reply) => {
    const { telefono } = request.params;
    const { motivo } = request.body ?? {};

    const linea = await prisma.linea.findUnique({ where: { telefono } });
    if (!linea) return reply.code(404).send({ ok: false, error: 'Línea no encontrada.' });
    if (linea.userId !== request.user.sub) {
      return reply.code(403).send({ ok: false, error: 'No puedes bloquear una línea ajena.' });
    }

    const actualizada = await prisma.linea.update({
      where: { telefono },
      data: {
        estado: 'kill_switched',
        eventos: {
          create: {
            tipo: 'kill_switched',
            detalle: { motivo: motivo ?? 'manual', origen: 'api' },
          },
        },
      },
    });

    publishEvent('telecom.kill_switch_activado', {
      telefono: actualizada.telefono,
      userId: actualizada.userId,
      motivo: motivo ?? 'manual',
    });

    return { ok: true, linea: actualizada };
  });

  // POST /api/telecom/lineas/:telefono/unblock — quita un kill switch (PROTEGIDO)
  fastify.post('/lineas/:telefono/unblock', { preHandler: requireAuth }, async (request, reply) => {
    const { telefono } = request.params;
    const linea = await prisma.linea.findUnique({ where: { telefono } });
    if (!linea) return reply.code(404).send({ ok: false, error: 'Línea no encontrada.' });
    if (linea.userId !== request.user.sub) {
      return reply.code(403).send({ ok: false, error: 'No puedes desbloquear una línea ajena.' });
    }

    const actualizada = await prisma.linea.update({
      where: { telefono },
      data: {
        estado: 'activa',
        eventos: {
          create: { tipo: 'desbloqueada', detalle: { origen: 'api' } },
        },
      },
    });
    return { ok: true, linea: actualizada };
  });
}
