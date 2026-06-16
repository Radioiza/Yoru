import React, { useEffect, useRef, useState } from 'react';
import { api, uploadToPresignedUrl, dataUrlToBlob } from '../api.js';

function obtenerSaludo() {
  const h = new Date().getHours();
  if (h < 12) return 'Buen dia';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}
function inicialDesdeCurp(curp) {
  if (!curp || curp.length < 4) return null;
  return curp[3].toUpperCase();
}

export default function Cuenta({
  token,
  user,             // { id, telefono, curp, nombre, publicKeyId }
  publicKeyId,
  onAgregarLinea,
  onIniciarRevocacion,
  onCerrarSesion,
}) {
  const [lineas, setLineas]       = useState([]);
  const [cargando, setCargando]   = useState(false);
  const [mensaje, setMensaje]     = useState(null);

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [esSelfieDefault, setEsSelfieDefault] = useState(true);
  const [editandoFoto, setEditandoFoto]       = useState(false);
  const [camaraPerfil, setCamaraPerfil]       = useState(false);
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  // CURP copy
  const [curpCopiado, setCurpCopiado] = useState(false);

  const copiarCurp = async () => {
    try {
      await navigator.clipboard.writeText(user.curp);
      setCurpCopiado(true);
      setTimeout(() => setCurpCopiado(false), 2000);
    } catch {}
  };

  const cargarLineas = async () => {
    setCargando(true);
    const r = await api.listarMisLineas(token);
    setCargando(false);
    if (r.status === 200 && r.data.ok) setLineas(r.data.lineas);
  };

  const cargarFotoPerfil = async () => {
    const r = await api.fotoPerfilUrl({ userId: user.id });
    if (r.status === 200 && r.data.ok) {
      setAvatarUrl(r.data.url);
      setEsSelfieDefault(r.data.esSelfie === true);
    }
  };

  useEffect(() => {
    cargarLineas();
    cargarFotoPerfil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Acciones por linea (kill switch / desbloquear) -----
  const accionKillSwitch = async (telefono) => {
    if (!confirm(`¿Reportar ${telefono} como robada o perdida?`)) return;
    setCargando(true);
    const r = await api.killSwitch({ telefono, motivo: 'usuario_lo_pidio' }, token);
    setCargando(false);
    if (r.status === 200) cargarLineas();
    else setMensaje(r.data.error ?? 'No se pudo activar el kill switch.');
  };
  const accionDesbloquear = async (telefono) => {
    setCargando(true);
    const r = await api.desbloquearLinea({ telefono }, token);
    setCargando(false);
    if (r.status === 200) cargarLineas();
    else setMensaje(r.data.error ?? 'No se pudo desbloquear.');
  };

  // ----- Foto de perfil -----
  const activarCamaraPerfil = async () => {
    setCamaraPerfil(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      alert('No se pudo acceder a la camara.');
      setCamaraPerfil(false);
    }
  };
  const tomarFotoPerfil = async () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    const dataUrl = c.toDataURL('image/jpeg');
    v.srcObject?.getTracks().forEach(t => t.stop());
    setCamaraPerfil(false);
    await subirFotoPerfil(dataUrlToBlob(dataUrl), 'image/jpeg');
    setEditandoFoto(false);
  };
  const cancelarCamaraPerfil = () => {
    const v = videoRef.current;
    v?.srcObject?.getTracks().forEach(t => t.stop());
    setCamaraPerfil(false);
  };
  const cambiarFotoDesdeArchivo = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await subirFotoPerfil(file, file.type || 'image/jpeg');
    setEditandoFoto(false);
  };
  const usarSelfieDefault = async () => {
    // Borrar la foto perfil custom para que vuelva a usar la selfie original.
    const r = await api.guardarFotoPerfil({ userId: user.id, refFotoPerfilS3: '' });
    if (r.status === 200) cargarFotoPerfil();
    setEditandoFoto(false);
  };

  const subirFotoPerfil = async (blobOFile, contentType) => {
    setCargando(true);
    try {
      const u = await api.fotoPerfilUploadUrl({ userId: user.id, curp: user.curp, contentType });
      if (u.status !== 200 || !u.data.ok) throw new Error(u.data.error ?? 'No URL');
      await uploadToPresignedUrl(u.data.uploadUrl, blobOFile, contentType);
      const g = await api.guardarFotoPerfil({ userId: user.id, refFotoPerfilS3: u.data.key });
      if (g.status !== 200) throw new Error(g.data.error ?? 'No se pudo guardar');
      await cargarFotoPerfil();
    } catch (err) {
      setMensaje('No se pudo cambiar la foto: ' + err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="w-full max-w-3xl flex flex-col items-center animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-xl w-full p-8 md:p-12 mb-8 relative">

        <button onClick={onCerrarSesion} className="absolute top-8 right-8 text-red-500 font-bold text-xs hover:underline">
          Cerrar sesion
        </button>

        {mensaje && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-xl text-sm flex justify-between">
            <span>{mensaje}</span>
            <button onClick={() => setMensaje(null)}>×</button>
          </div>
        )}

        <div className="flex items-center gap-5 mb-8">
          <div className="relative flex-shrink-0">
            <div className="w-24 h-24 rounded-full bg-[#dfd0f1] border-[3px] border-[#b174e7] shadow-inner overflow-hidden flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl">👤</span>
              )}
            </div>
            <button onClick={() => setEditandoFoto(v => !v)} title="Cambiar foto"
              className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[#591f96] text-white flex items-center justify-center shadow-lg hover:bg-[#3a1366] transition-all border-[2px] border-white">
              📷
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <span className="inline-block bg-[#dfd0f1] text-[#3a1366] text-xs font-bold px-3 py-1 rounded-full mb-2 tracking-wider uppercase">Sesion activa</span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-[#591f96] leading-tight">
              {obtenerSaludo()}{user.nombre ? `, ${user.nombre}` : (inicialDesdeCurp(user.curp) ? `, ${inicialDesdeCurp(user.curp)}.` : '')}
            </h2>
            {esSelfieDefault && avatarUrl && (
              <p className="text-[#bf00ff] text-xs mt-1">Tu foto de perfil es tu selfie del registro. Toca 📷 para cambiarla.</p>
            )}
          </div>
        </div>

        {editandoFoto && (
          <div className="bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl p-5 mb-6 animate-fade-in">
            <p className="text-[#591f96] font-bold text-sm mb-3">Cambiar foto de perfil</p>
            <p className="text-[#bf00ff] text-xs mb-4">
              La selfie original NO se puede modificar (es prueba de identidad). Aqui solo cambias la foto que se muestra.
            </p>

            {camaraPerfil ? (
              <div className="flex flex-col gap-3">
                <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                </div>
                <div className="flex gap-2">
                  <button onClick={cancelarCamaraPerfil} className="flex-1 py-2 rounded-full font-bold text-xs bg-white border-[1.5px] border-[#b174e7] text-[#591f96]">Cancelar</button>
                  <button onClick={tomarFotoPerfil} className="flex-1 py-2 rounded-full font-bold text-xs bg-[#591f96] text-white">📸 Capturar</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button onClick={activarCamaraPerfil} className="py-3 rounded-full font-bold text-xs bg-[#591f96] text-white">📸 Tomar nueva</button>
                <label htmlFor="foto-perfil-upload" className="cursor-pointer py-3 rounded-full font-bold text-xs bg-white border-[1.5px] border-[#b174e7] text-[#591f96] text-center">
                  🖼️ Elegir archivo
                  <input id="foto-perfil-upload" type="file" accept="image/*" className="hidden" onChange={cambiarFotoDesdeArchivo} />
                </label>
                <button onClick={usarSelfieDefault} className="py-3 rounded-full font-bold text-xs bg-white border-[1.5px] border-[#b174e7] text-[#591f96]">↺ Usar selfie</button>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
            <button onClick={() => { cancelarCamaraPerfil(); setEditandoFoto(false); }} className="block mx-auto mt-4 text-[#bf00ff] text-xs font-bold hover:underline">
              Cerrar
            </button>
          </div>
        )}

        {/* DATOS DEL USUARIO */}
        <div className="bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-[#bf00ff] text-xs font-bold uppercase tracking-wider mb-1">CURP</p>
            <div className="flex items-center gap-2">
              <p className="text-[#591f96] font-bold text-sm font-mono break-all flex-1">{user.curp}</p>
              <button onClick={copiarCurp} title="Copiar CURP" className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm transition-all ${curpCopiado ? 'bg-[#bf00ff]' : 'bg-[#b174e7] hover:bg-[#bf00ff]'}`}>
                {curpCopiado ? '✓' : '📋'}
              </button>
            </div>
          </div>
          <div>
            <p className="text-[#bf00ff] text-xs font-bold uppercase tracking-wider mb-1">User ID</p>
            <p className="text-[#591f96] font-mono text-xs break-all">{user.id}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-[#bf00ff] text-xs font-bold uppercase tracking-wider mb-1">Public Key ID</p>
            <p className="text-[#591f96] font-mono text-xs break-all">{publicKeyId ?? '—'}</p>
          </div>
        </div>

        {/* LINEAS */}
        <div className="bg-white border-[1.5px] border-[#b174e7] rounded-2xl p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-extrabold text-[#591f96]">Mis lineas ({lineas.length})</h3>
            <div className="flex gap-2">
              <button onClick={cargarLineas} disabled={cargando} className="text-[#591f96] text-xs font-bold hover:underline">🔄 Refrescar</button>
              {lineas.length < 10 ? (
                <button onClick={onAgregarLinea} className="text-[#bf00ff] text-xs font-bold hover:underline">+ Agregar otra</button>
              ) : (
                <span className="text-[#a98fc4] text-xs font-bold" title="Máximo de 10 líneas por cuenta">Máx. 10 líneas</span>
              )}
            </div>
          </div>

          {lineas.length === 0 && !cargando && (
            <p className="text-[#591f96] font-medium text-sm">No tienes lineas activas. Agrega una.</p>
          )}

          {lineas.map((l) => (
            <div key={l.id} className="border-t border-[#dfd0f1] pt-3 mt-3 first:border-t-0 first:pt-0 first:mt-0">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <p className="text-[#591f96] font-extrabold text-lg">{l.telefono}</p>
                  <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-extrabold ${
                    l.estado === 'activa' ? 'bg-green-100 text-green-700' :
                    l.estado === 'kill_switched' || l.estado === 'bloqueada' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{l.estado.toUpperCase()}</span>
                </div>
                <div className="flex gap-2">
                  {l.estado !== 'kill_switched' ? (
                    <button onClick={() => accionKillSwitch(l.telefono)} disabled={cargando}
                      className="text-xs font-bold px-3 py-2 rounded-full bg-red-500 text-white hover:bg-red-600">
                      🚨 Reportar
                    </button>
                  ) : (
                    <button onClick={() => accionDesbloquear(l.telefono)} disabled={cargando}
                      className="text-xs font-bold px-3 py-2 rounded-full bg-green-500 text-white hover:bg-green-600">
                      🔓 Reactivar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* RESTABLECER SEGURIDAD (antes "Revocar mi llave") */}
        <button
          onClick={onIniciarRevocacion}
          disabled={cargando || !publicKeyId}
          className={`w-full py-4 rounded-2xl font-bold text-sm shadow-lg transition-all ${
            cargando || !publicKeyId ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#3a1366] text-white hover:bg-[#591f96]'
          }`}
        >
          🔄 Restablecer mi seguridad
        </button>
        <p className="text-[#bf00ff] text-xs mt-2 text-center max-w-md mx-auto">
          Crea una nueva llave de acceso y desvincula todas tus lineas.
          Usalo si perdiste tu archivo de respaldo o crees que alguien lo tiene.
        </p>

        <p className="text-[#bf00ff] text-xs mt-6 font-medium text-center">
          Tu sesion expira automaticamente en 1 hora por seguridad.
        </p>
      </div>
    </div>
  );
}
