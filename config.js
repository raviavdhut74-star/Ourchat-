import 'dotenv/config';
import path from 'node:path';

const env = process.env;
const list = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);

export const config = {
  env: env.NODE_ENV || 'development',
  port: Number(env.PORT || 4000),
  jwtSecret: env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpires: '30d',
  corsOrigin: list(env.CORS_ORIGIN || '*'),
  publicUrl: (env.PUBLIC_URL || `http://localhost:${env.PORT || 4000}`).replace(/\/$/, ''),
  appUrl: (env.APP_URL || 'http://localhost:5173').replace(/\/$/, ''),
  mysql: {
    host: env.MYSQL_HOST || '127.0.0.1',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'kshan',
  },
  mongoUrl: env.MONGO_URL || 'mongodb://127.0.0.1:27017',
  mongoDb: env.MONGO_DB || 'kshan',
  uploadDir: path.resolve(env.UPLOAD_DIR || './uploads'),
  maxUploadMb: Number(env.MAX_UPLOAD_MB || 100),
  smtp: { host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), user: env.SMTP_USER, pass: env.SMTP_PASS, from: env.MAIL_FROM || 'Kshan <no-reply@kshan.app>' },
  ice: {
    stun: list(env.STUN_URLS || 'stun:stun.l.google.com:19302'),
    turnUrl: env.TURN_URL || '',
    turnUser: env.TURN_USER || '',
    turnPass: env.TURN_PASS || '',
  },
};

if (config.env === 'production' && config.jwtSecret === 'dev-secret-change-me') {
  throw new Error('JWT_SECRET must be set in production');
}
