import React, { useState } from 'react';
import {
  api,
  leerArchivoComoTexto,
  leerMetadataDePem,
  leerPrivateKeyDePem,
  signWithPrivateKey,
} from '../api.js';

/**
 * Vincula un nuevo telefono a la cuenta del usuario autenticado con un filtro
 * de seguridad en 3 pasos:
 *
 *   1) telefono  — el usuario escribe el numero; se envia un codigo por SMS.
 *   2) sms       — el usuario ingresa el codigo recibido para confirmar la linea.
 *   3) pem       — el usuario sube su archivo .pem; firmamos un reto con la
 *                  llave privada y el backend lo verifica contra PKI antes de
 *                  vincular definitivamente la linea.
 *
 * No requiere repetir KYC porque los documentos ya estan en su cuenta.
 */
export default function AgregarLinea({ token, user, onLineaAgregada, onCancelar }) {
  const [paso, setPaso]         = useState('telefono'); // 'telefono' | 'sms' | 'pem'
  const [telefono, setTelefono] = useState('');
  const [codigo, setCodigo]     = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState(null);
  const [info, setInfo]         = useState(null);

  // Estado del .pem cargado.
  const [archivoNombre, setArchivoNombre] = useState(null);
  const [privateKey, setPrivateKey]       = useState(null);

  // ----- Paso 1: enviar SMS -----
  const enviarSms = async () => {
    if (telefono.length !== 10) {
      setError('Se requieren 10 dígitos.');
      return;
    }
    setCargando(true);
    setError(null);
    setInfo(null);
    const r = await api.verificarLineaIniciar({ telefono }, token);
    setCargando(false);
    if (r.status === 200 && r.data.ok) {
      setInfo(`Enviamos un código SMS al ${telefono}. En modo demo aparece en la consola del notification-service.`);
      setPaso('sms');
    } else {
      setError(r.data.error ?? 'No se pudo enviar el código.');
    }
  };

  // ----- Paso 2: confirmar codigo SMS -----
  const confirmarSms = async () => {
    if (!/^\d{5}$/.test(codigo)) {
      setError('El código son 5 dígitos.');
      return;
    }
    setCargando(true);
    setError(null);
    setInfo(null);
    const r = await api.verificarLineaConfirmar({ telefono, codigo }, token);
    setCargando(false);
    if (r.status === 200 && r.data.ok) {
      setInfo('Teléfono confirmado. Ahora sube tu llave (.pem) para autorizar la vinculación.');
      setPaso('pem');
    } else {
      setError(r.data.error ?? 'Código incorrecto.');
    }
  };

  const reenviarSms = async () => {
    setCargando(true);
    setError(null);
    const r = await api.verificarLineaIniciar({ telefono }, token);
    setCargando(false);
    if (r.status === 200 && r.data.ok) setInfo('Código reenviado.');
    else setError(r.data.error ?? 'No se pudo reenviar.');
  };

  // ----- Paso 3: cargar .pem y firmar -----
  const cargarPem = async (file) => {
    setCargando(true);
    setError(null);
    try {
      const texto = await leerArchivoComoTexto(file);
      const meta = leerMetadataDePem(texto);
      if (meta.app !== 'yoru' || !meta.userId) {
        throw new Error('Este .pem no parece ser de Yoru.');
      }
      if (user?.id && meta.userId !== user.id) {
        throw new Error('Esta llave pertenece a otra cuenta.');
      }
      const pk = await leerPrivateKeyDePem(texto);
      setPrivateKey(pk);
      setArchivoNombre(file.name);
    } catch (err) {
      setError('No se pudo leer el archivo: ' + err.message);
      setPrivateKey(null);
      setArchivoNombre(null);
    } finally {
      setCargando(false);
    }
  };

  const firmarYVincular = async () => {
    if (!privateKey) return;
    setCargando(true);
    setError(null);
    try {
      const reto = await api.retoLinea({ telefono }, token);
      if (reto.status !== 200 || !reto.data.ok) {
        throw new Error(reto.data.error ?? 'No se pudo iniciar la firma.');
      }
      const { id: challengeId, nonce } = reto.data.challenge;
      const signatureB64 = await signWithPrivateKey(privateKey, nonce);
      const r = await api.agregarLinea({ telefono, challengeId, signatureB64 }, token);
      if (r.status === 201 && r.data.ok) {
        onLineaAgregada(r.data.linea);
      } else {
        throw new Error(r.data.error ?? 'No se pudo vincular la línea.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const Pasos = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {['telefono', 'sms', 'pem'].map((p, i) => {
        const activo = paso === p;
        const completado = ['telefono', 'sms', 'pem'].indexOf(paso) > i;
        return (
          <div key={p} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              activo ? 'bg-[#591f96] text-white' :
              completado ? 'bg-[#b174e7] text-white' : 'bg-[#dfd0f1] text-[#591f96]'
            }`}>{completado ? '✓' : i + 1}</div>
            {i < 2 && <div className={`w-8 h-0.5 ${completado ? 'bg-[#b174e7]' : 'bg-[#dfd0f1]'}`} />}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="w-full max-w-xl flex flex-col items-center animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-xl w-full flex flex-col items-center text-center p-8 md:p-14 mb-8">
        <div className="w-24 h-24 rounded-full bg-[#dfd0f1] flex items-center justify-center mb-6 border-[2px] border-[#b174e7] shadow-inner">
          <span className="text-5xl">{paso === 'pem' ? '🔐' : '📱'}</span>
        </div>
        <h2 className="text-3xl font-extrabold text-[#591f96] mb-2">Vincular otra línea</h2>

        <Pasos />

        {info && (
          <div className="w-full bg-blue-50 border border-blue-300 text-blue-800 px-4 py-3 rounded-xl text-sm mb-4">
            {info}
          </div>
        )}
        {error && (
          <div className="w-full bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        {/* PASO 1 — TELEFONO */}
        {paso === 'telefono' && (
          <>
            <p className="text-[#591f96] text-base font-medium mb-6 max-w-md">
              Escribe el nuevo número. Te enviaremos un código por SMS para
              confirmar que la línea es tuya.
            </p>
            <input
              type="tel"
              maxLength={10}
              value={telefono}
              onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))}
              placeholder="10 dígitos"
              className="w-full max-w-xs bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl px-6 py-4 font-semibold text-center text-lg focus:outline-none focus:border-[#591f96] focus:ring-2 focus:ring-[#b174e7] transition-all mb-4"
            />
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md mt-2">
              <button onClick={onCancelar} className="flex-1 py-3 rounded-full font-bold text-sm bg-white border-[1.5px] border-[#b174e7] text-[#591f96] hover:bg-[#dfd0f1] transition-all">
                Cancelar
              </button>
              <button onClick={enviarSms} disabled={cargando}
                className={`flex-1 py-3 rounded-full font-bold text-sm shadow-lg transition-all ${
                  cargando ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#591f96] text-white hover:bg-[#3a1366]'
                }`}>
                {cargando ? 'Enviando…' : 'Enviar código SMS'}
              </button>
            </div>
          </>
        )}

        {/* PASO 2 — CODIGO SMS */}
        {paso === 'sms' && (
          <>
            <p className="text-[#591f96] text-base font-medium mb-2 max-w-md">
              Ingresa el código de 5 dígitos que enviamos al:
            </p>
            <p className="text-[#bf00ff] font-bold mb-4">{telefono}</p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              placeholder="-----"
              className="w-48 bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl px-6 py-4 font-mono text-center text-2xl tracking-widest focus:outline-none focus:border-[#591f96] focus:ring-2 focus:ring-[#b174e7] transition-all mb-4"
            />
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md mt-2">
              <button onClick={() => { setPaso('telefono'); setCodigo(''); setError(null); setInfo(null); }}
                className="flex-1 py-3 rounded-full font-bold text-sm bg-white border-[1.5px] border-[#b174e7] text-[#591f96] hover:bg-[#dfd0f1] transition-all">
                ← Cambiar número
              </button>
              <button onClick={confirmarSms} disabled={cargando}
                className={`flex-1 py-3 rounded-full font-bold text-sm shadow-lg transition-all ${
                  cargando ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#591f96] text-white hover:bg-[#3a1366]'
                }`}>
                {cargando ? 'Validando…' : 'Confirmar código'}
              </button>
            </div>
            <button onClick={reenviarSms} disabled={cargando}
              className="mt-4 text-sm font-bold text-[#bf00ff] hover:underline disabled:text-gray-400">
              Reenviar código
            </button>
          </>
        )}

        {/* PASO 3 — SUBIR .PEM Y FIRMAR */}
        {paso === 'pem' && (
          <>
            <p className="text-[#591f96] text-base font-medium mb-6 max-w-md">
              Último paso: sube tu archivo <b>.pem</b> para autorizar la
              vinculación con tu llave privada.
            </p>

            {!privateKey ? (
              <label htmlFor="pem-upload-linea"
                className="cursor-pointer border-2 border-dashed border-[#b174e7] rounded-2xl p-8 bg-[#f5eefe] flex flex-col items-center gap-3 hover:bg-[#dfd0f1] transition-all w-full">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center border-[2px] border-[#b174e7] shadow-inner">
                  <span className="text-3xl">📁</span>
                </div>
                <p className="text-[#591f96] font-bold text-center">
                  {cargando ? 'Leyendo archivo…' : 'Selecciona tu archivo .pem'}
                </p>
                <p className="text-[#591f96] text-xs text-center">
                  Es el archivo que descargaste al registrarte
                </p>
                <input id="pem-upload-linea" type="file" accept=".pem,application/x-pem-file" className="hidden"
                  onChange={(e) => e.target.files?.[0] && cargarPem(e.target.files[0])} />
              </label>
            ) : (
              <div className="bg-green-50 border-[1.5px] border-green-400 rounded-2xl p-5 w-full">
                <p className="text-[#591f96] font-bold">Archivo: {archivoNombre}</p>
                <button onClick={() => { setPrivateKey(null); setArchivoNombre(null); }}
                  className="text-[#bf00ff] text-xs font-bold hover:underline mt-1">
                  Cambiar archivo
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md mt-6">
              <button onClick={onCancelar} className="flex-1 py-3 rounded-full font-bold text-sm bg-white border-[1.5px] border-[#b174e7] text-[#591f96] hover:bg-[#dfd0f1] transition-all">
                Cancelar
              </button>
              <button onClick={firmarYVincular} disabled={cargando || !privateKey}
                className={`flex-1 py-3 rounded-full font-bold text-sm shadow-lg transition-all ${
                  cargando || !privateKey ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#591f96] text-white hover:bg-[#3a1366]'
                }`}>
                {cargando ? 'Vinculando…' : 'Firmar y vincular línea'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
