import React, { useState } from 'react';
import { api } from '../api.js';
import PasswordInput from '../components/PasswordInput.jsx';

/**
 * Login estandar con correo y contrasena.
 */
export default function Login({ onLoginExitoso, onIrARegistro, onIrARecuperar, onVolverInicio }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState(null);

  const entrar = async () => {
    if (!email || !password) {
      setError('Correo y contrasena son obligatorios.');
      return;
    }
    setCargando(true);
    setError(null);
    const r = await api.login({ email, password });
    setCargando(false);
    if (r.status === 200 && r.data.ok) {
      onLoginExitoso({
        token: r.data.token,
        user: r.data.user,
        publicKeyId: r.data.publicKeyId,
      });
    } else {
      setError(r.data.error ?? 'No se pudo iniciar sesion.');
    }
  };

  return (
    <div className="w-full max-w-2xl flex flex-col items-center animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-xl w-full p-8 md:p-12 mb-8 relative">
        <button onClick={onVolverInicio} className="absolute top-8 left-8 text-[#bf00ff] hover:text-[#3a1366] font-bold text-sm transition-colors z-20">
          ← Volver al inicio
        </button>

        <div className="text-center mt-8 mb-8">
          <div className="w-20 h-20 rounded-full bg-[#dfd0f1] flex items-center justify-center mx-auto mb-4 border-[2px] border-[#b174e7] shadow-inner">
            <span className="text-4xl">🔓</span>
          </div>
          <h2 className="text-3xl font-extrabold text-[#591f96] mb-2">Iniciar sesion</h2>
          <p className="text-[#591f96] font-medium max-w-md mx-auto">
            Usa tu correo y contrasena.
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4 max-w-md mx-auto">
          <div className="flex flex-col text-left">
            <label className="text-[#591f96] font-bold ml-2 text-sm">Correo</label>
            <input type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              autoComplete="email"
              className="w-full bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl px-6 py-4 font-semibold focus:outline-none focus:border-[#591f96] focus:ring-2 focus:ring-[#b174e7] transition-all" />
          </div>

          <div className="flex flex-col text-left">
            <label className="text-[#591f96] font-bold ml-2 text-sm">Contrasena</label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') entrar(); }}
              autoComplete="current-password"
              ariaLabel="Contrasena"
            />
          </div>

          <button onClick={entrar} disabled={cargando}
            className={`py-4 rounded-full font-bold text-lg shadow-lg transition-all mt-2 ${
              cargando ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#591f96] text-white hover:bg-[#3a1366]'
            }`}>
            {cargando ? 'Entrando…' : 'Iniciar sesion'}
          </button>

          <div className="flex flex-col items-center gap-2 mt-2">
            <button onClick={onIrARecuperar} className="text-[#bf00ff] text-sm font-bold hover:underline">
              ¿Olvidaste tu contrasena o correo?
            </button>
            <p className="text-[#591f96] text-sm">
              ¿No tienes cuenta? {' '}
              <button onClick={onIrARegistro} className="text-[#bf00ff] font-bold hover:underline">
                Registrate aqui →
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
