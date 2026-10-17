import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from './http.js';

export const signToken = (id) => jwt.sign({ sub: id }, config.jwtSecret, { expiresIn: config.jwtExpires });
export const verifyToken = (t) => jwt.verify(t, config.jwtSecret).sub;

export function requireAuth(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return next(new HttpError(401, 'unauthorized'));
  try {
    req.me = verifyToken(token);
    next();
  } catch {
    next(new HttpError(401, 'unauthorized'));
  }
}
