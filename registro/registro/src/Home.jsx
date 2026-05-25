import React from 'react';

export default function Home({ onRegistrarse, onTutorial, onLogin }) {
  return (
    <div className="min-h-screen bg-[#f5eefe] flex flex-col font-sans relative overflow-hidden">

      <header
        className="w-full py-4 flex justify-center items-center relative z-10 shadow-md"
        style={{ background: 'radial-gradient(circle at center, #bf00f0 0%, #591f96 100%)' }}
      >
        <h1 className="text-white text-4xl font-bold italic tracking-tighter">YORU</h1>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center max-w-6xl mx-auto px-4 md:px-8 py-8 relative z-10 w-full">

        {/* HERO PRINCIPAL */}
        <div className="w-full flex flex-col items-center animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-xl w-full flex flex-col md:flex-row items-center justify-between p-8 md:p-12 mb-8 gap-8">

            <div className="w-full md:w-1/2 flex flex-col items-start text-left md:pr-8">
              <span className="inline-block bg-[#dfd0f1] text-[#3a1366] text-xs font-bold px-4 py-1 rounded-full mb-4 tracking-wider uppercase">
                Bienvenido
              </span>

              <h2 className="text-4xl md:text-[3.2rem] font-extrabold text-[#591f96] mb-6 leading-tight">
                Tu identidad móvil, ahora <span className="text-[#591f96]">segura</span>.
              </h2>

              <p className="text-[#591f96] text-base md:text-lg mb-8 max-w-md font-medium">
                YORU vincula tu línea telefónica a tu identidad mediante criptografía ECDSA. Sin contraseñas, sin servidores que guarden tus llaves.
              </p>

              <div className="w-full max-w-md flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={onRegistrarse}
                    className="bg-[#591f96] text-white py-4 px-6 rounded-full font-bold text-lg hover:bg-[#3a1366] transition-colors shadow-lg flex-1"
                  >
                    Registrarme
                  </button>
                  <button
                    onClick={onLogin}
                    className="bg-[#591f96] text-white py-4 px-6 rounded-full font-bold text-lg hover:bg-[#3a1366] transition-colors shadow-lg flex-1"
                  >
                    Iniciar sesión
                  </button>
                </div>
                <button
                  onClick={onTutorial}
                  className="bg-white border-[1.5px] border-[#b174e7] text-[#591f96] py-3 px-6 rounded-full font-bold text-sm hover:bg-[#f5eefe] transition-colors shadow-sm"
                >
                  Ver tutorial
                </button>
              </div>
            </div>

            <div className="w-full md:w-1/2 flex justify-center items-center">
              <img src="/Tiburoncin1.png" className="w-full max-w-[28rem] h-auto" alt="Mascota YORU" />
            </div>
          </div>

          {/* TARJETAS DE BENEFICIOS */}
          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

            <div className="bg-white rounded-[2rem] shadow-xl p-8 flex flex-col items-start gap-3">
              <div className="w-14 h-14 rounded-full bg-[#dfd0f1] flex items-center justify-center border-[2px] border-[#b174e7] shadow-inner">
                <span className="text-2xl">🔐</span>
              </div>
              <h3 className="text-xl font-extrabold text-[#591f96]">Llaves locales</h3>
              <p className="text-[#591f96] font-medium text-sm">
                Tu llave privada se genera y queda en tu dispositivo. Nadie más puede usarla.
              </p>
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl p-8 flex flex-col items-start gap-3">
              <div className="w-14 h-14 rounded-full bg-[#dfd0f1] flex items-center justify-center border-[2px] border-[#b174e7] shadow-inner">
                <span className="text-2xl">🪪</span>
              </div>
              <h3 className="text-xl font-extrabold text-[#591f96]">Validación INE</h3>
              <p className="text-[#591f96] font-medium text-sm">
                Vincula tu identidad oficial y tu rostro a tu número de teléfono.
              </p>
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl p-8 flex flex-col items-start gap-3">
              <div className="w-14 h-14 rounded-full bg-[#dfd0f1] flex items-center justify-center border-[2px] border-[#b174e7] shadow-inner">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-xl font-extrabold text-[#591f96]">ECDSA P-256</h3>
              <p className="text-[#591f96] font-medium text-sm">
                Firma digital estándar, rápida y compatible con Web Crypto API.
              </p>
            </div>

          </div>

          {/* CTA SECUNDARIO */}
          <div className="bg-white rounded-[2.5rem] shadow-xl w-full flex flex-col md:flex-row items-center justify-between p-8 md:p-10 gap-6">
            <div className="flex flex-col items-start text-left">
              <h3 className="text-2xl md:text-3xl font-extrabold text-[#591f96] mb-2">
                ¿Es tu primera vez?
              </h3>
              <p className="text-[#591f96] font-medium max-w-xl">
                Aprende paso a paso cómo registrarte y proteger tu línea en menos de 3 minutos.
              </p>
            </div>
            <button
              onClick={onTutorial}
              className="bg-[#591f96] text-white py-4 px-8 rounded-full font-bold text-lg hover:bg-[#3a1366] transition-all shadow-lg whitespace-nowrap"
            >
              Empezar tutorial →
            </button>
          </div>
        </div>

      </main>

      <footer className="w-full px-8 py-6 flex flex-col md:flex-row justify-between items-center text-[#591f96] text-xs font-bold relative z-10 gap-6 mt-auto">
        <p>©2026 ESCOM</p>
        <div className="flex flex-row items-center gap-8 md:gap-16">
          <a href="#" className="hover:underline">Ayuda</a>
          <div className="w-10 h-10 rounded-full border-[2px] border-[#591f96] flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-[#591f96] opacity-20"></div>
          </div>
          <span className="text-xl italic font-black tracking-tighter">ESCOM</span>
        </div>
      </footer>
    </div>
  );
}
