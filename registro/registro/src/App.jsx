import React, { useState } from 'react';
import Layout from './components/Layout.jsx';

import Formulario       from './screens/Formulario.jsx';
import Biometria        from './screens/Biometria.jsx';
import Generacion       from './screens/Generacion.jsx';
import VerificarEmail   from './screens/VerificarEmail.jsx';
import Login            from './screens/Login.jsx';
import Cuenta           from './screens/Cuenta.jsx';
import AgregarLinea     from './screens/AgregarLinea.jsx';
import RevocarConfirmar from './screens/RevocarConfirmar.jsx';
import RevocarCodigo    from './screens/RevocarCodigo.jsx';
import RegenerarLlave   from './screens/RegenerarLlave.jsx';
import RecuperarLlave   from './screens/RecuperarLlave.jsx';
import RecuperarCambiar from './screens/RecuperarCambiar.jsx';
import RecuperarMenu     from './screens/RecuperarMenu.jsx';
import RecuperarPassword from './screens/RecuperarPassword.jsx';

/**
 * Orquestador principal. Estado global + ruteo entre pantallas. Cada
 * pantalla vive en su propio archivo bajo /screens.
 */
export default function App({ pantallaInicial = 'formulario', onSalir }) {
  const [pantalla, setPantalla] = useState(pantallaInicial);
  const [mensaje, setMensaje]   = useState(null);

  // Datos del flujo de registro (en memoria, sin tocar backend hasta
  // que el usuario verifique el codigo de email).
  const [registroData, setRegistroData] = useState({
    telefono: '', curp: '', nombre: '', email: '', password: '',
    pdfIne: null, fotoCapturada: null,
  });
  const [registroDraft, setRegistroDraft] = useState(null); // { draftUserId, email, verificacionExpiraEn }

  // Datos de sesion autenticada.
  const [token, setToken]           = useState(null);
  const [userFull, setUserFull]     = useState(null);
  const [publicKeyId, setPublicKeyId] = useState(null);

  // Estado de flujos auxiliares.
  const [revExpiraEn, setRevExpiraEn] = useState(null);
  const [recoveryCtx, setRecoveryCtx] = useState(null); // { user, recoveryToken, recoveryExpiraEn }

  /** Borra TODO el estado en memoria. */
  const resetTotal = () => {
    setRegistroData({ telefono: '', curp: '', nombre: '', email: '', password: '', pdfIne: null, fotoCapturada: null });
    setRegistroDraft(null);
    setToken(null);
    setUserFull(null);
    setPublicKeyId(null);
    setRevExpiraEn(null);
    setRecoveryCtx(null);
  };

  const volverInicio = () => {
    resetTotal();
    if (onSalir) onSalir();
    else setPantalla('formulario');
  };

  // ----- Registro -----
  const onFormularioContinuar = (d) => {
    setRegistroData((prev) => ({ ...prev, ...d }));
    setPantalla('biometria');
  };
  const onBiometriaContinuar = ({ pdfIne, fotoCapturada }) => {
    setRegistroData((prev) => ({ ...prev, pdfIne, fotoCapturada }));
    setPantalla('generacion');
  };
  const onListoParaVerificar = (info) => {
    setRegistroDraft(info);
    setPantalla('verificar_email');
  };
  const onEmailVerificado = () => {
    // Limpiamos el estado del registro y mandamos al login con email+password.
    resetTotal();
    setPantalla('login');
  };

  // ----- Login -----
  const onLoginExitoso = ({ token: t, user, publicKeyId: pkid }) => {
    setToken(t);
    setUserFull(user);
    setPublicKeyId(pkid ?? null);
    setPantalla('cuenta');
  };

  // ----- Revocacion -----
  const onIniciarRevocacion = () => setPantalla('revocar_confirmar');
  const onCodigoEnviado = ({ expiraEn }) => {
    setRevExpiraEn(expiraEn);
    setPantalla('revocar_codigo');
  };
  const onRevocacionConfirmada = () => {
    setPublicKeyId(null);
    setPantalla('regenerar');
  };
  const onRegeneracionCompletada = () => {
    resetTotal();
    setPantalla('login');
  };

  // ----- Recuperacion -----
  const onIrARecuperar = () => setPantalla('recuperar_menu');
  const onRecuperarVerificado = (ctx) => {
    setRecoveryCtx(ctx);
    setPantalla('recuperar_cambiar');
  };
  const onRecuperarTerminado = () => {
    resetTotal();
    setPantalla('login');
  };

  const onCerrarSesion = () => {
    resetTotal();
    setPantalla('login');
    if (onSalir) onSalir();
  };

  // ----- Render -----
  return (
    <Layout mensajeBackend={mensaje} onLimpiarMensaje={() => setMensaje(null)}>
      {pantalla === 'formulario' && (
        <Formulario
          valoresIniciales={registroData}
          onContinuar={onFormularioContinuar}
          onVolver={volverInicio}
        />
      )}

      {pantalla === 'biometria' && (
        <Biometria
          pdfIneInicial={registroData.pdfIne}
          fotoCapturadaInicial={registroData.fotoCapturada}
          onContinuar={onBiometriaContinuar}
          onVolver={() => setPantalla('formulario')}
        />
      )}

      {pantalla === 'generacion' && (
        <Generacion
          datosRegistro={registroData}
          onListoParaVerificar={onListoParaVerificar}
          onVolver={() => setPantalla('biometria')}
        />
      )}

      {pantalla === 'verificar_email' && registroDraft && (
        <VerificarEmail
          draftUserId={registroDraft.draftUserId}
          email={registroDraft.email}
          expiraEnInicial={registroDraft.verificacionExpiraEn}
          onVerificado={onEmailVerificado}
          onCancelar={volverInicio}
        />
      )}

      {pantalla === 'login' && (
        <Login
          onLoginExitoso={onLoginExitoso}
          onIrARegistro={() => { resetTotal(); setPantalla('formulario'); }}
          onIrARecuperar={onIrARecuperar}
          onVolverInicio={volverInicio}
        />
      )}

      {pantalla === 'cuenta' && userFull && (
        <Cuenta
          token={token}
          user={userFull}
          publicKeyId={publicKeyId}
          onAgregarLinea={() => setPantalla('agregar_linea')}
          onIniciarRevocacion={onIniciarRevocacion}
          onCerrarSesion={onCerrarSesion}
        />
      )}

      {pantalla === 'agregar_linea' && (
        <AgregarLinea
          token={token}
          user={userFull}
          onLineaAgregada={() => setPantalla('cuenta')}
          onCancelar={() => setPantalla('cuenta')}
        />
      )}

      {pantalla === 'revocar_confirmar' && (
        <RevocarConfirmar
          token={token}
          onCodigoEnviado={onCodigoEnviado}
          onCancelar={() => setPantalla('cuenta')}
        />
      )}

      {pantalla === 'revocar_codigo' && (
        <RevocarCodigo
          token={token}
          expiraEn={revExpiraEn}
          onConfirmado={onRevocacionConfirmada}
          onCancelar={() => setPantalla('cuenta')}
        />
      )}

      {pantalla === 'regenerar' && userFull && (
        <RegenerarLlave
          user={userFull}
          token={token}
          onCompletado={onRegeneracionCompletada}
        />
      )}

      {pantalla === 'recuperar_menu' && (
        <RecuperarMenu
          onElegirPassword={() => setPantalla('recuperar_password')}
          onElegirCorreo={() => setPantalla('recuperar_llave')}
          onVolverInicio={() => setPantalla('login')}
        />
      )}

      {pantalla === 'recuperar_password' && (
        <RecuperarPassword
          onTerminado={onRecuperarTerminado}
          onVolver={() => setPantalla('recuperar_menu')}
        />
      )}

      {pantalla === 'recuperar_llave' && (
        <RecuperarLlave
          onVerificado={onRecuperarVerificado}
          onVolverInicio={() => setPantalla('recuperar_menu')}
        />
      )}

      {pantalla === 'recuperar_cambiar' && recoveryCtx && (
        <RecuperarCambiar
          user={recoveryCtx.user}
          recoveryToken={recoveryCtx.recoveryToken}
          onTerminado={onRecuperarTerminado}
        />
      )}
    </Layout>
  );
}
