import React, { useState } from 'react';
import { api } from '../api.js';

/**
 * Vincula un nuevo telefono a la cuenta del usuario autenticado. No requiere
 * repetir KYC porque los documentos ya estan en su cuenta.
 */
export default function AgregarLinea({ token, onLineaAgregada, onCancelar }) {
  const [telefono, setTelefono] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState(null);

  const agregar = async () => {
    if (telefono.length !== 10) {
      setError('Se requieren 10 digitos.');
      return;
    }
    setCargando(true);
    setError(null);
    const r = await api.agregarLinea({ telefono }, token);
    setCargando(false);
    if (r.status === 201 && r.data.ok) {
      onLineaAgregada(r.data.linea);
    } else {
      setError(r.data.error ?? 'No se pudo vincular la linea.');
    }
  };

  return (
    <div className="w-full max-w-xl flex flex-col items-center animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-xl w-full flex flex-col items-center text-center p-8 md:p-14 mb-8">
        <div className="w-24 h-24 rounded-full bg-[#dfd0f1] flex items-center justify-center mb-6 border-[2px] border-[#b174e7] shadow-inner">
          <span className="text-5xl">📱</span>
        </div>
        <h2 className="text-3xl font-extrabold text-[#591f96] mb-2">Vincular otra linea</h2>
        <p className="text-[#591f96] text-base font-medium mb-6 max-w-md">
          Tus documentos KYC ya estan registrados. Solo necesitamos el nuevo numero.
        </p>

        <input
          type="tel"
          maxLength={10}
          value={telefono}
          onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))}
          placeholder="10 digitos"
          className="w-full max-w-xs bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl px-6 py-4 font-semibold text-center text-lg focus:outline-none focus:border-[#591f96] focus:ring-2 focus:ring-[#b174e7] transition-all mb-4"
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
            onClick={agregar}
            disabled={cargando}
            className={`flex-1 py-3 rounded-full font-bold text-sm shadow-lg transition-all ${
              cargando ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#591f96] text-white hover:bg-[#3a1366]'
            }`}
          >
            {cargando ? 'Vinculando…' : 'Vincular linea'}
          </button>
        </div>
      </div>
    </div>
  );
}
