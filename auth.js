import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { q, one } from '../db/mysql.js';
import { wrap, bad, HttpError } from '../lib/http.js';
import { uid, keyOf, pubUser } from '../lib/helpers.js';
import { signToken, requireAuth } from '../lib/auth.js';
import { sendMail } from '../lib/mailer.js';
import { config } from '../config.js';

const r = Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const me = (u) => ({ ...pubUser(u), email: u.email, phone: u.phone || '', lang: u.lang });

async function findByIdentifier(identifier) {
  const raw = String(identifier || '').trim();
  if (EMAIL.test(raw)) return one('SELECT * FROM users WHERE email = ?', [raw.toLowerCase()]);
  const k = keyOf(raw);
  if (/^\d{7,}$/.test(k)) return one('SELECT * FROM users WHERE phone = ?', [k]);
  return one('SELECT * FROM users WHERE username = ?', [k]);
}

r.post('/register', wrap(async (req, res) => {
  const { email = '', password = '', name = '', phone = '', lang } = req.body || {};
  const username = keyOf(req.body && req.body.username).replace(/[^a-z0-9._]/g, '');
  const ph = keyOf(phone);
  if (!name.trim() || username.length < 3) throw bad('name_username_required');
  if (!EMAIL.test(email)) throw bad('invalid_email');
  if (String(password).length < 6) throw bad('weak_password');
  const phoneVal = /^\d{7,}$/.test(ph) ? ph : null;
  const taken = await one('SELECT 1 AS x FROM users WHERE username = ? OR email = ? OR (phone IS NOT NULL AND phone = ?)', [username, email.toLowerCase(), phoneVal]);
  if (taken) throw new HttpError(409, 'taken');
  const id = uid();
  const hash = await bcrypt.hash(password, 10);
  await q('INSERT INTO users (id, email, username, phone, name, password_hash, lang) VALUES (?,?,?,?,?,?,?)', [
    id, email.toLowerCase(), username, phoneVal, name.trim().slice(0, 30), hash, ['mr', 'en', 'hi', 'gu', 'kn', 'ta', 'te', 'bn'].includes(lang) ? lang : 'mr',
  ]);
  const u = await one('SELECT * FROM users WHERE id = ?', [id]);
  res.status(201).json({ token: signToken(id), user: me(u) });
}));

r.post('/login', wrap(async (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) throw bad('missing_fields');
  const u = await findByIdentifier(identifier);
  if (!u) throw new HttpError(404, 'no_account');
  if (!(await bcrypt.compare(String(password), u.password_hash))) throw new HttpError(401, 'invalid_credentials');
  if (u.deactivated) await q('UPDATE users SET deactivated = 0 WHERE id = ?', [u.id]); // logging in re-activates
  res.json({ token: signToken(u.id), user: me({ ...u, deactivated: 0 }) });
}));

r.post('/forgot', wrap(async (req, res) => {
  const u = await findByIdentifier(req.body && req.body.identifier);
  if (!u) throw new HttpError(404, 'no_account');
  const token = crypto.randomBytes(24).toString('hex');
  await q('DELETE FROM password_resets WHERE user_id = ?', [u.id]);
  await q('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?,?, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 1 HOUR))', [sha(token), u.id]);
  const link = `${config.appUrl}/?reset=${token}`;
  await sendMail({ to: u.email, subject: 'Kshan / क्षण — password reset', text: `Reset your password (valid 1 hour):\n${link}\n\nपासवर्ड रीसेट करण्यासाठी (१ तास वैध):\n${link}` });
  res.json({ ok: true, email: u.email.replace(/^(.).*(@.*)$/, '$1***$2') });
}));

r.post('/reset', wrap(async (req, res) => {
  const { token = '', password = '' } = req.body || {};
  if (String(password).length < 6) throw bad('weak_password');
  const row = await one('SELECT * FROM password_resets WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP(3)', [sha(token)]);
  if (!row) throw bad('invalid_token');
  await q('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(password, 10), row.user_id]);
  await q('DELETE FROM password_resets WHERE user_id = ?', [row.user_id]);
  res.json({ ok: true });
}));

r.get('/me', requireAuth, wrap(async (req, res) => {
  const u = await one('SELECT * FROM users WHERE id = ?', [req.me]);
  if (!u) throw new HttpError(401, 'unauthorized');
  res.json({ user: me(u) });
}));

export default r;
