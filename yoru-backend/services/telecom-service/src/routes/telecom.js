import { prisma } from '../prisma.js';
import { publishEvent } from '../broker.js';
import { requireAuth } from '../middleware.js';

export default async function telecomRoutes(fastify) {

  // POST /api/telecom/lineas
  fastify.post('/lineas', async (request, reply) => {
    const { telefono, userId, publicKeyId, committed = false } = request.body ?? {};

    if (!telefono || !userId) {
      return reply.code(400).send({ ok: false, error: 'telefono y userId requeridos.' });
    }

    try {
      const linea = await prisma.linea.create({
        data: {
          telefono,
          userId,
          publicKeyId: publicKeyId ?? null,
          committed,
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
          error: 'Este telefono ya esta vinculado.',
        });
      }
      throw err;
    }
  });

  // GET /api/telecom/user-ids — lista los userId distintos con lineas.
  // Lo usa el reconciliador de auth para purgar huerfanos.
  fastify.get('/user-ids', async () => {
    const rows = await prisma.linea.findMany({ distinct: ['userId'], select: { userId: true } });
    return { ok: true, userIds: rows.map((r) => r.userId) };
  });

  // GET /api/telecom/lineas/:telefono
  fastify.get('/lineas/:telefono', async (request, reply) => {
    const { telefono } = request.params;
    const linea = await prisma.linea.findUnique({
      where: { telefono },
      include: { eventos: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!linea || !linea.committed) return reply.code(404).send({ ok: false, error: 'Linea no encontrada.' });
    return { ok: true, linea };
  });

  // GET /api/telecom/lineas/by-user/:userId — lista todas las lineas del usuario.
  fastify.get('/lineas/by-user/:userId', async (request) => {
    const { userId } = request.params;
    const lineas = await prisma.linea.findMany({
      where: { userId, committed: true },
      include: { eventos: { orderBy: { createdAt: 'desc' }, take: 5 } },
      orderBy: { fechaVinculacion: 'asc' },
    });
    // Diagnostico: si hay lineas para ese userId pero todas con committed=false,
    // las contamos aparte para distinguir entre "no existen" y "no estan committeadas".
    const total = await prisma.linea.count({ where: { userId } });
    console.log(`[by-user] userId=${userId} -> ${lineas.length} commiteadas (total ${total})`);
    return { ok: true, lineas };
  });

  // POST /api/telecom/lineas/:telefono/activar — activa una linea (usado por add-linea)
  fastify.post('/lineas/:telefono/activar', async (request, reply) => {
    const { telefono } = request.params;
    const linea = await prisma.linea.findUnique({ where: { telefono } });
    if (!linea) return reply.code(404).send({ ok: false, error: 'No existe.' });

    const updated = await prisma.linea.update({
      where: { telefono },
      data: {
        estado: 'activa',
        eventos: { create: { tipo: 'activada', detalle: { origen: 'add-linea' } } },
      },
    });
    return { ok: true, linea: updated };
  });

  // POST /api/telecom/lineas/by-user/:userId/desvincular
  // Desvincula (borra) TODAS las lineas del usuario. Usado por el flujo de revocacion.
  fastify.post('/lineas/by-user/:userId/desvincular', async (request) => {
    const { userId } = request.params;
    const lineas = await prisma.linea.findMany({ where: { userId } });
    const count = lineas.length;
    await prisma.linea.deleteMany({ where: { userId } });
    publishEvent('telecom.lineas_desvinculadas', { userId, cantidad: count });
    return { ok: true, desvinculadas: count };
  });

  // POST /api/telecom/lineas/:telefono/kill-switch (PROTEGIDO)
  fastify.post('/lineas/:telefono/kill-switch', { preHandler: requireAuth }, async (request, reply) => {
    const { telefono } = request.params;
    const { motivo } = request.body ?? {};

    const linea = await prisma.linea.findUnique({ where: { telefono } });
    if (!linea) return reply.code(404).send({ ok: false, error: 'Linea no encontrada.' });
    if (linea.userId !== request.user.sub) {
      return reply.code(403).send({ ok: false, error: 'No puedes bloquear una linea ajena.' });
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

  // POST /api/telecom/lineas/:telefono/unblock (PROTEGIDO)
  fastify.post('/lineas/:telefono/unblock', { preHandler: requireAuth }, async (request, reply) => {
    const { telefono } = request.params;
    const linea = await prisma.linea.findUnique({ where: { telefono } });
    if (!linea) return reply.code(404).send({ ok: false, error: 'Linea no encontrada.' });
    if (linea.userId !== request.user.sub) {
      return reply.code(403).send({ ok: false, error: 'No puedes desbloquear una linea ajena.' });
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
