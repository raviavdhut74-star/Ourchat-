import { Router } from 'express';
import { q, one } from '../db/mysql.js';
import { col } from '../db/mongo.js';
import { wrap, bad, notFound, forbidden, HttpError } from '../lib/http.js';
import { requireAuth } from '../lib/auth.js';
import { uid, chatOf, pubUser, canChat, hiddenIds } from '../lib/helpers.js';
import { emitTo, isOnline } from '../lib/realtime.js';
import { config } from '../config.js';

const r = Router();
r.use(requireAuth);

const TYPES = ['text', 'image', 'video', 'audio', 'file', 'snap'];

/** Shape a message for the client. Snap pictures are view-once: the url is only given by /open. */
function view(m, me, names = {}) {
  const snap = m.type === 'snap';
  return {
    id: m._id,
    chatId: m.chatId,
    from: m.from,
    to: m.to,
    name: names[m.from] || '',
    type: m.type,
    text: m.text || '',
    url: snap ? null : m.url || null,
    fileName: m.fileName || null,
    replyTo: m.replyTo || null,
    pinned: !!m.pinned,
    edited: !!m.edited,
    reactions: m.reactions || {},
    opened: snap ? (m.openedBy || []).length > 0 : undefined,
    createdAt: m.createdAt,
  };
}
const namesOf = async (ids) => {
  const rows = ids.length ? await q('SELECT id, name FROM users WHERE id IN (?)', [ids]) : [];
  return Object.fromEntries(rows.map((x) => [x.id, x.name]));
};
const push = (m, event, extra = {}) => {
  [m.from, m.to].forEach((u) => emitTo(u, event, { ...extra, chatId: m.chatId, message: extra.message }));
};

async function presenceOf(userId) {
  const p = await col.presence.findOne({ _id: userId });
  return { online: isOnline(userId), lastSeen: p ? p.lastSeen : null };
}

/* ---------- chat list ---------- */
r.get('/chats', wrap(async (req, res) => {
  const me = req.me;
  const [edges, hidden] = await Promise.all([
    q('SELECT follower, followee FROM follows WHERE follower = ? OR followee = ?', [me, me]),
    hiddenIds(me),
  ]);
  const peerIds = [...new Set(edges.map((e) => (e.follower === me ? e.followee : e.follower)))].filter((id) => !hidden.has(id));
  if (!peerIds.length) return res.json({ chats: [] });
  const users = await q('SELECT * FROM users WHERE id IN (?) AND deactivated = 0', [peerIds]);

  const myP = (await col.presence.findOne({ _id: me })) || {};
  const lastRead = myP.lastRead || {};
  const lasts = await col.messages.aggregate([
    { $match: { $or: [{ from: me }, { to: me }] } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$chatId', last: { $first: '$$ROOT' } } },
  ]).toArray();
  const lastBy = new Map(lasts.map((x) => [x._id, x.last]));

  const chats = [];
  for (const u of users) {
    const chatId = chatOf(me, u.id);
    const last = lastBy.get(chatId);
    const since = lastRead[chatId] ? new Date(lastRead[chatId]) : new Date(0);
    const unread = last ? await col.messages.countDocuments({ chatId, to: me, createdAt: { $gt: since } }) : 0;
    chats.push({
      user: pubUser(u),
      chatId,
      last: last ? { type: last.type, text: last.text || '', mine: last.from === me, createdAt: last.createdAt } : null,
      unread,
      online: isOnline(u.id),
    });
  }
  chats.sort((a, b) => (b.last ? +new Date(b.last.createdAt) : 0) - (a.last ? +new Date(a.last.createdAt) : 0));
  res.json({ chats });
}));

/* ---------- messages ---------- */
r.get('/chats/:peer/messages', wrap(async (req, res) => {
  const me = req.me, peer = req.params.peer;
  if (!(await canChat(me, peer))) throw forbidden('cannot_chat');
  const chatId = chatOf(me, peer);
  const rows = await col.messages.find({ chatId }).sort({ createdAt: -1 }).limit(Math.min(Number(req.query.limit) || 200, 500)).toArray();
  rows.reverse();
  const names = await namesOf([me, peer]);
  const pp = (await col.presence.findOne({ _id: peer })) || {};
  res.json({
    messages: rows.map((m) => view(m, me, names)),
    peerLastRead: pp.lastRead && pp.lastRead[chatId] ? pp.lastRead[chatId] : null,
    peer: await presenceOf(peer),
  });
}));

r.post('/chats/:peer/messages', wrap(async (req, res) => {
  const me = req.me, peer = req.params.peer;
  if (!(await canChat(me, peer))) throw forbidden('cannot_chat');
  const { type = 'text', text = '', url = null, fileName = null, replyTo = null } = req.body || {};
  if (!TYPES.includes(type)) throw bad('bad_type');
  if (type === 'text' && !String(text).trim()) throw bad('empty');
  if (type !== 'text' && !(typeof url === 'string' && /^(https?:\/\/|\/uploads\/)/.test(url))) throw bad('bad_url');
  const doc = {
    _id: uid(),
    chatId: chatOf(me, peer),
    from: me,
    to: peer,
    type,
    text: String(text).slice(0, 4000),
    url: type === 'text' ? null : url,
    fileName: fileName ? String(fileName).slice(0, 200) : null,
    replyTo: replyTo && typeof replyTo === 'object' ? { id: replyTo.id || null, name: String(replyTo.name || '').slice(0, 40), text: String(replyTo.text || '').slice(0, 120) } : null,
    pinned: false,
    edited: false,
    reactions: {},
    openedBy: [],
    createdAt: new Date(),
  };
  await col.messages.insertOne(doc);
  const names = await namesOf([me, peer]);
  const message = view(doc, me, names);
  push(doc, 'message:new', { message });
  res.status(201).json({ message });
}));

r.post('/chats/:peer/read', wrap(async (req, res) => {
  const me = req.me, peer = req.params.peer;
  const chatId = chatOf(me, peer);
  const at = new Date();
  await col.presence.updateOne({ _id: me }, { $set: { [`lastRead.${chatId}`]: at, lastSeen: at } }, { upsert: true });
  emitTo(peer, 'chat:read', { chatId, by: me, at });
  res.json({ ok: true });
}));

async function ownedMessage(id, me, { senderOnly }) {
  const m = await col.messages.findOne({ _id: id });
  if (!m) throw notFound();
  if (m.from !== me && m.to !== me) throw forbidden();
  if (senderOnly && m.from !== me) throw forbidden();
  return m;
}

// edit text (sender only) and/or pin (either person; one pinned message per chat)
r.patch('/messages/:id', wrap(async (req, res) => {
  const m = await ownedMessage(req.params.id, req.me, { senderOnly: false });
  const set = {};
  if (req.body.text !== undefined) {
    if (m.from !== req.me || m.type !== 'text') throw forbidden();
    const t = String(req.body.text).trim();
    if (!t) throw bad('empty');
    set.text = t.slice(0, 4000); set.edited = true;
  }
  if (req.body.pinned !== undefined) {
    set.pinned = !!req.body.pinned;
    if (set.pinned) {
      const others = await col.messages.find({ chatId: m.chatId, pinned: true, _id: { $ne: m._id } }).toArray();
      await col.messages.updateMany({ chatId: m.chatId, pinned: true }, { $set: { pinned: false } });
      const names0 = await namesOf([m.from, m.to]);
      others.forEach((o) => push(o, 'message:update', { message: view({ ...o, pinned: false }, req.me, names0) }));
    }
  }
  await col.messages.updateOne({ _id: m._id }, { $set: set });
  const fresh = await col.messages.findOne({ _id: m._id });
  const message = view(fresh, req.me, await namesOf([fresh.from, fresh.to]));
  push(fresh, 'message:update', { message });
  res.json({ message });
}));

r.delete('/messages/:id', wrap(async (req, res) => {
  const m = await ownedMessage(req.params.id, req.me, { senderOnly: true });
  await col.messages.deleteOne({ _id: m._id });
  push(m, 'message:delete', { id: m._id });
  res.json({ ok: true });
}));

// delete everything I sent in this chat ("Delete my messages")
r.delete('/chats/:peer/mine', wrap(async (req, res) => {
  const chatId = chatOf(req.me, req.params.peer);
  const mine = await col.messages.find({ chatId, from: req.me }, { projection: { _id: 1 } }).toArray();
  await col.messages.deleteMany({ chatId, from: req.me });
  mine.forEach((m) => { emitTo(req.me, 'message:delete', { id: m._id, chatId }); emitTo(req.params.peer, 'message:delete', { id: m._id, chatId }); });
  res.json({ deleted: mine.length });
}));

// ❤️ reaction toggle (double tap)
r.post('/messages/:id/react', wrap(async (req, res) => {
  const m = await ownedMessage(req.params.id, req.me, { senderOnly: false });
  const emoji = String((req.body && req.body.emoji) || '❤️').slice(0, 8);
  const has = m.reactions && m.reactions[req.me];
  await col.messages.updateOne({ _id: m._id }, has ? { $unset: { [`reactions.${req.me}`]: '' } } : { $set: { [`reactions.${req.me}`]: emoji } });
  const fresh = await col.messages.findOne({ _id: m._id });
  const message = view(fresh, req.me, await namesOf([fresh.from, fresh.to]));
  push(fresh, 'message:update', { message });
  res.json({ message });
}));

// view-once snap: returns the picture once, then marks it as opened
r.post('/messages/:id/open', wrap(async (req, res) => {
  const m = await ownedMessage(req.params.id, req.me, { senderOnly: false });
  if (m.type !== 'snap' || m.to !== req.me) throw forbidden();
  if ((m.openedBy || []).length) throw new HttpError(410, 'snap_opened');
  await col.messages.updateOne({ _id: m._id, openedBy: { $size: 0 } }, { $push: { openedBy: req.me } });
  const fresh = await col.messages.findOne({ _id: m._id });
  push(fresh, 'message:update', { message: view(fresh, req.me, await namesOf([fresh.from, fresh.to])) });
  res.json({ url: m.url, seconds: 5 });
}));

/* ---------- calls ---------- */
r.get('/calls', wrap(async (req, res) => {
  const rows = await col.calls.find({ $or: [{ from: req.me }, { to: req.me }] }).sort({ createdAt: -1 }).limit(30).toArray();
  const ids = [...new Set(rows.flatMap((c) => [c.from, c.to]))];
  const names = await namesOf(ids);
  res.json({
    calls: rows.map((c) => ({
      id: c._id, from: c.from, to: c.to, fromName: names[c.from] || '', toName: names[c.to] || '',
      video: !!c.video, status: c.status, createdAt: c.createdAt, answeredAt: c.answeredAt || null, endedAt: c.endedAt || null,
    })),
  });
}));

// STUN/TURN servers the clients should use for calls
r.get('/ice', (req, res) => {
  const iceServers = [{ urls: config.ice.stun }];
  if (config.ice.turnUrl) iceServers.push({ urls: config.ice.turnUrl, username: config.ice.turnUser, credential: config.ice.turnPass });
  res.json({ iceServers });
});

export default r;
