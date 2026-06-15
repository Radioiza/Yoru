import React, { useState, useRef, useLayoutEffect } from 'react';

/* ============================================================
   PASOS — cada uno apunta a un ref del mockup, no a coordenadas
   "a ojo". Así el spotlight queda alineado perfecto siempre.
   ============================================================ */
const PASOS = [
  {
    mockup: 'formulario',
    target: 'telefono',
    arrowSide: 'right',
    cajaTexto: 'bottom-right',
    titulo: 'Llena tu teléfono',
    descripcion: 'Escribe aquí tu número de celular (10 dígitos).',
    porque: 'Es la línea que vamos a proteger. Más adelante podrás vincular otras líneas a la misma cuenta.',
  },
  {
    mockup: 'formulario',
    target: 'curp',
    arrowSide: 'right',
    cajaTexto: 'bottom-right',
    titulo: 'Ahora tu CURP',
    descripcion: 'Escribe los 18 caracteres de tu CURP. Las letras se pondrán en mayúsculas solas.',
    porque: 'Es como tu acta de nacimiento digital: confirma que la persona detrás del número eres tú de verdad.',
  },
  {
    mockup: 'formulario',
    target: 'email',
    arrowSide: 'right',
    cajaTexto: 'top-right',
    titulo: 'Tu correo electrónico',
    descripcion: 'Escribe un correo al que tengas acceso.',
    porque: 'Te enviaremos un código para confirmar tu cuenta y, si algún día olvidas tu contraseña, podrás recuperarla por aquí.',
  },
  {
    mockup: 'formulario',
    target: 'password',
    arrowSide: 'right',
    cajaTexto: 'top-right',
    titulo: 'Crea tu contraseña',
    descripcion: 'Elige una contraseña segura y repítela para confirmarla.',
    porque: 'Con tu correo y tu contraseña iniciarás sesión cada vez que entres. La verás marcada en verde cuando ambas coincidan.',
  },
  {
    mockup: 'formulario',
    target: 'continuarForm',
    arrowSide: 'above',
    cajaTexto: 'top-right',
    titulo: 'Presiona Continuar',
    descripcion: 'Cuando todos los datos estén llenos, toca el botón morado.',
    porque: 'Nada se guarda todavía: solo revisamos que tus datos estén bien escritos antes de avanzar.',
  },
  {
    mockup: 'biometria',
    target: 'ineSection',
    arrowSide: 'right',
    cajaTexto: 'bottom-right',
    titulo: 'Sube tu INE',
    descripcion: 'Selecciona el PDF de tu credencial de elector.',
    porque: 'Necesitamos ver tu identificación oficial para confirmar que la persona del CURP es la dueña del teléfono.',
  },
  {
    mockup: 'biometria',
    target: 'camaraSection',
    arrowSide: 'right',
    cajaTexto: 'top-right',
    titulo: 'Toma tu selfie',
    descripcion: 'Activa la cámara y captura tu rostro de frente.',
    porque: 'Comparamos tu cara con la foto de tu INE. Así nadie puede registrar un teléfono con la identidad de otra persona.',
  },
  {
    mockup: 'generacion',
    target: 'generarBtn',
    arrowSide: 'above',
    cajaTexto: 'top-right',
    titulo: 'Genera tu identidad y guarda tu llave',
    descripcion: 'Toca el botón. Se creará tu llave y se descargará un archivo .pem en tu dispositivo.',
    porque: 'Ese archivo .pem es tu respaldo: lo necesitas para recuperar tu cuenta y para autorizar nuevas líneas. Guárdalo en un lugar seguro, porque la llave nunca sale de tu dispositivo.',
  },
  {
    mockup: 'verificarEmail',
    target: 'codigoEmail',
    arrowSide: 'right',
    cajaTexto: 'top-right',
    titulo: 'Confirma tu correo',
    descripcion: 'Escribe el código de 5 dígitos que te enviamos por correo.',
    porque: 'Hasta que confirmes el código, tu cuenta no se crea de verdad. Así nos aseguramos de que el correo es tuyo.',
  },
  {
    mockup: 'login',
    target: 'loginBtn',
    arrowSide: 'above',
    cajaTexto: 'top-right',
    titulo: 'Inicia sesión',
    descripcion: 'Entra con tu correo y la contraseña que creaste.',
    porque: 'Ya con tu cuenta activa, este es el acceso normal de cada día. Si olvidas la contraseña, la recuperas con tu correo o tu archivo .pem.',
  },
  {
    mockup: 'cuenta',
    target: 'lineasSection',
    arrowSide: 'left',
    cajaTexto: 'top-right',
    titulo: 'Tu panel de cuenta',
    descripcion: 'Aquí ves todas tus líneas protegidas y su estado.',
    porque: 'Si pierden o te roban un teléfono, toca “Reportar” para bloquear la línea al instante (kill switch). Cuando la recuperes, la reactivas tú mismo.',
  },
  {
    mockup: 'agregarLinea',
    target: 'pemUpload',
    arrowSide: 'right',
    cajaTexto: 'top-right',
    titulo: 'Agrega otra línea',
    descripcion: 'Confirma el nuevo número por SMS y sube tu archivo .pem para autorizarlo.',
    porque: 'No repites tu INE ni tu selfie: tu llave .pem firma la solicitud y demuestra que la cuenta es tuya. Por eso es tan importante conservarla.',
  },
];

/* ============================================================
   MOCKUPS — réplicas de las pantallas reales.
   Cada mockup recibe un objeto `refs` y los pega en los
   elementos highlightables.
   ============================================================ */

function MockupFormulario({ refs }) {
  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl w-full max-w-5xl flex flex-col md:flex-row gap-8 p-8 md:p-12">
      <div className="w-full md:w-1/2">
        <button className="text-[#bf00ff] font-bold text-sm mb-4">← Volver al inicio</button>
        <h2 className="text-3xl font-extrabold text-[#591f96] mb-1">Crear tu cuenta</h2>
        <p className="text-[#bf00ff] text-xs mb-6">Nada se guarda hasta que confirmes el código de tu correo.</p>

        <div className="flex flex-col gap-4 max-w-md">
          <div ref={refs.telefono} className="flex flex-col">
            <label className="text-[#591f96] font-bold ml-2 text-sm">Teléfono</label>
            <div className="w-full bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl px-6 py-3 font-semibold text-[#591f96]">
              5512345678
            </div>
          </div>
          <div ref={refs.curp} className="flex flex-col">
            <label className="text-[#591f96] font-bold ml-2 text-sm">CURP</label>
            <div className="w-full bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl px-6 py-3 font-semibold text-[#591f96]">
              GOMC900101HDFRRR01
            </div>
          </div>
          <div ref={refs.email} className="flex flex-col">
            <label className="text-[#591f96] font-bold ml-2 text-sm">Correo electrónico</label>
            <div className="w-full bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl px-6 py-3 font-semibold text-[#591f96]">
              mariam@correo.com
            </div>
          </div>
          <div ref={refs.password} className="flex flex-col">
            <label className="text-[#591f96] font-bold ml-2 text-sm">Contraseña</label>
            <div className="w-full bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl px-6 py-3 font-semibold text-[#591f96] tracking-widest">
              ••••••••••
            </div>
            <label className="text-[#591f96] font-bold ml-2 text-sm mt-3">Confirmar contraseña</label>
            <div className="w-full bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl px-6 py-3 font-semibold text-[#591f96] tracking-widest">
              ••••••••••
            </div>
            <span className="text-green-600 text-xs mt-1 ml-2 font-bold">✓ Las contraseñas coinciden</span>
          </div>
          <button ref={refs.continuarForm} className="bg-[#591f96] text-white py-4 rounded-full font-bold text-lg shadow-lg mt-2">
            Continuar
          </button>
        </div>
      </div>
      <div className="w-full md:w-1/2 flex justify-center items-center">
        <img src="/Tiburon.png" className="w-full max-w-[18rem]" alt="" />
      </div>
    </div>
  );
}

function MockupBiometria({ refs }) {
  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl w-full max-w-2xl p-8 md:p-12">
      <button className="text-[#bf00ff] font-bold text-sm mb-2">← Volver</button>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-extrabold text-[#591f96] mb-1">Validación de Identidad</h2>
        <p className="text-[#591f96] font-medium text-sm">Sube tu INE y verifica tu rostro.</p>
      </div>

      <div className="flex flex-col gap-6">
        <div ref={refs.ineSection}>
          <h3 className="text-left font-bold text-[#591f96] flex items-center gap-2 mb-2">
            <span className="bg-[#dfd0f1] w-7 h-7 rounded-full flex items-center justify-center text-xs">1</span>
            Documento INE (PDF)
          </h3>
          <div className="border-2 border-dashed border-[#b174e7] rounded-2xl p-6 bg-[#f5eefe] flex justify-center">
            <div className="bg-[#591f96] text-white px-6 py-2 rounded-full font-bold text-sm">
              Seleccionar PDF
            </div>
          </div>
        </div>

        <div ref={refs.camaraSection}>
          <h3 className="text-left font-bold text-[#591f96] flex items-center gap-2 mb-2">
            <span className="bg-[#dfd0f1] w-7 h-7 rounded-full flex items-center justify-center text-xs">2</span>
            Reconocimiento Facial
          </h3>
          <div className="aspect-video bg-black rounded-2xl flex items-center justify-center">
            <div className="bg-white text-[#591f96] px-6 py-3 rounded-full font-bold shadow-lg">
              Activar Cámara
            </div>
          </div>
        </div>

        <button className="bg-gray-200 text-gray-400 py-4 rounded-full font-bold text-lg">
          Continuar
        </button>
      </div>
    </div>
  );
}

function MockupGeneracion({ refs }) {
  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl w-full max-w-xl flex flex-col items-center text-center p-8 md:p-14">
      <div className="w-24 h-24 rounded-full bg-[#dfd0f1] flex items-center justify-center mb-6 border-[2px] border-[#b174e7]">
        <span className="text-5xl">🔐</span>
      </div>
      <h2 className="text-3xl font-extrabold text-[#591f96] mb-4">Protegiendo tu Identidad</h2>
      <p className="text-[#591f96] text-base font-medium mb-8 max-w-md">
        Generaremos tu par de llaves localmente y descargaremos tu archivo .pem de respaldo. Tu llave privada nunca abandonará este dispositivo.
      </p>
      <div ref={refs.generarBtn} className="bg-[#591f96] text-white py-4 px-8 rounded-full font-bold text-lg shadow-lg w-full max-w-sm">
        Generar mi Identidad Local
      </div>
      <div className="bg-yellow-50 border-[1.5px] border-yellow-400 rounded-2xl p-3 mt-6 w-full max-w-sm">
        <p className="text-yellow-800 text-xs leading-snug">
          ⚠️ Guarda tu archivo <b>.pem</b>: lo necesitas para recuperar tu cuenta y agregar líneas.
        </p>
      </div>
    </div>
  );
}

function MockupVerificarEmail({ refs }) {
  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl w-full max-w-xl flex flex-col items-center text-center p-8 md:p-14">
      <div className="w-24 h-24 rounded-full bg-[#dfd0f1] flex items-center justify-center mb-6 border-[2px] border-[#b174e7]">
        <span className="text-5xl">📩</span>
      </div>
      <h2 className="text-3xl font-extrabold text-[#591f96] mb-2">Confirma tu correo</h2>
      <p className="text-[#591f96] text-base font-medium mb-1 max-w-md">
        Enviamos un código de 5 dígitos a:
      </p>
      <p className="text-[#bf00ff] font-bold mb-6">mariam@correo.com</p>
      <div ref={refs.codigoEmail} className="w-48 bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl px-6 py-4 font-mono text-center text-2xl tracking-widest text-[#591f96] mb-6">
        4 2 7 1 9
      </div>
      <div className="flex gap-3 w-full max-w-md">
        <div className="flex-1 py-3 rounded-full font-bold text-sm bg-white border-[1.5px] border-[#b174e7] text-[#591f96]">
          Cancelar registro
        </div>
        <div className="flex-1 py-3 rounded-full font-bold text-sm bg-[#591f96] text-white shadow-lg">
          Validar código
        </div>
      </div>
    </div>
  );
}

function MockupLogin({ refs }) {
  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl w-full max-w-xl flex flex-col p-8 md:p-12">
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-full bg-[#dfd0f1] flex items-center justify-center mx-auto mb-4 border-[2px] border-[#b174e7]">
          <span className="text-4xl">🔓</span>
        </div>
        <h2 className="text-3xl font-extrabold text-[#591f96] mb-1">Iniciar sesión</h2>
        <p className="text-[#591f96] font-medium">Usa tu correo y contraseña.</p>
      </div>
      <div className="flex flex-col gap-4 max-w-md mx-auto w-full">
        <div className="flex flex-col">
          <label className="text-[#591f96] font-bold ml-2 text-sm">Correo</label>
          <div className="w-full bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl px-6 py-3 font-semibold text-[#591f96]">
            mariam@correo.com
          </div>
        </div>
        <div className="flex flex-col">
          <label className="text-[#591f96] font-bold ml-2 text-sm">Contraseña</label>
          <div className="w-full bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl px-6 py-3 font-semibold text-[#591f96] tracking-widest">
            ••••••••••
          </div>
        </div>
        <div ref={refs.loginBtn} className="bg-[#591f96] text-white py-4 rounded-full font-bold text-lg shadow-lg mt-2 text-center">
          Iniciar sesión
        </div>
        <p className="text-[#bf00ff] text-sm font-bold text-center mt-1">¿Olvidaste tu contraseña o correo?</p>
      </div>
    </div>
  );
}

function MockupCuenta({ refs }) {
  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl w-full max-w-3xl p-8 md:p-12">
      <div className="flex items-center gap-5 mb-8">
        <div className="w-20 h-20 rounded-full bg-[#dfd0f1] border-[3px] border-[#b174e7] flex items-center justify-center text-4xl">👤</div>
        <div>
          <span className="inline-block bg-[#dfd0f1] text-[#3a1366] text-xs font-bold px-3 py-1 rounded-full mb-1 tracking-wider uppercase">Sesión activa</span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#591f96] leading-tight">Buenas tardes, Mariam</h2>
        </div>
      </div>

      <div ref={refs.lineasSection} className="bg-white border-[1.5px] border-[#b174e7] rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-extrabold text-[#591f96]">Mis líneas (2)</h3>
          <span className="text-[#bf00ff] text-xs font-bold">+ Agregar otra</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[#591f96] font-extrabold text-lg">5512345678</p>
            <span className="inline-block mt-1 px-3 py-1 rounded-full text-xs font-extrabold bg-green-100 text-green-700">ACTIVA</span>
          </div>
          <span className="text-xs font-bold px-3 py-2 rounded-full bg-red-500 text-white">🚨 Reportar</span>
        </div>
        <div className="flex items-center justify-between border-t border-[#dfd0f1] pt-3 mt-3">
          <div>
            <p className="text-[#591f96] font-extrabold text-lg">5598765432</p>
            <span className="inline-block mt-1 px-3 py-1 rounded-full text-xs font-extrabold bg-green-100 text-green-700">ACTIVA</span>
          </div>
          <span className="text-xs font-bold px-3 py-2 rounded-full bg-red-500 text-white">🚨 Reportar</span>
        </div>
      </div>
    </div>
  );
}

function MockupAgregarLinea({ refs }) {
  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl w-full max-w-xl flex flex-col items-center text-center p-8 md:p-14">
      <div className="w-24 h-24 rounded-full bg-[#dfd0f1] flex items-center justify-center mb-6 border-[2px] border-[#b174e7]">
        <span className="text-5xl">🔐</span>
      </div>
      <h2 className="text-3xl font-extrabold text-[#591f96] mb-4">Vincular otra línea</h2>
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-[#b174e7] text-white">✓</div>
        <div className="w-8 h-0.5 bg-[#b174e7]" />
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-[#b174e7] text-white">✓</div>
        <div className="w-8 h-0.5 bg-[#b174e7]" />
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-[#591f96] text-white">3</div>
      </div>
      <p className="text-[#591f96] text-base font-medium mb-6 max-w-md">
        Confirmaste el número por SMS. Último paso: sube tu archivo <b>.pem</b> para autorizar con tu llave privada.
      </p>
      <div ref={refs.pemUpload} className="border-2 border-dashed border-[#b174e7] rounded-2xl p-8 bg-[#f5eefe] flex flex-col items-center gap-3 w-full">
        <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center border-[2px] border-[#b174e7]">
          <span className="text-3xl">📁</span>
        </div>
        <p className="text-[#591f96] font-bold">Selecciona tu archivo .pem</p>
        <p className="text-[#591f96] text-xs">Es el archivo que descargaste al registrarte</p>
      </div>
    </div>
  );
}

const MOCKUPS = {
  formulario:     MockupFormulario,
  biometria:      MockupBiometria,
  generacion:     MockupGeneracion,
  verificarEmail: MockupVerificarEmail,
  login:          MockupLogin,
  cuenta:         MockupCuenta,
  agregarLinea:   MockupAgregarLinea,
};

/* ============================================================
   useTargetRect — hook que mide la posición del ref en pantalla
   y se vuelve a medir si la ventana cambia o cambia el paso.
   ============================================================ */
function useTargetRect(targetRef, refreshKey) {
  const [rect, setRect] = useState(null);

  useLayoutEffect(() => {
    function medir() {
      if (targetRef?.current) {
        const r = targetRef.current.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        setRect(null);
      }
    }

    medir();
    // re-medir después del layout y de cualquier animación corta
    const t1 = setTimeout(medir, 60);
    const t2 = setTimeout(medir, 250);

    window.addEventListener('resize', medir);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', medir);
    };
  }, [targetRef, refreshKey]);

  return rect;
}

/* ============================================================
   SPOTLIGHT — rectángulo iluminado + dark overlay
   ============================================================ */
function Spotlight({ rect }) {
  if (!rect) return null;

  // Padding pequeño para que el borde no quede pegado al elemento
  const padding = 10;
  const style = {
    position: 'fixed',
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
    borderRadius: '1rem',
    pointerEvents: 'none',
  };

  return (
    <>
      <div
        className="z-20 transition-all duration-500"
        style={{
          ...style,
          boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.78)',
          outline: '4px solid #bf00ff',
          outlineOffset: '0px',
        }}
      />
      <div
        className="z-20 transition-all duration-500 animate-ping-slow"
        style={{
          ...style,
          border: '3px solid #bf00ff',
          opacity: 0.7,
        }}
      />
    </>
  );
}

/* ============================================================
   FLECHA — colocada a un lado del spotlight, apuntando hacia él
   ============================================================ */
function FlechaAnimada({ rect, side }) {
  if (!rect) return null;

  const ARROW_W = 90;
  const ARROW_H = 120;
  const GAP = 30; // espacio entre el spotlight y la flecha

  // Rotación según hacia dónde debe apuntar la punta.
  // SVG original apunta arriba (tip arriba). 0 deg = arriba.
  let top, left, rotation;
  switch (side) {
    case 'above': // flecha encima del spotlight, apuntando hacia abajo
      top = rect.top - GAP - ARROW_H / 2;
      left = rect.left + rect.width / 2;
      rotation = 180;
      break;
    case 'left': // flecha a la izquierda, apuntando a la derecha
      top = rect.top + rect.height / 2;
      left = rect.left - GAP - ARROW_W / 2;
      rotation = 90;
      break;
    case 'right': // flecha a la derecha, apuntando a la izquierda
      top = rect.top + rect.height / 2;
      left = rect.left + rect.width + GAP + ARROW_W / 2;
      rotation = 270;
      break;
    case 'below': // flecha debajo, apuntando arriba
    default:
      top = rect.top + rect.height + GAP + ARROW_H / 2;
      left = rect.left + rect.width / 2;
      rotation = 0;
  }

  return (
    <div
      className="z-30 pointer-events-none animate-bounce-tutorial"
      style={{
        position: 'fixed',
        top,
        left,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        '--rot': `${rotation}deg`,
      }}
    >
      <svg width={ARROW_W} height={ARROW_H} viewBox="0 0 90 120" style={{ filter: 'drop-shadow(0 8px 16px rgba(124, 44, 191, 0.6))' }}>
        <path
          d="M 45 0 L 88 60 L 62 60 L 62 115 L 28 115 L 28 60 L 2 60 Z"
          fill="#bf00ff"
          stroke="white"
          strokeWidth="5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/* ============================================================
   CAJA DE TEXTO — instrucciones + botones
   ============================================================ */
function CajaTexto({ paso, total, datos, onAnterior, onSiguiente, onSaltar, posicion }) {
  const posClases = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left':  'bottom-6 left-6',
    'top-right':    'top-20 right-6',
    'top-left':     'top-20 left-6',
  }[posicion] ?? 'bottom-6 right-6';

  return (
    <div className={`fixed z-40 ${posClases} max-w-sm w-[90vw] md:w-full animate-fade-in-up`}>
      <div className="bg-white rounded-[2rem] shadow-2xl p-6 border-[2px] border-[#b174e7]">
        <div className="flex items-center justify-between mb-3">
          <span className="inline-block bg-[#dfd0f1] text-[#3a1366] text-xs font-bold px-3 py-1 rounded-full tracking-wider uppercase">
            Paso {paso} / {total}
          </span>
          <button onClick={onSaltar} className="text-red-500 text-xs font-bold hover:underline">
            Saltar
          </button>
        </div>

        <h3 className="text-2xl font-extrabold text-[#591f96] mb-2 leading-tight">
          {datos.titulo}
        </h3>
        <p className="text-[#591f96] font-medium mb-3 text-sm">
          {datos.descripcion}
        </p>
        <div className="bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-xl p-3 mb-4">
          <p className="text-[#591f96] font-bold text-xs leading-snug">
            💡 <span className="uppercase tracking-wider">¿Por qué?</span> {datos.porque}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onAnterior}
            disabled={paso === 1}
            className={`flex-1 py-2 rounded-full font-bold text-xs transition-all ${
              paso === 1
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-white border-[1.5px] border-[#b174e7] text-[#591f96] hover:bg-[#dfd0f1]'
            }`}
          >
            ← Anterior
          </button>
          <button
            onClick={onSiguiente}
            className="flex-1 py-2 rounded-full font-bold text-xs bg-[#591f96] text-white hover:bg-[#3a1366] shadow-lg transition-all"
          >
            {paso === total ? 'Finalizar' : 'Siguiente →'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PANTALLA DE BIENVENIDA
   ============================================================ */
function Bienvenida({ onEmpezar, onVolver }) {
  return (
    <div className="min-h-screen bg-[#f5eefe] flex flex-col font-sans">
      <header
        className="w-full py-4 flex justify-center items-center shadow-md"
        style={{ background: 'radial-gradient(circle at center, #bf00f0 0%, #591f96 100%)' }}
      >
        <h1 className="text-white text-4xl font-bold italic tracking-tighter">YORU</h1>
      </header>

      <main className="flex-grow flex items-center justify-center px-4 py-8">
        <div className="bg-white rounded-[2.5rem] shadow-xl w-full max-w-2xl flex flex-col items-center text-center p-8 md:p-14 relative">
          {onVolver && (
            <button onClick={onVolver} className="absolute top-8 left-8 text-[#bf00ff] hover:text-[#3a1366] font-bold text-sm transition-colors">
              ← Volver al inicio
            </button>
          )}

          <div className="w-28 h-28 rounded-full bg-[#dfd0f1] flex items-center justify-center mb-6 border-[3px] border-[#b174e7] shadow-inner">
            <span className="text-6xl">🎯</span>
          </div>

          <span className="inline-block bg-[#dfd0f1] text-[#3a1366] text-xs font-bold px-4 py-1 rounded-full mb-4 tracking-wider uppercase">
            Tutorial interactivo
          </span>

          <h2 className="text-3xl md:text-4xl font-extrabold text-[#591f96] mb-4 leading-tight">
            ¿Cómo funciona Yoru?
          </h2>
          <p className="text-[#591f96] text-base md:text-lg font-medium mb-8 max-w-md">
            Te enseñamos paso a paso cómo crear tu cuenta, proteger tu línea telefónica y agregar más líneas, mostrándote exactamente qué tocar y por qué.
          </p>

          <button
            onClick={onEmpezar}
            className="bg-[#591f96] text-white py-4 px-12 rounded-full font-bold text-lg hover:bg-[#3a1366] transition-all shadow-lg"
          >
            Empezar tutorial
          </button>

          <p className="text-[#bf00ff] text-xs mt-4 font-medium">
            Toma menos de 3 minutos · Puedes saltarlo cuando quieras
          </p>
        </div>
      </main>
    </div>
  );
}

/* ============================================================
   PANTALLA FINAL
   ============================================================ */
function Completado({ onRegistrarse, onVolver }) {
  return (
    <div className="min-h-screen bg-[#f5eefe] flex flex-col font-sans">
      <header
        className="w-full py-4 flex justify-center items-center shadow-md"
        style={{ background: 'radial-gradient(circle at center, #bf00f0 0%, #591f96 100%)' }}
      >
        <h1 className="text-white text-4xl font-bold italic tracking-tighter">YORU</h1>
      </header>

      <main className="flex-grow flex items-center justify-center px-4 py-8">
        <div className="bg-white rounded-[2.5rem] shadow-xl w-full max-w-2xl flex flex-col items-center text-center p-8 md:p-14">
          <div className="w-28 h-28 rounded-full bg-green-100 flex items-center justify-center mb-6 border-[3px] border-green-400 shadow-inner">
            <span className="text-6xl">🎉</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-extrabold text-[#591f96] mb-4">
            ¡Tutorial completado!
          </h2>
          <p className="text-[#591f96] text-base md:text-lg font-medium mb-8 max-w-md">
            Ya sabes cómo funciona Yoru. ¿Listo para registrarte?
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
            <button
              onClick={onRegistrarse}
              className="flex-1 bg-[#591f96] text-white py-4 px-8 rounded-full font-bold text-lg hover:bg-[#3a1366] transition-all shadow-lg"
            >
              Registrarme ahora
            </button>
            <button
              onClick={onVolver}
              className="flex-1 bg-white border-[1.5px] border-[#b174e7] text-[#591f96] py-4 px-8 rounded-full font-bold text-lg hover:bg-[#dfd0f1] transition-all"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */
export default function Tutorial({ onVolver, onRegistrarse }) {
  const [paso, setPaso] = useState(-1);
  const total = PASOS.length;

  // Refs persistentes para todos los elementos highlightables.
  // Se quedan vivos entre cambios de paso y los mockups los pegan a su DOM.
  const refs = {
    telefono:        useRef(null),
    curp:            useRef(null),
    email:           useRef(null),
    password:        useRef(null),
    continuarForm:   useRef(null),
    ineSection:      useRef(null),
    camaraSection:   useRef(null),
    generarBtn:      useRef(null),
    codigoEmail:     useRef(null),
    loginBtn:        useRef(null),
    lineasSection:   useRef(null),
    pemUpload:       useRef(null),
  };

  const actual = paso >= 0 && paso < total ? PASOS[paso] : null;
  const targetRef = actual ? refs[actual.target] : null;
  const rect = useTargetRect(targetRef, paso);

  if (paso === -1) {
    return <Bienvenida onEmpezar={() => setPaso(0)} onVolver={onVolver} />;
  }
  if (paso >= total) {
    return <Completado onRegistrarse={onRegistrarse} onVolver={onVolver} />;
  }

  const MockupActual = MOCKUPS[actual.mockup];

  return (
    <div className="min-h-screen bg-[#f5eefe] flex flex-col font-sans relative overflow-hidden">
      <style>{`
        @keyframes bounce-tutorial {
          0%, 100% { transform: translate(-50%, -50%) rotate(var(--rot, 0deg)) translateY(0); }
          50%      { transform: translate(-50%, -50%) rotate(var(--rot, 0deg)) translateY(-12px); }
        }
        .animate-bounce-tutorial { animation: bounce-tutorial 1.2s ease-in-out infinite; }

        @keyframes ping-slow {
          0%   { transform: scale(1);    opacity: 0.7; }
          75%  { transform: scale(1.08); opacity: 0;   }
          100% { transform: scale(1.08); opacity: 0;   }
        }
        .animate-ping-slow { animation: ping-slow 1.8s cubic-bezier(0,0,0.2,1) infinite; }

        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.4s ease-out; }
      `}</style>

      <header className="bg-[#3a1366] w-full py-4 flex justify-center items-center relative z-50 shadow-md">
        <h1 className="text-white text-4xl font-bold italic tracking-tighter">YORU</h1>
      </header>

      <main className="flex-grow relative overflow-hidden">
        {/* MOCKUP base */}
        <div className="absolute inset-0 flex items-center justify-center p-8 z-10">
          <MockupActual refs={refs} />
        </div>

        {/* SPOTLIGHT alineado al elemento real */}
        <Spotlight rect={rect} />

        {/* FLECHA apuntando al elemento */}
        <FlechaAnimada rect={rect} side={actual.arrowSide} />

        {/* CAJA DE TEXTO */}
        <CajaTexto
          paso={paso + 1}
          total={total}
          datos={actual}
          onAnterior={() => setPaso((p) => Math.max(0, p - 1))}
          onSiguiente={() => setPaso((p) => p + 1)}
          onSaltar={onVolver}
          posicion={actual.cajaTexto}
        />

        {/* PROGRESS DOTS */}
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 flex gap-2">
          {PASOS.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === paso
                  ? 'bg-[#b174e7] w-8 shadow-lg'
                  : i < paso
                  ? 'bg-[#591f96] w-2'
                  : 'bg-white/50 w-2'
              }`}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
