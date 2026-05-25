import React, { useState, useRef } from 'react';

/* ============================================================
   HELPERS DE UI
   ============================================================ */
function obtenerSaludo() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buen día';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/**
 * El CURP guarda la inicial del nombre en su 4ta posición.
 * Ejemplo: GOMC900101HDFRRR01 → C → "C."
 * No podemos extraer el nombre completo, solo la inicial.
 */
function inicialDesdeCurp(curp) {
  if (!curp || curp.length < 4) return null;
  return curp[3].toUpperCase();
}
import {
  api,
  publicKeyToPem,
  signWithPrivateKey,
  dataUrlToBlob,
  uploadToPresignedUrl,
  privateKeyToJwk,
  importPrivateKeyFromJwk,
  descargarArchivo,
  leerArchivoComoTexto,
} from './api.js';

export default function RegistroIdentidad({ pantallaInicial = 'inicio', onSalir }) {
  // --- ESTADOS DE NAVEGACIÓN ---
  const [pantallaActual, setPantallaActual] = useState(pantallaInicial);

  // Si Router nos dio onSalir, lo usamos para "Volver al inicio" desde
  // pantallas que son entradas directas (login). En el flujo de registro
  // las pantallas internas siguen usando setPantallaActual('inicio').
  const volverInicio = () => onSalir ? onSalir() : setPantallaActual('inicio');

  // --- ESTADOS DEL FORMULARIO (PANTALLA 2) ---
  const [telefono, setTelefono] = useState('');
  const [curp, setCurp] = useState('');
  const [nombre, setNombre] = useState('');
  const [erroresForm, setErroresForm] = useState({});

  // --- ESTADOS DE BIOMETRÍA (PANTALLA 3) ---
  const [pdfIne, setPdfIne] = useState(null);
  const [fotoCapturada, setFotoCapturada] = useState(null);
  const [camaraEncendida, setCamaraEncendida] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // La llave privada vive solo en memoria del navegador.
  // Usamos useRef porque las CryptoKey no son serializables como estado React.
  const privateKeyRef = useRef(null);

  // --- ESTADOS DE CRIPTOGRAFÍA (PANTALLA 4) ---
  const [llavesGeneradas, setLlavesGeneradas] = useState(false);

  // --- ESTADOS DEL WIRE AL BACKEND ---
  const [userId, setUserId] = useState(null);
  const [publicKeyId, setPublicKeyId] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [mensajeBackend, setMensajeBackend] = useState(null);

  // --- ESTADOS DEL RETO DE FIRMA (PANTALLA 5) ---
  const [nonceActual, setNonceActual] = useState(null);
  const [firmaValida, setFirmaValida] = useState(null); // null | true | false

  // --- SESIÓN AUTENTICADA (JWT) ---
  const [token, setToken] = useState(null);
  const [lineaInfo, setLineaInfo] = useState(null);

  // --- FOTO DE PERFIL EDITABLE ---
  // Default: la selfie del registro (sirve como avatar). El usuario puede
  // cambiarla por una nueva foto o por una imagen de su galería/computadora.
  const [fotoPerfil, setFotoPerfil] = useState(null);
  const [editandoFoto, setEditandoFoto] = useState(false);
  const [camaraPerfilActiva, setCamaraPerfilActiva] = useState(false);
  const videoPerfilRef = useRef(null);
  const canvasPerfilRef = useRef(null);

  const activarCamaraPerfil = async () => {
    setCamaraPerfilActiva(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoPerfilRef.current) videoPerfilRef.current.srcObject = stream;
    } catch (err) {
      alert('No se pudo acceder a la cámara. Revisa los permisos.');
      setCamaraPerfilActiva(false);
    }
  };

  const tomarFotoPerfil = () => {
    const video = videoPerfilRef.current;
    const canvas = canvasPerfilRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    setFotoPerfil(canvas.toDataURL('image/jpeg'));

    const stream = video.srcObject;
    stream?.getTracks().forEach((t) => t.stop());
    setCamaraPerfilActiva(false);
    setEditandoFoto(false);
  };

  const cancelarCamaraPerfil = () => {
    const video = videoPerfilRef.current;
    const stream = video?.srcObject;
    stream?.getTracks().forEach((t) => t.stop());
    setCamaraPerfilActiva(false);
  };

  const cambiarFotoDesdeArchivo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setFotoPerfil(e.target.result);
      setEditandoFoto(false);
    };
    reader.readAsDataURL(file);
  };

  const usarFotoDelRegistro = () => {
    setFotoPerfil(fotoCapturada);
    setEditandoFoto(false);
  };

  // Foto efectiva: la del perfil si la cambió, si no la del registro, si no null.
  const avatarUrl = fotoPerfil ?? fotoCapturada;

  // --- COPIA DE CURP AL CLIPBOARD ---
  const [curpCopiado, setCurpCopiado] = useState(false);
  const copiarCurp = async () => {
    if (!curp) return;
    try {
      await navigator.clipboard.writeText(curp);
      setCurpCopiado(true);
      setTimeout(() => setCurpCopiado(false), 2000);
    } catch (err) {
      console.warn('No se pudo copiar al portapapeles:', err);
    }
  };

  // --- ARCHIVO DE LLAVE DESCARGABLE ---
  // Después de generar, guardamos el contenido del archivo para que el
  // usuario lo pueda descargar (botón) o re-descargar si lo necesita.
  const [archivoLlave, setArchivoLlave] = useState(null); // { filename, contenido }

  // --- LOGIN: archivo cargado por el usuario ---
  const [llaveCargada, setLlaveCargada] = useState(null); // { userId, telefono, ... }

  /**
   * Carga un archivo de llave (.json) que el usuario seleccionó desde su
   * dispositivo. Valida el contenido, importa la llave privada y deja todo
   * listo para firmar el reto.
   */
  const cargarLlaveDesdeArchivo = async (file) => {
    setCargando(true);
    setMensajeBackend(null);
    try {
      const texto = await leerArchivoComoTexto(file);
      const data = JSON.parse(texto);
      if (data.app !== 'yoru' || !data.privateKeyJwk || !data.userId) {
        throw new Error('Este archivo no parece ser una llave de Yoru válida.');
      }
      const priv = await importPrivateKeyFromJwk(data.privateKeyJwk);
      privateKeyRef.current = priv;
      setUserId(data.userId);
      setTelefono(data.telefono ?? '');
      setCurp(data.curp ?? '');
      setNombre(data.nombre ?? '');
      setPublicKeyId(data.publicKeyId ?? null);
      setLlaveCargada({
        userId: data.userId,
        telefono: data.telefono,
        publicKeyId: data.publicKeyId,
        fechaGeneracion: data.fechaGeneracion,
      });
    } catch (err) {
      console.error(err);
      setMensajeBackend('No se pudo leer el archivo: ' + err.message);
      setLlaveCargada(null);
    } finally {
      setCargando(false);
    }
  };

  const limpiarLlaveCargada = () => {
    setLlaveCargada(null);
    privateKeyRef.current = null;
    setUserId(null);
    setPublicKeyId(null);
    setTelefono('');
    setCurp('');
    setNombre('');
  };

  // --- LÓGICA DE VALIDACIÓN (PANTALLA 2) ---
  const irABiometria = async () => {
    const err = {};
    if (telefono.length !== 10) err.telefono = "Se requieren 10 dígitos.";
    if (curp.length !== 18) err.curp = "Se requieren 18 caracteres.";

    setErroresForm(err);
    if (Object.keys(err).length > 0) return;

    setCargando(true);
    setMensajeBackend(null);
    const { status, data } = await api.registrar({ telefono, curp, nombre: nombre.trim() || null });
    setCargando(false);

    if (status === 201 && data.ok) {
      setUserId(data.user.id);
      setPantallaActual('biometria');
    } else if (data.errores) {
      setErroresForm(data.errores);
    } else {
      setMensajeBackend(data.error ?? 'No se pudo registrar el usuario.');
    }
  };

  // --- LOGIN: firma reto + JWT (PANTALLA 5) ---
  // Pide un nonce al auth-service, lo firma localmente y llama a /login.
  // Auth llama internamente a PKI verify; si todo cuadra, emite un JWT.
  const firmarReto = async () => {
    if (!userId) {
      setMensajeBackend('Falta el userId.');
      return;
    }
    if (!privateKeyRef.current) {
      setMensajeBackend('La llave privada se perdió. Tienes que regenerar.');
      return;
    }

    setCargando(true);
    setMensajeBackend(null);
    setFirmaValida(null);

    try {
      // 1. Pedir el challenge.
      const ch = await api.pedirChallenge({ userId });
      if (ch.status !== 200 || !ch.data.ok) {
        throw new Error(ch.data.error ?? 'No se pudo obtener el challenge.');
      }
      const { id: challengeId, nonce } = ch.data.challenge;
      setNonceActual(nonce);

      // 2. Firmar el nonce localmente.
      const signatureB64 = await signWithPrivateKey(privateKeyRef.current, nonce);

      // 3. Login: auth verificará con PKI y emitirá el JWT.
      const r = await api.login({ userId, challengeId, signatureB64 });
      if (r.status !== 200 || !r.data.ok) {
        throw new Error(r.data.error ?? 'Login fallido.');
      }

      setToken(r.data.token);
      setFirmaValida(true);
      console.log('JWT recibido, expira en', r.data.expiresIn, 's');
    } catch (err) {
      console.error('Error en login:', err);
      setMensajeBackend(err.message);
      setFirmaValida(false);
    } finally {
      setCargando(false);
    }
  };

  // --- ACCIONES PROTEGIDAS DE "MI CUENTA" ---

  const cargarMiCuenta = async () => {
    if (!token || !telefono) return;
    setCargando(true);
    try {
      const r = await api.obtenerLinea({ telefono });
      if (r.status === 200 && r.data.ok) setLineaInfo(r.data.linea);
    } finally {
      setCargando(false);
    }
  };

  const accionKillSwitch = async () => {
    if (!confirm('¿Reportar tu línea como robada o perdida? Quedará bloqueada hasta que la reactives.')) return;
    setCargando(true);
    const r = await api.killSwitch({ telefono, motivo: 'usuario_lo_pidio' }, token);
    setCargando(false);
    if (r.status === 200) {
      setLineaInfo(r.data.linea);
    } else {
      setMensajeBackend(r.data.error ?? 'No se pudo activar el kill switch.');
    }
  };

  const accionDesbloquear = async () => {
    setCargando(true);
    const r = await api.desbloquearLinea({ telefono }, token);
    setCargando(false);
    if (r.status === 200) {
      setLineaInfo(r.data.linea);
    } else {
      setMensajeBackend(r.data.error ?? 'No se pudo desbloquear.');
    }
  };

  const accionRevocar = async () => {
    if (!publicKeyId) return;
    if (!confirm('¿Revocar tu llave activa? Tendrás que generar una nueva para volver a iniciar sesión.')) return;
    setCargando(true);
    const r = await api.revocarLlave({ publicKeyId }, token);
    setCargando(false);
    if (r.status === 200) {
      setMensajeBackend('Llave revocada. Tu sesión actual sigue válida pero no podrás reanudar después.');
    } else {
      setMensajeBackend(r.data.error ?? 'No se pudo revocar.');
    }
  };

  const cerrarSesion = () => {
    setToken(null);
    setLineaInfo(null);
    setFirmaValida(null);
    setNonceActual(null);
    setPantallaActual('inicio');
  };

  // --- WIRE BIOMETRÍA → KYC (PANTALLA 3 → 4) ---
  // Flujo: presigned URLs → PUT directo a MinIO → crear KYC → aprobar.
  const irAGeneracion = async () => {
    if (!userId) {
      setMensajeBackend('Falta el userId. Vuelve al formulario.');
      return;
    }
    if (!pdfIne || !fotoCapturada) {
      setMensajeBackend('Faltan documentos por subir.');
      return;
    }

    setCargando(true);
    setMensajeBackend(null);

    try {
      // 1. Pedir presigned URLs al KYC.
      const u = await api.obtenerPresignedUrls({ userId });
      if (u.status !== 200 || !u.data.ok) {
        throw new Error(u.data.error ?? 'No se pudieron generar URLs de subida.');
      }
      const { ineUploadUrl, selfieUploadUrl, ineKey, selfieKey } = u.data;

      // 2. Subir PDF + selfie a MinIO directamente, en paralelo.
      const selfieBlob = dataUrlToBlob(fotoCapturada);
      await Promise.all([
        uploadToPresignedUrl(ineUploadUrl,    pdfIne,     'application/pdf'),
        uploadToPresignedUrl(selfieUploadUrl, selfieBlob, 'image/jpeg'),
      ]);

      // 3. Crear el KYC request con las rutas reales de S3.
      const crear = await api.crearKyc({
        userId,
        refIneS3:    ineKey,
        refSelfieS3: selfieKey,
      });
      if (crear.status !== 201) {
        throw new Error(crear.data.error ?? 'No se pudo crear la solicitud KYC.');
      }

      // 4. Auto-aprobación de demo.
      const aprobar = await api.aprobarKyc({ userId, scoreMatch: 0.95 });
      if (aprobar.status !== 200 || !aprobar.data.ok) {
        throw new Error(aprobar.data.error ?? 'No se pudo aprobar el KYC.');
      }

      setPantallaActual('generacion');
    } catch (err) {
      console.error('Error en upload/KYC:', err);
      setMensajeBackend(err.message);
    } finally {
      setCargando(false);
    }
  };

  // --- LÓGICA DE CÁMARA (PANTALLA 3) ---
  const encenderCamara = async () => {
    setCamaraEncendida(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert("No se pudo acceder a la cámara. Revisa los permisos.");
      setCamaraEncendida(false);
    }
  };

  const capturarFoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      setFotoCapturada(canvas.toDataURL('image/jpeg'));
      
      const stream = video.srcObject;
      stream.getTracks().forEach(track => track.stop());
      setCamaraEncendida(false);
    }
  };

  // --- LÓGICA CRIPTOGRÁFICA ECDSA (PANTALLA 4) ---
  const generarLlaves = async () => {
    if (!userId) {
      setMensajeBackend('Falta el userId. Vuelve al formulario.');
      return;
    }
    setCargando(true);
    setMensajeBackend(null);

    try {
      // 1. Generar el par ECDSA P-256 localmente con Web Crypto API.
      //    extractable=true para poder exportar ambas: la pública a PEM
      //    para enviar al backend, y la privada a JWK para descargar.
      const keyPair = await window.crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"]
      );

      // 2. Exportar la pública (PEM) y la privada (JWK).
      const publicKeyPem = await publicKeyToPem(keyPair.publicKey);
      const privateKeyJwk = await privateKeyToJwk(keyPair.privateKey);

      // Re-importar la privada como extractable:false en memoria, para
      // poder firmar el reto inmediatamente sin volver a leer el archivo.
      const privateKeyNoExt = await importPrivateKeyFromJwk(privateKeyJwk);
      privateKeyRef.current = privateKeyNoExt;

      // 3. Registrar la llave pública en el PKI.
      const reg = await api.registrarLlave({ userId, publicKeyPem });
      if (reg.status !== 201) {
        throw new Error(reg.data.error ?? 'No se pudo registrar la llave pública.');
      }
      setPublicKeyId(reg.data.key.id);

      // 4. Vincular la línea telefónica en Telecom service.
      const vincular = await api.vincularLinea({
        telefono,
        userId,
        publicKeyId: reg.data.key.id,
      });
      if (vincular.status !== 201 && vincular.status !== 409) {
        throw new Error(vincular.data.error ?? 'No se pudo vincular la línea.');
      }

      // 5. Construir el archivo descargable que el usuario debe guardar.
      //    Es la única forma de iniciar sesión más adelante.
      const archivo = {
        app: 'yoru',
        version: 1,
        userId,
        telefono,
        curp,
        nombre,
        publicKeyId: reg.data.key.id,
        publicKeyPem,
        privateKeyJwk,
        fechaGeneracion: new Date().toISOString(),
      };
      setArchivoLlave({
        filename: `yoru-llave-${telefono}.json`,
        contenido: JSON.stringify(archivo, null, 2),
      });

      setLlavesGeneradas(true);
    } catch (error) {
      console.error("Error en la generación/registro de llaves:", error);
      setMensajeBackend(error.message ?? 'Error al generar tu identidad segura.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5eefe] flex flex-col font-sans relative overflow-hidden">
      
      <header
        className="w-full py-4 flex justify-center items-center relative z-10 shadow-md"
        style={{ background: 'radial-gradient(circle at center, #bf00f0 0%, #591f96 100%)' }}
      >
        <h1 className="text-white text-4xl font-bold italic tracking-tighter">YORU</h1>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center max-w-6xl mx-auto px-4 md:px-8 py-8 relative z-10 w-full">

        {/* BANNER DE ERROR/INFO DEL BACKEND */}
        {mensajeBackend && (
          <div className="w-full max-w-2xl mb-4 bg-red-100 border border-red-400 text-red-700 px-6 py-3 rounded-2xl font-bold text-sm flex justify-between items-center">
            <span>⚠️ {mensajeBackend}</span>
            <button onClick={() => setMensajeBackend(null)} className="text-red-700 hover:text-red-900 text-lg leading-none">×</button>
          </div>
        )}

        {/* 1. PANTALLA DE INICIO */}
        {pantallaActual === 'inicio' && (
          <div className="w-full flex flex-col items-center animate-fade-in">
            <div className="bg-white rounded-[2.5rem] shadow-xl w-full flex flex-col md:flex-row items-center justify-between p-8 md:p-12 mb-8 gap-8">
              <div className="w-full md:w-1/2 flex flex-col items-start text-left md:pr-8">
                <h2 className="text-4xl md:text-[3.2rem] font-extrabold text-[#591f96] mb-6 leading-tight">Registro de usuarios de telefonía móvil</h2>
                <p className="text-[#591f96] text-base md:text-lg mb-8 max-w-md font-medium">Protege tu línea vinculando tu identidad mediante criptografía ECDSA.</p>
                <div className="w-full max-w-md flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setPantallaActual('formulario')}
                    className="flex-1 bg-[#591f96] text-white py-4 px-6 rounded-full font-bold text-lg hover:bg-[#3a1366] transition-colors shadow-lg"
                  >
                    Registrarme
                  </button>
                  <button
                    onClick={() => setPantallaActual('login')}
                    className="flex-1 bg-white border-[1.5px] border-[#b174e7] text-[#591f96] py-4 px-6 rounded-full font-bold text-lg hover:bg-[#dfd0f1] transition-colors shadow-sm"
                  >
                    Iniciar sesión
                  </button>
                </div>
              </div>
              <div className="w-full md:w-1/2 flex justify-center items-center">
                <img src="/Tiburoncin1.png" className="w-full max-w-[28rem] h-auto" alt="Mascota" />
              </div>
            </div>
          </div>
        )}

        {/* PANTALLA DE LOGIN — el usuario sube su archivo de llave */}
        {pantallaActual === 'login' && (
          <div className="w-full max-w-2xl flex flex-col items-center animate-fade-in">
            <div className="bg-white rounded-[2.5rem] shadow-xl w-full p-8 md:p-12 mb-8 relative">
              <button
                onClick={volverInicio}
                className="absolute top-8 left-8 text-[#bf00ff] hover:text-[#3a1366] font-bold text-sm transition-colors z-20"
              >
                ← Volver al inicio
              </button>

              <div className="text-center mt-8 mb-8">
                <div className="w-20 h-20 rounded-full bg-[#dfd0f1] flex items-center justify-center mx-auto mb-4 border-[2px] border-[#b174e7] shadow-inner">
                  <span className="text-4xl">🔐</span>
                </div>
                <h2 className="text-3xl font-extrabold text-[#591f96] mb-2">Iniciar sesión</h2>
                <p className="text-[#591f96] font-medium max-w-md mx-auto">
                  Carga tu archivo de llave para firmar el reto y entrar a tu cuenta.
                </p>
              </div>

              {!llaveCargada ? (
                <div className="flex flex-col gap-4">
                  <label
                    htmlFor="llave-upload"
                    className="cursor-pointer border-2 border-dashed border-[#b174e7] rounded-2xl p-8 bg-[#f5eefe] flex flex-col items-center gap-3 hover:bg-[#dfd0f1] transition-all"
                  >
                    <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center border-[2px] border-[#b174e7] shadow-inner">
                      <span className="text-3xl">📁</span>
                    </div>
                    <p className="text-[#591f96] font-bold text-center">
                      {cargando ? 'Leyendo archivo…' : 'Selecciona tu archivo de llave (.json)'}
                    </p>
                    <p className="text-[#591f96] text-xs text-center">
                      Es el archivo que descargaste al registrarte
                    </p>
                    <input
                      id="llave-upload"
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && cargarLlaveDesdeArchivo(e.target.files[0])}
                    />
                  </label>

                  <div className="text-center mt-2">
                    <p className="text-[#591f96] text-sm">
                      ¿No tienes una llave todavía?
                    </p>
                    <button
                      onClick={() => setPantallaActual('formulario')}
                      className="text-[#bf00ff] font-bold text-sm hover:underline"
                    >
                      Regístrate aquí →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="bg-green-50 border-[1.5px] border-green-400 rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center border-[2px] border-green-400 shadow-inner flex-shrink-0">
                      <span className="text-2xl">✅</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#591f96] font-extrabold text-lg truncate">
                        {llaveCargada.telefono ?? 'Llave cargada'}
                      </p>
                      <p className="text-[#bf00ff] text-xs font-mono truncate">
                        {llaveCargada.userId.slice(0, 18)}…
                      </p>
                      {llaveCargada.fechaGeneracion && (
                        <p className="text-[#591f96] text-xs mt-1">
                          Generada: {new Date(llaveCargada.fechaGeneracion).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={limpiarLlaveCargada}
                      className="flex-1 py-3 rounded-full font-bold text-sm bg-white border-[1.5px] border-[#b174e7] text-[#591f96] hover:bg-[#dfd0f1] transition-all"
                    >
                      Cambiar archivo
                    </button>
                    <button
                      onClick={() => setPantallaActual('reto')}
                      className="flex-1 py-3 rounded-full font-bold text-sm bg-[#591f96] text-white hover:bg-[#3a1366] shadow-lg transition-all"
                    >
                      Firmar y entrar →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. PANTALLA DE FORMULARIO */}
        {pantallaActual === 'formulario' && (
          <div className="w-full flex flex-col items-center animate-fade-in">
            <div className="bg-white rounded-[2.5rem] shadow-xl w-full flex flex-col md:flex-row p-8 md:p-12 mb-8 relative gap-8">
              <button onClick={volverInicio} className="absolute top-8 left-8 text-[#bf00ff] hover:text-[#3a1366] font-bold text-sm transition-colors z-20">← Volver al inicio</button>
              
              <div className="w-full md:w-1/2 flex flex-col mt-10 md:mt-4 md:pr-8">
                <div className="flex flex-col items-center md:items-start text-center md:text-left mb-8">

                  <h2 className="text-3xl font-extrabold text-[#591f96] mb-2">Ingresa tus datos</h2>

                </div>

                <div className="flex flex-col gap-6 w-full max-w-md mx-auto md:mx-0">
                  <div className="flex flex-col text-left">
                    <label className="text-[#591f96] font-bold ml-2">Teléfono</label>
                    <input type="tel" maxLength={10} value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ''))} className={`w-full bg-[#f5eefe] border-[1.5px] rounded-2xl px-6 py-4 font-semibold focus:outline-none focus:border-[#591f96] focus:ring-2 focus:ring-[#b174e7] transition-all ${erroresForm.telefono ? 'border-red-500' : 'border-[#b174e7]'}`} />
                    {erroresForm.telefono && <span className="text-red-500 text-xs mt-1 ml-2 font-bold">{erroresForm.telefono}</span>}
                  </div>
                  
                  <div className="flex flex-col text-left">
                    <label className="text-[#591f96] font-bold ml-2">CURP</label>
                    <input type="text" maxLength={18} value={curp} onChange={(e) => setCurp(e.target.value.toUpperCase())} className={`w-full bg-[#f5eefe] border-[1.5px] rounded-2xl px-6 py-4 font-semibold uppercase focus:outline-none focus:border-[#591f96] focus:ring-2 focus:ring-[#b174e7] transition-all ${erroresForm.curp ? 'border-red-500' : 'border-[#b174e7]'}`} />
                    {erroresForm.curp && <span className="text-red-500 text-xs mt-1 ml-2 font-bold">{erroresForm.curp}</span>}
                  </div>

                  <div className="flex flex-col text-left">
                    <label className="text-[#591f96] font-bold ml-2">¿Cómo te gusta que te digan?</label>
                    <input
                      type="text"
                      maxLength={50}
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      placeholder="Ej. Mariam"
                      className={`w-full bg-[#f5eefe] border-[1.5px] rounded-2xl px-6 py-4 font-semibold focus:outline-none focus:border-[#591f96] focus:ring-2 focus:ring-[#b174e7] transition-all ${erroresForm.nombre ? 'border-red-500' : 'border-[#b174e7]'}`}
                    />
                    {erroresForm.nombre
                      ? <span className="text-red-500 text-xs mt-1 ml-2 font-bold">{erroresForm.nombre}</span>
                      : <span className="text-[#bf00ff] text-xs mt-1 ml-2 font-medium">Opcional. Lo usaremos para saludarte.</span>}
                  </div>

                  <button
                    onClick={irABiometria}
                    disabled={cargando}
                    className={`py-4 rounded-full font-bold text-lg mt-4 shadow-lg transition-colors ${
                      cargando ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#591f96] text-white hover:bg-[#3a1366]'
                    }`}
                  >
                    {cargando ? 'Registrando…' : 'Continuar'}
                  </button>
                </div>
              </div>

              <div className="w-full md:w-1/2 flex justify-center items-center mt-10 md:mt-0">
                  <img src="/Tiburon.png" className="w-full h-full object-cover" alt="Mascota Tiburón Formulario" />
              </div>
            </div>
          </div>
        )}

        {/* 3. PANTALLA DE BIOMETRÍA Y DOCUMENTOS */}
        {pantallaActual === 'biometria' && (
          <div className="w-full max-w-2xl flex flex-col items-center animate-fade-in">
            <div className="bg-white rounded-[2.5rem] shadow-xl w-full flex flex-col p-8 md:p-12 mb-8 relative">
              <button onClick={() => setPantallaActual('formulario')} className="absolute top-8 left-8 text-[#bf00ff] font-bold text-sm">← Volver</button>
              
              <div className="text-center mt-8 mb-10">
                <h2 className="text-3xl font-extrabold text-[#591f96] mb-2">Validación de Identidad</h2>
                <p className="text-[#591f96] font-medium">Sube tu INE y verifica tu rostro.</p>
              </div>

              <div className="flex flex-col gap-10">
                
                <div className="flex flex-col gap-4">
                  <h3 className="text-left font-bold text-[#591f96] flex items-center gap-2">
                    <span className="bg-[#dfd0f1] w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span> Documento INE (PDF)
                  </h3>
                  <div className="border-2 border-dashed border-[#b174e7] rounded-2xl p-6 bg-[#f5eefe] flex flex-col items-center gap-3">
                    <input type="file" accept="application/pdf" id="pdf-upload" className="hidden" onChange={(e) => setPdfIne(e.target.files[0])} />
                    <label htmlFor="pdf-upload" className="cursor-pointer bg-[#591f96] text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-[#3a1366] transition-all">
                      {pdfIne ? "Cambiar Archivo" : "Seleccionar PDF"}
                    </label>
                    {pdfIne && <p className="text-[#591f96] text-sm font-bold">📄 {pdfIne.name}</p>}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <h3 className="text-left font-bold text-[#591f96] flex items-center gap-2">
                    <span className="bg-[#dfd0f1] w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span> Reconocimiento Facial
                  </h3>
                  
                  <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
                    {!camaraEncendida && !fotoCapturada && (
                      <button onClick={encenderCamara} className="bg-white text-[#591f96] px-6 py-3 rounded-full font-bold shadow-lg">Activar Cámara</button>
                    )}
                    {camaraEncendida && (
                      <div className="w-full h-full relative">
                        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <button onClick={capturarFoto} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white p-4 rounded-full shadow-2xl hover:bg-red-600">📸</button>
                      </div>
                    )}
                    {fotoCapturada && (
                      <div className="w-full h-full relative">
                        <img src={fotoCapturada} className="w-full h-full object-cover" alt="Selfie" />
                        <button onClick={encenderCamara} className="absolute bottom-4 right-4 bg-white text-[#591f96] px-4 py-2 rounded-full text-xs font-bold shadow-lg">Repetir foto</button>
                      </div>
                    )}
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                </div>

                {/* AQUÍ ESTÁ EL ENLACE A LA PANTALLA DE GENERACIÓN */}
                <button
                  disabled={!pdfIne || !fotoCapturada || cargando}
                  onClick={irAGeneracion}
                  className={`py-4 rounded-full font-bold text-lg shadow-lg transition-all ${
                    pdfIne && fotoCapturada && !cargando ? 'bg-[#3a1366] text-white cursor-pointer hover:bg-[#591f96]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {cargando ? 'Subiendo y validando…' : 'Continuar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 4. PANTALLA DE GENERACIÓN CRIPTOGRÁFICA (LA NUEVA MAGIA) */}
        {/* ========================================================= */}
        {pantallaActual === 'generacion' && (
          <div className="w-full max-w-xl flex flex-col items-center animate-fade-in">
            <div className="bg-white rounded-[2.5rem] shadow-xl w-full flex flex-col items-center text-center p-8 md:p-14 mb-8 relative">
              
              {!llavesGeneradas && (
                <button onClick={() => setPantallaActual('biometria')} className="absolute top-8 left-8 text-[#bf00ff] font-bold text-sm hover:text-[#3a1366]">
                  ← Volver
                </button>
              )}

              {/* Icono decorativo de seguridad */}
              <div className="w-24 h-24 rounded-full bg-[#dfd0f1] flex items-center justify-center mb-6 border-[2px] border-[#b174e7] shadow-inner">
                <span className="text-5xl">🔐</span>
              </div>

              <h2 className="text-3xl font-extrabold text-[#591f96] mb-4">
                Protegiendo tu Identidad
              </h2>
              
              <p className="text-[#591f96] text-lg font-medium mb-10 max-w-md">
                Validando tu identidad y creando tu firma digital segura. Tu llave privada nunca abandonará este dispositivo.
              </p>

              {/* Si no se han generado, mostramos el botón. Si ya se generaron, mostramos éxito. */}
              {!llavesGeneradas ? (
                <button
                  onClick={generarLlaves}
                  disabled={cargando}
                  className={`py-4 px-8 rounded-full font-bold text-lg transition-all shadow-lg w-full max-w-sm ${
                    cargando ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#591f96] text-white hover:bg-[#3a1366]'
                  }`}
                >
                  {cargando ? 'Generando y vinculando…' : 'Generar mi Identidad Local'}
                </button>
              ) : (
                <div className="w-full flex flex-col items-center gap-4 animate-fade-in">
                  <div className="bg-green-100 border border-green-400 text-green-700 px-6 py-4 rounded-xl font-bold text-sm w-full">
                    ¡Llaves criptográficas generadas con éxito!
                  </div>

                  <div className="bg-yellow-50 border-[1.5px] border-yellow-400 rounded-2xl p-4 w-full">
                    <p className="text-yellow-800 font-bold text-sm mb-1">⚠️ ¡Muy importante!</p>
                    <p className="text-yellow-800 text-sm leading-snug">
                      Descarga tu archivo de llave y guárdalo en un lugar seguro
                      (USB, gestor de contraseñas, nube privada). Es la única forma
                      de iniciar sesión más adelante. Si lo pierdes, tendrás que
                      registrarte de nuevo.
                    </p>
                  </div>

                  {archivoLlave && (
                    <button
                      onClick={() => descargarArchivo(archivoLlave.filename, archivoLlave.contenido)}
                      className="bg-[#591f96] text-white py-4 px-8 rounded-full font-bold text-lg hover:bg-[#3a1366] transition-all shadow-lg w-full max-w-sm"
                    >
                      ⬇️ Descargar mi llave
                    </button>
                  )}

                  <button
                    onClick={() => {
                      // Limpiamos la llave que quedo en memoria al generarla.
                      // El usuario debe cargar el archivo .json que acaba de
                      // descargar — asi confirmamos que lo guardo bien y usa
                      // el mismo flujo manual que los usuarios recurrentes.
                      privateKeyRef.current = null;
                      setLlaveCargada(null);
                      setPantallaActual('login');
                    }}
                    className="bg-[#591f96] text-white py-3 px-8 rounded-full font-bold text-sm hover:bg-[#3a1366] transition-all shadow-lg w-full max-w-sm"
                  >
                    Ya la guardé → Iniciar sesión con mi llave
                  </button>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 5. PANTALLA DEL RETO DE FIRMA                              */}
        {/* ========================================================= */}
        {pantallaActual === 'reto' && (
          <div className="w-full max-w-xl flex flex-col items-center animate-fade-in">
            <div className="bg-white rounded-[2.5rem] shadow-xl w-full flex flex-col items-center text-center p-8 md:p-14 mb-8 relative">

              <button
                onClick={() => { setPantallaActual('generacion'); setFirmaValida(null); setNonceActual(null); }}
                className="absolute top-8 left-8 text-[#bf00ff] font-bold text-sm hover:text-[#3a1366]"
              >
                ← Volver
              </button>

              <div className="w-24 h-24 rounded-full bg-[#dfd0f1] flex items-center justify-center mb-6 border-[2px] border-[#b174e7] shadow-inner">
                <span className="text-5xl">✍️</span>
              </div>

              <h2 className="text-3xl font-extrabold text-[#591f96] mb-4">
                Reto de Firma Digital
              </h2>

              <p className="text-[#591f96] text-base font-medium mb-8 max-w-md">
                Vamos a comprobar que controlas tu llave privada. Pediremos un reto al servidor, lo firmarás con tu llave local y verificaremos la firma con tu llave pública.
              </p>

              {nonceActual && (
                <div className="w-full bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl p-4 mb-6">
                  <p className="text-[#bf00ff] font-bold text-xs tracking-wider uppercase mb-1">Nonce recibido</p>
                  <p className="text-[#591f96] font-mono text-xs break-all">{nonceActual}</p>
                </div>
              )}

              {firmaValida === null && (
                <button
                  onClick={firmarReto}
                  disabled={cargando}
                  className={`py-4 px-8 rounded-full font-bold text-lg transition-all shadow-lg w-full max-w-sm ${
                    cargando ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#591f96] text-white hover:bg-[#3a1366]'
                  }`}
                >
                  {cargando ? 'Firmando y verificando…' : 'Firmar el reto'}
                </button>
              )}

              {firmaValida === true && (
                <div className="w-full flex flex-col items-center gap-6 animate-fade-in">
                  <div className="bg-green-100 border border-green-400 text-green-700 px-6 py-4 rounded-xl font-bold text-sm w-full">
                    ✅ Sesión iniciada. Tienes un JWT válido por 1 hora.
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
                    <button
                      onClick={() => { cargarMiCuenta(); setPantallaActual('cuenta'); }}
                      className="flex-1 bg-[#591f96] text-white py-3 px-6 rounded-full font-bold text-sm hover:bg-[#3a1366] transition-all shadow-lg"
                    >
                      Ver mi cuenta →
                    </button>
                    <button
                      onClick={() => { setFirmaValida(null); setNonceActual(null); }}
                      className="flex-1 bg-white border-[1.5px] border-[#b174e7] text-[#591f96] py-3 px-6 rounded-full font-bold text-sm hover:bg-[#dfd0f1] transition-all"
                    >
                      Otro reto
                    </button>
                  </div>
                </div>
              )}

              {firmaValida === false && (
                <div className="w-full flex flex-col items-center gap-6 animate-fade-in">
                  <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-xl font-bold text-sm w-full">
                    ❌ La firma no se pudo verificar. Revisa el log del PKI.
                  </div>
                  <button
                    onClick={() => { setFirmaValida(null); setNonceActual(null); }}
                    className="bg-[#591f96] text-white py-3 px-8 rounded-full font-bold text-sm hover:bg-[#3a1366] transition-all shadow-lg"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {/* Pie de la pantalla del reto: olvidar identidad */}
              {userId && (
                <div className="w-full mt-10 pt-6 border-t border-[#dfd0f1] flex flex-col items-center gap-2">
                  <p className="text-[#bf00ff] text-xs font-medium">
                    Identidad activa: <span className="font-mono">{userId.slice(0, 13)}…</span>
                  </p>
                  <button
                    onClick={() => {
                      if (confirm('¿Olvidar esta identidad en este dispositivo? La llave privada se borra de IndexedDB y no podrás volver a firmar sin regenerar.')) {
                        olvidarIdentidad(userId);
                      }
                    }}
                    className="text-red-500 text-xs font-bold hover:underline"
                  >
                    Olvidar identidad en este dispositivo
                  </button>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 6. PANTALLA "MI CUENTA" (autenticada con JWT)              */}
        {/* ========================================================= */}
        {pantallaActual === 'cuenta' && (
          <div className="w-full max-w-3xl flex flex-col items-center animate-fade-in">
            <div className="bg-white rounded-[2.5rem] shadow-xl w-full p-8 md:p-12 mb-8 relative">

              <button
                onClick={cerrarSesion}
                className="absolute top-8 right-8 text-red-500 font-bold text-xs hover:underline"
              >
                Cerrar sesión
              </button>

              <div className="flex items-center gap-5 mb-8">
                {/* AVATAR EDITABLE */}
                <div className="relative flex-shrink-0">
                  <div className="w-24 h-24 rounded-full bg-[#dfd0f1] border-[3px] border-[#b174e7] shadow-inner overflow-hidden flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-5xl">👤</span>
                    )}
                  </div>
                  <button
                    onClick={() => setEditandoFoto((v) => !v)}
                    title="Cambiar foto"
                    className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[#591f96] text-white flex items-center justify-center shadow-lg hover:bg-[#3a1366] transition-all border-[2px] border-white"
                  >
                    📷
                  </button>
                </div>

                {/* SALUDO DINÁMICO */}
                <div className="flex-1 min-w-0">
                  <span className="inline-block bg-[#dfd0f1] text-[#3a1366] text-xs font-bold px-3 py-1 rounded-full mb-2 tracking-wider uppercase">Sesión activa</span>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-[#591f96] leading-tight">
                    {obtenerSaludo()}{nombre ? `, ${nombre}` : (inicialDesdeCurp(curp) ? `, ${inicialDesdeCurp(curp)}.` : '')}
                  </h2>
                </div>
              </div>

              {/* PANEL PARA EDITAR LA FOTO DE PERFIL */}
              {editandoFoto && (
                <div className="bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl p-5 mb-6 animate-fade-in">
                  <p className="text-[#591f96] font-bold text-sm mb-3">
                    Cambiar foto de perfil
                  </p>
                  <p className="text-[#bf00ff] text-xs mb-4">
                    La foto del registro solo se usa para verificar tu identidad. Aquí puedes poner la que tú quieras.
                  </p>

                  {camaraPerfilActiva ? (
                    <div className="flex flex-col gap-3">
                      <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden">
                        <video ref={videoPerfilRef} autoPlay playsInline className="w-full h-full object-cover" />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={cancelarCamaraPerfil}
                          className="flex-1 py-2 rounded-full font-bold text-xs bg-white border-[1.5px] border-[#b174e7] text-[#591f96] hover:bg-[#dfd0f1] transition-all"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={tomarFotoPerfil}
                          className="flex-1 py-2 rounded-full font-bold text-xs bg-[#591f96] text-white hover:bg-[#3a1366] shadow-lg transition-all"
                        >
                          📸 Capturar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        onClick={activarCamaraPerfil}
                        className="py-3 rounded-full font-bold text-xs bg-[#591f96] text-white hover:bg-[#3a1366] shadow-lg transition-all"
                      >
                        📸 Tomar nueva foto
                      </button>
                      <label
                        htmlFor="foto-perfil-upload"
                        className="cursor-pointer py-3 rounded-full font-bold text-xs bg-white border-[1.5px] border-[#b174e7] text-[#591f96] hover:bg-[#dfd0f1] text-center transition-all"
                      >
                        🖼️ Elegir archivo
                        <input
                          id="foto-perfil-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={cambiarFotoDesdeArchivo}
                        />
                      </label>
                      <button
                        onClick={usarFotoDelRegistro}
                        disabled={!fotoCapturada}
                        className={`py-3 rounded-full font-bold text-xs transition-all ${
                          fotoCapturada
                            ? 'bg-white border-[1.5px] border-[#b174e7] text-[#591f96] hover:bg-[#dfd0f1]'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        ↺ Usar la del registro
                      </button>
                    </div>
                  )}

                  <canvas ref={canvasPerfilRef} className="hidden" />

                  <button
                    onClick={() => { cancelarCamaraPerfil(); setEditandoFoto(false); }}
                    className="block mx-auto mt-4 text-[#bf00ff] text-xs font-bold hover:underline"
                  >
                    Cerrar
                  </button>
                </div>
              )}

              {/* DATOS DEL USUARIO */}
              <div className="bg-[#f5eefe] border-[1.5px] border-[#b174e7] rounded-2xl p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-[#bf00ff] text-xs font-bold uppercase tracking-wider mb-1">Teléfono</p>
                  <p className="text-[#591f96] font-extrabold text-lg">{telefono}</p>
                </div>
                <div>
                  <p className="text-[#bf00ff] text-xs font-bold uppercase tracking-wider mb-1">CURP</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[#591f96] font-bold text-sm font-mono break-all flex-1">{curp}</p>
                    <button
                      onClick={copiarCurp}
                      title={curpCopiado ? '¡Copiado!' : 'Copiar CURP'}
                      className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white shadow-sm transition-all ${
                        curpCopiado ? 'bg-[#bf00ff]' : 'bg-[#b174e7] hover:bg-[#bf00ff]'
                      }`}
                    >
                      {curpCopiado ? '✓' : '📋'}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-[#bf00ff] text-xs font-bold uppercase tracking-wider mb-1">User ID</p>
                  <p className="text-[#591f96] font-mono text-xs break-all">{userId}</p>
                </div>
                <div>
                  <p className="text-[#bf00ff] text-xs font-bold uppercase tracking-wider mb-1">Public Key ID</p>
                  <p className="text-[#591f96] font-mono text-xs break-all">{publicKeyId ?? '—'}</p>
                </div>
              </div>

              {/* INFO DE LA LÍNEA */}
              <div className="bg-white border-[1.5px] border-[#b174e7] rounded-2xl p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-extrabold text-[#591f96]">Estado de tu línea</h3>
                  <button
                    onClick={cargarMiCuenta}
                    disabled={cargando}
                    className="text-[#591f96] text-xs font-bold hover:underline"
                  >
                    🔄 Refrescar
                  </button>
                </div>

                {lineaInfo ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-4 py-2 rounded-full text-sm font-extrabold ${
                        lineaInfo.estado === 'activa' ? 'bg-green-100 text-green-700' :
                        lineaInfo.estado === 'kill_switched' ? 'bg-red-100 text-red-700' :
                        lineaInfo.estado === 'bloqueada' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {lineaInfo.estado.toUpperCase()}
                      </span>
                      <span className="text-[#591f96] text-sm">
                        Vinculada el {new Date(lineaInfo.fechaVinculacion).toLocaleString()}
                      </span>
                    </div>

                    <div className="mt-2">
                      <p className="text-[#bf00ff] text-xs font-bold uppercase tracking-wider mb-2">Últimos eventos</p>
                      <ul className="space-y-1 max-h-40 overflow-y-auto">
                        {(lineaInfo.eventos ?? []).slice(0, 8).map((e) => (
                          <li key={e.id} className="text-[#591f96] text-xs font-mono">
                            <span className="text-[#bf00ff]">{new Date(e.createdAt).toLocaleTimeString()}</span>
                            {' · '}
                            <span className="font-bold">{e.tipo}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="text-[#591f96] font-medium">Cargando información de la línea…</p>
                )}
              </div>

              {/* ACCIONES PROTEGIDAS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lineaInfo?.estado !== 'kill_switched' ? (
                  <button
                    onClick={accionKillSwitch}
                    disabled={cargando}
                    className={`py-4 rounded-2xl font-bold text-sm shadow-lg transition-all ${
                      cargando ? 'bg-gray-200 text-gray-400 cursor-not-allowed' :
                      'bg-red-500 text-white hover:bg-red-600'
                    }`}
                  >
                    🚨 Reportar robo o pérdida
                  </button>
                ) : (
                  <button
                    onClick={accionDesbloquear}
                    disabled={cargando}
                    className={`py-4 rounded-2xl font-bold text-sm shadow-lg transition-all ${
                      cargando ? 'bg-gray-200 text-gray-400 cursor-not-allowed' :
                      'bg-green-500 text-white hover:bg-green-600'
                    }`}
                  >
                    🔓 Reactivar mi línea
                  </button>
                )}

                <button
                  onClick={accionRevocar}
                  disabled={cargando || !publicKeyId}
                  className={`py-4 rounded-2xl font-bold text-sm shadow-lg transition-all ${
                    cargando || !publicKeyId ? 'bg-gray-200 text-gray-400 cursor-not-allowed' :
                    'bg-[#3a1366] text-white hover:bg-[#591f96]'
                  }`}
                >
                  🔒 Revocar mi llave
                </button>
              </div>

              <p className="text-[#bf00ff] text-xs mt-6 font-medium text-center">
                Tu sesión expira automáticamente en 1 hora por seguridad.
              </p>

            </div>
          </div>
        )}

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