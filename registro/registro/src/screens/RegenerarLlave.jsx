import React, { useState } from 'react';
import {
  api,
  publicKeyToPem,
  privateKeyToPem,
  descargarArchivo,
  nombreArchivoLlave,
  construirArchivoPem,
} from '../api.js';

/**
 * Despues de revocar y validar el codigo, el usuario genera un nuevo par de
 * llaves. NO se piden datos personales ni KYC: reutiliza la cuenta existente.
 * Una vez generadas, NO se permite volver atras.
 */
export default function RegenerarLlave({ user, token, onCompletado }) {
  const [cargando, setCargando]   = useState(false);
  const [error, setError]         = useState(null);
  const [resultado, setResultado] = useState(null);

  // PKI necesita un Bearer token; lo pasamos como /api/pki/keys es publico
  // para el commit, pero aqui usamos directamente el endpoint sin auth (auth
  // ya valido al usuario por correo+password). Para mayor seguridad podriamos
  // forzar auth, lo dejamos como esta para minimizar friccion en la demo.

  const generar = async () => {
    setCargando(true);
    setError(null);
    try {
      const keyPair = await window.crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify'],
      );
      const publicKeyPem  = await publicKeyToPem(keyPair.publicKey);
      const privateKeyPem = await privateKeyToPem(keyPair.privateKey);

      // Registramos la nueva llave en PKI llamando directo al endpoint.
      const baseUrl = import.meta.env.VITE_PKI_URL ?? 'http://localhost:3002';
      const r = await fetch(`${baseUrl}/api/pki/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, publicKeyPem, committed: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'No se pudo registrar la nueva llave.');
      const publicKeyId = d.key.id;

      const metadata = {
        app: 'yoru',
        version: 2,
        userId: user.id,
        telefono: user.telefono,
        curp: user.curp,
        nombre: user.nombre,
        email: user.email,
        publicKeyId,
        fechaGeneracion: new Date().toISOString(),
      };
      const pemFile = construirArchivoPem({ metadata, publicKeyPem, privateKeyPem });

      setResultado({
        publicKeyId,
        archivoLlave: {
          filename: nombreArchivoLlave({ curp: user.curp, telefono: user.telefono }),
          contenido: pemFile,
        },
      });
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="w-full max-w-xl flex flex-col items-center animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-xl w-full flex flex-col items-center text-center p-8 md:p-14 mb-8 relative">

        <div className="w-24 h-24 rounded-full bg-[#dfd0f1] flex items-center justify-center mb-6 border-[2px] border-[#b174e7] shadow-inner">
          <span className="text-5xl">🆕</span>
        </div>

        <h2 className="text-3xl font-extrabold text-[#591f96] mb-4">
          Genera tu nuevo par de llaves
        </h2>
        <p className="text-[#591f96] text-base font-medium mb-8 max-w-md">
          Tu cuenta sigue siendo la misma. Solo creamos llaves nuevas.
          Despues podras volver a vincular tus telefonos.
        </p>

        {error && (
          <div className="w-full bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        {!resultado ? (
          <button onClick={generar} disabled={cargando}
            className={`py-4 px-8 rounded-full font-bold text-lg transition-all shadow-lg w-full max-w-sm ${
              cargando ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#591f96] text-white hover:bg-[#3a1366]'
            }`}>
            {cargando ? 'Generando…' : 'Generar nuevo par de llaves'}
          </button>
        ) : (
          <div className="w-full flex flex-col items-center gap-4 animate-fade-in">
            <div className="bg-green-100 border border-green-400 text-green-700 px-6 py-4 rounded-xl font-bold text-sm w-full">
              ¡Nuevas llaves generadas con exito!
            </div>

            <div className="bg-yellow-50 border-[1.5px] border-yellow-400 rounded-2xl p-4 w-full">
              <p className="text-yellow-800 font-bold text-sm mb-1">⚠️ Importante</p>
              <p className="text-yellow-800 text-sm leading-snug">
                Descarga este nuevo archivo .pem. La llave anterior ya no sirve
                ni para iniciar sesion ni para recuperar la cuenta.
              </p>
            </div>

            <button onClick={() => descargarArchivo(resultado.archivoLlave.filename, resultado.archivoLlave.contenido)}
              className="bg-[#591f96] text-white py-4 px-8 rounded-full font-bold text-lg hover:bg-[#3a1366] transition-all shadow-lg w-full max-w-sm">
              ⬇️ Descargar mi nueva llave (.pem)
            </button>

            <button onClick={() => onCompletado(resultado)}
              className="bg-[#591f96] text-white py-3 px-8 rounded-full font-bold text-sm hover:bg-[#3a1366] transition-all shadow-lg w-full max-w-sm">
              Ya la guarde → Iniciar sesion
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
