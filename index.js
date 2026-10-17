import fs from 'node:fs';
import http from 'node:http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { initMysql } from './db/mysql.js';
import { initMongo } from './db/mongo.js';
import { errorHandler } from './lib/http.js';
import { rateLimit } from './lib/rateLimit.js';
import { attachSocket } from './socket.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import contentRoutes from './routes/content.js';
import socialRoutes from './routes/social.js';
import chatRoutes from './routes/chat.js';
import uploadRoutes from './routes/upload.js';

await initMysql();
await initMongo();
fs.mkdirSync(config.uploadDir, { recursive: true });

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.corsOrigin.includes('*') ? true : config.corsOrigin }));
app.use(express.json({ limit: '1mb' }));

// uploaded photos / videos / voice notes. nosniff + attachment for unknown types keeps them from running as pages
app.use('/uploads', express.static(config.uploadDir, {
  maxAge: '7d',
  setHeaders(res) { res.setHeader('X-Content-Type-Options', 'nosniff'); },
}));

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'kshan' }));
app.use('/api/auth', rateLimit({ max: 40 }), authRoutes); // login / register / reset are rate limited
app.use('/api', uploadRoutes);
app.use('/api', userRoutes);
app.use('/api', contentRoutes);
app.use('/api', socialRoutes);
app.use('/api', chatRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));
app.use(errorHandler);

const server = http.createServer(app);
attachSocket(server);
server.listen(config.port, () => console.log(`🌸 Kshan API ready on http://localhost:${config.port}`));
