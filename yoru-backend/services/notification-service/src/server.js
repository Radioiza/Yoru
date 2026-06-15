import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { connectBroker } from './broker.js';
import { registrarConsumers } from './consumers.js';
import { obtenerHistorial } from './notifier.js';
import { initSms } from './sms.js';

const app = Fastify({ logger: { level: 'warn' } }); // menos ruido, el notifier ya imprime

await app.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
});

app.get('/health', async () => ({
  ok: true,
  service: 'notification-service',
  uptime: process.uptime(),
  notificaciones: obtenerHistorial().length,
}));

// Endpoint de inspección: ver las últimas notificaciones procesadas.
app.get('/notifications', async (request) => {
  const { canal, severidad, limit } = request.query;
  let lista = obtenerHistorial();
  if (canal)     lista = lista.filter((n) => n.canal === canal);
  if (severidad) lista = lista.filter((n) => n.severidad === severidad);
  if (limit)     lista = lista.slice(0, Number(limit));
  return { ok: true, total: lista.length, notificaciones: lista };
});

await initSms();

// Registramos los consumers SIEMPRE: subscribe() recuerda la suscripcion y la
// re-aplica en cuanto el broker conecte (o reconecte), aunque RabbitMQ aun no
// este listo en este momento.
await connectBroker(process.env.RABBITMQ_URL);
await registrarConsumers();

const port = Number(process.env.PORT ?? 3005);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await app.listen({ port, host });
  console.log(`notification-service escuchando en http://${host}:${port}`);
} catch (err) {
  console.error(err);
  process.exit(1);
}

const shutdown = async (signal) => {
  console.log(`recibí ${signal}, cerrando…`);
  await app.close();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
