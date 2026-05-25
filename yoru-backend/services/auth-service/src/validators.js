const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
const TELEFONO_REGEX = /^\d{10}$/;

export function validarRegistro({ telefono, curp, nombre }) {
  const errores = {};

  if (!telefono || typeof telefono !== 'string') {
    errores.telefono = 'El teléfono es obligatorio.';
  } else if (!TELEFONO_REGEX.test(telefono)) {
    errores.telefono = 'Se requieren 10 dígitos numéricos.';
  }

  if (!curp || typeof curp !== 'string') {
    errores.curp = 'El CURP es obligatorio.';
  } else {
    const curpUpper = curp.toUpperCase();
    if (curpUpper.length !== 18) {
      errores.curp = 'Se requieren 18 caracteres.';
    } else if (!CURP_REGEX.test(curpUpper)) {
      errores.curp = 'Formato de CURP inválido.';
    }
  }

  // nombre es opcional, pero si lo mandan, validamos longitud razonable.
  if (nombre !== undefined && nombre !== null && nombre !== '') {
    if (typeof nombre !== 'string' || nombre.trim().length === 0) {
      errores.nombre = 'Nombre inválido.';
    } else if (nombre.trim().length > 50) {
      errores.nombre = 'Máximo 50 caracteres.';
    }
  }

  return errores;
}
