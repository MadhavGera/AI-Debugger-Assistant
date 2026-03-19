import { Router, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { Repository } from '../models';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

const AI_ENGINE = process.env.AI_ENGINE_URL || 'http://localhost:8000';

// In-memory job status store (use Redis/Bull in production)
const jobStore = new Map<string, {
  status: string; progress: number; message: string;
  filesProcessed?: number; totalFiles?: number;
}>();

const IndexRepoSchema = z.object({
  repositoryId: z.string().min(1),
  owner: z.string().min(1),
  repo: z.string().min(1),
});

/**
 * POST /index-repo
 * Triggers the AI engine to clone and index a repository.
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const body = IndexRepoSchema.parse(req.body);
    const userId = req.user!._id;

    // Verify repo belongs to user
    const repo = await Repository.findOne({ _id: body.repositoryId, userId });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    // Get decrypted token for AI engine to clone private repos
    const accessToken = (req.user as any).accessToken;

    // Generate job ID
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Update repo status
    await Repository.updateOne(
      { _id: repo._id },
      { $set: { indexingStatus: 'indexing' } }
    );

    // Initialize job status
    jobStore.set(jobId, { status: 'cloning', progress: 5, message: 'Cloning repository...' });

    // Fire-and-forget: call AI engine asynchronously
    triggerIndexing(jobId, body.owner, body.repo, accessToken, repo._id.toString()).catch(
      (err) => logger.error(`Indexing job ${jobId} failed`, err)
    );

    res.json({ success: true, jobId, message: 'Indexing started' });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors });
    }
    res.status(500).json({ error: err.message });
  }
});

async function triggerIndexing(
  jobId: string,
  owner: string,
  repo: string,
  token: string,
  repoDbId: string
): Promise<void> {
  const updateJob = (status: string, progress: number, message: string, extra?: object) => {
    jobStore.set(jobId, { status, progress, message, ...extra });
  };

  try {
    updateJob('cloning', 10, 'Cloning repository from GitHub...');

    const response = await axios.post(
      `${AI_ENGINE}/index`,
      { owner, repo, token, repoId: repoDbId },
      {
        timeout: 600000, // 10 min for large repos
        onDownloadProgress: () => {},
      }
    );

    const { fileCount, chunkCount } = response.data;

    // Update DB
    await Repository.updateOne(
      { _id: repoDbId },
      {
        $set: {
          isIndexed: true,
          indexedAt: new Date(),
          indexingStatus: 'complete',
          fileCount,
          chunkCount,
        },
      }
    );

    updateJob('complete', 100, `Indexed ${fileCount} files, ${chunkCount} chunks`, {
      filesProcessed: fileCount,
      totalFiles: fileCount,
    });
  } catch (err: any) {
    await Repository.updateOne({ _id: repoDbId }, { $set: { indexingStatus: 'error' } });
    updateJob('error', 0, err.response?.data?.detail || err.message);
    throw err;
  }
}

/**
 * GET /index-repo/status/:jobId
 */
router.get('/status/:jobId', (req: AuthRequest, res: Response) => {
  const status = jobStore.get(req.params.jobId);
  if (!status) return res.status(404).json({ error: 'Job not found' });
  res.json(status);
});

export default router;
