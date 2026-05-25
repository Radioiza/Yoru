import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? 'yoru-demo-secret-no-prod-change-me';
const ISSUER = 'yoru-auth';

export function verifyJwt(token) {
  return jwt.verify(token, SECRET, { issuer: ISSUER });
}
