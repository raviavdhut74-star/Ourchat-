import { Router } from 'express';
import { q, one } from '../db/mysql.js';
import { wrap, bad } from '../lib/http.js';
import { requireAuth } from '../lib/auth.js';
import { uid, hiddenIds } from '../lib/helpers.js';

const r = Router();
r.use(requireAuth);

/* ---------- activity / notifications ---------- */
r.get('/notifications', wrap(async (req, res) => {
  const hidden = await hiddenIds(req.me);
  const rows = await q(
    `SELECT n.id, n.type, n.from_id, n.post_id, n.text, n.is_read, n.created_at, u.name AS from_name, u.avatar_url, p.url AS post_url, p.kind AS post_kind
     FROM notifications n JOIN users u ON u.id = n.from_id LEFT JOIN posts p ON p.id = n.post_id
     WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 100`, [req.me]);
  res.json({
    notifications: rows.filter((n) => !hidden.has(n.from_id)).map((n) => ({
      id: n.id, type: n.type, from: n.from_id, fromName: n.from_name, photo: n.avatar_url || '', postId: n.post_id,
      url: n.post_url || '', mediaKind: n.post_kind || '', text: n.text, read: !!n.is_read, createdAt: n.created_at,
    })),
  });
}));

r.post('/notifications/read', wrap(async (req, res) => {
  await q('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.me]);
  res.json({ ok: true });
}));

/* ---------- history ---------- */
r.get('/history', wrap(async (req, res) => {
  const rows = await q(
    `SELECT h.id, h.type, h.ref_id, h.text, h.created_at, u.name AS user_name, p.url AS post_url, p.kind AS post_kind, p.caption, p.is_reel
     FROM history h LEFT JOIN users u ON h.type = 'profile' AND u.id = h.ref_id
     LEFT JOIN posts p ON h.type = 'watch' AND p.id = h.ref_id
     WHERE h.user_id = ? ORDER BY h.created_at DESC LIMIT 100`, [req.me]);
  res.json({
    history: rows.map((h) => ({
      id: h.id, type: h.type, refId: h.ref_id, text: h.text, createdAt: h.created_at,
      name: h.user_name || '', url: h.post_url || '', mediaKind: h.post_kind || '', caption: h.caption || '', reel: !!h.is_reel,
    })),
  });
}));

r.post('/history', wrap(async (req, res) => {
  const { type, refId = null, text = '' } = req.body || {};
  if (!['search', 'profile', 'watch'].includes(type)) throw bad('bad_type');
  // do not store the same thing twice in 30 seconds
  const dup = await one('SELECT 1 AS x FROM history WHERE user_id = ? AND type = ? AND ref_id <=> ? AND text = ? AND created_at > DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 30 SECOND)', [req.me, type, refId, String(text).slice(0, 120)]);
  if (!dup) await q('INSERT INTO history (id, user_id, type, ref_id, text) VALUES (?,?,?,?,?)', [uid(), req.me, type, refId, String(text).slice(0, 120)]);
  res.json({ ok: true });
}));

r.delete('/history/:id', wrap(async (req, res) => {
  await q('DELETE FROM history WHERE id = ? AND user_id = ?', [req.params.id, req.me]);
  res.json({ ok: true });
}));
r.delete('/history', wrap(async (req, res) => {
  await q('DELETE FROM history WHERE user_id = ?', [req.me]);
  res.json({ ok: true });
}));

/* ---------- reports ---------- */
r.post('/reports', wrap(async (req, res) => {
  const { type, targetId, targetUid = null, reason } = req.body || {};
  if (!['spam', 'abusive', 'nudity', 'scam', 'other'].includes(reason) || !type || !targetId) throw bad('bad_report');
  await q('INSERT INTO reports (id, by_id, type, target_id, target_uid, reason) VALUES (?,?,?,?,?,?)', [uid(), req.me, String(type).slice(0, 20), String(targetId).slice(0, 64), targetUid, reason]);
  res.status(201).json({ ok: true });
}));

export default r;
