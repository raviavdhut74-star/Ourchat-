// Tiny in-memory rate limiter (per IP). For several server instances use a shared store such as Redis.
export function rateLimit({ windowMs = 15 * 60 * 1000, max = 30 } = {}) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, windowMs).unref();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    let h = hits.get(key);
    if (!h || h.reset < now) { h = { count: 0, reset: now + windowMs }; hits.set(key, h); }
    if (++h.count > max) return res.status(429).json({ error: 'too_many_requests' });
    next();
  };
}
