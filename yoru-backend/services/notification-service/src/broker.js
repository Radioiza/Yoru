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

/**
 * Se suscribe a una cola y la enlaza a los routing keys dados en el exchange.
 * Cada mensaje se entrega al handler ya parseado como JSON.
 */
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
