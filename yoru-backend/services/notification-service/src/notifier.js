import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';
import { smsHabilitado, enviarSms } from './sms.js';

const MAIL_FROM = process.env.MAIL_FROM ?? 'noreply@yoru.mx';

// ====================== DIAGNOSTICO AL ARRANCAR ======================
console.log('');
console.log('=================================================================');
console.log('  notification-service - diagnostico de configuracion de correo');
console.log('=================================================================');
const envPath = path.resolve(process.cwd(), '.env');
console.log(`  cwd:           ${process.cwd()}`);
console.log(`  .env esperado: ${envPath}`);
console.log(`  .env existe:   ${fs.existsSync(envPath) ? 'SI' : 'NO (no se cargara nada)'}`);
console.log(`  MAIL_TRANSPORT = "${process.env.MAIL_TRANSPORT ?? '(no definido)'}"`);
console.log(`  SMTP_HOST      = "${process.env.SMTP_HOST ?? '(no definido)'}"`);
console.log(`  SMTP_PORT      = "${process.env.SMTP_PORT ?? '(no definido)'}"`);
console.log(`  SMTP_USER      = "${process.env.SMTP_USER ?? '(no definido)'}"`);
console.log(`  SMTP_PASS      = ${process.env.SMTP_PASS ? '(definido, ' + process.env.SMTP_PASS.length + ' chars)' : '(no definido)'}`);
console.log(`  MAIL_FROM      = "${process.env.MAIL_FROM ?? '(usara noreply@yoru.mx)'}"`);
console.log('=================================================================');
console.log('');
// =====================================================================

// --- transporte ---
let transport;
let modoSMTP = false;
if (process.env.MAIL_TRANSPORT === 'smtp') {
  const port = Number(process.env.SMTP_PORT ?? 587);
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // true para SSL puro (465), false para STARTTLS (587, 25)
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  modoSMTP = true;
  console.log(`[notifier] modo SMTP real: ${process.env.SMTP_HOST}:${port} (from ${MAIL_FROM})`);

  // verify() hace handshake con el servidor SMTP al arrancar; si las
  // credenciales o el host estan mal, lo dice de inmediato.
  transport.verify()
    .then(() => console.log('[notifier] ✓ conexion SMTP verificada. Listo para enviar.'))
    .catch((err) => {
      console.error('[notifier] ✗ verify() fallo:', err.message);
      if (err.response) console.error('[notifier]   respuesta servidor:', err.response);
      console.error('[notifier]   los correos NO se enviaran hasta arreglar esto.');
    });
} else {
  transport = nodemailer.createTransport({ jsonTransport: true });
  console.log('[notifier] modo jsonTransport (sin envio real).');
  console.log('[notifier] Para enviar correos reales: crea yoru-backend/services/notification-service/.env');
  console.log('[notifier] con MAIL_TRANSPORT=smtp + credenciales (ver .env.example).');
}

// Regex sencillo para validar que el destinatario parece un correo.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- buffer en memoria para inspeccion ---
const MAX_HISTORIAL = 100;
const historial = [];

export function obtenerHistorial() {
  return historial.slice().reverse();
}

export async function enviar(notificacion) {
  const { routingKey, payload, asunto, cuerpo, canal, severidad } = notificacion;

  const destinatario = payload.email
    ? payload.email
    : payload.telefono
      ? `tel:${payload.telefono}`
      : payload.userId
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

  // --- Canal SMS: si es una notificacion 'sms' con telefono, intentamos Twilio ---
  if (canal === 'sms' && payload.telefono) {
    if (smsHabilitado()) {
      const res = await enviarSms({ to: payload.telefono, body: cuerpo });
      if (res.enviado) {
        console.log(`[notifier] ✓ SMS enviado a ${res.to} (id ${res.id ?? '—'})`);
      } else {
        console.error(`[notifier] ✗ fallo enviando SMS a ${res.to ?? payload.telefono}:`, res.error);
      }
    } else {
      console.log(`[notifier] (SMS en modo consola: codigo visible arriba para ${payload.telefono})`);
    }
  }

  // --- Canal correo: solo intentamos SMTP real si estamos en modo SMTP y el
  //     destinatario es una direccion de correo valida. ---
  const debeEnviar = modoSMTP && EMAIL_REGEX.test(destinatario);
  if (debeEnviar) {
    try {
      const info = await transport.sendMail({
        from: MAIL_FROM,
        to: destinatario,
        subject: asunto,
        text: cuerpo,
      });
      console.log(`[notifier] ✓ correo enviado a ${destinatario} (id ${info.messageId})`);
    } catch (err) {
      console.error(`[notifier] ✗ fallo enviando a ${destinatario}:`, err.message);
      if (err.response) console.error('[notifier] respuesta servidor:', err.response);
    }
  } else if (modoSMTP && canal !== 'sms') {
    console.log(`[notifier] (skip SMTP: destinatario "${destinatario}" no es un email)`);
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
