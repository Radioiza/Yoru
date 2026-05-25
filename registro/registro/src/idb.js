/**
 * Persistencia de identidades Yoru en IndexedDB.
 *
 * ¿Por qué IndexedDB y no localStorage?
 *  - IndexedDB puede almacenar objetos CryptoKey nativamente vía structured clone.
 *    localStorage solo guarda strings, lo que obligaría a exportar la llave privada
 *    a JWK y guardarla como texto plano. IndexedDB la mantiene como CryptoKey,
 *    y si fue generada/importada con extractable:false, NUNCA se podrá leer
 *    en texto plano desde JS — solo se puede usar para firmar.
 *  - IndexedDB está aislada por origen (mismo-origin policy).
 */

const DB_NAME = 'yoru-identity';
const DB_VERSION = 1;
const STORE = 'identities';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'userId' });
      }
    };
  });
}

/**
 * Guarda (o reemplaza) la identidad de un usuario.
 *
 * @param {object} identity
 * @param {string} identity.userId
 * @param {string} identity.telefono
 * @param {string} identity.curp
 * @param {CryptoKey} identity.privateKey   — idealmente extractable:false
 * @param {string} identity.publicKeyId
 * @param {string} identity.publicKeyPem
 */
export async function saveIdentity(identity) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.put({ ...identity, savedAt: new Date().toISOString() });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Recupera la identidad de un usuario. Devuelve null si no existe. */
export async function loadIdentity(userId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(userId);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Devuelve todas las identidades guardadas en este navegador. */
export async function listIdentities() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

/** Borra una identidad. */
export async function deleteIdentity(userId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(userId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
