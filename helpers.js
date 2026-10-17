import crypto from 'node:crypto';
import { q, one } from '../db/mysql.js';

export const uid = () => crypto.randomUUID();
export const chatOf = (a, b) => [a, b].sort().join('_');

/** Public view of a user row. */
export const pubUser = (r) =>
  r && {
    id: r.id,
    name: r.name,
    username: r.username,
    photo: r.avatar_url || '',
    bio: r.bio || '',
    private: !!r.is_private,
  };

/** Normalise a login id: phone -> digits, @username -> username, else lowercase */
export const keyOf = (v) => {
  v = String(v || '').trim().toLowerCase();
  return /^[\d+\s-]{7,}$/.test(v) ? v.replace(/\D/g, '') : v.replace(/^@/, '');
};

const TAG_RE = /#([\p{L}\p{M}\p{N}_]+)/gu;
export const tagsOf = (text) =>
  [...new Set([...String(text || '').toLowerCase().matchAll(TAG_RE)].map((m) => m[1]))].slice(0, 10);

/** Ids of everyone who blocked me or whom I blocked. */
export async function hiddenIds(me) {
  const rows = await q('SELECT blocked AS id FROM blocks WHERE blocker = ? UNION SELECT blocker AS id FROM blocks WHERE blocked = ?', [me, me]);
  return new Set(rows.map((r) => r.id));
}

export async function iFollow(me) {
  const rows = await q('SELECT followee AS id FROM follows WHERE follower = ?', [me]);
  return new Set(rows.map((r) => r.id));
}

export async function relationSet(me, kind) {
  const rows = await q('SELECT other_id AS id FROM user_relations WHERE user_id = ? AND kind = ?', [me, kind]);
  return new Set(rows.map((r) => r.id));
}

export async function isHidden(a, b) {
  const r = await one('SELECT 1 AS x FROM blocks WHERE (blocker = ? AND blocked = ?) OR (blocker = ? AND blocked = ?) LIMIT 1', [a, b, b, a]);
  return !!r;
}

/** You may chat when one of you follows the other (as in the original app) and nobody blocked. */
export async function canChat(a, b) {
  if (a === b || (await isHidden(a, b))) return false;
  const r = await one('SELECT 1 AS x FROM follows WHERE (follower = ? AND followee = ?) OR (follower = ? AND followee = ?) LIMIT 1', [a, b, b, a]);
  return !!r;
}

/** Can `me` see the content (posts) of `owner`? */
export async function canSeeUser(me, owner) {
  if (me === owner) return true;
  if (await isHidden(me, owner)) return false;
  const u = await one('SELECT is_private FROM users WHERE id = ? AND deactivated = 0', [owner]);
  if (!u) return false;
  if (!u.is_private) return true;
  const f = await one('SELECT 1 AS x FROM follows WHERE follower = ? AND followee = ?', [me, owner]);
  return !!f;
}

/** Attach like/comment counts and "liked/saved by me" to post rows. */
export async function decoratePosts(rows, me) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [likes, mine, cm, sv] = await Promise.all([
    q('SELECT post_id, COUNT(*) AS n FROM likes WHERE post_id IN (?) GROUP BY post_id', [ids]),
    q('SELECT post_id FROM likes WHERE user_id = ? AND post_id IN (?)', [me, ids]),
    q('SELECT post_id, COUNT(*) AS n FROM comments WHERE post_id IN (?) GROUP BY post_id', [ids]),
    q('SELECT post_id FROM saved WHERE user_id = ? AND post_id IN (?)', [me, ids]),
  ]);
  const L = new Map(likes.map((x) => [x.post_id, Number(x.n)]));
  const C = new Map(cm.map((x) => [x.post_id, Number(x.n)]));
  const M = new Set(mine.map((x) => x.post_id));
  const S = new Set(sv.map((x) => x.post_id));
  return rows.map((r) => ({
    id: r.id,
    uid: r.user_id,
    name: r.name,
    username: r.username,
    photo: r.avatar_url || '',
    kind: r.kind,
    reel: !!r.is_reel,
    url: r.url,
    caption: r.caption,
    createdAt: r.created_at,
    likes: L.get(r.id) || 0,
    liked: M.has(r.id),
    comments: C.get(r.id) || 0,
    saved: S.has(r.id),
  }));
}

export const POST_SELECT =
  'SELECT p.*, u.name, u.username, u.avatar_url FROM posts p JOIN users u ON u.id = p.user_id AND u.deactivated = 0';
