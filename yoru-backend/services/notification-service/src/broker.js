import amqp from 'amqplib';

const EXCHANGE = 'yoru.events';
const RECONNECT_MS = 3000;

let channel = null;
let conectando = false;
let urlGuardada = null;

// Suscripciones registradas; se re-aplican tras cada reconexion para que el
// consumidor de correos siga vivo aunque RabbitMQ se reinicie.
const suscripciones = [];

export async function connectBroker(url) {
  urlGuardada = url ?? urlGuardada;
  if (conectando) return channel;
  conectando = true;
  try {
    const conn = await amqp.connect(urlGuardada);
    conn.on('error', (err) => console.warn('[broker] conexion error:', err.message));
    conn.on('close', () => {
      console.warn(`[broker] conexion cerrada, reintentando en ${RECONNECT_MS / 1000}s…`);
      channel = null;
      conectando = false;
      setTimeout(() => connectBroker(urlGuardada), RECONNECT_MS);
    });
    channel = await conn.createChannel();
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    console.log('[broker] conectado a RabbitMQ');
    conectando = false;
    for (const s of suscripciones) await aplicarSuscripcion(s);
    return channel;
  } catch (err) {
    console.warn(`[broker] no se pudo conectar: ${err.message} — reintentando en ${RECONNECT_MS / 1000}s`);
    channel = null;
    conectando = false;
    setTimeout(() => connectBroker(urlGuardada), RECONNECT_MS);
    return null;
  }
}

async function aplicarSuscripcion({ queueName, routingKeys, handler }) {
  if (!channel) return;
  await channel.assertQueue(queueName, { durable: true });
  for (const key of routingKeys) {
    await channel.bindQueue(queueName, EXCHANGE, key);
  }
  channel.consume(queueName, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      await handler(msg.fields.routingKey, payload);
      channel.ack(msg);
    } catch (err) {
      console.error('[broker] error procesando mensaje:', err);
      channel.nack(msg, false, false);
    }
  });
  console.log(`[broker] suscrito a ${routingKeys.join(', ')} en cola ${queueName}`);
}

/**
 * Se suscribe a una cola y la enlaza a los routing keys dados. La suscripcion
 * se recuerda para re-aplicarla automaticamente tras una reconexion.
 */
export async function subscribe(queueName, routingKeys, handler) {
  if (!suscripciones.find((s) => s.queueName === queueName)) {
    suscripciones.push({ queueName, routingKeys, handler });
  }
  if (channel) await aplicarSuscripcion({ queueName, routingKeys, handler });
  else console.warn(`[broker] sin canal aun; "${queueName}" se suscribira al reconectar.`);
}
