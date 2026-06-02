const CURP_REGEX     = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
const TELEFONO_REGEX = /^\d{10}$/;
const EMAIL_REGEX    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Reglas de contrasena:
 *   - minimo 8 caracteres
 *   - al menos 1 mayuscula
 *   - al menos 2 numeros
 *   - al menos 1 caracter especial (no alfanumerico)
 *
 * Devuelve una lista de errores en espanol; vacia si la contrasena es valida.
 */
export function reglasContrasena(password) {
  const errs = [];
  if (typeof password !== 'string' || password.length < 8) errs.push('minimo 8 caracteres');
  if (!/[A-Z]/.test(password ?? '')) errs.push('al menos 1 mayuscula');
  if (((password ?? '').match(/\d/g) ?? []).length < 2) errs.push('al menos 2 numeros');
  if (!/[^A-Za-z0-9]/.test(password ?? '')) errs.push('al menos 1 caracter especial');
  return errs;
}

export function validarPassword(password) {
  return reglasContrasena(password).length === 0;
}

export function validarEmail(email) {
  return typeof email === 'string' && EMAIL_REGEX.test(email.trim());
}

export function validarRegistro({ telefono, curp, email, password, nombre }) {
  const errores = {};

  if (!telefono || typeof telefono !== 'string') {
    errores.telefono = 'El telefono es obligatorio.';
  } else if (!TELEFONO_REGEX.test(telefono)) {
    errores.telefono = 'Se requieren 10 digitos numericos.';
  }

  if (!curp || typeof curp !== 'string') {
    errores.curp = 'El CURP es obligatorio.';
  } else {
    const curpUpper = curp.toUpperCase();
    if (curpUpper.length !== 18) {
      errores.curp = 'Se requieren 18 caracteres.';
    } else if (!CURP_REGEX.test(curpUpper)) {
      errores.curp = 'Formato de CURP invalido.';
    }
  }

  if (!email || typeof email !== 'string') {
    errores.email = 'El correo es obligatorio.';
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errores.email = 'Correo invalido.';
  }

  const errsPass = reglasContrasena(password);
  if (errsPass.length > 0) {
    errores.password = `La contraseña debe tener ${errsPass.join(', ')}.`;
  }

  if (nombre !== undefined && nombre !== null && nombre !== '') {
    if (typeof nombre !== 'string' || nombre.trim().length === 0) {
      errores.nombre = 'Nombre invalido.';
    } else if (nombre.trim().length > 50) {
      errores.nombre = 'Maximo 50 caracteres.';
    }
  }

  return errores;
}
