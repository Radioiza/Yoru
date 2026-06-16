import { prisma } from './prisma.js';
import { subscribe } from './broker.js';
import { deleteUsuarioObjetos } from './s3.js';

export async function registrarConsumers() {
  await subscribe('kyc.queue', ['auth.user_deleted'], async (routingKey, payload) => {
    console.log(`[consumer] ${routingKey}`, payload);
    if (routingKey !== 'auth.user_deleted') return;

    const req = await prisma.kycRequest.findUnique({ where: { userId: payload.userId } });
    if (!req) return;

    // Borra TODA la carpeta del usuario en MinIO (ine/, selfies/, foto-perfil/).
    try {
      const n = await deleteUsuarioObjetos([req.refIneS3, req.refSelfieS3, req.refFotoPerfilS3]);
      console.log(`[consumer] ${n} objeto(s) MinIO borrados de ${payload.userId}`);
    } catch (err) {
      console.warn(`[consumer] no pude borrar objetos S3 de ${payload.userId}:`, err.message);
    }
    await prisma.kycRequest.delete({ where: { userId: payload.userId } });
    console.log(`[consumer] KYC de ${payload.userId} purgado.`);
  });
}
