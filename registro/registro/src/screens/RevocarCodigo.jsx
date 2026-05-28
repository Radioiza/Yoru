import React, { useState } from 'react';
import { api } from '../api.js';

/**
 * El usuario ingresa el codigo de 5 digitos que recibio por correo.
 * Si es correcto: revoca llave + desvincula lineas, y avanza a la pantalla
 * de creacion de nuevo par de llaves.
 */
export default function RevocarCodigo({ token, expiraEn, onConfirmado, onCancelar }) {
  const [codigo, setCodigo]     = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState(null);

  const confirmar = async () => {
    if (!/^\d{5}$/.test(codigo)) {
      setError('Debe ser de 5 digitos.');
      return;
    }
    setCargando(true);
    setError(null);
    const r = await api.revocarConfirmar({ codigo }, token);
    setCargando(false);
    if (r.status !== 200 || !r.data.ok) {
      setError(r.data.error ?? 'Codigo incorrecto.');
      return;
    }
    onConfirmado();
  };

  return (
    <div className="w-full max-w-xl flex flex-col items-center animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-xl w-full flex flex-col items-center text-center p-8 md:p-14 mb-8">
        <div className="w-24 h-24 rounded-full bg-[#dfd0f1] flex items-center justify-center mb-6 border-[2px] border-[#b174e7] shadow-inner">
          <span className="text-5xl">📩</span>
        </div>
        <h2 className="text-3xl font-extrabold text-[#591f96] mb-2">Ingresa tu codigo</h2>
        <p className="text-[#591f96] text-base font-medium mb-6 max-w-md">
          Enviamos un codigo de 5 digitos a tu correo. Revisa la consola del
          notification-service para verlo en modo demo.
        </p>

        {expiraEn && (
          <p className="text-[#bf00ff] text-xs mb-4">
            Expira: {new Date(expiraEn).toLocaleString()}
          </p>
        )}

        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
          placeholder="-----"
          className="w-48 bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl px-6 py-4 font-mono text-center text-2xl tracking-widest focus:outline-none focus:border-[#591f96] focus:ring-2 focus:ring-[#b174e7] transition-all mb-4"
        />

        {error && (
          <div className="w-full bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md mt-2">
          <button onClick={onCancelar} className="flex-1 py-3 rounded-full font-bold text-sm bg-white border-[1.5px] border-[#b174e7] text-[#591f96] hover:bg-[#dfd0f1] transition-all">
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={cargando}
            className={`flex-1 py-3 rounded-full font-bold text-sm shadow-lg transition-all ${
              cargando ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#591f96] text-white hover:bg-[#3a1366]'
            }`}
          >
            {cargando ? 'Validando…' : 'Validar codigo'}
          </button>
        </div>
      </div>
    </div>
  );
}
