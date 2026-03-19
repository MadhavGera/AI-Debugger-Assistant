import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { Repository } from '../models';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

/**
 * GET /repos
 * Returns all repos for the current user stored in DB.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const repos = await Repository.find({ userId: req.user!._id })
      .sort({ updatedAt: -1 })
    res.json(repos);
  } catch (err: any) {
    logger.error('GET /repos error', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /repos/:id
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const repo = await Repository.findOne({
      _id: req.params.id,
      userId: req.user!._id,
    });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });
    res.json(repo);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /repos/sync
 * Fetches all user repos from GitHub and upserts them in DB.
 */
router.post('/sync', async (req: AuthRequest, res: Response) => {
  try {
    const octokit = req.octokit!;
    const userId = req.user!._id;

    // Paginate all repos from GitHub
    const ghRepos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
      per_page: 100,
      sort: 'updated',
      affiliation: 'owner,collaborator',
    });

    const ops = ghRepos.map((r) => ({
      updateOne: {
        filter: { githubId: r.id, userId },
        update: {
          $set: {
            githubId: r.id,
            owner: r.owner.login,
            name: r.name,
            fullName: r.full_name,
            description: r.description || '',
            language: r.language || '',
            isPrivate: r.private,
            defaultBranch: r.default_branch,
            userId,
          },
        },
        upsert: true,
      },
    }));

    await Repository.bulkWrite(ops);
    const repos = await Repository.find({ userId }).sort({ updatedAt: -1 }).lean();

    logger.info(`Synced ${repos.length} repos for user ${req.user!.login}`);
    res.json(repos);
  } catch (err: any) {
    logger.error('POST /repos/sync error', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
