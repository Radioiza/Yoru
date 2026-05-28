import { prisma } from './prisma.js';
import { subscribe, publishEvent } from './broker.js';

/**
 * Consumers de telecom-service:
 *  - kyc.completed             → activa la linea
 *  - pki.new_key_attempt       → kill switch automatico
 *  - auth.user_deleted         → cascada (borra lineas)
 *  - auth.revocacion_confirmada → cascada de desvinculacion
 */
export async function registrarConsumers() {
  await subscribe(
    'telecom.queue',
    ['kyc.completed', 'pki.new_key_attempt', 'auth.user_deleted', 'auth.revocacion_confirmada'],
    async (routingKey, payload) => {
      console.log(`[consumer] ${routingKey}`, payload);

      if (routingKey === 'kyc.completed') {
        await onKycCompleted(payload);
      } else if (routingKey === 'pki.new_key_attempt') {
        await onNewKeyAttempt(payload);
      } else if (routingKey === 'auth.user_deleted') {
        const r = await prisma.linea.deleteMany({ where: { userId: payload.userId } });
        console.log(`[consumer] borradas ${r.count} lineas de userId=${payload.userId}`);
      } else if (routingKey === 'auth.revocacion_confirmada') {
        const r = await prisma.linea.deleteMany({ where: { userId: payload.userId } });
        console.log(`[consumer] desvinculadas ${r.count} lineas por revocacion de userId=${payload.userId}`);
      }
    }
  );
}

async function onKycCompleted({ userId, aprobado }) {
  if (!aprobado) return;
  const linea = await prisma.linea.findFirst({ where: { userId } });
  if (!linea) {
    console.warn(`[consumer] kyc.completed sin linea para userId=${userId}`);
    return;
  }
  await prisma.linea.update({
    where: { id: linea.id },
    data: {
      estado: 'activa',
      eventos: {
        create: { tipo: 'activada', detalle: { origen: 'kyc.completed' } },
      },
    },
  });
  console.log(`[consumer] linea ${linea.telefono} activada por KYC aprobado.`);
}

async function onNewKeyAttempt({ userId, previousKeyId, ip, userAgent }) {
  const linea = await prisma.linea.findFirst({ where: { userId } });
  if (!linea) return;

  await prisma.linea.update({
    where: { id: linea.id },
    data: {
      estado: 'kill_switched',
      eventos: {
        create: {
          tipo: 'nueva_llave_detectada',
          detalle: { previousKeyId, ip, userAgent, accion: 'kill_switch_automatico' },
        },
      },
    },
  });

  publishEvent('telecom.kill_switch_activado', {
    telefono: linea.telefono,
    userId: linea.userId,
    motivo: 'pki.new_key_attempt',
  });

  console.log(`[consumer] kill switch automatico en ${linea.telefono}.`);
}
