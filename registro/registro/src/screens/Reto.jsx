import React, { useState } from 'react';
import { api, signWithPrivateKey } from '../api.js';

/**
 * Pide un nonce, lo firma con la llave privada, login → JWT.
 */
export default function Reto({ userId, privateKey, onLoginExitoso, onVolver }) {
  const [cargando, setCargando]     = useState(false);
  const [nonce, setNonce]           = useState(null);
  const [firmaValida, setFirmaValida] = useState(null);
  const [error, setError]           = useState(null);

  const firmar = async () => {
    if (!userId || !privateKey) {
      setError('Falta la llave o el userId. Vuelve a cargar tu archivo.');
      return;
    }
    setCargando(true);
    setError(null);
    setFirmaValida(null);
    try {
      const ch = await api.pedirChallenge({ userId });
      if (ch.status !== 200 || !ch.data.ok) {
        throw new Error(ch.data.error ?? 'No se pudo obtener el challenge.');
      }
      const { id: challengeId, nonce: nonceNuevo } = ch.data.challenge;
      setNonce(nonceNuevo);

      const signatureB64 = await signWithPrivateKey(privateKey, nonceNuevo);

      const r = await api.login({ userId, challengeId, signatureB64 });
      if (r.status !== 200 || !r.data.ok) {
        throw new Error(r.data.error ?? 'Login fallido.');
      }
      setFirmaValida(true);
      // Notificamos al padre con token + datos del usuario para entrar a cuenta.
      onLoginExitoso({
        token: r.data.token,
        user: r.data.user,
      });
    } catch (err) {
      console.error(err);
      setError(err.message);
      setFirmaValida(false);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="w-full max-w-xl flex flex-col items-center animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-xl w-full flex flex-col items-center text-center p-8 md:p-14 mb-8 relative">
        <button onClick={onVolver} className="absolute top-8 left-8 text-[#bf00ff] font-bold text-sm hover:text-[#3a1366]">
          ← Volver
        </button>

        <div className="w-24 h-24 rounded-full bg-[#dfd0f1] flex items-center justify-center mb-6 border-[2px] border-[#b174e7] shadow-inner">
          <span className="text-5xl">✍️</span>
        </div>

        <h2 className="text-3xl font-extrabold text-[#591f96] mb-4">Reto de Firma Digital</h2>
        <p className="text-[#591f96] text-base font-medium mb-8 max-w-md">
          Vamos a comprobar que controlas tu llave privada. Pedimos un reto, lo firmas localmente y verificamos la firma.
        </p>

        {nonce && (
          <div className="w-full bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl p-4 mb-6">
            <p className="text-[#bf00ff] font-bold text-xs tracking-wider uppercase mb-1">Nonce recibido</p>
            <p className="text-[#591f96] font-mono text-xs break-all">{nonce}</p>
          </div>
        )}

        {firmaValida !== true && (
          <button
            onClick={firmar}
            disabled={cargando}
            className={`py-4 px-8 rounded-full font-bold text-lg transition-all shadow-lg w-full max-w-sm ${
              cargando ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#591f96] text-white hover:bg-[#3a1366]'
            }`}
          >
            {cargando ? 'Firmando y verificando…' : 'Firmar el reto'}
          </button>
        )}

        {firmaValida === false && (
          <div className="w-full bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-xl font-bold text-sm mt-4">
            ❌ {error ?? 'La firma no se pudo verificar.'}
          </div>
        )}
      </div>
    </div>
  );
}
