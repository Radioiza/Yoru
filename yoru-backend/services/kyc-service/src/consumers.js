import { prisma } from './prisma.js';
import { subscribe } from './broker.js';
import { deleteObject } from './s3.js';

export async function registrarConsumers() {
  await subscribe('kyc.queue', ['auth.user_deleted'], async (routingKey, payload) => {
    console.log(`[consumer] ${routingKey}`, payload);
    if (routingKey !== 'auth.user_deleted') return;

    const req = await prisma.kycRequest.findUnique({ where: { userId: payload.userId } });
    if (!req) return;

    for (const key of [req.refIneS3, req.refSelfieS3, req.refFotoPerfilS3]) {
      if (!key) continue;
      try { await deleteObject(key); } catch (err) {
        console.warn(`[consumer] no pude borrar S3 ${key}:`, err.message);
      }
    }
    await prisma.kycRequest.delete({ where: { userId: payload.userId } });
    console.log(`[consumer] KYC de ${payload.userId} purgado.`);
  });
}
