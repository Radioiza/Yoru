import crypto from 'node:crypto';

const KEYLEN = 64;

/** Hashea una contraseña con scrypt + salt aleatorio. Devuelve { hash, salt } en hex. */
export function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, KEYLEN).toString('hex');
  return { hash, salt };
}

/** Compara una contraseña plana contra (hash, salt) en tiempo constante. */
export function verifyPassword(plain, hash, salt) {
  if (!hash || !salt) return false;
  const test = crypto.scryptSync(plain, salt, KEYLEN);
  const stored = Buffer.from(hash, 'hex');
  if (stored.length !== test.length) return false;
  return crypto.timingSafeEqual(stored, test);
}

/** 5 digitos aleatorios como string. */
export function codigoCincoDigitos() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

/** Token corto base64url (para recovery). */
export function tokenAleatorio(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}
