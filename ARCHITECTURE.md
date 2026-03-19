# System Architecture — AI GitHub Debugging Assistant

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                                      │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │              Next.js 14 Frontend (TypeScript + Tailwind)            │ │
│  │                                                                     │ │
│  │   Landing → Dashboard → Repos → Debugger → Patch Viewer → PR       │ │
│  └─────────────────────────────────┬───────────────────────────────────┘ │
└────────────────────────────────────│──────────────────────────────────────┘
                                     │ HTTPS / REST
┌────────────────────────────────────▼──────────────────────────────────────┐
│                    Nginx Reverse Proxy (Production)                        │
│              Rate limiting · SSL termination · Security headers            │
└────────────────────────────────────┬──────────────────────────────────────┘
                                     │
        ┌────────────────────────────┴────────────────────┐
        │                                                  │
┌───────▼───────────────────────┐           ┌─────────────▼──────────────┐
│   Backend API (Node/Express)  │           │   NextAuth (OAuth handler) │
│                               │           │   GitHub Provider          │
│  /auth         POST           │           └────────────────────────────┘
│  /repos        GET POST       │
│  /index-repo   POST GET       │  ←── Stores encrypted GitHub
│  /analyze-error POST GET      │       tokens in MongoDB
│  /create-pr    POST GET       │
└───────────┬───────────────────┘
            │
     ┌──────┴──────────────────────┐
     │                             │
┌────▼──────┐   ┌──────────────┐  │  ┌─────────────────────────────────┐
│  MongoDB  │   │  GitHub API  │  │  │     AI Engine (FastAPI/Python)  │
│           │   │  (@octokit)  │  │  │                                 │
│  Users    │   │              │  └─►│  POST /index                    │
│  Repos    │   │  - list repos│     │    clone → scan → chunk →       │
│  Analyses │   │  - get files │     │    embed → store                │
│  PRs      │   │  - create PR │     │                                 │
│           │   │  - push code │     │  POST /analyze                  │
└───────────┘   └──────────────┘     │    embed query → search →       │
                                     │    retrieve → LLM → patch       │
                                     └────────┬────────────────────────┘
                                              │
                                    ┌─────────┴──────────┐
                                    │                    │
                              ┌─────▼──────┐    ┌───────▼────────┐
                              │  ChromaDB  │    │  OpenAI API    │
                              │            │    │                │
                              │  Vectors   │    │  GPT-4.1       │
                              │  per repo  │    │  (analysis)    │
                              │  (HNSW     │    │                │
                              │  cosine)   │    │  text-emb-3    │
                              └────────────┘    │  (embeddings)  │
                                                └────────────────┘
```

---

## RAG Pipeline (Detailed)

### Phase 1: Repository Indexing

```
User clicks "Index" button
         │
         ▼
Backend POST /index-repo
  - Verify repo ownership
  - Get encrypted GitHub token
  - Call AI Engine POST /index
  - Return jobId immediately (async)
         │
         ▼
AI Engine: RepositoryIndexer.index()
         │
    ┌────▼────────────────────────────────────────────────────────┐
    │  git clone --depth=1 https://x-access-token:{token}@...     │
    │  → /tmp/repos/{repoId}/                                     │
    └────────────────────────────────────────────────────────────-┘
         │
    ┌────▼────────────────────────────────────────────────────────┐
    │  Scan files (recursive glob)                                │
    │  Filter: extensions (.py .ts .js .go .rs .java ...)        │
    │  Filter: skip node_modules, .git, dist, build ...          │
    │  Filter: max 500KB per file                                 │
    └─────────────────────────────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────────────────────────┐
    │  Language-aware chunking (LangChain splitters)              │
    │  Python → RecursiveCharacterTextSplitter(Language.PYTHON)  │
    │  JS/TS  → RecursiveCharacterTextSplitter(Language.JS)      │
    │  chunk_size=1000, chunk_overlap=200                         │
    │  Metadata: file_path, start_line, end_line, language        │
    └─────────────────────────────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────────────────────────┐
    │  Batch embed (batches of 50)                                │
    │  OpenAI text-embedding-3-small → 1536-dim vectors           │
    └─────────────────────────────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────────────────────────┐
    │  ChromaDB upsert                                            │
    │  Collection: repo_{repoId}                                  │
    │  HNSW index, cosine distance metric                         │
    └─────────────────────────────────────────────────────────────┘
         │
    Clean up /tmp/repos/{repoId}
    Update MongoDB: isIndexed=true, fileCount, chunkCount
```

### Phase 2: Error Analysis

```
User pastes error + selects repo → clicks Analyze
         │
         ▼
Backend POST /analyze-error
  - Validate repo is indexed
  - Fetch GitHub issue if URL type
  - Call AI Engine POST /analyze
         │
         ▼
AI Engine: VectorSearcher.search()
         │
    ┌────▼────────────────────────────────────────────────────────┐
    │  Enrich error query                                         │
    │  - Extract first 5 meaningful lines                         │
    │  - Extract function/class identifiers from stack trace      │
    │  - Append "Related identifiers: ..."                        │
    └─────────────────────────────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────────────────────────┐
    │  Embed enriched query                                       │
    │  text-embedding-3-small → 1536-dim vector                   │
    └─────────────────────────────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────────────────────────┐
    │  ChromaDB cosine similarity search                          │
    │  collection.query(query_embeddings=[...], n_results=16)     │
    │  Filter: similarity >= 0.3                                  │
    │  Return top 8 chunks with scores                            │
    └─────────────────────────────────────────────────────────────┘
         │
         ▼
AI Engine: AIDebugger.analyze()
         │
    ┌────▼────────────────────────────────────────────────────────┐
    │  Build LangChain prompt                                     │
    │  System: expert debugger instructions                       │
    │  Human:  error + code context + format instructions         │
    │                                                             │
    │  Code context format:                                       │
    │  ### [1] src/file.ts (lines 12-45) — relevance: 0.92      │
    │  ```typescript                                              │
    │  ... code chunk ...                                         │
    │  ```                                                        │
    └─────────────────────────────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────────────────────────┐
    │  GPT-4.1 call (temperature=0.1)                             │
    │  Fallback: gpt-4o-mini on failure                           │
    │  max_tokens=4096                                            │
    └─────────────────────────────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────────────────────────┐
    │  Pydantic structured output parsing                         │
    │  → root_cause, explanation, affected_files                  │
    │  → suggested_fix, code_fixes[], confidence                  │
    └─────────────────────────────────────────────────────────────┘
         │
         ▼
PatchGenerator.generate()
         │
    ┌────▼────────────────────────────────────────────────────────┐
    │  For each code_fix:                                         │
    │  difflib.unified_diff(original_lines, fixed_lines)          │
    │  → raw patch string                                         │
    │  → structured hunks (for frontend diff viewer)              │
    └─────────────────────────────────────────────────────────────┘
         │
    Persist Analysis to MongoDB
    Return to frontend
```

### Phase 3: Pull Request Creation

```
User reviews patch → clicks "Open PR"
         │
         ▼
Backend POST /create-pr
         │
    ┌────▼────────────────────────────────────────────────────────┐
    │  GitHub API: get base branch SHA                            │
    │  GET /repos/{owner}/{repo}/git/refs/heads/{branch}          │
    └─────────────────────────────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────────────────────────┐
    │  GitHub API: create new branch                              │
    │  POST /repos/{owner}/{repo}/git/refs                        │
    │  branch name: ai-fix/{timestamp}                            │
    └─────────────────────────────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────────────────────────┐
    │  For each affected file in patchPreview:                    │
    │                                                             │
    │  1. GET /repos/{owner}/{repo}/contents/{path}?ref={branch}  │
    │     → current file content (base64) + file SHA              │
    │                                                             │
    │  2. Apply patch lines to content:                           │
    │     - deletion: remove line at offset                       │
    │     - addition: insert line at offset                       │
    │     - context: advance offset                               │
    │                                                             │
    │  3. PUT /repos/{owner}/{repo}/contents/{path}               │
    │     → commit patched file to new branch                     │
    └─────────────────────────────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────────────────────────┐
    │  GitHub API: create pull request                            │
    │  POST /repos/{owner}/{repo}/pulls                           │
    │  head: ai-fix/{timestamp}                                   │
    │  base: main (default branch)                                │
    │  body: AI-generated description with root cause             │
    └─────────────────────────────────────────────────────────────┘
         │
    Add labels: ai-generated, bug-fix
    Persist PR to MongoDB
    Return PR URL to frontend
```

---

## Data Flow & Security

```
Browser ──[HTTPS]──► Nginx ──► Frontend (Next.js)
                                    │
                                    │ /api/auth (NextAuth)
                                    ▼
                               GitHub OAuth
                                    │ access_token
                                    ▼
                              Backend /auth/github
                                    │
                               ┌────▼─────────────────┐
                               │  AES-256 encrypt      │
                               │  token before save    │
                               │  to MongoDB           │
                               └────┬─────────────────-┘
                                    │
Every subsequent API call:          │
Browser ──► Backend                 │
Authorization: Bearer {token} ──────┤
x-github-login: {login}             │
                                    │
            authMiddleware:         │
            1. Verify token via     │
               GitHub /user API     │
            2. Load user from DB    │
               with +_encryptedToken│
            3. Decrypt token        │
            4. Attach octokit       │
            5. All queries scoped   │
               by userId            │
```

---

## Database Schema

```
Users Collection
├── githubId: string (unique, indexed)
├── login: string
├── name: string
├── email: string
├── avatarUrl: string
├── _encryptedToken: string (AES-256, hidden from JSON)
└── timestamps

Repositories Collection
├── githubId: number
├── owner: string
├── name: string
├── fullName: string (e.g. "torvalds/linux")
├── description: string
├── language: string
├── isPrivate: boolean
├── defaultBranch: string
├── isIndexed: boolean
├── indexedAt: Date
├── indexingStatus: enum[pending|indexing|complete|error]
├── fileCount: number
├── chunkCount: number
├── userId: ObjectId → Users (indexed)
└── timestamps
  Index: { githubId, userId } unique

Analyses Collection
├── repositoryId: ObjectId → Repositories (indexed)
├── userId: ObjectId → Users (indexed)
├── errorInput: string
├── errorType: enum[message|stacktrace|github_issue]
├── rootCause: string
├── explanation: string
├── affectedFiles: [{ path, reason, relevanceScore, snippets[] }]
├── suggestedFix: string
├── patch: string (raw unified diff)
├── patchPreview: [{ filePath, hunks[], lines[] }]
├── confidence: float 0-1
├── model: string (e.g. "gpt-4.1")
├── tokensUsed: number
└── timestamps

PullRequests Collection
├── repositoryId: ObjectId → Repositories
├── analysisId: ObjectId → Analyses
├── userId: ObjectId → Users
├── githubPrNumber: number
├── githubPrUrl: string
├── title: string
├── body: string
├── branch: string
├── baseBranch: string
├── status: enum[open|closed|merged]
└── timestamps
```

---

## ChromaDB Vector Storage

```
Collection per repository: repo_{repoId}
  Metric: cosine similarity
  Index: HNSW (Hierarchical Navigable Small World)

Document:
  id:        MD5(filePath + chunkIndex + firstChars)
  embedding: 1536-dim float32 (text-embedding-3-small)
  document:  code chunk text
  metadata:
    file_path:   "src/components/UserList.tsx"
    start_line:  12
    end_line:    45
    language:    "tsx"
    chunk_index: 0
```

---

## API Reference

### Backend Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/github` | No | Sync user from NextAuth |
| GET | `/auth/me` | Header | Current user info |
| GET | `/repos` | GitHub token | List user's repos |
| POST | `/repos/sync` | GitHub token | Sync repos from GitHub |
| GET | `/repos/:id` | GitHub token | Get single repo |
| POST | `/index-repo` | GitHub token | Start indexing pipeline |
| GET | `/index-repo/status/:jobId` | GitHub token | Poll job status |
| POST | `/analyze-error` | GitHub token | Run RAG analysis |
| GET | `/analyze-error/:id` | GitHub token | Get analysis by ID |
| GET | `/analyze-error/history/:repoId` | GitHub token | List repo analyses |
| POST | `/create-pr` | GitHub token | Create pull request |
| GET | `/create-pr/list/:repoId` | GitHub token | List repo PRs |
| GET | `/health` | No | Health check |

### AI Engine Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/index` | Clone, chunk, embed, store |
| POST | `/analyze` | RAG analysis + patch generation |
| GET | `/health` | Health check |
| GET | `/docs` | Swagger UI (development only) |
