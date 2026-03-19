import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/database';
import { logger } from './utils/logger';
import mongoose from 'mongoose';

// Routes
import authRoutes from './routes/auth';
import repoRoutes from './routes/repos';
import indexRoutes from './routes/index-repo';
import analyzeRoutes from './routes/analyze';
import prRoutes from './routes/pull-requests';

const app = express();
const PORT = process.env.PORT || 4000;

// ── Security Middleware ────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));

// ── Global Mongoose JSON transform ────────────────────────
// Makes every document expose `id` (string) alongside `_id`
mongoose.set('toJSON', {
  virtuals: true,
  transform: (_doc: any, ret: any) => {
    ret.id = ret._id?.toString();
  },
});

// ── Rate Limiting ─────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 10, // 10 AI calls per minute per IP
  message: { error: 'Too many AI requests. Please wait a moment.' },
});

app.use(generalLimiter);
app.use(morgan('combined', { stream: { write: (msg: string) => process.stdout.write(msg) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health Check ──────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ── Routes ────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/repos', repoRoutes);
app.use('/index-repo', indexRoutes);
app.use('/analyze-error', aiLimiter, analyzeRoutes);
app.use('/create-pr', prRoutes);

// ── Error Handler ─────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ── Start ─────────────────────────────────────────────────
async function bootstrap() {
  await connectDB();
  app.listen(PORT, () => {
    logger.info(`Backend API running on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});

export default app;
