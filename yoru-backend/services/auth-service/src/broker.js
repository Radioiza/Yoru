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
    console.warn('[broker] el servicio sigue funcionando sin eventos');
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

export async function subscribe(queueName, routingKeys, handler) {
  if (!channel) {
    console.warn('[broker] no hay canal, no se puede suscribir.');
    return;
  }
  await channel.assertQueue(queueName, { durable: true });
  for (const key of routingKeys) {
    await channel.bindQueue(queueName, 'yoru.events', key);
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
