export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}
export const bad = (code, message) => new HttpError(400, code, message);
export const forbidden = (code = 'forbidden') => new HttpError(403, code);
export const notFound = (code = 'not_found') => new HttpError(404, code);

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.code, message: err.message });
  if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'file_too_large' });
  if (err && err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'duplicate' });
  console.error(err);
  res.status(500).json({ error: 'server_error' });
}
