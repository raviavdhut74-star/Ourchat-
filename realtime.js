// Tiny holder so route files can push realtime events without importing the socket server.
let io = null;
export const online = new Map(); // userId -> number of open sockets

export const setIO = (i) => { io = i; };
export const emitTo = (userId, event, payload) => { if (io) io.to('u:' + userId).emit(event, payload); };
export const isOnline = (userId) => (online.get(userId) || 0) > 0;
