import amqp from 'amqplib';

const EXCHANGE = 'yoru.events';
const RECONNECT_MS = 3000;

let channel = null;
let conectando = false;
let urlGuardada = null;

// Suscripciones registradas; se re-aplican tras cada reconexion.
const suscripciones = [];

/**
 * Conecta al broker y se mantiene reconectando solo. A diferencia de la
 * version anterior, si RabbitMQ no esta listo (o se cae despues) NO se rinde:
 * reintenta cada pocos segundos. Asi los eventos dejan de perderse en silencio
 * cuando el servicio arranca antes que RabbitMQ o el broker se reinicia.
 */
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

/**
 * Publica un evento. Devuelve true si se publico, false si el broker estaba
 * offline. Quien llama puede decidir si avisar al usuario o registrar el fallo.
 */
export function publishEvent(routingKey, payload) {
  if (!channel) {
    console.warn(`[broker] (offline) evento ${routingKey} NO publicado — sin conexion a RabbitMQ`);
    return false;
  }
  try {
    const body = Buffer.from(JSON.stringify(payload));
    channel.publish(EXCHANGE, routingKey, body, { persistent: true });
    console.log(`[broker] publicado ${routingKey}`);
    return true;
  } catch (err) {
    console.error(`[broker] fallo publicando ${routingKey}:`, err.message);
    return false;
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

export async function subscribe(queueName, routingKeys, handler) {
  if (!suscripciones.find((s) => s.queueName === queueName)) {
    suscripciones.push({ queueName, routingKeys, handler });
  }
  if (channel) await aplicarSuscripcion({ queueName, routingKeys, handler });
  else console.warn(`[broker] sin canal aun; "${queueName}" se suscribira al reconectar.`);
}
