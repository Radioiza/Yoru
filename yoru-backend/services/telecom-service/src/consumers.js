import { prisma } from './prisma.js';
import { subscribe, publishEvent } from './broker.js';

/**
 * Consumidores de eventos del bus.
 *
 *  - kyc.completed         → activa la línea
 *  - pki.new_key_attempt   → evalúa kill switch automático
 */
export async function registrarConsumers() {
  await subscribe(
    'telecom.queue',
    ['kyc.completed', 'pki.new_key_attempt'],
    async (routingKey, payload) => {
      console.log(`[consumer] ${routingKey}`, payload);

      if (routingKey === 'kyc.completed') {
        await onKycCompleted(payload);
      } else if (routingKey === 'pki.new_key_attempt') {
        await onNewKeyAttempt(payload);
      }
    }
  );
}

async function onKycCompleted({ userId, aprobado }) {
  if (!aprobado) return;
  const linea = await prisma.linea.findFirst({ where: { userId } });
  if (!linea) {
    console.warn(`[consumer] kyc.completed sin línea para userId=${userId}`);
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
  console.log(`[consumer] línea ${linea.telefono} activada por KYC aprobado.`);
}

async function onNewKeyAttempt({ userId, previousKeyId, ip, userAgent }) {
  // Regla simple: si ya había una llave previa y aparece un intento nuevo,
  // activamos kill switch automático y dejamos rastro.
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

  console.log(`[consumer] kill switch automático en ${linea.telefono}.`);
}
