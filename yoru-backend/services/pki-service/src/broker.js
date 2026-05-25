import amqp from 'amqplib';

let channel = null;

export async function connectBroker(url) {
  try {
    const conn = await amqp.connect(url);
    channel = await conn.createChannel();
    await channel.assertExchange('yoru.events', 'topic', { durable: true });
    console.log('[broker] conectado a RabbitMQ');
    return channel;
  } catch (err) {
    console.warn('[broker] no se pudo conectar:', err.message);
    return null;
  }
}

export function publishEvent(routingKey, payload) {
  if (!channel) {
    console.log(`[broker] (offline) evento ${routingKey}:`, payload);
    return;
  }
  const body = Buffer.from(JSON.stringify(payload));
  channel.publish('yoru.events', routingKey, body, { persistent: true });
  console.log(`[broker] publicado ${routingKey}`);
}
