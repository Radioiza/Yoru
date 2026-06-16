// Cliente de los microservicios del backend Yoru.

const AUTH    = import.meta.env.VITE_AUTH_URL    ?? 'http://localhost:3001';
const PKI     = import.meta.env.VITE_PKI_URL     ?? 'http://localhost:3002';
const KYC     = import.meta.env.VITE_KYC_URL     ?? 'http://localhost:3003';
const TELECOM = import.meta.env.VITE_TELECOM_URL ?? 'http://localhost:3004';

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function postJSON(url, body, token) {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({ ok: false, error: 'Respuesta no JSON.' }));
    return { status: r.status, data };
  } catch (err) {
    return { status: 0, data: { ok: false, error: `Red: ${err.message}` } };
  }
}

async function getJSON(url, token) {
  try {
    const r = await fetch(url, { headers: { ...authHeaders(token) } });
    const data = await r.json().catch(() => ({ ok: false, error: 'Respuesta no JSON.' }));
    return { status: r.status, data };
  } catch (err) {
    return { status: 0, data: { ok: false, error: `Red: ${err.message}` } };
  }
}

async function deleteJSON(url, token) {
  try {
    const r = await fetch(url, { method: 'DELETE', headers: { ...authHeaders(token) } });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, data };
  } catch (err) {
    return { status: 0, data: { ok: false, error: `Red: ${err.message}` } };
  }
}

export const api = {
  // ===== Registro en 3 pasos: preparar + datos-pendientes + verificar-email =====
  prepararRegistro:        (body) => postJSON(`${AUTH}/api/auth/registro/preparar`, body),
  guardarDatosPendientes:  (body) => postJSON(`${AUTH}/api/auth/registro/datos-pendientes`, body),
  verificarEmailRegistro:  (body) => postJSON(`${AUTH}/api/auth/registro/verificar-email`, body),
  reenviarCodigoRegistro:  ({ draftUserId }) => postJSON(`${AUTH}/api/auth/registro/reenviar-codigo`, { draftUserId }),
  cancelarRegistro:        ({ draftUserId }) => postJSON(`${AUTH}/api/auth/registro/cancelar`, { draftUserId }),

  // ===== Login estandar =====
  login: ({ email, password }) => postJSON(`${AUTH}/api/auth/login`, { email, password }),
  me:    (token)               => getJSON(`${AUTH}/api/auth/me`, token),

  // ===== Lineas =====
  listarMisLineas: (token)               => getJSON(`${AUTH}/api/auth/lineas`, token),
  // Vincular otra linea: SMS -> confirmar -> reto -> agregar (con firma .pem).
  verificarLineaIniciar:   ({ telefono }, token)         => postJSON(`${AUTH}/api/auth/lineas/verificar/iniciar`, { telefono }, token),
  verificarLineaConfirmar: ({ telefono, codigo }, token) => postJSON(`${AUTH}/api/auth/lineas/verificar/confirmar`, { telefono, codigo }, token),
  retoLinea:               ({ telefono }, token)         => postJSON(`${AUTH}/api/auth/lineas/challenge`, { telefono }, token),
  agregarLinea: ({ telefono, challengeId, signatureB64 }, token) =>
    postJSON(`${AUTH}/api/auth/lineas/agregar`, { telefono, challengeId, signatureB64 }, token),

  // ===== Recuperacion de contrasena por codigo de correo (sin .pem) =====
  recuperarPasswordIniciar:   ({ email })                       => postJSON(`${AUTH}/api/auth/recuperar/password/iniciar`, { email }),
  recuperarPasswordConfirmar: ({ email, codigo, newPassword })  => postJSON(`${AUTH}/api/auth/recuperar/password/confirmar`, { email, codigo, newPassword }),

  // ===== Revocacion (con codigo por correo) =====
  revocarIniciar:    (token)             => postJSON(`${AUTH}/api/auth/revocar/iniciar`, {}, token),
  revocarConfirmar:  ({ codigo }, token) => postJSON(`${AUTH}/api/auth/revocar/confirmar`, { codigo }, token),

  // ===== Recuperacion (olvido password/email, usa .pem) =====
  recuperarIniciar:    ({ userId })                                => postJSON(`${AUTH}/api/auth/recuperar/iniciar`, { userId }),
  recuperarVerificar:  ({ userId, challengeId, signatureB64 })     => postJSON(`${AUTH}/api/auth/recuperar/verificar`, { userId, challengeId, signatureB64 }),
  recuperarCambiar:    ({ recoveryToken, newPassword, newEmail })  => postJSON(`${AUTH}/api/auth/recuperar/cambiar`, { recoveryToken, newPassword, newEmail }),

  borrarUsuario: ({ userId }) => deleteJSON(`${AUTH}/api/auth/users/${userId}`),

  // ===== KYC =====
  obtenerPresignedUrls: ({ userId, curp }) => postJSON(`${KYC}/api/kyc/presigned-urls`, { userId, curp }),
  verKyc:               ({ userId }) => getJSON(`${KYC}/api/kyc/requests/${userId}`),

  fotoPerfilUploadUrl: ({ userId, curp, contentType }) =>
    postJSON(`${KYC}/api/kyc/foto-perfil/presigned-url`, { userId, curp, contentType }),
  guardarFotoPerfil: ({ userId, refFotoPerfilS3 }) =>
    postJSON(`${KYC}/api/kyc/foto-perfil`, { userId, refFotoPerfilS3 }),
  fotoPerfilUrl: ({ userId }) => getJSON(`${KYC}/api/kyc/foto-perfil/${userId}`),
  selfieUrl:     ({ userId }) => getJSON(`${KYC}/api/kyc/selfie/${userId}`),

  // ===== PKI =====
  revocarLlave: ({ publicKeyId }, token) =>
    postJSON(`${PKI}/api/pki/keys/${publicKeyId}/revoke`, {}, token),

  // ===== Telecom (acciones por linea, protegidas) =====
  killSwitch:       ({ telefono, motivo }, token) =>
    postJSON(`${TELECOM}/api/telecom/lineas/${telefono}/kill-switch`, { motivo }, token),
  desbloquearLinea: ({ telefono }, token) =>
    postJSON(`${TELECOM}/api/telecom/lineas/${telefono}/unblock`, {}, token),
};

// ============================================================
//  HELPERS DE CRIPTOGRAFIA
// ============================================================

export async function publicKeyToPem(publicKey) {
  const der = await crypto.subtle.exportKey('spki', publicKey);
  return derToPem(der, 'PUBLIC KEY');
}

export async function privateKeyToPem(privateKey) {
  const der = await crypto.subtle.exportKey('pkcs8', privateKey);
  return derToPem(der, 'PRIVATE KEY');
}

export async function importPrivateKeyFromPem(pem) {
  const der = pemToDer(pem, 'PRIVATE KEY');
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

export async function signWithPrivateKey(privateKey, payload) {
  const dataBytes = new TextEncoder().encode(payload);
  const sigBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    dataBytes,
  );
  const bytes = new Uint8Array(sigBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] ?? 'application/octet-stream';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function uploadToPresignedUrl(url, file, contentType) {
  const r = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!r.ok) throw new Error(`Subida fallo (${r.status}): ${await r.text()}`);
  return true;
}

// ============================================================
//  ARCHIVO .pem DE YORU
// ============================================================
// Un .pem de Yoru contiene 3 bloques PEM en orden:
//   1) YORU IDENTITY        - JSON base64 con metadata (userId, email, ...)
//   2) PUBLIC KEY           - SPKI base64 (ECDSA P-256)
//   3) PRIVATE KEY          - PKCS8 base64 (ECDSA P-256)
//
// El bloque YORU IDENTITY no es estandar PEM pero sigue su formato (armor)
// y cualquier parser PEM lo ignora si no le interesa.
// ============================================================

export function construirArchivoPem({ metadata, publicKeyPem, privateKeyPem }) {
  const metaBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(metadata, null, 0))));
  const metaLines  = metaBase64.match(/.{1,64}/g)?.join('\n') ?? metaBase64;
  const metaBlock  = `-----BEGIN YORU IDENTITY-----\n${metaLines}\n-----END YORU IDENTITY-----`;
  // Si publicKeyPem o privateKeyPem ya vienen con armor, los respetamos.
  return [metaBlock, publicKeyPem.trim(), privateKeyPem.trim()].join('\n');
}

export function leerMetadataDePem(pem) {
  const m = pem.match(/-----BEGIN YORU IDENTITY-----([\s\S]*?)-----END YORU IDENTITY-----/);
  if (!m) throw new Error('No es un archivo Yoru valido (falta bloque YORU IDENTITY).');
  const b64 = m[1].replace(/\s+/g, '');
  const json = decodeURIComponent(escape(atob(b64)));
  return JSON.parse(json);
}

/** Lee el bloque PUBLIC KEY del .pem (formato PEM completo, listo para enviar al PKI). */
export function leerPublicKeyDePem(pem) {
  const m = pem.match(/-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----/);
  if (!m) throw new Error('No se encontro el bloque PUBLIC KEY.');
  return m[0];
}

/** Lee el bloque PRIVATE KEY del .pem y devuelve un CryptoKey usable para firmar. */
export async function leerPrivateKeyDePem(pem) {
  const m = pem.match(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/);
  if (!m) throw new Error('No se encontro el bloque PRIVATE KEY.');
  return importPrivateKeyFromPem(m[0]);
}

function derToPem(der, label) {
  const bytes = new Uint8Array(der);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  const lines = b64.match(/.{1,64}/g).join('\n');
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`;
}

function pemToDer(pem, label) {
  const begin = `-----BEGIN ${label}-----`;
  const end   = `-----END ${label}-----`;
  const a = pem.indexOf(begin);
  const b = pem.indexOf(end);
  if (a < 0 || b < 0) throw new Error(`PEM sin bloque ${label}`);
  const b64 = pem.slice(a + begin.length, b).replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ============================================================
//  UTILIDADES
// ============================================================

export function descargarArchivo(filename, contenido, mime = 'application/x-pem-file') {
  const blob = new Blob([contenido], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function leerArchivoComoTexto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/** "<CURP>-privatekey.pem" (o telefono como fallback). */
export function nombreArchivoLlave({ curp, telefono }) {
  const base = (curp ?? telefono ?? 'yoru').replace(/[^A-Za-z0-9]/g, '');
  return `${base}-privatekey.pem`;
}
