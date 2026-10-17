import { Router } from 'express';
import { q, one } from '../db/mysql.js';
import { wrap, bad, notFound, forbidden } from '../lib/http.js';
import { requireAuth } from '../lib/auth.js';
import { pubUser, hiddenIds, relationSet, isHidden, canSeeUser, decoratePosts, POST_SELECT } from '../lib/helpers.js';
import { notify, unnotify } from '../lib/notify.js';
import { emitTo } from '../lib/realtime.js';

const r = Router();
r.use(requireAuth);

/* ---------- my profile / settings ---------- */
r.patch('/me', wrap(async (req, res) => {
  const { name, bio, avatarUrl, isPrivate, lang } = req.body || {};
  const sets = []; const vals = [];
  if (name !== undefined) { if (!String(name).trim()) throw bad('name_required'); sets.push('name = ?'); vals.push(String(name).trim().slice(0, 30)); }
  if (bio !== undefined) { sets.push('bio = ?'); vals.push(String(bio).slice(0, 80)); }
  if (avatarUrl !== undefined) { sets.push('avatar_url = ?'); vals.push(avatarUrl || null); }
  if (isPrivate !== undefined) { sets.push('is_private = ?'); vals.push(isPrivate ? 1 : 0); }
  if (lang !== undefined && ['mr', 'en', 'hi', 'gu', 'kn', 'ta', 'te', 'bn'].includes(lang)) { sets.push('lang = ?'); vals.push(lang); }
  if (sets.length) await q(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...vals, req.me]);
  const u = await one('SELECT * FROM users WHERE id = ?', [req.me]);
  res.json({ user: { ...pubUser(u), email: u.email, phone: u.phone || '', lang: u.lang } });
}));

r.post('/me/deactivate', wrap(async (req, res) => {
  await q('UPDATE users SET deactivated = 1 WHERE id = ?', [req.me]);
  res.json({ ok: true });
}));

/** "Download my data" */
r.get('/me/export', wrap(async (req, res) => {
  const [user, posts, comments, follows, followers, saved] = await Promise.all([
    one('SELECT id, email, username, phone, name, bio, avatar_url, is_private, lang, created_at FROM users WHERE id = ?', [req.me]),
    q('SELECT id, kind, is_reel, url, caption, created_at FROM posts WHERE user_id = ?', [req.me]),
    q('SELECT id, post_id, text, created_at FROM comments WHERE user_id = ?', [req.me]),
    q('SELECT followee, created_at FROM follows WHERE follower = ?', [req.me]),
    q('SELECT follower, created_at FROM follows WHERE followee = ?', [req.me]),
    q('SELECT post_id, created_at FROM saved WHERE user_id = ?', [req.me]),
  ]);
  res.setHeader('Content-Disposition', 'attachment; filename="kshan-data.json"');
  res.json({ exportedAt: new Date().toISOString(), user, posts, comments, following: follows, followers, saved });
}));

/* ---------- users ---------- */
// list / search. No query -> everyone visible (the original app listed all users)
r.get('/users', wrap(async (req, res) => {
  const hidden = await hiddenIds(req.me);
  const term = String(req.query.q || '').trim().toLowerCase().replace(/^@/, '');
  let rows;
  if (term) {
    const like = '%' + term.replace(/[%_]/g, '') + '%';
    rows = await q('SELECT * FROM users WHERE deactivated = 0 AND (LOWER(name) LIKE ? OR username LIKE ?) LIMIT 50', [like, like]);
  } else {
    rows = await q('SELECT * FROM users WHERE deactivated = 0 ORDER BY name LIMIT 200');
  }
  res.json({ users: rows.filter((u) => !hidden.has(u.id)).map(pubUser) });
}));

r.get('/users/:id', wrap(async (req, res) => {
  const id = req.params.id;
  if (await isHidden(req.me, id)) throw notFound();
  const u = await one('SELECT * FROM users WHERE id = ? AND (deactivated = 0 OR id = ?)', [id, req.me]);
  if (!u) throw notFound();
  const [cnt] = await Promise.all([
    one(`SELECT (SELECT COUNT(*) FROM posts WHERE user_id = ?) AS posts,
                (SELECT COUNT(*) FROM follows WHERE followee = ?) AS followers,
                (SELECT COUNT(*) FROM follows WHERE follower = ?) AS following`, [id, id, id]),
  ]);
  const [f, fb, rq, rqIn] = await Promise.all([
    one('SELECT 1 AS x FROM follows WHERE follower = ? AND followee = ?', [req.me, id]),
    one('SELECT 1 AS x FROM follows WHERE follower = ? AND followee = ?', [id, req.me]),
    one('SELECT 1 AS x FROM follow_requests WHERE requester = ? AND target = ?', [req.me, id]),
    one('SELECT 1 AS x FROM follow_requests WHERE requester = ? AND target = ?', [id, req.me]),
  ]);
  const iBlock = await one('SELECT 1 AS x FROM blocks WHERE blocker = ? AND blocked = ?', [req.me, id]);
  res.json({
    user: pubUser(u),
    counts: { posts: Number(cnt.posts), followers: Number(cnt.followers), following: Number(cnt.following) },
    relation: { following: !!f, followsMe: !!fb, requested: !!rq, requestedMe: !!rqIn, blocked: !!iBlock },
    canSee: await canSeeUser(req.me, id),
  });
}));

r.get('/users/:id/posts', wrap(async (req, res) => {
  const id = req.params.id;
  if (!(await canSeeUser(req.me, id))) return res.json({ posts: [], locked: true });
  const reels = req.query.reels === '1' ? 1 : 0;
  const rows = await q(`${POST_SELECT} WHERE p.user_id = ? AND p.is_reel = ? ORDER BY p.created_at DESC LIMIT 100`, [id, reels]);
  res.json({ posts: await decoratePosts(rows, req.me) });
}));

r.get('/users/:id/:list(followers|following)', wrap(async (req, res) => {
  const id = req.params.id;
  if (!(await canSeeUser(req.me, id))) throw forbidden();
  const hidden = await hiddenIds(req.me);
  const rows = req.params.list === 'followers'
    ? await q('SELECT u.* FROM follows f JOIN users u ON u.id = f.follower WHERE f.followee = ? AND u.deactivated = 0', [id])
    : await q('SELECT u.* FROM follows f JOIN users u ON u.id = f.followee WHERE f.follower = ? AND u.deactivated = 0', [id]);
  res.json({ users: rows.filter((u) => !hidden.has(u.id)).map(pubUser) });
}));

/* ---------- follow / requests ---------- */
// all follow edges that involve me (the client uses this to know who it can chat with)
r.get('/follows', wrap(async (req, res) => {
  const rows = await q('SELECT follower, followee FROM follows WHERE follower = ? OR followee = ?', [req.me, req.me]);
  res.json({ follows: rows.map((x) => ({ from: x.follower, to: x.followee })) });
}));

r.post('/follow/:id', wrap(async (req, res) => {
  const t = req.params.id;
  if (t === req.me) throw bad('self');
  if (await isHidden(req.me, t)) throw forbidden('blocked');
  const u = await one('SELECT is_private FROM users WHERE id = ? AND deactivated = 0', [t]);
  if (!u) throw notFound();
  if (u.is_private) {
    await q('INSERT IGNORE INTO follow_requests (requester, target) VALUES (?,?)', [req.me, t]);
    await notify(t, req.me, 'request');
    emitTo(t, 'social:update', {});
    return res.json({ status: 'requested' });
  }
  await q('INSERT IGNORE INTO follows (follower, followee) VALUES (?,?)', [req.me, t]);
  await notify(t, req.me, 'follow');
  emitTo(t, 'social:update', {});
  res.json({ status: 'following' });
}));

r.delete('/follow/:id', wrap(async (req, res) => {
  const t = req.params.id;
  await q('DELETE FROM follows WHERE follower = ? AND followee = ?', [req.me, t]);
  await q('DELETE FROM follow_requests WHERE requester = ? AND target = ?', [req.me, t]);
  await unnotify(t, req.me, 'follow'); await unnotify(t, req.me, 'request');
  emitTo(t, 'social:update', {});
  res.json({ status: 'none' });
}));

// remove a follower (the other person stops following me)
r.delete('/followers/:id', wrap(async (req, res) => {
  await q('DELETE FROM follows WHERE follower = ? AND followee = ?', [req.params.id, req.me]);
  res.json({ ok: true });
}));

r.get('/follow-requests', wrap(async (req, res) => {
  const hidden = await hiddenIds(req.me);
  const rows = await q('SELECT u.* FROM follow_requests fr JOIN users u ON u.id = fr.requester WHERE fr.target = ? AND u.deactivated = 0 ORDER BY fr.created_at DESC', [req.me]);
  res.json({ requests: rows.filter((u) => !hidden.has(u.id)).map(pubUser) });
}));

r.post('/follow-requests/:id/accept', wrap(async (req, res) => {
  const from = req.params.id;
  const rq = await one('SELECT 1 AS x FROM follow_requests WHERE requester = ? AND target = ?', [from, req.me]);
  if (!rq) throw notFound();
  await q('INSERT IGNORE INTO follows (follower, followee) VALUES (?,?)', [from, req.me]);
  await q('DELETE FROM follow_requests WHERE requester = ? AND target = ?', [from, req.me]);
  await notify(from, req.me, 'accepted');
  emitTo(from, 'social:update', {});
  res.json({ ok: true });
}));

r.delete('/follow-requests/:id', wrap(async (req, res) => {
  await q('DELETE FROM follow_requests WHERE requester = ? AND target = ?', [req.params.id, req.me]);
  res.json({ ok: true });
}));

/* ---------- blocks ---------- */
r.get('/blocks', wrap(async (req, res) => {
  const rows = await q('SELECT u.* FROM blocks b JOIN users u ON u.id = b.blocked WHERE b.blocker = ?', [req.me]);
  res.json({ users: rows.map(pubUser) });
}));
r.post('/blocks/:id', wrap(async (req, res) => {
  const t = req.params.id;
  if (t === req.me) throw bad('self');
  await q('INSERT IGNORE INTO blocks (blocker, blocked) VALUES (?,?)', [req.me, t]);
  // blocking also breaks follows both ways
  await q('DELETE FROM follows WHERE (follower = ? AND followee = ?) OR (follower = ? AND followee = ?)', [req.me, t, t, req.me]);
  await q('DELETE FROM follow_requests WHERE (requester = ? AND target = ?) OR (requester = ? AND target = ?)', [req.me, t, t, req.me]);
  emitTo(t, 'social:update', {});
  res.json({ ok: true });
}));
r.delete('/blocks/:id', wrap(async (req, res) => {
  await q('DELETE FROM blocks WHERE blocker = ? AND blocked = ?', [req.me, req.params.id]);
  emitTo(req.params.id, 'social:update', {});
  res.json({ ok: true });
}));

/* ---------- close friends / muted / restricted ---------- */
const KINDS = ['close', 'muted', 'restricted'];
r.get('/relations', wrap(async (req, res) => {
  const out = {};
  for (const k of KINDS) out[k] = [...(await relationSet(req.me, k))];
  res.json(out);
}));
r.post('/relations/:kind/:id', wrap(async (req, res) => {
  const { kind, id } = req.params;
  if (!KINDS.includes(kind)) throw bad('bad_kind');
  const ex = await one('SELECT 1 AS x FROM user_relations WHERE user_id = ? AND other_id = ? AND kind = ?', [req.me, id, kind]);
  if (ex) await q('DELETE FROM user_relations WHERE user_id = ? AND other_id = ? AND kind = ?', [req.me, id, kind]);
  else await q('INSERT INTO user_relations (user_id, other_id, kind) VALUES (?,?,?)', [req.me, id, kind]);
  res.json({ on: !ex });
}));

export default r;
