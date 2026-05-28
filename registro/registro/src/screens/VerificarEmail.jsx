import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

/**
 * Pantalla post-Generacion. El usuario recibio un codigo de 5 digitos en su
 * correo. Lo ingresa aqui; al validar, el backend ejecuta el commit atomico
 * de KYC + PKI + Telecom. Si no le llego, puede "Reenviar codigo" pasado el
 * cooldown de 60 segundos.
 */
export default function VerificarEmail({
  draftUserId,
  email,
  expiraEnInicial,
  onVerificado,
  onCancelar,
}) {
  const [codigo, setCodigo]     = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState(null);
  const [info, setInfo]         = useState(null);
  const [cooldown, setCooldown] = useState(60);
  const [expiraEn, setExpiraEn] = useState(expiraEnInicial);

  // Cooldown del boton de reenvio (60s).
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const validar = async () => {
    if (!/^\d{5}$/.test(codigo)) {
      setError('Deben ser 5 digitos.');
      return;
    }
    setCargando(true);
    setError(null);
    setInfo(null);
    const r = await api.verificarEmailRegistro({ draftUserId, codigo });
    setCargando(false);
    if (r.status === 200 && r.data.ok) {
      onVerificado(r.data);
    } else {
      setError(r.data.error ?? 'No se pudo verificar.');
    }
  };

  const reenviar = async () => {
    if (cooldown > 0) return;
    setCargando(true);
    setError(null);
    setInfo(null);
    const r = await api.reenviarCodigoRegistro({ draftUserId });
    setCargando(false);
    if (r.status === 200 && r.data.ok) {
      setInfo('Codigo reenviado. Revisa tu correo.');
      setCooldown(60);
      setExpiraEn(r.data.verificacionExpiraEn);
    } else if (r.status === 429) {
      setCooldown(r.data.restante ?? 60);
      setError(r.data.error);
    } else {
      setError(r.data.error ?? 'No se pudo reenviar.');
    }
  };

  return (
    <div className="w-full max-w-xl flex flex-col items-center animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-xl w-full flex flex-col items-center text-center p-8 md:p-14 mb-8">
        <div className="w-24 h-24 rounded-full bg-[#dfd0f1] flex items-center justify-center mb-6 border-[2px] border-[#b174e7] shadow-inner">
          <span className="text-5xl">📩</span>
        </div>
        <h2 className="text-3xl font-extrabold text-[#591f96] mb-2">Confirma tu correo</h2>
        <p className="text-[#591f96] text-base font-medium mb-2 max-w-md">
          Enviamos un codigo de 5 digitos a:
        </p>
        <p className="text-[#bf00ff] font-bold mb-4">{email}</p>
        <p className="text-[#591f96] text-xs mb-4 max-w-md">
          Tienes 5 minutos para ingresarlo. En modo demo, el codigo aparece
          tambien en la consola del notification-service.
        </p>
        {expiraEn && (
          <p className="text-[#bf00ff] text-xs mb-4">Expira: {new Date(expiraEn).toLocaleString()}</p>
        )}

        <input type="text" inputMode="numeric" maxLength={5} value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
          placeholder="-----"
          className="w-48 bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl px-6 py-4 font-mono text-center text-2xl tracking-widest focus:outline-none focus:border-[#591f96] focus:ring-2 focus:ring-[#b174e7] transition-all mb-4" />

        {error && (
          <div className="w-full max-w-md bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl text-sm mb-3">
            {error}
          </div>
        )}
        {info && (
          <div className="w-full max-w-md bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-xl text-sm mb-3">
            {info}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md mt-2">
          <button onClick={onCancelar}
            className="flex-1 py-3 rounded-full font-bold text-sm bg-white border-[1.5px] border-[#b174e7] text-[#591f96] hover:bg-[#dfd0f1] transition-all">
            Cancelar registro
          </button>
          <button onClick={validar} disabled={cargando}
            className={`flex-1 py-3 rounded-full font-bold text-sm shadow-lg transition-all ${
              cargando ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#591f96] text-white hover:bg-[#3a1366]'
            }`}>
            {cargando ? 'Validando…' : 'Validar codigo'}
          </button>
        </div>

        <button onClick={reenviar} disabled={cooldown > 0 || cargando}
          className={`mt-4 text-sm font-bold ${
            cooldown > 0 || cargando ? 'text-gray-400 cursor-not-allowed' : 'text-[#bf00ff] hover:underline'
          }`}>
          {cooldown > 0 ? `Reenviar codigo en ${cooldown}s` : 'Reenviar codigo'}
        </button>
      </div>
    </div>
  );
}
