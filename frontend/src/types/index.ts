// ============================================================
// Core Domain Types
// ============================================================

export interface User {
  id: string;
  githubId: string;
  login: string;
  name: string;
  email: string;
  avatarUrl: string;
  accessToken?: string; // encrypted, never exposed to client
}

export interface Repository {
  id: string;
  _id: string;
  githubId: number;
  owner: string;
  name: string;
  fullName: string;
  description: string;
  language: string;
  isPrivate: boolean;
  defaultBranch: string;
  isIndexed: boolean;
  indexedAt?: string;
  indexingStatus?: 'pending' | 'indexing' | 'complete' | 'error';
  fileCount?: number;
  chunkCount?: number;
  userId: string;
}

export interface CodeChunk {
  id: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
  relevanceScore?: number;
}

export interface AnalysisResult {
  id: string;
  repositoryId: string;
  errorInput: string;
  rootCause: string;
  explanation: string;
  affectedFiles: AffectedFile[];
  suggestedFix: string;
  patch: string;
  patchPreview: PatchHunk[];
  confidence: number;
  model: string;
  createdAt: string;
}

export interface AffectedFile {
  path: string;
  reason: string;
  relevanceScore: number;
  snippets: CodeChunk[];
}

export interface PatchHunk {
  filePath: string;
  oldStart: number;
  newStart: number;
  oldLines: number;
  newLines: number;
  lines: PatchLine[];
}

export interface PatchLine {
  type: 'context' | 'addition' | 'deletion';
  content: string;
  lineNumber?: number;
}

export interface PullRequest {
  id: string;
  repositoryId: string;
  analysisId: string;
  githubPrNumber: number;
  githubPrUrl: string;
  title: string;
  body: string;
  branch: string;
  baseBranch: string;
  status: 'open' | 'closed' | 'merged';
  createdAt: string;
}

// ============================================================
// API Request/Response Types
// ============================================================

export interface IndexRepoRequest {
  repositoryId: string;
  owner: string;
  repo: string;
}

export interface IndexRepoResponse {
  success: boolean;
  jobId: string;
  message: string;
}

export interface AnalyzeErrorRequest {
  repositoryId: string;
  errorInput: string;
  errorType: 'message' | 'stacktrace' | 'github_issue';
  issueUrl?: string;
}

export interface CreatePRRequest {
  analysisId: string;
  repositoryId: string;
  title: string;
  body: string;
  branch?: string;
}

export interface CreatePRResponse {
  success: boolean;
  pullRequest: PullRequest;
}

// ============================================================
// UI State Types
// ============================================================

export type IndexingStatus = {
  status: 'idle' | 'cloning' | 'scanning' | 'chunking' | 'embedding' | 'storing' | 'complete' | 'error';
  progress: number;
  message: string;
  filesProcessed?: number;
  totalFiles?: number;
};

export type AnalysisStep = {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'complete' | 'error';
};
