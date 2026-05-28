import React, { useRef, useState } from 'react';

/**
 * Sube INE (PDF) y toma una selfie. NO sube a MinIO aqui: solo guarda los
 * archivos en memoria. La subida ocurre en Generacion, dentro del commit atomico.
 */
export default function Biometria({
  pdfIneInicial,
  fotoCapturadaInicial,
  onContinuar,
  onVolver,
}) {
  const [pdfIne, setPdfIne]                     = useState(pdfIneInicial ?? null);
  const [fotoCapturada, setFotoCapturada]       = useState(fotoCapturadaInicial ?? null);
  const [camaraEncendida, setCamaraEncendida]   = useState(false);
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);

  const encenderCamara = async () => {
    setCamaraEncendida(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      alert('No se pudo acceder a la camara. Revisa los permisos.');
      setCamaraEncendida(false);
    }
  };

  const capturarFoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    setFotoCapturada(canvas.toDataURL('image/jpeg'));
    const stream = video.srcObject;
    stream?.getTracks().forEach((t) => t.stop());
    setCamaraEncendida(false);
  };

  const listo = pdfIne && fotoCapturada;

  return (
    <div className="w-full max-w-2xl flex flex-col items-center animate-fade-in">
      <div className="bg-white rounded-[2.5rem] shadow-xl w-full flex flex-col p-8 md:p-12 mb-8 relative">
        <button onClick={onVolver} className="absolute top-8 left-8 text-[#bf00ff] font-bold text-sm">← Volver</button>

        <div className="text-center mt-8 mb-10">
          <h2 className="text-3xl font-extrabold text-[#591f96] mb-2">Validacion de Identidad</h2>
          <p className="text-[#591f96] font-medium">Sube tu INE y verifica tu rostro.</p>
        </div>

        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <h3 className="text-left font-bold text-[#591f96] flex items-center gap-2">
              <span className="bg-[#dfd0f1] w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span> Documento INE (PDF)
            </h3>
            <div className="border-2 border-dashed border-[#b174e7] rounded-2xl p-6 bg-[#f5eefe] flex flex-col items-center gap-3">
              <input
                type="file" accept="application/pdf" id="pdf-upload" className="hidden"
                onChange={(e) => setPdfIne(e.target.files[0])}
              />
              <label htmlFor="pdf-upload" className="cursor-pointer bg-[#591f96] text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-[#3a1366] transition-all">
                {pdfIne ? 'Cambiar archivo' : 'Seleccionar PDF'}
              </label>
              {pdfIne && <p className="text-[#591f96] text-sm font-bold">📄 {pdfIne.name}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-left font-bold text-[#591f96] flex items-center gap-2">
              <span className="bg-[#dfd0f1] w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span> Reconocimiento facial
            </h3>

            <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
              {!camaraEncendida && !fotoCapturada && (
                <button onClick={encenderCamara} className="bg-white text-[#591f96] px-6 py-3 rounded-full font-bold shadow-lg">Activar camara</button>
              )}
              {camaraEncendida && (
                <div className="w-full h-full relative">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <button onClick={capturarFoto} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white p-4 rounded-full shadow-2xl hover:bg-red-600">📸</button>
                </div>
              )}
              {fotoCapturada && !camaraEncendida && (
                <div className="w-full h-full relative">
                  <img src={fotoCapturada} className="w-full h-full object-cover" alt="Selfie" />
                  <button onClick={encenderCamara} className="absolute bottom-4 right-4 bg-white text-[#591f96] px-4 py-2 rounded-full text-xs font-bold shadow-lg">Repetir foto</button>
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <button
            disabled={!listo}
            onClick={() => onContinuar({ pdfIne, fotoCapturada })}
            className={`py-4 rounded-full font-bold text-lg shadow-lg transition-all ${
              listo ? 'bg-[#3a1366] text-white cursor-pointer hover:bg-[#591f96]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
