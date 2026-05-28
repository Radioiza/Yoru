import { prisma } from './prisma.js';
import { publishEvent } from './broker.js';

/**
 * Cada 5 minutos, borra drafts (users con committed=false) mas viejos de 30 min.
 * Emite auth.user_deleted para que kyc/pki/telecom limpien lo que haya quedado.
 */
const TTL_MS = 30 * 60 * 1000;
const INTERVAL_MS = 5 * 60 * 1000;

export function arrancarCleanup() {
  const tick = async () => {
    try {
      const limite = new Date(Date.now() - TTL_MS);
      const viejos = await prisma.user.findMany({
        where: { committed: false, createdAt: { lt: limite } },
        select: { id: true },
      });
      if (viejos.length === 0) return;
      for (const u of viejos) {
        await prisma.user.delete({ where: { id: u.id } }).catch(() => {});
        publishEvent('auth.user_deleted', { userId: u.id, motivo: 'draft_expirado' });
      }
      console.log(`[cleanup] purgados ${viejos.length} drafts`);
    } catch (err) {
      console.warn('[cleanup] error:', err.message);
    }
  };
  setTimeout(tick, 10_000);
  setInterval(tick, INTERVAL_MS);
}
