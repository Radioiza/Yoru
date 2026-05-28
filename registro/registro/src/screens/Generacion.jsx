import React, { useState } from 'react';
import {
  api,
  publicKeyToPem,
  privateKeyToPem,
  dataUrlToBlob,
  uploadToPresignedUrl,
  descargarArchivo,
  nombreArchivoLlave,
  construirArchivoPem,
} from '../api.js';

/**
 * Genera el par de llaves localmente, sube INE+selfie y prepara todos los
 * datos del registro en el draft del usuario. Despues redirige a la pantalla
 * de verificacion de email — el commit real ocurre alli.
 *
 * El usuario descarga su archivo .pem aqui mismo. Una vez generado, ya NO
 * se permite volver atras (mismo invariante del flujo anterior).
 */
export default function Generacion({ datosRegistro, onListoParaVerificar, onVolver }) {
  const [cargando, setCargando]   = useState(false);
  const [error, setError]         = useState(null);
  const [resultado, setResultado] = useState(null); // { archivoLlave, draftUserId, email, verificacionExpiraEn }

  const generar = async () => {
    setCargando(true);
    setError(null);
    try {
      const { telefono, curp, nombre, email, password, pdfIne, fotoCapturada } = datosRegistro;

      // 1) Preparar registro: crea draft, envia codigo de email, devuelve presigned URLs.
      const prep = await api.prepararRegistro({ telefono, curp, nombre: nombre || null, email, password });
      if (prep.status !== 201 || !prep.data.ok) {
        if (prep.data.errores) throw new Error(Object.values(prep.data.errores).join(' '));
        throw new Error(prep.data.error ?? 'No se pudo preparar el registro.');
      }
      const { draftUserId, ineUploadUrl, selfieUploadUrl, ineKey, selfieKey, verificacionExpiraEn } = prep.data;

      // 2) Subir INE + selfie a MinIO.
      const selfieBlob = dataUrlToBlob(fotoCapturada);
      await Promise.all([
        uploadToPresignedUrl(ineUploadUrl,    pdfIne,     'application/pdf'),
        uploadToPresignedUrl(selfieUploadUrl, selfieBlob, 'image/jpeg'),
      ]);

      // 3) Generar par ECDSA P-256.
      const keyPair = await window.crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify'],
      );
      const publicKeyPem  = await publicKeyToPem(keyPair.publicKey);
      const privateKeyPem = await privateKeyToPem(keyPair.privateKey);

      // 4) Guardar refs+pubkey en el draft del usuario (sin tocar aun KYC/PKI/Telecom).
      const g = await api.guardarDatosPendientes({
        draftUserId,
        refIneS3: ineKey,
        refSelfieS3: selfieKey,
        publicKeyPem,
      });
      if (g.status !== 200 || !g.data.ok) {
        throw new Error(g.data.error ?? 'No se pudieron guardar los datos pendientes.');
      }

      // 5) Construir el archivo .pem descargable.
      const metadata = {
        app: 'yoru',
        version: 2,
        userId: draftUserId,
        telefono, curp, nombre,
        email,
        fechaGeneracion: new Date().toISOString(),
      };
      const pemFile = construirArchivoPem({ metadata, publicKeyPem, privateKeyPem });

      setResultado({
        draftUserId,
        email,
        verificacionExpiraEn,
        archivoLlave: {
          filename: nombreArchivoLlave({ curp, telefono }),
          contenido: pemFile,
        },
      });
    } catch (err) {
      console.error('Error en generacion:', err);
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="w-full max-w-xl flex flex-col items-center animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-xl w-full flex flex-col items-center text-center p-8 md:p-14 mb-8 relative">
        {!resultado && (
          <button onClick={onVolver} className="absolute top-8 left-8 text-[#bf00ff] font-bold text-sm hover:text-[#3a1366]">
            ← Volver
          </button>
        )}

        <div className="w-24 h-24 rounded-full bg-[#dfd0f1] flex items-center justify-center mb-6 border-[2px] border-[#b174e7] shadow-inner">
          <span className="text-5xl">🔐</span>
        </div>
        <h2 className="text-3xl font-extrabold text-[#591f96] mb-4">Protegiendo tu Identidad</h2>
        <p className="text-[#591f96] text-lg font-medium mb-8 max-w-md">
          Generaremos tu par de llaves localmente y prepararemos tu identidad.
          Despues confirmaras tu correo con el codigo que te enviamos.
        </p>

        {error && (
          <div className="w-full bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        {!resultado ? (
          <button onClick={generar} disabled={cargando}
            className={`py-4 px-8 rounded-full font-bold text-lg transition-all shadow-lg w-full max-w-sm ${
              cargando ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#591f96] text-white hover:bg-[#3a1366]'
            }`}>
            {cargando ? 'Subiendo y preparando…' : 'Generar mi Identidad Local'}
          </button>
        ) : (
          <div className="w-full flex flex-col items-center gap-4 animate-fade-in">
            <div className="bg-green-100 border border-green-400 text-green-700 px-6 py-4 rounded-xl font-bold text-sm w-full">
              ¡Llaves generadas! Te enviamos un codigo a {resultado.email}.
            </div>

            <div className="bg-yellow-50 border-[1.5px] border-yellow-400 rounded-2xl p-4 w-full">
              <p className="text-yellow-800 font-bold text-sm mb-1">⚠️ Muy importante</p>
              <p className="text-yellow-800 text-sm leading-snug">
                Descarga tu archivo .pem ahora. Lo necesitas si olvidas tu
                contrasena o tu correo. Sin el, no podras recuperar la cuenta.
              </p>
            </div>

            <button onClick={() => descargarArchivo(resultado.archivoLlave.filename, resultado.archivoLlave.contenido)}
              className="bg-[#591f96] text-white py-4 px-8 rounded-full font-bold text-lg hover:bg-[#3a1366] transition-all shadow-lg w-full max-w-sm">
              ⬇️ Descargar mi llave (.pem)
            </button>

            <button
              onClick={() => onListoParaVerificar({
                draftUserId: resultado.draftUserId,
                email: resultado.email,
                verificacionExpiraEn: resultado.verificacionExpiraEn,
              })}
              className="bg-[#591f96] text-white py-3 px-8 rounded-full font-bold text-sm hover:bg-[#3a1366] transition-all shadow-lg w-full max-w-sm">
              Ya la guarde → Ingresar codigo de email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
