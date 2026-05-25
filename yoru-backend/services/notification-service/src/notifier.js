import nodemailer from 'nodemailer';

const MAIL_FROM = process.env.MAIL_FROM ?? 'noreply@yoru.mx';

// --- transporte ---
let transport;
if (process.env.MAIL_TRANSPORT === 'smtp') {
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  console.log('[notifier] usando transporte SMTP real:', process.env.SMTP_HOST);
} else {
  transport = nodemailer.createTransport({ jsonTransport: true });
  console.log('[notifier] usando jsonTransport (sin envío real)');
}

// --- buffer en memoria para demo / inspección ---
const MAX_HISTORIAL = 100;
const historial = [];

export function obtenerHistorial() {
  return historial.slice().reverse(); // más recientes primero
}

/**
 * Envía la notificación: imprime con formato bonito y la guarda en historial.
 * En jsonTransport, también muestra cómo se vería el correo serializado.
 */
export async function enviar(notificacion) {
  const { routingKey, payload, asunto, cuerpo, canal, severidad } = notificacion;

  const destinatario = payload.userId
    ? `usuario:${payload.userId.slice(0, 8)}…`
    : 'sistema';

  const tag = etiquetaSeveridad(severidad);
  const fecha = new Date().toISOString();

  console.log('');
  console.log(`──── ${tag} [${canal.toUpperCase()}] ${routingKey} ────`);
  console.log(`Fecha:    ${fecha}`);
  console.log(`Para:     ${destinatario}`);
  console.log(`Asunto:   ${asunto}`);
  console.log('');
  cuerpo.split('\n').forEach((linea) => console.log(`  ${linea}`));
  console.log('────────────────────────────────────────────────────');

  try {
    const info = await transport.sendMail({
      from: MAIL_FROM,
      to: destinatario,
      subject: asunto,
      text: cuerpo,
    });
    if (process.env.MAIL_TRANSPORT === 'smtp') {
      console.log(`[notifier] correo enviado: ${info.messageId}`);
    }
  } catch (err) {
    console.error('[notifier] fallo enviando correo:', err.message);
  }

  historial.push({ ...notificacion, fecha, destinatario });
  if (historial.length > MAX_HISTORIAL) historial.shift();
}

function etiquetaSeveridad(s) {
  switch (s) {
    case 'critical': return '🚨 CRITICAL';
    case 'warn':     return '⚠️  WARN    ';
    default:         return 'ℹ️  INFO    ';
  }
}
