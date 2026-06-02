import React, { useState } from 'react';
import { api } from '../api.js';
import PasswordInput, { reglasContrasena, ChecklistContrasena } from '../components/PasswordInput.jsx';

/**
 * Recuperacion de contrasena con codigo por correo (sin .pem).
 *   1) El usuario escribe su correo -> se envia un codigo de 5 digitos.
 *   2) Ingresa el codigo + una nueva contrasena -> queda establecida.
 */
export default function RecuperarPassword({ onTerminado, onVolver }) {
  const [paso, setPaso]   = useState('email'); // 'email' | 'codigo'
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [newPassword, setNewPassword]   = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState(null);
  const [info, setInfo]         = useState(null);

  const enviarCodigo = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Correo inválido.');
      return;
    }
    setCargando(true);
    setError(null);
    setInfo(null);
    const r = await api.recuperarPasswordIniciar({ email: email.trim().toLowerCase() });
    setCargando(false);
    if (r.status === 200 && r.data.ok) {
      setInfo('Si el correo está registrado, te enviamos un código. En modo demo aparece en la consola del notification-service.');
      setPaso('codigo');
    } else {
      setError(r.data.error ?? 'No se pudo enviar el código.');
    }
  };

  const confirmar = async () => {
    if (!/^\d{5}$/.test(codigo)) {
      setError('El código son 5 dígitos.');
      return;
    }
    const errs = reglasContrasena(newPassword);
    if (errs.length > 0) {
      setError(`La contraseña debe tener: ${errs.join(', ')}.`);
      return;
    }
    if (newPassword !== newPassword2) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setCargando(true);
    setError(null);
    const r = await api.recuperarPasswordConfirmar({
      email: email.trim().toLowerCase(),
      codigo,
      newPassword,
    });
    setCargando(false);
    if (r.status === 200 && r.data.ok) {
      onTerminado();
    } else {
      setError(r.data.error ?? 'No se pudo cambiar la contraseña.');
    }
  };

  const passwordsCoinciden = newPassword2.length > 0 && newPassword === newPassword2;
  const passwordsNoCoinciden = newPassword2.length > 0 && newPassword !== newPassword2;

  return (
    <div className="w-full max-w-xl flex flex-col items-center animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-xl w-full p-8 md:p-12 mb-8 relative">
        <button onClick={onVolver}
          className="absolute top-8 left-8 text-[#bf00ff] hover:text-[#3a1366] font-bold text-sm transition-colors z-20">
          ← Volver
        </button>

        <div className="text-center mt-8 mb-6">
          <div className="w-20 h-20 rounded-full bg-[#dfd0f1] flex items-center justify-center mx-auto mb-4 border-[2px] border-[#b174e7] shadow-inner">
            <span className="text-4xl">🔑</span>
          </div>
          <h2 className="text-3xl font-extrabold text-[#591f96] mb-2">Restablecer contraseña</h2>
          <p className="text-[#591f96] font-medium max-w-md mx-auto">
            {paso === 'email'
              ? 'Escribe tu correo y te enviaremos un código.'
              : 'Ingresa el código que recibiste y tu nueva contraseña.'}
          </p>
        </div>

        {info && (
          <div className="mb-4 bg-blue-50 border border-blue-300 text-blue-800 px-4 py-3 rounded-xl text-sm">
            {info}
          </div>
        )}
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {paso === 'email' ? (
          <div className="flex flex-col gap-4 max-w-md mx-auto">
            <div className="flex flex-col text-left">
              <label className="text-[#591f96] font-bold ml-2 text-sm">Correo</label>
              <input type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                autoComplete="email"
                className="w-full bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl px-6 py-4 font-semibold focus:outline-none focus:border-[#591f96] focus:ring-2 focus:ring-[#b174e7] transition-all" />
            </div>
            <button onClick={enviarCodigo} disabled={cargando}
              className={`py-4 rounded-full font-bold text-lg shadow-lg transition-all mt-2 ${
                cargando ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#591f96] text-white hover:bg-[#3a1366]'
              }`}>
              {cargando ? 'Enviando…' : 'Enviar código'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 max-w-md mx-auto">
            <div className="flex flex-col text-left">
              <label className="text-[#591f96] font-bold ml-2 text-sm">Código (5 dígitos)</label>
              <input type="text" inputMode="numeric" maxLength={5} value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                placeholder="-----"
                className="w-full bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl px-6 py-4 font-mono text-center text-2xl tracking-widest focus:outline-none focus:border-[#591f96] focus:ring-2 focus:ring-[#b174e7] transition-all" />
            </div>
            <div className="flex flex-col text-left">
              <label className="text-[#591f96] font-bold ml-2 text-sm">Nueva contraseña</label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Crea una contraseña segura"
                ariaLabel="Nueva contraseña"
              />
              {newPassword && <ChecklistContrasena password={newPassword} />}
            </div>
            <div className="flex flex-col text-left">
              <label className="text-[#591f96] font-bold ml-2 text-sm">Confirmar nueva contraseña</label>
              <PasswordInput
                value={newPassword2}
                onChange={(e) => setNewPassword2(e.target.value)}
                placeholder="Repite tu contraseña"
                hasError={passwordsNoCoinciden}
                ariaLabel="Confirmar nueva contraseña"
                onPaste={(e) => e.preventDefault()}
              />
              {passwordsCoinciden && (
                <span className="text-green-600 text-xs mt-1 ml-2 font-bold">✓ Las contraseñas coinciden</span>
              )}
              {passwordsNoCoinciden && (
                <span className="text-red-500 text-xs mt-1 ml-2 font-bold">✗ Las contraseñas no coinciden todavía</span>
              )}
            </div>
            <button onClick={confirmar} disabled={cargando}
              className={`py-4 rounded-full font-bold text-lg shadow-lg transition-all mt-2 ${
                cargando ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#591f96] text-white hover:bg-[#3a1366]'
              }`}>
              {cargando ? 'Guardando…' : 'Cambiar contraseña e iniciar sesión'}
            </button>
            <button onClick={() => { setPaso('email'); setError(null); setInfo(null); }}
              className="text-[#bf00ff] text-sm font-bold hover:underline">
              ← Usar otro correo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
