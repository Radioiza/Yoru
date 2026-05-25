import { subscribe } from './broker.js';
import { renderizar } from './templates.js';
import { enviar } from './notifier.js';

/**
 * Se suscribe a todos los eventos del exchange "yoru.events" usando
 * el wildcard "#" (matches everything). Para cada evento, busca la
 * plantilla correspondiente y dispara una notificación.
 *
 * Si llega un evento sin plantilla registrada, lo loguea como "ignorado"
 * para que sea fácil ver qué hace falta añadir.
 */
export async function registrarConsumers() {
  await subscribe('notification.queue', ['#'], async (routingKey, payload) => {
    const notificacion = renderizar(routingKey, payload);

    if (!notificacion) {
      console.log(`[consumer] evento sin plantilla, ignorado: ${routingKey}`);
      return;
    }

    await enviar(notificacion);
  });
}
