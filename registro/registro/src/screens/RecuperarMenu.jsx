import React from 'react';

/**
 * Selector de recuperacion. Dos caminos:
 *   - Olvide mi contrasena  -> codigo por correo (no requiere .pem).
 *   - Olvide mi correo       -> requiere el archivo .pem para autorizar el cambio.
 */
export default function RecuperarMenu({ onElegirPassword, onElegirCorreo, onVolverInicio }) {
  return (
    <div className="w-full max-w-2xl flex flex-col items-center animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-xl w-full p-8 md:p-12 mb-8 relative">
        <button onClick={onVolverInicio}
          className="absolute top-8 left-8 text-[#bf00ff] hover:text-[#3a1366] font-bold text-sm transition-colors z-20">
          ← Volver
        </button>

        <div className="text-center mt-8 mb-8">
          <div className="w-20 h-20 rounded-full bg-[#dfd0f1] flex items-center justify-center mx-auto mb-4 border-[2px] border-[#b174e7] shadow-inner">
            <span className="text-4xl">🤔</span>
          </div>
          <h2 className="text-3xl font-extrabold text-[#591f96] mb-2">¿Qué olvidaste?</h2>
          <p className="text-[#591f96] font-medium max-w-md mx-auto">
            Elige una opción para recuperar el acceso a tu cuenta.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto">
          <button onClick={onElegirPassword}
            className="text-left bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl p-6 hover:bg-[#dfd0f1] transition-all">
            <div className="text-4xl mb-2">🔑</div>
            <p className="text-[#591f96] font-extrabold text-lg mb-1">Olvidé mi contraseña</p>
            <p className="text-[#591f96] text-sm">
              Te enviaremos un código a tu correo para crear una nueva contraseña.
              No necesitas tu archivo .pem.
            </p>
          </button>

          <button onClick={onElegirCorreo}
            className="text-left bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl p-6 hover:bg-[#dfd0f1] transition-all">
            <div className="text-4xl mb-2">📧</div>
            <p className="text-[#591f96] font-extrabold text-lg mb-1">Olvidé mi correo</p>
            <p className="text-[#591f96] text-sm">
              Sube tu archivo .pem para demostrar que la cuenta es tuya y cambiar
              tu correo.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
