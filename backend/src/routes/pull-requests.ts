import { Router, Response } from 'express';
import { z } from 'zod';
import { Octokit } from '@octokit/rest';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { Analysis, Repository, PullRequest } from '../models';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

const CreatePRSchema = z.object({
  analysisId: z.string().min(1),
  repositoryId: z.string().min(1),
  title: z.string().min(1).max(200),
  body: z.string().max(65536).optional().default(''),
  branch: z.string().optional(),
});

/**
 * POST /create-pr
 * Full workflow:
 *  1. Load analysis + repo
 *  2. Get default branch SHA
 *  3. Create new branch from default
 *  4. Apply patch file-by-file via GitHub Contents API
 *  5. Commit each file change
 *  6. Open pull request
 *  7. Persist PR record
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const body = CreatePRSchema.parse(req.body);
    const userId = req.user!._id;
    const octokit = req.octokit!;

    // Load analysis
    const analysis = await Analysis.findOne({ _id: body.analysisId, userId });
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });

    // Load repo
    const repo = await Repository.findOne({ _id: body.repositoryId, userId });
    if (!repo) return res.status(404).json({ error: 'Repository not found' });

    const owner = repo.owner;
    const repoName = repo.name;
    const baseBranch = repo.defaultBranch;

    // ── Step 1: Get base branch SHA ───────────────────────
    const { data: refData } = await octokit.git.getRef({
      owner, repo: repoName,
      ref: `heads/${baseBranch}`,
    });
    const baseSha = refData.object.sha;
    logger.info(`Base branch SHA: ${baseSha}`);

    // ── Step 2: Create new fix branch ─────────────────────
    const timestamp = Date.now();
    const branchName = body.branch || `ai-fix/${timestamp}`;

    await octokit.git.createRef({
      owner, repo: repoName,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });
    logger.info(`Created branch: ${branchName}`);

    // ── Step 3: Apply patch via GitHub API ────────────────
    const patchHunks = analysis.patchPreview;

    for (const hunk of patchHunks) {
      await applyFilePatch(octokit, owner, repoName, branchName, hunk, body.title);
    }

    // ── Step 4: Create Pull Request ───────────────────────
    const prBody = buildPRBody(body.body, analysis.rootCause, analysis.explanation, analysis.aimodel);

    const { data: pr } = await octokit.pulls.create({
      owner,
      repo: repoName,
      title: body.title,
      body: prBody,
      head: branchName,
      base: baseBranch,
    });

    logger.info(`PR #${pr.number} created: ${pr.html_url}`);

    // Add AI label
    try {
      await octokit.issues.addLabels({
        owner, repo: repoName,
        issue_number: pr.number,
        labels: ['ai-generated', 'bug-fix'],
      });
    } catch { /* Labels may not exist, ignore */ }

    // ── Step 5: Persist PR ────────────────────────────────
    const pullRequest = await PullRequest.create({
      repositoryId: repo._id,
      analysisId: analysis._id,
      userId,
      githubPrNumber: pr.number,
      githubPrUrl: pr.html_url,
      title: body.title,
      body: prBody,
      branch: branchName,
      baseBranch,
      status: 'open',
    });

    res.json({
      success: true,
      pullRequest: {
        id: pullRequest._id,
        githubPrNumber: pr.number,
        githubPrUrl: pr.html_url,
        title: body.title,
        branch: branchName,
        baseBranch,
        status: 'open',
        createdAt: pullRequest.createdAt,
      },
    });
  } catch (err: any) {
    logger.error('Create PR error', err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: err.errors });
    }
    // Surface GitHub API errors
    const ghError = err.response?.data?.message;
    res.status(err.status || 500).json({ error: ghError || err.message });
  }
});

/**
 * Apply a single file patch via GitHub Contents API.
 * Gets current file → merges changes → commits new content.
 */
async function applyFilePatch(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  hunk: any,
  commitTitle: string
): Promise<void> {
  const filePath = hunk.filePath;

  // Get current file content
  let currentContent = '';
  let fileSha: string | undefined;

  try {
    const { data } = await octokit.repos.getContent({
      owner, repo, path: filePath, ref: branch,
    });

    if (!Array.isArray(data) && data.type === 'file') {
      currentContent = Buffer.from(data.content, 'base64').toString('utf8');
      fileSha = data.sha;
    }
  } catch (err: any) {
    if (err.status !== 404) throw err;
    // New file — currentContent stays empty
  }

  // Apply patch lines to content
  const lines = currentContent.split('\n');
  const newLines = applyHunkToLines(lines, hunk);
  const newContent = newLines.join('\n');

  // Commit to branch
  const params: any = {
    owner, repo, path: filePath,
    message: `${commitTitle}\n\nAI-generated fix by AI GitHub Debugger`,
    content: Buffer.from(newContent).toString('base64'),
    branch,
  };
  if (fileSha) params.sha = fileSha;

  await octokit.repos.createOrUpdateFileContents(params);
  logger.info(`Committed patch to ${filePath} on branch ${branch}`);
}

/**
 * Apply hunk lines to file lines array.
 * Handles additions and deletions based on patch preview data.
 */
function applyHunkToLines(lines: string[], hunk: any): string[] {
  const result = [...lines];
  const offset = hunk.oldStart - 1;
  let lineOffset = 0;

  for (const line of hunk.lines) {
    if (line.type === 'deletion') {
      result.splice(offset + lineOffset, 1);
    } else if (line.type === 'addition') {
      result.splice(offset + lineOffset, 0, line.content);
      lineOffset++;
    } else {
      lineOffset++;
    }
  }

  return result;
}

function buildPRBody(userBody: string, rootCause: string, explanation: string, model: string): string {
  return `## 🤖 AI-Generated Fix

${userBody}

---

### 🐛 Root Cause
${rootCause}

### 📋 Explanation
${explanation}

---

> **Generated by [AI GitHub Debugger](https://github.com) using \`${model}\`**
> 
> ⚠️ Please review this patch carefully before merging. AI-generated fixes should always be reviewed by a human.

<!-- ai-generated-fix -->`;
}

/**
 * GET /create-pr/list/:repositoryId
 */
router.get('/list/:repositoryId', async (req: AuthRequest, res: Response) => {
  try {
    const prs = await PullRequest.find({
      repositoryId: req.params.repositoryId,
      userId: req.user!._id,
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json(prs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
