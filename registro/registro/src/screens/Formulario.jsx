import React, { useState } from 'react';
import PasswordInput, { reglasContrasena, ChecklistContrasena } from '../components/PasswordInput.jsx';

/**
 * Paso 1 del registro. NO toca backend: solo valida y guarda los datos en
 * memoria. La persistencia ocurre tras verificar el codigo de email.
 */
export default function Formulario({ valoresIniciales, onContinuar, onVolver }) {
  const [telefono, setTelefono]   = useState(valoresIniciales?.telefono ?? '');
  const [curp, setCurp]           = useState(valoresIniciales?.curp ?? '');
  const [nombre, setNombre]       = useState(valoresIniciales?.nombre ?? '');
  const [email, setEmail]         = useState(valoresIniciales?.email ?? '');
  const [password, setPassword]   = useState(valoresIniciales?.password ?? '');
  const [password2, setPassword2] = useState(valoresIniciales?.password ?? '');
  const [errores, setErrores]     = useState({});

  const continuar = () => {
    const e = {};
    if (telefono.length !== 10) e.telefono = 'Se requieren 10 digitos.';
    if (curp.length !== 18)     e.curp = 'Se requieren 18 caracteres.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Correo invalido.';
    const errsPass = reglasContrasena(password);
    if (errsPass.length > 0)   e.password = `Falta: ${errsPass.join(', ')}.`;
    if (password !== password2) e.password2 = 'Las contrasenas no coinciden.';
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    onContinuar({
      telefono,
      curp: curp.toUpperCase(),
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      password,
    });
  };

  const inputCls = (err) =>
    `w-full bg-[#f5eefe] border-[1.5px] rounded-2xl px-6 py-4 font-semibold focus:outline-none focus:border-[#591f96] focus:ring-2 focus:ring-[#b174e7] transition-all ${
      err ? 'border-red-500' : 'border-[#b174e7]'
    }`;

  return (
    <div className="w-full flex flex-col items-center animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-xl w-full flex flex-col md:flex-row p-8 md:p-12 mb-8 relative gap-8">
        <button onClick={onVolver} className="absolute top-8 left-8 text-[#bf00ff] hover:text-[#3a1366] font-bold text-sm transition-colors z-20">← Volver al inicio</button>

        <div className="w-full md:w-1/2 flex flex-col mt-10 md:mt-4 md:pr-8">
          <h2 className="text-3xl font-extrabold text-[#591f96] mb-2">Crear tu cuenta</h2>
          <p className="text-[#bf00ff] text-xs mb-6">
            Nada se guarda hasta que confirmes el codigo de tu correo. Si cierras la pagina antes, no queda nada en el sistema.
          </p>

          <div className="flex flex-col gap-4 w-full max-w-md mx-auto md:mx-0">
            <div className="flex flex-col text-left">
              <label className="text-[#591f96] font-bold ml-2 text-sm">Telefono</label>
              <input type="tel" maxLength={10} value={telefono}
                onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))}
                className={inputCls(errores.telefono)} />
              {errores.telefono && <span className="text-red-500 text-xs mt-1 ml-2 font-bold">{errores.telefono}</span>}
            </div>

            <div className="flex flex-col text-left">
              <label className="text-[#591f96] font-bold ml-2 text-sm">CURP</label>
              <input type="text" maxLength={18} value={curp}
                onChange={(e) => setCurp(e.target.value.toUpperCase())}
                className={`${inputCls(errores.curp)} uppercase`} />
              {errores.curp && <span className="text-red-500 text-xs mt-1 ml-2 font-bold">{errores.curp}</span>}
            </div>

            <div className="flex flex-col text-left">
              <label className="text-[#591f96] font-bold ml-2 text-sm">Correo electronico</label>
              <input type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className={inputCls(errores.email)} />
              {errores.email && <span className="text-red-500 text-xs mt-1 ml-2 font-bold">{errores.email}</span>}
            </div>

            <div className="flex flex-col text-left">
              <label className="text-[#591f96] font-bold ml-2 text-sm">Contrasena</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Crea una contrasena segura"
                hasError={!!errores.password}
                ariaLabel="Contrasena"
              />
              <ChecklistContrasena password={password} />
              {errores.password && <span className="text-red-500 text-xs mt-1 ml-2 font-bold">{errores.password}</span>}
            </div>

            <div className="flex flex-col text-left">
              <label className="text-[#591f96] font-bold ml-2 text-sm">Confirmar contrasena</label>
              <PasswordInput
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="Repite tu contrasena"
                hasError={!!errores.password2}
                ariaLabel="Confirmar contrasena"
              />
              {errores.password2 && <span className="text-red-500 text-xs mt-1 ml-2 font-bold">{errores.password2}</span>}
            </div>

            <div className="flex flex-col text-left">
              <label className="text-[#591f96] font-bold ml-2 text-sm">¿Como te gusta que te digan?</label>
              <input type="text" maxLength={50} value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Mariam (opcional)"
                className="w-full bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl px-6 py-4 font-semibold focus:outline-none focus:border-[#591f96] focus:ring-2 focus:ring-[#b174e7] transition-all" />
            </div>

            <button onClick={continuar}
              className="py-4 rounded-full font-bold text-lg mt-4 shadow-lg transition-colors bg-[#591f96] text-white hover:bg-[#3a1366]">
              Continuar
            </button>
          </div>
        </div>

        <div className="w-full md:w-1/2 flex justify-center items-center mt-10 md:mt-0">
          <img src="/Tiburon.png" className="w-full h-full object-cover" alt="Mascota" />
        </div>
      </div>
    </div>
  );
}
