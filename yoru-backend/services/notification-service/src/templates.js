/**
 * Catálogo de plantillas: una por cada routing key que nos interesa.
 *
 * Cada plantilla recibe el payload del evento y devuelve:
 *   { canal, severidad, asunto, cuerpo }
 *
 * canal:     'email' | 'sms' | 'push'  (informativo, todo se loguea igual)
 * severidad: 'info' | 'warn' | 'critical'
 */
export const TEMPLATES = {

  'auth.email_verification': (p) => ({
    canal: 'email',
    severidad: 'info',
    asunto: '🔐 Tu codigo de verificacion Yoru',
    cuerpo:
      `Hola, gracias por registrarte en Yoru.\n\n` +
      `Tu codigo de verificacion es:\n\n` +
      `        ${p.codigo}\n\n` +
      `Valido 5 minutos. Ingresalo en la pantalla de la app.\n` +
      `Si no fuiste tu, ignora este mensaje.`,
  }),

  'auth.sms_verificacion': (p) => ({
    canal: 'sms',
    severidad: 'info',
    asunto: '📲 Código para vincular tu línea Yoru',
    // SMS de UNA sola linea corta: algunos gateways de SIM local (Traccar) no
    // entregan mensajes largos/multilinea aunque el HTTP responda 200. Mantener
    // el cuerpo breve (~60 chars, una linea) garantiza la entrega.
    cuerpo: `Yoru: tu codigo para vincular tu linea es ${p.codigo}. Valido 5 min.`,
  }),

  'auth.password_reset_codigo': (p) => ({
    canal: 'email',
    severidad: 'critical',
    asunto: '🔑 Código para restablecer tu contraseña Yoru',
    cuerpo:
      `Hola, recibimos una solicitud para restablecer tu contraseña.\n\n` +
      `Tu codigo es:\n\n` +
      `        ${p.codigo}\n\n` +
      `Valido 10 minutos. Ingresalo en la pantalla de recuperacion.\n` +
      `Si no fuiste tu, ignora este mensaje: tu contraseña no cambiara.`,
  }),

  'auth.user_created': (p) => ({
    canal: 'email',
    severidad: 'info',
    asunto: '¡Bienvenido a Yoru!',
    cuerpo:
      `Hola, tu cuenta fue creada correctamente.\n` +
      `Teléfono: ${p.telefono}\n` +
      `CURP: ${p.curp}\n\n` +
      `Continúa con la verificación de identidad para activar tu línea.`,
  }),

  'kyc.completed': (p) => ({
    canal: 'email',
    severidad: 'info',
    asunto: '✅ Tu identidad fue verificada',
    cuerpo:
      `Tu solicitud KYC fue aprobada con un score de ${p.scoreMatch ?? 'N/A'}.\n` +
      `Tu línea quedará activa en breve.`,
  }),

  'kyc.rejected': (p) => ({
    canal: 'email',
    severidad: 'warn',
    asunto: '❌ Solicitud KYC rechazada',
    cuerpo:
      `Tu solicitud KYC fue rechazada.\n` +
      `Motivo: ${p.motivoRechazo ?? 'sin especificar'}\n\n` +
      `Puedes intentarlo de nuevo con documentos más claros.`,
  }),

  'pki.key_registered': (p) => ({
    canal: 'email',
    severidad: 'info',
    asunto: '🔐 Nueva llave criptográfica registrada',
    cuerpo:
      `Se registró una nueva llave en tu cuenta.\n` +
      `ID: ${p.publicKeyId}\n` +
      `Curva: ${p.curva}\n\n` +
      `Si no fuiste tú, contáctanos de inmediato.`,
  }),

  'pki.new_key_attempt': (p) => ({
    canal: 'email',
    severidad: 'critical',
    asunto: '⚠️ ALERTA: Intento de registrar nueva llave',
    cuerpo:
      `Se detectó un intento de registrar una nueva llave en tu cuenta.\n` +
      `Llave previa: ${p.previousKeyId}\n` +
      `IP: ${p.ip}\n` +
      `User-Agent: ${p.userAgent ?? 'desconocido'}\n\n` +
      `Tu línea fue suspendida preventivamente por el kill switch.`,
  }),

  'pki.key_revoked': (p) => ({
    canal: 'email',
    severidad: 'warn',
    asunto: '🔒 Llave revocada',
    cuerpo: `La llave ${p.publicKeyId} fue marcada como revocada.`,
  }),

  'auth.failed_attempt': (p) => ({
    canal: 'email',
    severidad: 'warn',
    asunto: '⚠️ Intento de autenticación fallido',
    cuerpo:
      `Se registró un intento de firma inválido en tu cuenta.\n` +
      `Motivo: ${p.motivo ?? 'desconocido'}\n\n` +
      `Si no fuiste tú, considera revocar tu llave.`,
  }),

  'auth.revocacion_codigo': (p) => ({
    canal: 'email',
    severidad: 'critical',
    asunto: '🔐 Codigo para revocar tu llave Yoru',
    cuerpo:
      `Hola, recibimos una solicitud para revocar tu llave criptografica.\n\n` +
      `Tu codigo de confirmacion es:\n\n` +
      `        ${p.codigo}\n\n` +
      `Valido por 10 minutos. Si no fuiste tu, ignora este mensaje\n` +
      `y considera cambiar tus credenciales del dispositivo.`,
  }),

  'auth.revocacion_confirmada': (p) => ({
    canal: 'email',
    severidad: 'warn',
    asunto: '🔒 Llave revocada con exito',
    cuerpo:
      `Tu llave fue revocada y todas tus lineas telefonicas fueron\n` +
      `desvinculadas. Si quieres seguir usando Yoru, genera un nuevo\n` +
      `par de llaves desde la aplicacion.`,
  }),

  'telecom.kill_switch_activado': (p) => ({
    canal: 'sms',
    severidad: 'critical',
    asunto: '🚨 Tu línea fue bloqueada',
    cuerpo:
      `Tu línea ${p.telefono} fue bloqueada (kill switch).\n` +
      `Motivo: ${p.motivo}\n\n` +
      `Contacta a soporte para restaurarla.`,
  }),
};

export function renderizar(routingKey, payload) {
  const template = TEMPLATES[routingKey];
  if (!template) return null;
  return { ...template(payload), routingKey, payload };
}
