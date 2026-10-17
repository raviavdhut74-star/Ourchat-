import { q, one } from '../db/mysql.js';
import { uid, isHidden } from './helpers.js';
import { emitTo } from './realtime.js';

/** Create an activity notification (follow, like, comment, ...). Never for yourself or blocked users. */
export async function notify(to, from, type, { postId = null, text = '' } = {}) {
  if (!to || to === from) return;
  if (await isHidden(to, from)) return;
  if (type === 'like' || type === 'clike') {
    // a like can be toggled many times: keep only one notification
    await q('DELETE FROM notifications WHERE user_id = ? AND from_id = ? AND type = ? AND post_id <=> ?', [to, from, type, postId]);
  }
  const id = uid();
  await q('INSERT INTO notifications (id, user_id, from_id, type, post_id, text) VALUES (?,?,?,?,?,?)', [id, to, from, type, postId, String(text).slice(0, 100)]);
  const f = await one('SELECT name FROM users WHERE id = ?', [from]);
  emitTo(to, 'notif:new', { id, type, from, fromName: f ? f.name : '', postId, text, createdAt: new Date().toISOString() });
}

export async function unnotify(to, from, type, postId = null) {
  await q('DELETE FROM notifications WHERE user_id = ? AND from_id = ? AND type = ? AND post_id <=> ?', [to, from, type, postId]);
}
