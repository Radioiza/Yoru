import React, { useState } from 'react';
import Home from './Home.jsx';
import Tutorial from './Tutorial.jsx';
import App from './App.jsx';

export default function Router() {
  const [vista, setVista] = useState('home');

  if (vista === 'home') {
    return (
      <Home
        onRegistrarse={() => setVista('registro')}
        onTutorial={() => setVista('tutorial')}
        onLogin={() => setVista('login')}
      />
    );
  }

  if (vista === 'tutorial') {
    return (
      <Tutorial
        onVolver={() => setVista('home')}
        onRegistrarse={() => setVista('registro')}
      />
    );
  }

  if (vista === 'registro' || vista === 'login') {
    // Para 'registro' saltamos directo al formulario (la pantalla 'inicio'
    // interna del App.jsx es vieja y duplicada del Home).
    // Para 'login' arrancamos en la pantalla de carga de archivo de llave.
    const pantallaInicial = vista === 'login' ? 'login' : 'formulario';
    return (
      <div className="relative">
        <button
          onClick={() => setVista('home')}
          className="fixed top-20 left-4 z-50 bg-white text-[#591f96] border-[1.5px] border-[#b174e7] px-4 py-2 rounded-full font-bold text-xs shadow-lg hover:bg-[#f5eefe] transition-all"
        >
          ⌂ Inicio
        </button>
        <App pantallaInicial={pantallaInicial} onSalir={() => setVista('home')} />
      </div>
    );
  }

  return null;
}
