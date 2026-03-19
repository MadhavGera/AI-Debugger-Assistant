import { Router, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { Repository, Analysis } from '../models';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

const AI_ENGINE = process.env.AI_ENGINE_URL || 'http://localhost:8000';

const AnalyzeSchema = z.object({
  repositoryId: z.string().min(1),
  errorInput: z.string().min(1).max(10000),
  errorType: z.enum(['message', 'stacktrace', 'github_issue']),
  issueUrl: z.string().url().optional(),
});

/**
 * POST /analyze-error
 * Runs the full RAG pipeline: embed → search → retrieve → analyze → patch
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const body = AnalyzeSchema.parse(req.body);
    const userId = req.user!._id;

    // Verify repo belongs to user and is indexed
    const repo = await Repository.findOne({ _id: body.repositoryId, userId });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });
    if (!repo.isIndexed) {
      return res.status(400).json({ error: 'Repository is not indexed yet. Please index it first.' });
    }

    let errorText = body.errorInput;

    // If GitHub issue URL, fetch issue body
    if (body.errorType === 'github_issue' && body.issueUrl) {
      try {
        const issueData = await fetchGitHubIssue(body.issueUrl, req.octokit!);
        errorText = `Issue: ${issueData.title}\n\n${issueData.body}`;
      } catch {
        logger.warn('Could not fetch GitHub issue, using raw URL as input');
      }
    }

    logger.info(`Starting analysis for repo ${repo.fullName}`);

    // Call AI engine
    const aiResponse = await axios.post(
      `${AI_ENGINE}/analyze`,
      {
        repoId: repo._id.toString(),
        repoFullName: repo.fullName,
        errorText,
        errorType: body.errorType,
      },
      { timeout: 180000 } // 3 min
    );

    const aiResult = aiResponse.data;

    // Persist analysis to DB
    const analysis = await Analysis.create({
      repositoryId: repo._id,
      userId,
      errorInput: body.errorInput,
      errorType: body.errorType,
      rootCause: aiResult.rootCause,
      explanation: aiResult.explanation,
      affectedFiles: aiResult.affectedFiles,
      suggestedFix: aiResult.suggestedFix,
      patch: aiResult.patch,
      patchPreview: aiResult.patchPreview,
      confidence: aiResult.confidence,
      model: aiResult.model,
      tokensUsed: aiResult.tokensUsed || 0,
    });

    logger.info(`Analysis ${analysis._id} completed for ${repo.fullName}`);

    res.json({
      id: analysis._id,
      repositoryId: analysis.repositoryId,
      errorInput: analysis.errorInput,
      rootCause: analysis.rootCause,
      explanation: analysis.explanation,
      affectedFiles: analysis.affectedFiles,
      suggestedFix: analysis.suggestedFix,
      patch: analysis.patch,
      patchPreview: analysis.patchPreview,
      confidence: analysis.confidence,
      model: analysis.model,
      createdAt: analysis.createdAt,
    });
  } catch (err: any) {
    logger.error('Analyze error failed', err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors });
    }
    if (err.response?.data) {
      return res.status(502).json({ error: `AI engine error: ${err.response.data.detail || err.message}` });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /analyze-error/:id
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const analysis = await Analysis.findOne({
      _id: req.params.id,
      userId: req.user!._id,
    }).lean();
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
    res.json(analysis);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /analyze-error/history/:repositoryId
 */
router.get('/history/:repositoryId', async (req: AuthRequest, res: Response) => {
  try {
    const analyses = await Analysis.find({
      repositoryId: req.params.repositoryId,
      userId: req.user!._id,
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('-patch -patchPreview') // lighter response for history list
      .lean();
    res.json(analyses);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function fetchGitHubIssue(url: string, octokit: any) {
  // Parse https://github.com/owner/repo/issues/123
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  if (!match) throw new Error('Invalid GitHub issue URL');
  const [, owner, repo, issue_number] = match;
  const { data } = await octokit.issues.get({ owner, repo, issue_number: Number(issue_number) });
  return { title: data.title, body: data.body || '' };
}

export default router;
