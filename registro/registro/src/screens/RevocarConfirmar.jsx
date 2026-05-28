import React, { useState } from 'react';
import { api } from '../api.js';

/**
 * Confirma la intencion de revocar y dispara el envio del codigo por correo.
 */
export default function RevocarConfirmar({ token, onCodigoEnviado, onCancelar }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState(null);

  const enviar = async () => {
    setCargando(true);
    setError(null);
    const r = await api.revocarIniciar(token);
    setCargando(false);
    if (r.status !== 200 || !r.data.ok) {
      setError(r.data.error ?? 'No se pudo iniciar la revocacion.');
      return;
    }
    onCodigoEnviado({ expiraEn: r.data.expiraEn });
  };

  return (
    <div className="w-full max-w-xl flex flex-col items-center animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-xl w-full flex flex-col items-center text-center p-8 md:p-14 mb-8">
        <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mb-6 border-[2px] border-red-300 shadow-inner">
          <span className="text-5xl">⚠️</span>
        </div>
        <h2 className="text-3xl font-extrabold text-[#591f96] mb-4">Restablecer tu seguridad</h2>
        <p className="text-[#591f96] text-base font-medium mb-4 max-w-md">
          Esto invalida tu archivo de respaldo actual (.pem) y lo reemplaza por
          uno nuevo. Si continuas:
        </p>
        <ul className="text-[#591f96] text-sm text-left max-w-md mb-6 list-disc list-inside space-y-1">
          <li>Se desvincularan TODOS los telefonos asociados a tu cuenta.</li>
          <li>Tu llave actual quedara invalidada y no servira para recuperar la cuenta.</li>
          <li>Te enviaremos un codigo de 5 digitos a tu correo para confirmar.</li>
          <li>Despues podras crear un archivo de respaldo nuevo y volver a vincular tus telefonos.</li>
        </ul>

        {error && (
          <div className="w-full bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
          <button onClick={onCancelar} className="flex-1 py-3 rounded-full font-bold text-sm bg-white border-[1.5px] border-[#b174e7] text-[#591f96] hover:bg-[#dfd0f1] transition-all">
            Cancelar
          </button>
          <button
            onClick={enviar}
            disabled={cargando}
            className={`flex-1 py-3 rounded-full font-bold text-sm shadow-lg transition-all ${
              cargando ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {cargando ? 'Enviando codigo…' : 'Si, restablecer y enviar codigo'}
          </button>
        </div>
      </div>
    </div>
  );
}
