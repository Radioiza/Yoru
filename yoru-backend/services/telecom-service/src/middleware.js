import { verifyJwt } from './jwt.js';

export async function requireAuth(request, reply) {
  const auth = request.headers.authorization ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return reply.code(401).send({ ok: false, error: 'Token requerido.' });
  }
  const token = auth.slice(7).trim();
  try {
    request.user = verifyJwt(token);
  } catch (err) {
    return reply.code(401).send({ ok: false, error: `Token inválido: ${err.message}` });
  }
}
