import { Router } from 'express';
import { q, one } from '../db/mysql.js';
import { wrap, bad, notFound, forbidden } from '../lib/http.js';
import { requireAuth } from '../lib/auth.js';
import { uid, tagsOf, hiddenIds, iFollow, relationSet, canSeeUser, decoratePosts, POST_SELECT } from '../lib/helpers.js';
import { notify, unnotify } from '../lib/notify.js';

const r = Router();
r.use(requireAuth);

const validUrl = (u) => typeof u === 'string' && /^(https?:\/\/|\/uploads\/)/.test(u) && u.length <= 500;

/** Remove posts that I may not see (blocked, private accounts I don't follow, muted). */
async function visibleFilter(me, rows, { allowMuted = false } = {}) {
  const [hidden, following, muted] = await Promise.all([hiddenIds(me), iFollow(me), relationSet(me, 'muted')]);
  const owners = [...new Set(rows.map((x) => x.user_id))];
  const priv = new Set();
  if (owners.length) (await q('SELECT id FROM users WHERE is_private = 1 AND id IN (?)', [owners])).forEach((x) => priv.add(x.id));
  return rows.filter((x) => {
    if (x.user_id === me) return true;
    if (hidden.has(x.user_id)) return false;
    if (!allowMuted && muted.has(x.user_id)) return false;
    if (priv.has(x.user_id) && !following.has(x.user_id)) return false;
    return true;
  });
}

/* ---------- feed / reels ---------- */
// home feed = my posts + posts of people I follow (as in the original app)
r.get('/feed', wrap(async (req, res) => {
  const rows = await q(
    `${POST_SELECT} WHERE p.is_reel = 0 AND (p.user_id = ? OR p.user_id IN (SELECT followee FROM follows WHERE follower = ?))
     ORDER BY p.created_at DESC LIMIT 60`, [req.me, req.me]);
  const ok = await visibleFilter(req.me, rows);
  res.json({ posts: await decoratePosts(ok, req.me) });
}));

r.get('/reels', wrap(async (req, res) => {
  const rows = await q(`${POST_SELECT} WHERE p.is_reel = 1 ORDER BY p.created_at DESC LIMIT 60`);
  const ok = await visibleFilter(req.me, rows);
  res.json({ posts: await decoratePosts(ok, req.me) });
}));

r.get('/tags/:tag', wrap(async (req, res) => {
  const tag = String(req.params.tag).replace(/^#/, '').toLowerCase();
  const rows = await q(`${POST_SELECT} WHERE p.id IN (SELECT post_id FROM post_tags WHERE tag = ?) ORDER BY p.created_at DESC LIMIT 60`, [tag]);
  const ok = await visibleFilter(req.me, rows, { allowMuted: true });
  res.json({ tag, posts: await decoratePosts(ok, req.me) });
}));

/* ---------- create / delete ---------- */
r.post('/posts', wrap(async (req, res) => {
  const { url, kind, caption = '', reel = false } = req.body || {};
  if (!validUrl(url)) throw bad('bad_url');
  if (!['image', 'video'].includes(kind)) throw bad('bad_kind');
  if (reel && kind !== 'video') throw bad('reel_needs_video');
  const cap = String(caption).slice(0, reel ? 150 : 200);
  const id = uid();
  await q('INSERT INTO posts (id, user_id, kind, is_reel, url, caption) VALUES (?,?,?,?,?,?)', [id, req.me, kind, reel ? 1 : 0, url, cap]);
  for (const t of tagsOf(cap)) await q('INSERT IGNORE INTO post_tags (post_id, tag) VALUES (?,?)', [id, t]);
  const [row] = await q(`${POST_SELECT} WHERE p.id = ?`, [id]);
  res.status(201).json({ post: (await decoratePosts([row], req.me))[0] });
}));

r.delete('/posts/:id', wrap(async (req, res) => {
  const p = await one('SELECT user_id FROM posts WHERE id = ?', [req.params.id]);
  if (!p) throw notFound();
  if (p.user_id !== req.me) throw forbidden();
  await q('DELETE FROM posts WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

async function loadPost(id, me) {
  const p = await one('SELECT * FROM posts WHERE id = ?', [id]);
  if (!p || !(await canSeeUser(me, p.user_id))) throw notFound();
  return p;
}

/* ---------- like / save ---------- */
r.post('/posts/:id/like', wrap(async (req, res) => {
  const p = await loadPost(req.params.id, req.me);
  const ex = await one('SELECT 1 AS x FROM likes WHERE post_id = ? AND user_id = ?', [p.id, req.me]);
  if (ex) { await q('DELETE FROM likes WHERE post_id = ? AND user_id = ?', [p.id, req.me]); await unnotify(p.user_id, req.me, 'like', p.id); }
  else { await q('INSERT INTO likes (post_id, user_id) VALUES (?,?)', [p.id, req.me]); await notify(p.user_id, req.me, 'like', { postId: p.id }); }
  const n = await one('SELECT COUNT(*) AS n FROM likes WHERE post_id = ?', [p.id]);
  res.json({ liked: !ex, likes: Number(n.n) });
}));

r.post('/posts/:id/save', wrap(async (req, res) => {
  const p = await loadPost(req.params.id, req.me);
  const ex = await one('SELECT 1 AS x FROM saved WHERE user_id = ? AND post_id = ?', [req.me, p.id]);
  if (ex) await q('DELETE FROM saved WHERE user_id = ? AND post_id = ?', [req.me, p.id]);
  else await q('INSERT INTO saved (user_id, post_id) VALUES (?,?)', [req.me, p.id]);
  res.json({ saved: !ex });
}));

r.get('/saved', wrap(async (req, res) => {
  const rows = await q(`${POST_SELECT} JOIN saved s ON s.post_id = p.id AND s.user_id = ? ORDER BY s.created_at DESC LIMIT 200`, [req.me]);
  const ok = await visibleFilter(req.me, rows, { allowMuted: true });
  res.json({ posts: await decoratePosts(ok, req.me) });
}));

/* ---------- comments ---------- */
r.get('/posts/:id/comments', wrap(async (req, res) => {
  const p = await loadPost(req.params.id, req.me);
  const [hidden, restricted] = await Promise.all([hiddenIds(req.me), relationSet(req.me, 'restricted')]);
  const rows = await q(
    `SELECT c.id, c.user_id, c.parent_id, c.text, c.created_at, u.name, u.username, u.avatar_url,
            (SELECT COUNT(*) FROM comment_likes l WHERE l.comment_id = c.id) AS likes,
            EXISTS(SELECT 1 FROM comment_likes l WHERE l.comment_id = c.id AND l.user_id = ?) AS liked
     FROM comments c JOIN users u ON u.id = c.user_id WHERE c.post_id = ? ORDER BY c.created_at ASC LIMIT 500`, [req.me, p.id]);
  const comments = rows
    .filter((c) => !hidden.has(c.user_id) && (c.user_id === req.me || !restricted.has(c.user_id)))
    .map((c) => ({ id: c.id, uid: c.user_id, parentId: c.parent_id, text: c.text, name: c.name, username: c.username, photo: c.avatar_url || '', createdAt: c.created_at, likes: Number(c.likes), liked: !!c.liked }));
  res.json({ comments });
}));

r.post('/posts/:id/comments', wrap(async (req, res) => {
  const p = await loadPost(req.params.id, req.me);
  const text = String((req.body && req.body.text) || '').trim().slice(0, 300);
  if (!text) throw bad('empty');
  let parent = null;
  if (req.body.parentId) {
    parent = await one('SELECT id, user_id, parent_id FROM comments WHERE id = ? AND post_id = ?', [req.body.parentId, p.id]);
    if (!parent) throw notFound();
    if (parent.parent_id) parent = await one('SELECT id, user_id, parent_id FROM comments WHERE id = ?', [parent.parent_id]); // one level of replies
  }
  const id = uid();
  await q('INSERT INTO comments (id, post_id, user_id, parent_id, text) VALUES (?,?,?,?,?)', [id, p.id, req.me, parent ? parent.id : null, text]);
  if (parent) await notify(parent.user_id, req.me, 'reply', { postId: p.id, text: text.slice(0, 60) });
  if (!parent || parent.user_id !== p.user_id) await notify(p.user_id, req.me, 'comment', { postId: p.id, text: text.slice(0, 60) });
  res.status(201).json({ id });
}));

r.delete('/comments/:id', wrap(async (req, res) => {
  const c = await one('SELECT c.user_id, p.user_id AS owner FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.id = ?', [req.params.id]);
  if (!c) throw notFound();
  if (c.user_id !== req.me && c.owner !== req.me) throw forbidden(); // author of the comment or the post owner
  await q('DELETE FROM comments WHERE id = ?', [req.params.id]); // replies are removed by ON DELETE CASCADE
  res.json({ ok: true });
}));

r.post('/comments/:id/like', wrap(async (req, res) => {
  const c = await one('SELECT id, user_id, post_id FROM comments WHERE id = ?', [req.params.id]);
  if (!c) throw notFound();
  await loadPost(c.post_id, req.me);
  const ex = await one('SELECT 1 AS x FROM comment_likes WHERE comment_id = ? AND user_id = ?', [c.id, req.me]);
  if (ex) { await q('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?', [c.id, req.me]); await unnotify(c.user_id, req.me, 'clike', c.post_id); }
  else { await q('INSERT INTO comment_likes (comment_id, user_id) VALUES (?,?)', [c.id, req.me]); await notify(c.user_id, req.me, 'clike', { postId: c.post_id }); }
  res.json({ liked: !ex });
}));

/* ---------- stories (24h) ---------- */
r.get('/stories', wrap(async (req, res) => {
  const [hidden, muted] = await Promise.all([hiddenIds(req.me), relationSet(req.me, 'muted')]);
  const rows = await q(
    `SELECT s.*, u.name, u.username, u.avatar_url,
            EXISTS(SELECT 1 FROM story_views v WHERE v.story_id = s.id AND v.user_id = ?) AS seen
     FROM stories s JOIN users u ON u.id = s.user_id AND u.deactivated = 0
     WHERE s.created_at > DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 24 HOUR)
       AND (s.user_id = ? OR s.user_id IN (SELECT followee FROM follows WHERE follower = ?))
       AND (s.close_only = 0 OR s.user_id = ? OR EXISTS(SELECT 1 FROM user_relations ur WHERE ur.user_id = s.user_id AND ur.other_id = ? AND ur.kind = 'close'))
     ORDER BY s.created_at ASC`, [req.me, req.me, req.me, req.me, req.me]);
  const stories = rows
    .filter((s) => !hidden.has(s.user_id) && !muted.has(s.user_id))
    .map((s) => ({ id: s.id, uid: s.user_id, name: s.name, username: s.username, photo: s.avatar_url || '', kind: s.kind, url: s.url, close: !!s.close_only, createdAt: s.created_at, seen: !!s.seen }));
  res.json({ stories });
}));

r.post('/stories', wrap(async (req, res) => {
  const { url, kind, closeOnly = false } = req.body || {};
  if (!validUrl(url)) throw bad('bad_url');
  if (!['image', 'video'].includes(kind)) throw bad('bad_kind');
  if (closeOnly) {
    const n = await one("SELECT COUNT(*) AS n FROM user_relations WHERE user_id = ? AND kind = 'close'", [req.me]);
    if (!Number(n.n)) throw bad('no_close_friends');
  }
  const id = uid();
  await q('INSERT INTO stories (id, user_id, kind, url, close_only) VALUES (?,?,?,?,?)', [id, req.me, kind, url, closeOnly ? 1 : 0]);
  res.status(201).json({ id });
}));

r.post('/stories/:id/seen', wrap(async (req, res) => {
  await q('INSERT IGNORE INTO story_views (story_id, user_id) VALUES (?,?)', [req.params.id, req.me]);
  res.json({ ok: true });
}));

r.delete('/stories/:id', wrap(async (req, res) => {
  const s = await one('SELECT user_id FROM stories WHERE id = ?', [req.params.id]);
  if (!s) throw notFound();
  if (s.user_id !== req.me) throw forbidden();
  await q('DELETE FROM stories WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

export default r;
