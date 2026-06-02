import React, { useState } from 'react';

/**
 * Input de contraseña con boton "ojo" para mostrar/ocultar el texto.
 * Conserva la apariencia del resto de inputs del proyecto.
 */
export default function PasswordInput({
  value, onChange, placeholder, hasError,
  onKeyDown, onCopy, onPaste, onCut,
  autoComplete = 'new-password', ariaLabel,
}) {
  const [verVisible, setVerVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={verVisible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        onCopy={onCopy}
        onPaste={onPaste}
        onCut={onCut}
        autoComplete={autoComplete}
        aria-label={ariaLabel}
        className={`w-full bg-[#f5eefe] border-[1.5px] rounded-2xl pl-6 pr-14 py-4 font-semibold focus:outline-none focus:border-[#591f96] focus:ring-2 focus:ring-[#b174e7] transition-all ${
          hasError ? 'border-red-500' : 'border-[#b174e7]'
        }`}
      />
      <button
        type="button"
        onClick={() => setVerVisible((v) => !v)}
        title={verVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-label={verVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#dfd0f1] hover:bg-[#b174e7] hover:text-white text-[#591f96] flex items-center justify-center transition-all"
      >
        {verVisible ? (
          // ojo tachado
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        ) : (
          // ojo
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        )}
      </button>
    </div>
  );
}

/**
 * Reglas de contrasena (mismas que el backend). Devuelve array de errores
 * legibles; vacio si la contrasena cumple.
 */
export function reglasContrasena(password) {
  const errs = [];
  if (typeof password !== 'string' || password.length < 8) errs.push('minimo 8 caracteres');
  if (!/[A-Z]/.test(password ?? '')) errs.push('1 mayuscula');
  if (((password ?? '').match(/\d/g) ?? []).length < 2) errs.push('2 numeros');
  if (!/[^A-Za-z0-9]/.test(password ?? '')) errs.push('1 caracter especial');
  return errs;
}

/**
 * Mini-checklist visual de reglas — verde si cumple, gris si no.
 */
export function ChecklistContrasena({ password }) {
  const reglas = [
    { ok: (password ?? '').length >= 8,           label: 'Minimo 8 caracteres' },
    { ok: /[A-Z]/.test(password ?? ''),           label: '1 letra mayuscula' },
    { ok: (((password ?? '').match(/\d/g) ?? []).length) >= 2, label: '2 numeros' },
    { ok: /[^A-Za-z0-9]/.test(password ?? ''),    label: '1 caracter especial (!@#…)' },
  ];
  return (
    <ul className="text-xs ml-2 mt-1 space-y-0.5">
      {reglas.map((r, i) => (
        <li key={i} className={r.ok ? 'text-green-600 font-bold' : 'text-[#bf00ff]'}>
          {r.ok ? '✓' : '○'} {r.label}
        </li>
      ))}
    </ul>
  );
}
