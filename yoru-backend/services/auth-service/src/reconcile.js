import { prisma } from './prisma.js';
import { publishEvent } from './broker.js';

/**
 * Reconciliador de borrados.
 *
 * El cascade normal se dispara con el evento auth.user_deleted cuando un
 * usuario se borra a traves de la app (endpoint DELETE, rollback, cancelacion
 * o expiracion de draft). Pero si alguien borra una fila de "users" DIRECTAMENTE
 * en la base de datos (por ejemplo desde Prisma Studio), ese evento nunca se
 * emite y los datos quedarian huerfanos en pki/kyc/telecom.
 *
 * Cada INTERVAL_MS este job pregunta a cada servicio downstream que userIds
 * tiene registrados, y para cualquiera que YA NO exista en la tabla users de
 * auth, emite auth.user_deleted para que se purgue en cascada.
 */
const INTERVAL_MS = 2 * 60 * 1000; // cada 2 minutos

const PKI_URL     = process.env.PKI_URL     ?? 'http://localhost:3002';
const KYC_URL     = process.env.KYC_URL     ?? 'http://localhost:3003';
const TELECOM_URL = process.env.TELECOM_URL ?? 'http://localhost:3004';

async function userIdsDe(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.userIds) ? d.userIds : [];
  } catch {
    return [];
  }
}

export function arrancarReconciliador() {
  const tick = async () => {
    try {
      const [pki, kyc, telecom] = await Promise.all([
        userIdsDe(`${PKI_URL}/api/pki/user-ids`),
        userIdsDe(`${KYC_URL}/api/kyc/user-ids`),
        userIdsDe(`${TELECOM_URL}/api/telecom/user-ids`),
      ]);

      const referidos = [...new Set([...pki, ...kyc, ...telecom])];
      if (referidos.length === 0) return;

      // Cuales de esos userId ya NO existen en la tabla users.
      const existentes = await prisma.user.findMany({
        where: { id: { in: referidos } },
        select: { id: true },
      });
      const vivos = new Set(existentes.map((u) => u.id));
      const huerfanos = referidos.filter((id) => !vivos.has(id));

      for (const userId of huerfanos) {
        publishEvent('auth.user_deleted', { userId, motivo: 'reconciliacion_huerfano' });
      }
      if (huerfanos.length > 0) {
        console.log(`[reconcile] ${huerfanos.length} usuario(s) huerfano(s) -> cascada emitida`);
      }
    } catch (err) {
      console.warn('[reconcile] error:', err.message);
    }
  };
  setTimeout(tick, 20_000);
  setInterval(tick, INTERVAL_MS);
}
