import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../lib/auth.js';
import { uid } from '../lib/helpers.js';
import { bad, wrap } from '../lib/http.js';
import { config } from '../config.js';

const r = Router();
r.use(requireAuth);

// never store anything a browser could run as a page/script
const DENY = new Set(['.html', '.htm', '.xhtml', '.js', '.mjs', '.svg', '.php', '.exe', '.bat', '.cmd', '.sh', '.jar', '.msi', '.dll']);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const d = path.join(config.uploadDir, new Date().toISOString().slice(0, 7));
    fs.mkdirSync(d, { recursive: true });
    cb(null, d);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 8);
    cb(null, uid() + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (DENY.has(ext)) return cb(bad('file_type_not_allowed'));
    cb(null, true);
  },
});

r.post('/upload', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) throw bad('no_file');
  const rel = path.relative(config.uploadDir, req.file.path).split(path.sep).join('/');
  const mime = req.file.mimetype || '';
  const kind = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'file';
  res.status(201).json({ url: `${config.publicUrl}/uploads/${rel}`, kind, fileName: req.file.originalname, size: req.file.size });
}));

export default r;
