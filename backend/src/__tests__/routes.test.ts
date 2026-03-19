/**
 * Backend API Test Suite
 * Run: npx jest
 */
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/index';
import { User, Repository, Analysis } from '../src/models';

let mongod: MongoMemoryServer;

// ── Setup ─────────────────────────────────────────────────
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Repository.deleteMany({}),
    Analysis.deleteMany({}),
  ]);
});

// ── Mock GitHub token verification ────────────────────────
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    users: {
      getAuthenticated: jest.fn().mockResolvedValue({
        data: { login: 'testuser', id: 12345 },
      }),
    },
    paginate: jest.fn().mockResolvedValue([
      {
        id: 1001,
        owner: { login: 'testuser' },
        name: 'my-repo',
        full_name: 'testuser/my-repo',
        description: 'A test repo',
        language: 'TypeScript',
        private: false,
        default_branch: 'main',
      },
    ]),
    repos: { listForAuthenticatedUser: jest.fn() },
  })),
}));

// Helper: seed a user
async function seedUser() {
  const user = new User({
    githubId: '12345',
    login: 'testuser',
    name: 'Test User',
    email: 'test@example.com',
    avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
  });
  (user as any).accessToken = 'ghp_testtoken123';
  await user.save();
  return user;
}

// Helper: seed a repo
async function seedRepo(userId: mongoose.Types.ObjectId) {
  return Repository.create({
    githubId: 1001,
    owner: 'testuser',
    name: 'my-repo',
    fullName: 'testuser/my-repo',
    description: 'Test repo',
    language: 'TypeScript',
    isPrivate: false,
    defaultBranch: 'main',
    isIndexed: true,
    userId,
  });
}

const AUTH_HEADERS = {
  Authorization: 'Bearer ghp_testtoken123',
  'x-github-login': 'testuser',
};

// ============================================================
// AUTH ROUTES
// ============================================================
describe('POST /auth/github', () => {
  it('creates a new user on first login', async () => {
    const res = await request(app).post('/auth/github').send({
      githubId: '99999',
      login: 'newuser',
      name: 'New User',
      email: 'new@example.com',
      avatarUrl: 'https://avatars.githubusercontent.com/u/99999',
      accessToken: 'ghp_newtoken456',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.userId).toBeDefined();

    const user = await User.findOne({ login: 'newuser' });
    expect(user).not.toBeNull();
    expect(user!.login).toBe('newuser');
  });

  it('updates existing user on subsequent login', async () => {
    await seedUser();
    const res = await request(app).post('/auth/github').send({
      githubId: '12345',
      login: 'testuser',
      name: 'Updated Name',
      email: 'updated@example.com',
      avatarUrl: 'https://avatars.githubusercontent.com/u/12345',
      accessToken: 'ghp_newtoken789',
    });
    expect(res.status).toBe(200);

    const user = await User.findOne({ githubId: '12345' });
    expect(user!.name).toBe('Updated Name');
  });

  it('returns 400 for missing required fields', async () => {
    const res = await request(app).post('/auth/github').send({
      githubId: '12345',
      // login missing
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request');
  });
});

// ============================================================
// REPO ROUTES
// ============================================================
describe('GET /repos', () => {
  it('returns repositories for authenticated user', async () => {
    const user = await seedUser();
    await seedRepo(user._id);

    const res = await request(app)
      .get('/repos')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].fullName).toBe('testuser/my-repo');
  });

  it('returns empty array when no repos', async () => {
    await seedUser();
    const res = await request(app).get('/repos').set(AUTH_HEADERS);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/repos');
    expect(res.status).toBe(401);
  });
});

describe('POST /repos/sync', () => {
  it('syncs repos from GitHub and returns them', async () => {
    await seedUser();
    const res = await request(app)
      .post('/repos/sync')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].fullName).toBe('testuser/my-repo');
  });
});

describe('GET /repos/:id', () => {
  it('returns a specific repository', async () => {
    const user = await seedUser();
    const repo = await seedRepo(user._id);

    const res = await request(app)
      .get(`/repos/${repo._id}`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('my-repo');
  });

  it('returns 404 for non-existent repo', async () => {
    await seedUser();
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/repos/${fakeId}`)
      .set(AUTH_HEADERS);
    expect(res.status).toBe(404);
  });

  it('returns 404 for repo belonging to another user', async () => {
    // Create another user's repo
    const otherUser = await User.create({
      githubId: '99999', login: 'other', name: 'Other',
      email: 'other@example.com', avatarUrl: '',
    });
    (otherUser as any).accessToken = 'other_token';
    await otherUser.save();
    const repo = await seedRepo(otherUser._id);

    // Try to access as testuser
    await seedUser();
    const res = await request(app)
      .get(`/repos/${repo._id}`)
      .set(AUTH_HEADERS);
    expect(res.status).toBe(404);
  });
});

// ============================================================
// ANALYZE ROUTES
// ============================================================
describe('GET /analyze-error/history/:repositoryId', () => {
  it('returns analysis history for a repo', async () => {
    const user = await seedUser();
    const repo = await seedRepo(user._id);

    // Seed an analysis
    await Analysis.create({
      repositoryId: repo._id,
      userId: user._id,
      errorInput: 'TypeError: Cannot read property map of undefined',
      errorType: 'stacktrace',
      rootCause: 'users array is null before render',
      explanation: 'The component renders before data loads',
      affectedFiles: [],
      suggestedFix: 'Add optional chaining',
      patch: '--- a/file.ts\n+++ b/file.ts',
      patchPreview: [],
      confidence: 0.87,
      model: 'gpt-4.1',
    });

    const res = await request(app)
      .get(`/analyze-error/history/${repo._id}`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].rootCause).toBe('users array is null before render');
    // Should not include patch in history list
    expect(res.body[0].patch).toBeUndefined();
  });
});

describe('POST /analyze-error', () => {
  it('returns 400 when repo is not indexed', async () => {
    const user = await seedUser();
    const repo = await Repository.create({
      githubId: 2002,
      owner: 'testuser',
      name: 'unindexed-repo',
      fullName: 'testuser/unindexed-repo',
      description: '',
      language: 'Python',
      isPrivate: false,
      defaultBranch: 'main',
      isIndexed: false, // ← not indexed
      userId: user._id,
    });

    const res = await request(app)
      .post('/analyze-error')
      .set(AUTH_HEADERS)
      .send({
        repositoryId: repo._id.toString(),
        errorInput: 'KeyError: user_id',
        errorType: 'message',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('not indexed');
  });

  it('returns 404 for unknown repository', async () => {
    await seedUser();
    const res = await request(app)
      .post('/analyze-error')
      .set(AUTH_HEADERS)
      .send({
        repositoryId: new mongoose.Types.ObjectId().toString(),
        errorInput: 'some error',
        errorType: 'message',
      });
    expect(res.status).toBe(404);
  });
});

// ============================================================
// HEALTH CHECK
// ============================================================
describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe('1.0.0');
  });
});
