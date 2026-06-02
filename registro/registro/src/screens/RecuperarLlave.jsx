import React, { useState } from 'react';
import {
  api,
  leerArchivoComoTexto,
  leerMetadataDePem,
  leerPrivateKeyDePem,
  signWithPrivateKey,
} from '../api.js';

/**
 * Recuperacion: el usuario carga su archivo .pem. El frontend extrae el
 * userId, pide un challenge de recovery, lo firma y manda a verificar.
 * Si OK, recibe email actual + recoveryToken y pasa a la pantalla de
 * cambiar password/email.
 */
export default function RecuperarLlave({ onVerificado, onVolverInicio }) {
  const [archivoNombre, setArchivoNombre] = useState(null);
  const [meta, setMeta]                   = useState(null); // datos del bloque YORU IDENTITY
  const [privateKey, setPrivateKey]       = useState(null);
  const [cargando, setCargando]           = useState(false);
  const [error, setError]                 = useState(null);

  const cargar = async (file) => {
    setCargando(true);
    setError(null);
    try {
      const texto = await leerArchivoComoTexto(file);
      const m = leerMetadataDePem(texto);
      if (m.app !== 'yoru' || !m.userId) {
        throw new Error('Este .pem no parece ser de Yoru.');
      }
      const pk = await leerPrivateKeyDePem(texto);
      setMeta(m);
      setPrivateKey(pk);
      setArchivoNombre(file.name);
    } catch (err) {
      setError('No se pudo leer el archivo: ' + err.message);
      setMeta(null);
      setPrivateKey(null);
      setArchivoNombre(null);
    } finally {
      setCargando(false);
    }
  };

  const verificar = async () => {
    if (!meta || !privateKey) return;
    setCargando(true);
    setError(null);
    try {
      const ch = await api.recuperarIniciar({ userId: meta.userId });
      if (ch.status !== 200 || !ch.data.ok) {
        throw new Error(ch.data.error ?? 'No se pudo iniciar la recuperacion.');
      }
      const { id: challengeId, nonce } = ch.data.challenge;
      const signatureB64 = await signWithPrivateKey(privateKey, nonce);
      const v = await api.recuperarVerificar({
        userId: meta.userId,
        challengeId,
        signatureB64,
      });
      if (v.status !== 200 || !v.data.ok) {
        throw new Error(v.data.error ?? 'No se pudo verificar la firma.');
      }
      onVerificado({
        user: v.data.user,
        recoveryToken: v.data.recoveryToken,
        recoveryExpiraEn: v.data.recoveryExpiraEn,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="w-full max-w-2xl flex flex-col items-center animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-xl w-full p-8 md:p-12 mb-8 relative">
        <button onClick={onVolverInicio}
          className="absolute top-8 left-8 text-[#bf00ff] hover:text-[#3a1366] font-bold text-sm transition-colors z-20">
          ← Volver al inicio
        </button>

        <div className="text-center mt-8 mb-6">
          <div className="w-20 h-20 rounded-full bg-[#dfd0f1] flex items-center justify-center mx-auto mb-4 border-[2px] border-[#b174e7] shadow-inner">
            <span className="text-4xl">🆘</span>
          </div>
          <h2 className="text-3xl font-extrabold text-[#591f96] mb-2">Recuperar mi cuenta</h2>
          <p className="text-[#591f96] font-medium max-w-md mx-auto">
            Carga tu archivo .pem para demostrar que la cuenta es tuya. Después
            podrás ver tu correo actual y cambiarlo.
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {!meta ? (
          <label htmlFor="pem-upload"
            className="cursor-pointer border-2 border-dashed border-[#b174e7] rounded-2xl p-8 bg-[#f5eefe] flex flex-col items-center gap-3 hover:bg-[#dfd0f1] transition-all">
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center border-[2px] border-[#b174e7] shadow-inner">
              <span className="text-3xl">📁</span>
            </div>
            <p className="text-[#591f96] font-bold text-center">
              {cargando ? 'Leyendo archivo…' : 'Selecciona tu archivo .pem'}
            </p>
            <p className="text-[#591f96] text-xs text-center">
              Es el archivo que descargaste al registrarte
            </p>
            <input id="pem-upload" type="file" accept=".pem,application/x-pem-file" className="hidden"
              onChange={(e) => e.target.files?.[0] && cargar(e.target.files[0])} />
          </label>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="bg-green-50 border-[1.5px] border-green-400 rounded-2xl p-5">
              <p className="text-[#591f96] font-bold mb-1">Archivo: {archivoNombre}</p>
              <p className="text-[#bf00ff] text-xs font-mono break-all">userId: {meta.userId}</p>
              {meta.fechaGeneracion && (
                <p className="text-[#591f96] text-xs mt-1">
                  Generada: {new Date(meta.fechaGeneracion).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setMeta(null); setPrivateKey(null); setArchivoNombre(null); }}
                className="flex-1 py-3 rounded-full font-bold text-sm bg-white border-[1.5px] border-[#b174e7] text-[#591f96] hover:bg-[#dfd0f1] transition-all">
                Cambiar archivo
              </button>
              <button onClick={verificar} disabled={cargando}
                className={`flex-1 py-3 rounded-full font-bold text-sm shadow-lg transition-all ${
                  cargando ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#591f96] text-white hover:bg-[#3a1366]'
                }`}>
                {cargando ? 'Verificando…' : 'Firmar y continuar →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
