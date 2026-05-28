import React from 'react';

/**
 * Cabecera + pie + banner de error consistente para todas las pantallas
 * internas del flujo de registro/login/cuenta.
 */
export default function Layout({ mensajeBackend, onLimpiarMensaje, children }) {
  return (
    <div className="min-h-screen bg-[#f5eefe] flex flex-col font-sans relative overflow-hidden">
      <header
        className="w-full py-4 flex justify-center items-center relative z-10 shadow-md"
        style={{ background: 'radial-gradient(circle at center, #bf00f0 0%, #591f96 100%)' }}
      >
        <h1 className="text-white text-4xl font-bold italic tracking-tighter">YORU</h1>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center max-w-6xl mx-auto px-4 md:px-8 py-8 relative z-10 w-full">
        {mensajeBackend && (
          <div className="w-full max-w-2xl mb-4 bg-red-100 border border-red-400 text-red-700 px-6 py-3 rounded-2xl font-bold text-sm flex justify-between items-center">
            <span>⚠️ {mensajeBackend}</span>
            <button onClick={onLimpiarMensaje} className="text-red-700 hover:text-red-900 text-lg leading-none">×</button>
          </div>
        )}
        {children}
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
