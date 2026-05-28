import { prisma } from '../prisma.js';
import { publishEvent } from '../broker.js';
import { validarRegistro, validarEmail, validarPassword, reglasContrasena } from '../validators.js';
import { signJwt } from '../jwt.js';
import { requireAuth } from '../middleware.js';
import {
  hashPassword,
  verifyPassword,
  codigoCincoDigitos,
  tokenAleatorio,
} from '../password.js';

const PKI_URL     = process.env.PKI_URL     ?? 'http://localhost:3002';
const KYC_URL     = process.env.KYC_URL     ?? 'http://localhost:3003';
const TELECOM_URL = process.env.TELECOM_URL ?? 'http://localhost:3004';

const VERIF_TTL_MIN     = 5;   // ventana para ingresar el codigo de email
const RESEND_COOLDOWN_S = 60;  // un reenvio por minuto
const RECOVERY_TTL_MIN  = 10;  // ventana para usar el recoveryToken

export default async function authRoutes(fastify) {

  // ============================================================
  // POST /api/auth/registro/preparar
  // Recibe: telefono, curp, nombre, email, password.
  // Crea un draft de User (committed=false, emailVerified=false),
  // genera codigo de 5 digitos, lo envia por correo (evento) y devuelve
  // las presigned URLs para subir INE y selfie.
  // ============================================================
  fastify.post('/registro/preparar', async (request, reply) => {
    const { telefono, curp, nombre, email, password } = request.body ?? {};

    const errores = validarRegistro({ telefono, curp, nombre, email, password });
    if (Object.keys(errores).length > 0) {
      return reply.code(400).send({ ok: false, errores });
    }

    const curpUpper  = curp.toUpperCase();
    const emailLimpio = email.trim().toLowerCase();
    const nombreLimpio = typeof nombre === 'string'
      ? nombre.trim().slice(0, 50) || null
      : null;

    // Conflictos solo contra usuarios committeados.
    const existente = await prisma.user.findFirst({
      where: {
        committed: true,
        OR: [{ telefono }, { curp: curpUpper }, { email: emailLimpio }],
      },
    });
    if (existente) {
      const conflicto = existente.telefono === telefono ? 'telefono'
        : existente.curp === curpUpper ? 'curp'
        : 'email';
      return reply.code(409).send({
        ok: false,
        errores: { [conflicto]: 'Ya existe un registro con este valor.' },
      });
    }

    // Limpia drafts anteriores del mismo telefono/curp/email.
    await prisma.user.deleteMany({
      where: {
        committed: false,
        OR: [{ telefono }, { curp: curpUpper }, { email: emailLimpio }],
      },
    });

    const { hash, salt } = hashPassword(password);
    const codigo = codigoCincoDigitos();
    const ahora  = new Date();
    const expira = new Date(ahora.getTime() + VERIF_TTL_MIN * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        telefono,
        curp: curpUpper,
        nombre: nombreLimpio,
        email: emailLimpio,
        passwordHash: hash,
        passwordSalt: salt,
        committed: false,
        emailVerified: false,
        emailVerificationCode: codigo,
        emailVerificationExpira: expira,
        emailVerificationLastSent: ahora,
      },
      select: { id: true },
    });

    // Pide presigned URLs al KYC.
    let urls;
    try {
      const r = await fetch(`${KYC_URL}/api/kyc/presigned-urls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      urls = await r.json();
      if (!r.ok || !urls.ok) throw new Error(urls.error ?? 'No presigned URLs.');
    } catch (err) {
      await prisma.user.delete({ where: { id: user.id } });
      return reply.code(502).send({ ok: false, error: `KYC: ${err.message}` });
    }

    publishEvent('auth.email_verification', {
      userId: user.id,
      email: emailLimpio,
      codigo,
      expiraEn: expira.toISOString(),
    });

    return reply.code(201).send({
      ok: true,
      draftUserId: user.id,
      email: emailLimpio,
      ineUploadUrl:    urls.ineUploadUrl,
      selfieUploadUrl: urls.selfieUploadUrl,
      ineKey:          urls.ineKey,
      selfieKey:       urls.selfieKey,
      verificacionExpiraEn: expira.toISOString(),
    });
  });

  // ============================================================
  // POST /api/auth/registro/datos-pendientes
  // El cliente, despues de subir INE+selfie y generar las llaves,
  // guarda en el draft las refs S3 + la public key PEM. NADA se mueve
  // todavia a kyc/pki/telecom — esto ocurre cuando verifica el email.
  // ============================================================
  fastify.post('/registro/datos-pendientes', async (request, reply) => {
    const { draftUserId, refIneS3, refSelfieS3, publicKeyPem } = request.body ?? {};
    if (!draftUserId || !refIneS3 || !refSelfieS3 || !publicKeyPem) {
      return reply.code(400).send({ ok: false, error: 'Datos incompletos.' });
    }
    const user = await prisma.user.findUnique({ where: { id: draftUserId } });
    if (!user) return reply.code(404).send({ ok: false, error: 'Draft no encontrado.' });
    if (user.committed) return reply.code(409).send({ ok: false, error: 'Ya commiteado.' });

    await prisma.user.update({
      where: { id: draftUserId },
      data: {
        pendingIneS3: refIneS3,
        pendingSelfieS3: refSelfieS3,
        pendingPublicKeyPem: publicKeyPem,
      },
    });
    return { ok: true };
  });

  // ============================================================
  // POST /api/auth/registro/reenviar-codigo
  // Genera un codigo nuevo y lo reenvia, con rate-limit de 60s.
  // ============================================================
  fastify.post('/registro/reenviar-codigo', async (request, reply) => {
    const { draftUserId } = request.body ?? {};
    if (!draftUserId) return reply.code(400).send({ ok: false, error: 'draftUserId requerido.' });
    const user = await prisma.user.findUnique({ where: { id: draftUserId } });
    if (!user || user.committed) {
      return reply.code(404).send({ ok: false, error: 'Draft no encontrado.' });
    }

    const ahora = new Date();
    if (user.emailVerificationLastSent) {
      const diffS = (ahora - user.emailVerificationLastSent) / 1000;
      if (diffS < RESEND_COOLDOWN_S) {
        const restante = Math.ceil(RESEND_COOLDOWN_S - diffS);
        return reply.code(429).send({
          ok: false,
          error: `Espera ${restante}s para reenviar.`,
          restante,
        });
      }
    }

    const codigo = codigoCincoDigitos();
    const expira = new Date(ahora.getTime() + VERIF_TTL_MIN * 60 * 1000);
    await prisma.user.update({
      where: { id: draftUserId },
      data: {
        emailVerificationCode: codigo,
        emailVerificationExpira: expira,
        emailVerificationLastSent: ahora,
      },
    });

    publishEvent('auth.email_verification', {
      userId: user.id,
      email: user.email,
      codigo,
      expiraEn: expira.toISOString(),
    });

    return { ok: true, verificacionExpiraEn: expira.toISOString() };
  });

  // ============================================================
  // POST /api/auth/registro/verificar-email
  // Valida el codigo, y si coincide hace el commit atomico de
  // KYC + PKI + Telecom usando los pendingX guardados.
  // ============================================================
  fastify.post('/registro/verificar-email', async (request, reply) => {
    const { draftUserId, codigo } = request.body ?? {};
    if (!draftUserId || !codigo) {
      return reply.code(400).send({ ok: false, error: 'draftUserId y codigo requeridos.' });
    }

    const user = await prisma.user.findUnique({ where: { id: draftUserId } });
    if (!user) return reply.code(404).send({ ok: false, error: 'Draft no encontrado.' });
    if (user.committed) return reply.code(409).send({ ok: false, error: 'Ya verificado.' });

    if (!user.emailVerificationCode || !user.emailVerificationExpira) {
      return reply.code(400).send({ ok: false, error: 'No hay codigo activo. Reenvialo.' });
    }
    if (user.emailVerificationExpira < new Date()) {
      return reply.code(400).send({ ok: false, error: 'Codigo expirado. Reenvialo.' });
    }
    if (user.emailVerificationCode !== String(codigo).trim()) {
      return reply.code(400).send({ ok: false, error: 'Codigo incorrecto.' });
    }

    if (!user.pendingIneS3 || !user.pendingSelfieS3 || !user.pendingPublicKeyPem) {
      return reply.code(400).send({ ok: false, error: 'Faltan datos pendientes del registro.' });
    }

    // Conflicto de unicidad por si alguien committeo mientras tanto.
    const conflicto = await prisma.user.findFirst({
      where: {
        committed: true,
        id: { not: user.id },
        OR: [{ telefono: user.telefono }, { curp: user.curp }, { email: user.email }],
      },
    });
    if (conflicto) {
      await prisma.user.delete({ where: { id: user.id } });
      publishEvent('auth.user_deleted', { userId: user.id, motivo: 'duplicado' });
      return reply.code(409).send({ ok: false, error: 'Telefono, CURP o correo duplicado.' });
    }

    // 1) PKI registrar llave
    let publicKeyId = null;
    try {
      const r = await fetch(`${PKI_URL}/api/pki/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, publicKeyPem: user.pendingPublicKeyPem, committed: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'PKI fallo.');
      publicKeyId = d.key.id;
    } catch (err) {
      await rollback(user.id);
      return reply.code(502).send({ ok: false, error: `PKI: ${err.message}` });
    }

    // 2) Telecom vincular linea
    try {
      console.log(`[verify-email] creando linea en telecom para userId=${user.id} telefono=${user.telefono}`);
      const r = await fetch(`${TELECOM_URL}/api/telecom/lineas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefono: user.telefono,
          userId: user.id,
          publicKeyId,
          committed: true,
        }),
      });
      const d = await r.json();
      console.log(`[verify-email] telecom respondio status=${r.status}`, d);

      if (r.status === 409) {
        // El telefono ya existe en telecom. Si pertenece a OTRO user, es un
        // bloqueo real → abortar. Si es un huerfano (rollback parcial previo),
        // lo reasignamos al user actual para que aparezca en su cuenta.
        const existente = await fetch(`${TELECOM_URL}/api/telecom/lineas/${user.telefono}`);
        const exJson = await existente.json().catch(() => null);
        const lineaExistente = exJson?.linea;
        if (lineaExistente && lineaExistente.userId === user.id) {
          // Ya es nuestra; ok.
          console.log(`[verify-email] linea ya existe para mismo userId, ok.`);
        } else {
          // Pertenece a otro user (real conflict). Abortar.
          console.error(`[verify-email] telefono ${user.telefono} pertenece a otro userId=${lineaExistente?.userId}`);
          throw new Error('Telefono ya esta vinculado a otra cuenta.');
        }
      } else if (!r.ok) {
        throw new Error(d.error ?? 'Telecom fallo.');
      } else {
        console.log(`[verify-email] linea creada id=${d.linea?.id}`);
      }
    } catch (err) {
      console.error('[verify-email] Telecom fail:', err);
      await rollback(user.id);
      return reply.code(502).send({ ok: false, error: `Telecom: ${err.message}` });
    }

    // 3) KYC crear + aprobar
    try {
      const r = await fetch(`${KYC_URL}/api/kyc/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          refIneS3: user.pendingIneS3,
          refSelfieS3: user.pendingSelfieS3,
          committed: true,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'KYC fallo.');
      const a = await fetch(`${KYC_URL}/api/kyc/requests/${user.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scoreMatch: 0.95 }),
      });
      if (!a.ok) {
        const ad = await a.json().catch(() => ({}));
        throw new Error(ad.error ?? 'KYC approve fallo.');
      }
    } catch (err) {
      await rollback(user.id);
      return reply.code(502).send({ ok: false, error: `KYC: ${err.message}` });
    }

    // 4) Commit final del usuario y limpieza de fields temporales.
    const committed = await prisma.user.update({
      where: { id: user.id },
      data: {
        committed: true,
        emailVerified: true,
        estado: 'activo',
        emailVerificationCode: null,
        emailVerificationExpira: null,
        emailVerificationLastSent: null,
        pendingIneS3: null,
        pendingSelfieS3: null,
        pendingPublicKeyPem: null,
      },
      select: { id: true, telefono: true, curp: true, email: true, nombre: true, estado: true, createdAt: true },
    });

    publishEvent('auth.user_created', {
      userId: committed.id,
      telefono: committed.telefono,
      curp: committed.curp,
      email: committed.email,
      nombre: committed.nombre,
      createdAt: committed.createdAt,
    });

    return { ok: true, user: committed, publicKeyId };
  });

  async function rollback(userId) {
    try { await prisma.user.delete({ where: { id: userId } }); } catch {}
    publishEvent('auth.user_deleted', { userId, motivo: 'rollback_registro' });
  }

  // ============================================================
  // POST /api/auth/registro/cancelar
  // ============================================================
  fastify.post('/registro/cancelar', async (request, reply) => {
    const { draftUserId } = request.body ?? {};
    if (!draftUserId) return reply.code(400).send({ ok: false, error: 'draftUserId requerido.' });
    const u = await prisma.user.findUnique({ where: { id: draftUserId } });
    if (!u || u.committed) return { ok: true };
    await prisma.user.delete({ where: { id: draftUserId } });
    publishEvent('auth.user_deleted', { userId: draftUserId, motivo: 'cancelado_por_usuario' });
    return { ok: true };
  });

  // ============================================================
  // POST /api/auth/login
  // Login estandar: email + password. Requiere committed + emailVerified.
  // ============================================================
  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body ?? {};
    // En login solo verificamos que vengan datos: si la contrasena no cumple
    // reglas modernas, fallara igualmente al verificar el hash.
    if (!validarEmail(email) || typeof password !== 'string' || password.length === 0) {
      return reply.code(400).send({ ok: false, error: 'Correo o contrasena invalidos.' });
    }
    const emailLimpio = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: emailLimpio } });
    if (!user || !user.committed || !user.emailVerified) {
      return reply.code(401).send({ ok: false, error: 'Credenciales invalidas.' });
    }
    if (!verifyPassword(password, user.passwordHash, user.passwordSalt)) {
      publishEvent('auth.failed_attempt', { userId: user.id, motivo: 'password invalido' });
      return reply.code(401).send({ ok: false, error: 'Credenciales invalidas.' });
    }

    // publicKeyId actual (para incluir en el JWT y para "agregar linea").
    let publicKeyId = null;
    try {
      const r = await fetch(`${PKI_URL}/api/pki/keys/${user.id}`);
      if (r.ok) {
        const d = await r.json();
        publicKeyId = d.key?.id ?? null;
      }
    } catch {}

    const token = signJwt({
      sub: user.id,
      telefono: user.telefono,
      email: user.email,
      nombre: user.nombre,
      publicKeyId,
    });
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.session.create({ data: { userId: user.id, token, expiresAt } });

    publishEvent('auth.login_success', { userId: user.id });

    return {
      ok: true,
      token,
      expiresIn: 3600,
      user: {
        id: user.id,
        telefono: user.telefono,
        curp: user.curp,
        nombre: user.nombre,
        email: user.email,
        estado: user.estado,
      },
      publicKeyId,
    };
  });

  // ============================================================
  // GET /api/auth/me
  // ============================================================
  fastify.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true, telefono: true, curp: true, email: true, nombre: true, estado: true, createdAt: true },
    });
    if (!user) return reply.code(404).send({ ok: false, error: 'Usuario no encontrado.' });
    return { ok: true, user, tokenClaims: request.user };
  });

  // ============================================================
  // GET /api/auth/users/:id
  // ============================================================
  fastify.get('/users/:id', async (request, reply) => {
    const { id } = request.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, telefono: true, curp: true, email: true, estado: true, committed: true, createdAt: true },
    });
    if (!user || !user.committed) return reply.code(404).send({ ok: false, error: 'Usuario no encontrado.' });
    return { ok: true, user };
  });

  // ============================================================
  // DELETE /api/auth/users/:id
  // ============================================================
  fastify.delete('/users/:id', async (request, reply) => {
    const { id } = request.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return reply.code(404).send({ ok: false, error: 'Usuario no encontrado.' });
    await prisma.user.delete({ where: { id } });
    publishEvent('auth.user_deleted', { userId: id, motivo: 'admin_delete' });
    return { ok: true };
  });

  // ============================================================
  // POST /api/auth/lineas/agregar (PROTEGIDO)
  // ============================================================
  fastify.post('/lineas/agregar', { preHandler: requireAuth }, async (request, reply) => {
    const { telefono } = request.body ?? {};
    if (!telefono || !/^\d{10}$/.test(telefono)) {
      return reply.code(400).send({ ok: false, error: 'Telefono invalido (10 digitos).' });
    }
    const userId = request.user.sub;
    const publicKeyId = request.user.publicKeyId ?? null;

    try {
      const r = await fetch(`${TELECOM_URL}/api/telecom/lineas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono, userId, publicKeyId, committed: true }),
      });
      const d = await r.json();
      if (r.status === 409) return reply.code(409).send(d);
      if (!r.ok) throw new Error(d.error ?? 'Telecom fallo.');
      await fetch(`${TELECOM_URL}/api/telecom/lineas/${telefono}/activar`, { method: 'POST' });
      return reply.code(201).send({ ok: true, linea: d.linea });
    } catch (err) {
      return reply.code(502).send({ ok: false, error: err.message });
    }
  });

  // GET /api/auth/lineas (PROTEGIDO)
  fastify.get('/lineas', { preHandler: requireAuth }, async (request) => {
    try {
      const r = await fetch(`${TELECOM_URL}/api/telecom/lineas/by-user/${request.user.sub}`);
      const d = await r.json();
      return d;
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ============================================================
  // POST /api/auth/revocar/iniciar (PROTEGIDO)
  // ============================================================
  fastify.post('/revocar/iniciar', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user.sub;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.code(404).send({ ok: false, error: 'Usuario no encontrado.' });

    const codigo = codigoCincoDigitos();
    const expira = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: { codigoRevocacion: codigo, codigoRevocacionExpira: expira },
    });

    publishEvent('auth.revocacion_codigo', {
      userId,
      email: user.email,
      telefono: user.telefono,
      curp: user.curp,
      codigo,
      expiraEn: expira.toISOString(),
    });

    return { ok: true, expiraEn: expira.toISOString() };
  });

  // POST /api/auth/revocar/confirmar (PROTEGIDO)
  fastify.post('/revocar/confirmar', { preHandler: requireAuth }, async (request, reply) => {
    const { codigo } = request.body ?? {};
    if (!codigo || !/^\d{5}$/.test(codigo)) {
      return reply.code(400).send({ ok: false, error: 'Codigo invalido.' });
    }
    const userId = request.user.sub;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.code(404).send({ ok: false, error: 'Usuario no encontrado.' });
    if (!user.codigoRevocacion || !user.codigoRevocacionExpira) {
      return reply.code(400).send({ ok: false, error: 'No hay codigo activo. Solicita uno nuevo.' });
    }
    if (user.codigoRevocacionExpira < new Date()) {
      return reply.code(400).send({ ok: false, error: 'Codigo expirado.' });
    }
    if (user.codigoRevocacion !== codigo) {
      return reply.code(400).send({ ok: false, error: 'Codigo incorrecto.' });
    }

    publishEvent('auth.revocacion_confirmada', { userId });

    try {
      await fetch(`${TELECOM_URL}/api/telecom/lineas/by-user/${userId}/desvincular`, { method: 'POST' });
    } catch (err) { request.log.warn({ err }, 'Telecom desvincular'); }
    try {
      await fetch(`${PKI_URL}/api/pki/users/${userId}/revoke-all`, { method: 'POST' });
    } catch (err) { request.log.warn({ err }, 'PKI revoke-all'); }

    await prisma.user.update({
      where: { id: userId },
      data: { codigoRevocacion: null, codigoRevocacionExpira: null },
    });
    return { ok: true };
  });

  // ============================================================
  // RECUPERACION DE CUENTA (olvido de correo o contrasena)
  //
  // El cliente:
  //   1. Carga su archivo .pem y lee el bloque YORU IDENTITY para
  //      extraer su userId.
  //   2. POST /recuperar/iniciar { userId } -> challenge.
  //   3. Firma el nonce con su llave privada y manda POST
  //      /recuperar/verificar { userId, challengeId, signatureB64 }.
  //   4. Backend pide a PKI verificar. Si OK, devuelve email actual +
  //      recoveryToken (10 min) y permite cambiar password/email.
  //   5. POST /recuperar/cambiar { recoveryToken, newPassword?, newEmail? }
  // ============================================================
  fastify.post('/recuperar/iniciar', async (request, reply) => {
    const { userId } = request.body ?? {};
    if (!userId) return reply.code(400).send({ ok: false, error: 'userId requerido.' });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.committed) {
      return reply.code(404).send({ ok: false, error: 'Usuario no encontrado.' });
    }

    const nonce = crypto.randomUUID() + '.' + Date.now();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const challenge = await prisma.challenge.create({
      data: { userId, nonce, proposito: 'recovery', expiresAt },
      select: { id: true, nonce: true, expiresAt: true },
    });
    return { ok: true, challenge };
  });

  fastify.post('/recuperar/verificar', async (request, reply) => {
    const { userId, challengeId, signatureB64 } = request.body ?? {};
    if (!userId || !challengeId || !signatureB64) {
      return reply.code(400).send({ ok: false, error: 'Datos incompletos.' });
    }
    const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge || challenge.userId !== userId || challenge.proposito !== 'recovery') {
      return reply.code(404).send({ ok: false, error: 'Challenge no encontrado.' });
    }
    if (challenge.usado)               return reply.code(401).send({ ok: false, error: 'Challenge ya usado.' });
    if (challenge.expiresAt < new Date()) return reply.code(401).send({ ok: false, error: 'Challenge expirado.' });

    let valida = false;
    try {
      const r = await fetch(`${PKI_URL}/api/pki/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, payload: challenge.nonce, signatureB64, challengeId }),
      });
      const d = await r.json();
      valida = d.valida === true;
    } catch (err) {
      return reply.code(503).send({ ok: false, error: `PKI no disponible.` });
    }
    if (!valida) return reply.code(401).send({ ok: false, error: 'Firma invalida.' });

    await prisma.challenge.update({ where: { id: challengeId }, data: { usado: true } });

    const recoveryToken  = tokenAleatorio();
    const recoveryExpira = new Date(Date.now() + RECOVERY_TTL_MIN * 60 * 1000);
    const user = await prisma.user.update({
      where: { id: userId },
      data: { recoveryToken, recoveryTokenExpira: recoveryExpira },
      select: { id: true, email: true, telefono: true, curp: true, nombre: true },
    });
    return { ok: true, user, recoveryToken, recoveryExpiraEn: recoveryExpira.toISOString() };
  });

  fastify.post('/recuperar/cambiar', async (request, reply) => {
    const { recoveryToken, newPassword, newEmail } = request.body ?? {};
    if (!recoveryToken) return reply.code(400).send({ ok: false, error: 'recoveryToken requerido.' });

    const user = await prisma.user.findFirst({ where: { recoveryToken } });
    if (!user) return reply.code(404).send({ ok: false, error: 'Token invalido.' });
    if (!user.recoveryTokenExpira || user.recoveryTokenExpira < new Date()) {
      return reply.code(401).send({ ok: false, error: 'Token expirado.' });
    }

    const data = {
      recoveryToken: null,
      recoveryTokenExpira: null,
    };

    if (newPassword) {
      const errsPass = reglasContrasena(newPassword);
      if (errsPass.length > 0) {
        return reply.code(400).send({
          ok: false,
          error: `La contrasena debe tener ${errsPass.join(', ')}.`,
        });
      }
      const { hash, salt } = hashPassword(newPassword);
      data.passwordHash = hash;
      data.passwordSalt = salt;
    }

    if (newEmail) {
      if (!validarEmail(newEmail)) {
        return reply.code(400).send({ ok: false, error: 'Correo invalido.' });
      }
      const emailLimpio = newEmail.trim().toLowerCase();
      const conflicto = await prisma.user.findFirst({
        where: { email: emailLimpio, id: { not: user.id } },
      });
      if (conflicto) {
        return reply.code(409).send({ ok: false, error: 'Ese correo ya esta en uso.' });
      }
      data.email = emailLimpio;
    }

    if (!newPassword && !newEmail) {
      // Cambio "vacio" → solo consume el token (caso "solo queria ver mi email").
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
      select: { id: true, email: true },
    });
    return { ok: true, user: updated };
  });
}
