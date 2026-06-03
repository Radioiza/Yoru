/**
 * Transporte de SMS reales. Soporta dos proveedores, elegidos con SMS_TRANSPORT:
 *
 *   SMS_TRANSPORT=traccar  -> tu propio Android con la app "Traccar SMS Gateway"
 *                             (GRATIS, el SMS sale de TU SIM). Recomendada porque
 *                             esta facil de encontrar en Play Store.
 *   SMS_TRANSPORT=android  -> tu propio Android con la app "SMS Gateway for
 *                             Android" (sms-gate.app) en modo Local Server.
 *   SMS_TRANSPORT=twilio   -> Twilio (proveedor en la nube, de pago/trial).
 *   (sin definir)          -> modo CONSOLA: el codigo solo se imprime en la
 *                             terminal (comportamiento por defecto del demo).
 *
 * El servicio NUNCA se cae por esta configuracion: si faltan datos o la
 * libreria, cae a modo consola.
 *
 * Variables (ver .env.example):
 *   --- Traccar SMS Gateway ---
 *   SMS_TRANSPORT=traccar
 *   TRACCAR_SMS_URL=http://192.168.1.50:8082/   (la IP que muestra la app, puerto 8082)
 *   TRACCAR_SMS_KEY=...         (la API key que genera la app)
 *
 *   --- Android (sms-gate.app, Local Server) ---
 *   SMS_TRANSPORT=android
 *   ANDROID_SMS_URL=http://192.168.1.50:8080/message   (la IP que muestra la app)
 *   ANDROID_SMS_USER=...        (usuario del Local Server)
 *   ANDROID_SMS_PASSWORD=...    (password del Local Server)
 *
 *   --- Twilio ---
 *   SMS_TRANSPORT=twilio
 *   TWILIO_ACCOUNT_SID=ACxxxx
 *   TWILIO_AUTH_TOKEN=xxxx
 *   TWILIO_FROM=+15555555555   (o TWILIO_MESSAGING_SERVICE_SID=MGxxxx)
 *
 *   --- comun ---
 *   SMS_COUNTRY_CODE=+52       (prefijo pais por defecto; Mexico)
 */

const SMS_COUNTRY_CODE = process.env.SMS_COUNTRY_CODE ?? '+52';

let proveedor = null; // 'android' | 'twilio' | null

// Twilio
let twilioClient = null;
let twilioFrom = null;
let twilioMessagingServiceSid = null;

// Android (sms-gate.app local server)
let androidUrl = null;
let androidAuthHeader = null;

// Traccar SMS Gateway
let traccarUrl = null;
let traccarKey = null;

/** Inicializa el proveedor de SMS si hay credenciales. Llamar al arrancar. */
export async function initSms() {
  const transporte = process.env.SMS_TRANSPORT;

  console.log('');
  console.log('=================================================================');
  console.log('  notification-service - diagnostico de configuracion de SMS');
  console.log('=================================================================');
  console.log(`  SMS_TRANSPORT  = "${transporte ?? '(no definido)'}"`);

  if (transporte === 'traccar') {
    await initTraccar();
  } else if (transporte === 'android') {
    await initAndroid();
  } else if (transporte === 'twilio') {
    await initTwilio();
  } else {
    console.log('  Modo: CONSOLA (el codigo SMS solo se imprime en la terminal).');
    console.log('  Para enviar SMS reales: define SMS_TRANSPORT=android o =twilio en .env');
  }

  console.log('=================================================================');
  console.log('');
}

async function initTraccar() {
  traccarUrl = process.env.TRACCAR_SMS_URL ?? null;
  traccarKey = process.env.TRACCAR_SMS_KEY ?? null;

  console.log(`  TRACCAR_SMS_URL   = "${traccarUrl ?? '(no definido)'}"`);
  console.log(`  TRACCAR_SMS_KEY   = ${traccarKey ? '(definido)' : '(no definido)'}`);
  console.log(`  SMS_NUMBER_FORMAT = "${SMS_NUMBER_FORMAT}" (national = 10 digitos)`);

  if (!traccarUrl || !traccarKey) {
    console.log('  [X] Faltan datos del gateway Traccar. Se queda en modo CONSOLA.');
    traccarUrl = null;
    return;
  }

  proveedor = 'traccar';
  console.log('  [OK] Gateway Traccar activado. Los SMS saldran de tu telefono.');
}

async function initAndroid() {
  androidUrl = process.env.ANDROID_SMS_URL ?? null;
  const user = process.env.ANDROID_SMS_USER ?? null;
  const pass = process.env.ANDROID_SMS_PASSWORD ?? null;

  console.log(`  ANDROID_SMS_URL      = "${androidUrl ?? '(no definido)'}"`);
  console.log(`  ANDROID_SMS_USER     = "${user ?? '(no definido)'}"`);
  console.log(`  ANDROID_SMS_PASSWORD = ${pass ? '(definido)' : '(no definido)'}`);
  console.log(`  SMS_NUMBER_FORMAT    = "${SMS_NUMBER_FORMAT}" (national = 10 digitos)`);

  if (!androidUrl || !user || !pass) {
    console.log('  [X] Faltan datos del gateway Android. Se queda en modo CONSOLA.');
    androidUrl = null;
    return;
  }

  androidAuthHeader = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
  proveedor = 'android';
  console.log('  [OK] Gateway Android activado. Los SMS saldran de tu telefono.');
}

async function initTwilio() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const tok = process.env.TWILIO_AUTH_TOKEN;
  twilioFrom = process.env.TWILIO_FROM ?? null;
  twilioMessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID ?? null;

  console.log(`  TWILIO_ACCOUNT_SID = ${sid ? sid.slice(0, 6) + '…' : '(no definido)'}`);
  console.log(`  TWILIO_AUTH_TOKEN  = ${tok ? '(definido)' : '(no definido)'}`);
  console.log(`  TWILIO_FROM        = "${twilioFrom ?? '(no definido)'}"`);
  console.log(`  MESSAGING_SERVICE  = "${twilioMessagingServiceSid ?? '(no definido)'}"`);
  console.log(`  SMS_COUNTRY_CODE   = "${SMS_COUNTRY_CODE}"`);

  if (!sid || !tok || (!twilioFrom && !twilioMessagingServiceSid)) {
    console.log('  [X] Faltan credenciales Twilio. Se queda en modo CONSOLA.');
    return;
  }

  try {
    const { default: twilio } = await import('twilio');
    twilioClient = twilio(sid, tok);
    proveedor = 'twilio';
    console.log('  [OK] Twilio activado. Los SMS se enviaran de verdad.');
  } catch (err) {
    console.error('  [X] No se pudo cargar la libreria "twilio":', err.message);
    console.error('      Ejecuta:  npm install twilio   en notification-service.');
  }
}

export function smsHabilitado() {
  return proveedor !== null;
}

/**
 * Normaliza un telefono a formato E.164 (+<pais><numero>).
 * Acepta 10 digitos (MX) o un numero que ya venga con prefijo "+".
 */
export function aE164(telefono) {
  const t = String(telefono ?? '').trim();
  if (t.startsWith('+')) return t;
  const digits = t.replace(/\D/g, '');
  return `${SMS_COUNTRY_CODE}${digits}`;
}

/**
 * Numero en formato NACIONAL (solo digitos, sin prefijo de pais). Muchos
 * operadores moviles (ej. en Mexico) NO entregan SMS locales si el numero va
 * en formato internacional "+52...", pero si los entregan a 10 digitos. Por eso
 * los gateways que usan la SIM local (Android/Traccar) envian en nacional.
 * Si el numero trae el prefijo de pais, se lo quitamos.
 */
export function aNacional(telefono) {
  let d = String(telefono ?? '').replace(/\D/g, '');
  const cc = SMS_COUNTRY_CODE.replace(/\D/g, ''); // p.ej. "52"
  if (cc && d.length > 10 && d.startsWith(cc)) d = d.slice(cc.length);
  return d;
}

// Formato de numero para los gateways que usan la SIM local (android/traccar):
//   'national' (default) -> 10 digitos        | 'e164' -> +52...
const SMS_NUMBER_FORMAT = (process.env.SMS_NUMBER_FORMAT ?? 'national').toLowerCase();

function paraGatewayLocal(telefono) {
  return SMS_NUMBER_FORMAT === 'e164' ? aE164(telefono) : aNacional(telefono);
}

/** Envia un SMS real con el proveedor activo. Devuelve { enviado, id?, to?, error? }. */
export async function enviarSms({ to, body }) {
  // Twilio exige E.164; los gateways de SIM local usan el formato configurado
  // (nacional por defecto, porque el operador suele rechazar el +52 local).
  if (proveedor === 'traccar') return enviarTraccar(paraGatewayLocal(to), body);
  if (proveedor === 'android') return enviarAndroid(paraGatewayLocal(to), body);
  if (proveedor === 'twilio')  return enviarTwilio(aE164(to), body);
  return { enviado: false, to, error: 'sms deshabilitado' };
}

async function enviarTraccar(dest, body) {
  try {
    const r = await fetch(traccarUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: traccarKey },
      body: JSON.stringify({ to: dest, message: body }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return { enviado: false, to: dest, error: `gateway respondio ${r.status}: ${t}` };
    }
    return { enviado: true, id: null, to: dest };
  } catch (err) {
    return { enviado: false, to: dest, error: err.message };
  }
}

async function enviarAndroid(dest, body) {
  try {
    const r = await fetch(androidUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: androidAuthHeader },
      body: JSON.stringify({ textMessage: { text: body }, phoneNumbers: [dest] }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return { enviado: false, to: dest, error: `gateway respondio ${r.status}: ${data.message ?? ''}` };
    }
    return { enviado: true, id: data.id ?? null, to: dest };
  } catch (err) {
    return { enviado: false, to: dest, error: err.message };
  }
}

async function enviarTwilio(dest, body) {
  try {
    const opciones = { to: dest, body };
    if (twilioMessagingServiceSid) opciones.messagingServiceSid = twilioMessagingServiceSid;
    else opciones.from = twilioFrom;
    const msg = await twilioClient.messages.create(opciones);
    return { enviado: true, id: msg.sid, to: dest };
  } catch (err) {
    return { enviado: false, to: dest, error: err.message };
  }
}
