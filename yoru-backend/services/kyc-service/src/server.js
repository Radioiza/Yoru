import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import kycRoutes from './routes/kyc.js';
import { connectBroker } from './broker.js';
import { prisma } from './prisma.js';
import { bootstrapBucket } from './s3.js';

const app = Fastify({ logger: { level: 'info' } });

await app.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
});

app.get('/health', async () => ({
  ok: true,
  service: 'kyc-service',
  uptime: process.uptime(),
}));

await app.register(kycRoutes, { prefix: '/api/kyc' });

await connectBroker(process.env.RABBITMQ_URL);
await bootstrapBucket();

const port = Number(process.env.PORT ?? 3003);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  app.log.info(`kyc-service escuchando en http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  await prisma.$disconnect();
  process.exit(1);
}

const shutdown = async (signal) => {
  app.log.info(`recibí ${signal}, cerrando…`);
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
