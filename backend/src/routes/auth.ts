import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { User } from '../models';
import { logger } from '../utils/logger';

const router = Router();

const GitHubAuthSchema = z.object({
  githubId: z.union([z.string(), z.number()]).transform(String),
  login: z.string().min(1),
  name: z.string().optional().default(''),
  email: z.string().optional().default(''),
  avatarUrl: z.string().optional().default(''),
  accessToken: z.string().min(1),
});

/**
 * POST /auth/github
 * Called by NextAuth after successful GitHub OAuth login.
 * Creates or updates user, stores encrypted access token.
 */
router.post('/github', async (req: Request, res: Response) => {
  try {
    const body = GitHubAuthSchema.parse(req.body);

    // Upsert user
    const user = await User.findOneAndUpdate(
      { githubId: body.githubId },
      {
        $set: {
          login: body.login,
          name: body.name,
          email: body.email,
          avatarUrl: body.avatarUrl,
        },
      },
      { upsert: true, new: true, select: '+_encryptedToken' }
    );

    // Update encrypted token
    (user as any).accessToken = body.accessToken;
    await user.save();

    logger.info(`User synced: ${body.login}`);
    res.json({ success: true, userId: user._id });
  } catch (err: any) {
    logger.error('Auth sync error', err);
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: err.errors });
    } else {
      res.status(500).json({ error: 'Failed to sync user' });
    }
  }
});

/**
 * GET /auth/me
 * Returns current user info.
 */
router.get('/me', async (req: Request, res: Response) => {
  const login = req.headers['x-github-login'] as string;
  if (!login) return res.status(401).json({ error: 'Not authenticated' });

  const user = await User.findOne({ login });
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    id: user._id,
    login: user.login,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
  });
});

export default router;
