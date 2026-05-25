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

export const api = {
  // ========== auth-service ==========
  registrar:      (body)         => postJSON(`${AUTH}/api/auth/register`, body),
  pedirChallenge: ({ userId })   => postJSON(`${AUTH}/api/auth/challenge`, { userId }),
  login:          (body)         => postJSON(`${AUTH}/api/auth/login`, body),
  me:             (token)        => getJSON(`${AUTH}/api/auth/me`, token),

  // ========== kyc-service ==========
  obtenerPresignedUrls: ({ userId })       => postJSON(`${KYC}/api/kyc/presigned-urls`, { userId }),
  crearKyc:             (body)             => postJSON(`${KYC}/api/kyc/requests`, body),
  aprobarKyc:           ({ userId, scoreMatch }) =>
    postJSON(`${KYC}/api/kyc/requests/${userId}/approve`, { scoreMatch }),

  // ========== pki-service ==========
  registrarLlave: (body)                        => postJSON(`${PKI}/api/pki/keys`, body),
  verificarFirma: (body)                        => postJSON(`${PKI}/api/pki/verify`, body),
  revocarLlave:   ({ publicKeyId }, token)      =>
    postJSON(`${PKI}/api/pki/keys/${publicKeyId}/revoke`, {}, token),

  // ========== telecom-service ==========
  vincularLinea:    (body)                          => postJSON(`${TELECOM}/api/telecom/lineas`, body),
  obtenerLinea:     ({ telefono })                  => getJSON(`${TELECOM}/api/telecom/lineas/${telefono}`),
  killSwitch:       ({ telefono, motivo }, token)   =>
    postJSON(`${TELECOM}/api/telecom/lineas/${telefono}/kill-switch`, { motivo }, token),
  desbloquearLinea: ({ telefono }, token)           =>
    postJSON(`${TELECOM}/api/telecom/lineas/${telefono}/unblock`, {}, token),
};

/**
 * Exporta una CryptoKey pública (ECDSA P-256) a formato PEM SPKI.
 */
export async function publicKeyToPem(publicKey) {
  const der = await crypto.subtle.exportKey('spki', publicKey);
  const bytes = new Uint8Array(der);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  const lines = b64.match(/.{1,64}/g).join('\n');
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
}

/**
 * Convierte un data URL (como el que produce canvas.toDataURL) a un Blob,
 * para poder subirlo con fetch PUT a una presigned URL de MinIO/S3.
 */
export function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/:(.*?);/)?.[1] ?? 'application/octet-stream';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Sube un archivo (File o Blob) a una presigned PUT URL.
 * Devuelve true si la subida fue exitosa.
 */
export async function uploadToPresignedUrl(url, file, contentType) {
  const r = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!r.ok) throw new Error(`Subida falló (${r.status}): ${await r.text()}`);
  return true;
}

/**
 * Exporta una CryptoKey privada (ECDSA P-256) al formato JWK.
 * La llave debe haber sido generada como extractable:true.
 */
export async function privateKeyToJwk(privateKey) {
  return crypto.subtle.exportKey('jwk', privateKey);
}

/**
 * Importa una llave privada desde JWK y la marca extractable:false
 * para que, una vez cargada en el navegador, no pueda ser exportada
 * de nuevo. Solo se puede usar para firmar.
 */
export async function importPrivateKeyFromJwk(jwk) {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

/**
 * Dispara la descarga de un archivo en el navegador.
 */
export function descargarArchivo(filename, contenido, mime = 'application/json') {
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

/**
 * Lee un File del input como texto plano.
 */
export function leerArchivoComoTexto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Firma un payload con la llave privada ECDSA P-256 / SHA-256.
 * Devuelve la firma en base64 (formato IEEE P1363).
 */
export async function signWithPrivateKey(privateKey, payload) {
  const dataBytes = new TextEncoder().encode(payload);
  const sigBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    dataBytes
  );
  const bytes = new Uint8Array(sigBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
