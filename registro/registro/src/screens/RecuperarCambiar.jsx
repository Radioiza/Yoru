import React, { useState } from 'react';
import { api } from '../api.js';
import PasswordInput, { reglasContrasena, ChecklistContrasena } from '../components/PasswordInput.jsx';

/**
 * Tras verificar el .pem, el usuario ve su correo actual y puede cambiarlo,
 * y/o establecer una nueva contrasena. Si no quiere cambiar nada, "Terminar".
 */
export default function RecuperarCambiar({ user, recoveryToken, onTerminado }) {
  const [newPassword, setNewPassword]   = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [newEmail, setNewEmail]         = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState(null);

  const guardar = async () => {
    const cambios = {};
    if (newPassword || newPassword2) {
      const errs = reglasContrasena(newPassword);
      if (errs.length > 0) {
        setError(`La contraseña debe tener: ${errs.join(', ')}.`);
        return;
      }
      if (newPassword !== newPassword2) {
        setError('Las contraseñas no coinciden.');
        return;
      }
      cambios.newPassword = newPassword;
    }
    if (newEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        setError('Correo invalido.');
        return;
      }
      cambios.newEmail = newEmail.trim().toLowerCase();
    }
    setCargando(true);
    setError(null);
    const r = await api.recuperarCambiar({ recoveryToken, ...cambios });
    setCargando(false);
    if (r.status === 200 && r.data.ok) {
      onTerminado({ user: r.data.user });
    } else {
      setError(r.data.error ?? 'No se pudo guardar.');
    }
  };

  return (
    <div className="w-full max-w-2xl flex flex-col items-center animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-xl w-full p-8 md:p-12 mb-8">
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-[#dfd0f1] flex items-center justify-center mx-auto mb-4 border-[2px] border-[#b174e7] shadow-inner">
            <span className="text-4xl">🛠️</span>
          </div>
          <h2 className="text-3xl font-extrabold text-[#591f96] mb-2">Cuenta recuperada</h2>
          <p className="text-[#591f96] font-medium">Tu correo actual es:</p>
          <p className="text-[#bf00ff] font-bold text-lg mt-1">{user.email}</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <p className="text-[#591f96] text-sm mb-4">
          Puedes cambiar tu contraseña, tu correo, o ambos. Si solo querías
          recordar tu correo, salta directo a "Terminar".
        </p>

        <div className="flex flex-col gap-4 max-w-md mx-auto">
          <div className="flex flex-col text-left">
            <label className="text-[#591f96] font-bold ml-2 text-sm">Nueva contraseña (opcional)</label>
            <PasswordInput
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Dejar vacío para no cambiar"
              ariaLabel="Nueva contraseña"
            />
            {newPassword && <ChecklistContrasena password={newPassword} />}
          </div>
          <div className="flex flex-col text-left">
            <label className="text-[#591f96] font-bold ml-2 text-sm">Confirmar nueva contraseña</label>
            <PasswordInput
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              placeholder=""
              ariaLabel="Confirmar nueva contraseña"
              onPaste={(e) => e.preventDefault()}
            />
          </div>
          <div className="flex flex-col text-left">
            <label className="text-[#591f96] font-bold ml-2 text-sm">Nuevo correo (opcional)</label>
            <input type="email" value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Dejar vacio para no cambiar"
              className="w-full bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl px-6 py-4 font-semibold focus:outline-none focus:border-[#591f96] focus:ring-2 focus:ring-[#b174e7] transition-all" />
          </div>

          <button onClick={guardar} disabled={cargando}
            className={`py-4 rounded-full font-bold text-lg shadow-lg transition-all mt-2 ${
              cargando ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#591f96] text-white hover:bg-[#3a1366]'
            }`}>
            {cargando ? 'Guardando…' : 'Guardar cambios e iniciar sesion'}
          </button>
          <button onClick={() => onTerminado({ user })}
            className="text-[#bf00ff] text-sm font-bold hover:underline">
            Terminar sin cambiar nada
          </button>
        </div>
      </div>
    </div>
  );
}
