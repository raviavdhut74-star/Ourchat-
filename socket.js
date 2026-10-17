import { Server } from 'socket.io';
import { config } from './config.js';
import { col } from './db/mongo.js';
import { q } from './db/mysql.js';
import { verifyToken } from './lib/auth.js';
import { uid, canChat } from './lib/helpers.js';
import { setIO, online, emitTo, isOnline } from './lib/realtime.js';

// calls that are ringing or active: id -> { id, from, to, video, offer, name, state, timer }
const calls = new Map();
const RING_MS = 45000;

const otherOf = (c, me) => (c.from === me ? c.to : c.from);
const userCall = (userId) => [...calls.values()].find((c) => c.from === userId || c.to === userId);

async function finishCall(c, status, reason) {
  clearTimeout(c.timer);
  calls.delete(c.id);
  await col.calls.updateOne({ _id: c.id }, { $set: { status, endedAt: new Date() } }).catch(() => {});
  [c.from, c.to].forEach((u) => emitTo(u, 'call:ended', { callId: c.id, reason }));
}

export function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigin.includes('*') ? true : config.corsOrigin },
    maxHttpBufferSize: 1e6,
  });
  setIO(io);

  io.use((socket, next) => {
    try {
      socket.data.me = verifyToken(socket.handshake.auth && socket.handshake.auth.token);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const me = socket.data.me;
    socket.join('u:' + me);
    online.set(me, (online.get(me) || 0) + 1);
    if (online.get(me) === 1) io.to('p:' + me).emit('presence', { userId: me, online: true });

    // calls that rang while the phone was offline
    for (const c of calls.values()) {
      if (c.to === me && c.state === 'ringing') {
        socket.emit('call:incoming', { callId: c.id, from: c.from, name: c.name, video: c.video, offer: c.offer });
      }
    }

    socket.on('presence:watch', async ({ userId } = {}, ack) => {
      if (!userId || !(await canChat(me, userId))) return ack && ack({ error: 'cannot_chat' });
      socket.join('p:' + userId);
      const p = await col.presence.findOne({ _id: userId });
      ack && ack({ online: isOnline(userId), lastSeen: p ? p.lastSeen : null });
    });
    socket.on('presence:unwatch', ({ userId } = {}) => userId && socket.leave('p:' + userId));

    socket.on('typing', async ({ to, typing } = {}) => {
      if (to && (await canChat(me, to))) emitTo(to, 'typing', { from: me, typing: !!typing });
    });

    /* ---------- WebRTC signalling ---------- */
    socket.on('call:invite', async ({ to, video, offer } = {}, ack = () => {}) => {
      try {
        if (!to || !offer || !(await canChat(me, to))) return ack({ error: 'cannot_chat' });
        if (userCall(me) || userCall(to)) return ack({ error: 'busy' });
        const [u] = await q('SELECT name FROM users WHERE id = ?', [me]);
        const c = { id: uid(), from: me, to, video: !!video, offer, name: u ? u.name : '', state: 'ringing' };
        calls.set(c.id, c);
        await col.calls.insertOne({ _id: c.id, from: me, to, video: !!video, status: 'ringing', createdAt: new Date() });
        c.timer = setTimeout(() => { if (calls.get(c.id) && c.state === 'ringing') finishCall(c, 'missed', 'missed'); }, RING_MS);
        emitTo(to, 'call:incoming', { callId: c.id, from: me, name: c.name, video: c.video, offer });
        ack({ callId: c.id });
      } catch (e) {
        console.error(e);
        ack({ error: 'server_error' });
      }
    });

    socket.on('call:answer', async ({ callId, answer } = {}, ack = () => {}) => {
      const c = calls.get(callId);
      if (!c || c.to !== me || c.state !== 'ringing' || !answer) return ack({ error: 'gone' });
      clearTimeout(c.timer);
      c.state = 'active';
      await col.calls.updateOne({ _id: c.id }, { $set: { status: 'active', answeredAt: new Date() } });
      emitTo(c.from, 'call:answered', { callId, answer });
      ack({ ok: true });
    });

    socket.on('call:ice', ({ callId, candidate } = {}) => {
      const c = calls.get(callId);
      if (c && (c.from === me || c.to === me) && candidate) emitTo(otherOf(c, me), 'call:ice', { callId, candidate });
    });

    socket.on('call:decline', ({ callId } = {}) => {
      const c = calls.get(callId);
      if (c && c.to === me && c.state === 'ringing') finishCall(c, 'declined', 'declined');
    });

    socket.on('call:end', ({ callId } = {}) => {
      const c = calls.get(callId);
      if (!c || (c.from !== me && c.to !== me)) return;
      if (c.state === 'ringing') finishCall(c, c.from === me ? 'cancelled' : 'declined', c.from === me ? 'cancelled' : 'declined');
      else finishCall(c, 'ended', 'ended');
    });

    socket.on('disconnect', async () => {
      const n = (online.get(me) || 1) - 1;
      if (n <= 0) {
        online.delete(me);
        const now = new Date();
        await col.presence.updateOne({ _id: me }, { $set: { lastSeen: now } }, { upsert: true }).catch(() => {});
        io.to('p:' + me).emit('presence', { userId: me, online: false, lastSeen: now });
        const c = userCall(me);
        if (c) finishCall(c, c.state === 'ringing' ? (c.from === me ? 'cancelled' : 'missed') : 'ended', 'ended');
      } else online.set(me, n);
    });
  });

  return io;
}
