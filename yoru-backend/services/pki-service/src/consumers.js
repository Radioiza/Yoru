import { prisma } from './prisma.js';
import { subscribe } from './broker.js';

/**
 * Consumers del pki-service.
 *
 *  - auth.user_deleted        → borra todas las llaves del usuario (cascada)
 *  - auth.revocacion_confirmada → revoca todas las llaves activas del usuario
 */
export async function registrarConsumers() {
  await subscribe(
    'pki.queue',
    ['auth.user_deleted', 'auth.revocacion_confirmada'],
    async (routingKey, payload) => {
      console.log(`[consumer] ${routingKey}`, payload);

      if (routingKey === 'auth.user_deleted') {
        const r = await prisma.publicKey.deleteMany({ where: { userId: payload.userId } });
        console.log(`[consumer] borradas ${r.count} llaves de userId=${payload.userId}`);
      } else if (routingKey === 'auth.revocacion_confirmada') {
        const r = await prisma.publicKey.updateMany({
          where: { userId: payload.userId, revocada: false },
          data: { revocada: true, revokedAt: new Date() },
        });
        console.log(`[consumer] revocadas ${r.count} llaves de userId=${payload.userId}`);
      }
    },
  );
}
