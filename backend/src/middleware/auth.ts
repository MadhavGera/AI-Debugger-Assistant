import { Request, Response, NextFunction } from 'express';
import { Octokit } from '@octokit/rest';
import { User, IUser } from '../models';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: IUser;
  octokit?: Octokit;
  githubLogin?: string;
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const githubLogin = req.headers['x-github-login'] as string;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing authorization header' });
      return;
    }

    const token = authHeader.slice(7);

    if (!token || !githubLogin) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verify token is valid with GitHub
    const octokit = new Octokit({ auth: token });
    const { data: ghUser } = await octokit.users.getAuthenticated();

    if (ghUser.login !== githubLogin) {
      res.status(401).json({ error: 'Token/login mismatch' });
      return;
    }

    // Load user from DB (includes encrypted token via +select)
    const user = await User.findOne({ login: githubLogin }).select('+_encryptedToken');
    if (!user) {
      res.status(401).json({ error: 'User not found. Please sign in again.' });
      return;
    }

    req.user = user;
    req.octokit = octokit;
    req.githubLogin = githubLogin;
    next();
  } catch (err: any) {
    logger.warn(`Auth failed: ${err.message}`);
    if (err.status === 401) {
      res.status(401).json({ error: 'Invalid or expired GitHub token' });
    } else {
      res.status(500).json({ error: 'Authentication error' });
    }
  }
}
