import { verifyJwt } from './jwt.js';

/**
 * preHandler de Fastify que exige un Bearer token válido.
 * Si el token es válido, deja request.user = { sub, telefono, publicKeyId, ... }.
 */
export async function requireAuth(request, reply) {
  const auth = request.headers.authorization ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return reply.code(401).send({ ok: false, error: 'Token requerido (Authorization: Bearer …).' });
  }
  const token = auth.slice(7).trim();
  try {
    request.user = verifyJwt(token);
  } catch (err) {
    return reply.code(401).send({ ok: false, error: `Token inválido: ${err.message}` });
  }
}
