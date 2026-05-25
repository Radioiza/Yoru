import jwt from 'jsonwebtoken';

const SECRET     = process.env.JWT_SECRET     ?? 'yoru-demo-secret-no-prod-change-me';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '1h';
const ISSUER     = 'yoru-auth';

export function signJwt(claims) {
  return jwt.sign(claims, SECRET, { issuer: ISSUER, expiresIn: EXPIRES_IN });
}

export function verifyJwt(token) {
  return jwt.verify(token, SECRET, { issuer: ISSUER });
}
