import mongoose, { Document, Schema } from 'mongoose';
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'fallback-key-change-in-production';

// ── Encryption helpers ────────────────────────────────────
const encrypt = (text: string): string =>
  CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();

const decrypt = (cipher: string): string =>
  CryptoJS.AES.decrypt(cipher, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);

// ============================================================
// USER MODEL
// ============================================================
export interface IUser extends Document {
  githubId: string;
  login: string;
  name: string;
  email: string;
  avatarUrl: string;
  _encryptedToken: string;
  accessToken: string; // virtual
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  githubId: { type: String, required: true, unique: true, index: true },
  login: { type: String, required: true },
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  avatarUrl: { type: String, default: '' },
  _encryptedToken: { type: String, required: true, select: false },
}, { timestamps: true });

// Virtual: decrypt token on read
UserSchema.virtual('accessToken').get(function () {
  return this._encryptedToken ? decrypt(this._encryptedToken) : '';
});

// Encrypt token on set
UserSchema.virtual('accessToken').set(function (token: string) {
  this._encryptedToken = encrypt(token);
});

UserSchema.set('toJSON', { virtuals: false }); // Never expose token in JSON
export const User = mongoose.model<IUser>('User', UserSchema);

// ============================================================
// REPOSITORY MODEL
// ============================================================
export interface IRepository extends Document {
  githubId: number;
  owner: string;
  name: string;
  fullName: string;
  description: string;
  language: string;
  isPrivate: boolean;
  defaultBranch: string;
  isIndexed: boolean;
  indexedAt: Date;
  indexingStatus: 'pending' | 'indexing' | 'complete' | 'error';
  fileCount: number;
  chunkCount: number;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RepositorySchema = new Schema<IRepository>({
  githubId: { type: Number, required: true },
  owner: { type: String, required: true },
  name: { type: String, required: true },
  fullName: { type: String, required: true },
  description: { type: String, default: '' },
  language: { type: String, default: '' },
  isPrivate: { type: Boolean, default: false },
  defaultBranch: { type: String, default: 'main' },
  isIndexed: { type: Boolean, default: false },
  indexedAt: { type: Date },
  indexingStatus: {
    type: String,
    enum: ['pending', 'indexing', 'complete', 'error'],
    default: 'pending',
  },
  fileCount: { type: Number, default: 0 },
  chunkCount: { type: Number, default: 0 },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
}, { timestamps: true });

RepositorySchema.index({ githubId: 1, userId: 1 }, { unique: true });
export const Repository = mongoose.model<IRepository>('Repository', RepositorySchema);

// ============================================================
// ANALYSIS MODEL
// ============================================================
export interface IAnalysis extends Document {
  repositoryId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  errorInput: string;
  errorType: 'message' | 'stacktrace' | 'github_issue';
  rootCause: string;
  explanation: string;
  affectedFiles: {
    path: string;
    reason: string;
    relevanceScore: number;
    snippets: { filePath: string; content: string; startLine: number; endLine: number }[];
  }[];
  suggestedFix: string;
  patch: string;
  patchPreview: {
    filePath: string;
    oldStart: number;
    newStart: number;
    oldLines: number;
    newLines: number;
    lines: { type: 'context' | 'addition' | 'deletion'; content: string; lineNumber?: number }[];
  }[];
  confidence: number;
  aimodel: string;
  tokensUsed: number;
  createdAt: Date;
}

const AnalysisSchema = new Schema<IAnalysis>({
  repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  errorInput: { type: String, required: true },
  errorType: { type: String, enum: ['message', 'stacktrace', 'github_issue'], default: 'stacktrace' },
  rootCause: { type: String, required: true },
  explanation: { type: String, required: true },
  affectedFiles: [{ type: Schema.Types.Mixed }],
  suggestedFix: { type: String, required: true },
  patch: { type: String, required: true },
  patchPreview: [{ type: Schema.Types.Mixed }],
  confidence: { type: Number, min: 0, max: 1, default: 0.7 },
  aimodel: { type: String, default: 'gpt-4.1' },
  tokensUsed: { type: Number, default: 0 },
}, { timestamps: true });

export const Analysis = mongoose.model<IAnalysis>('Analysis', AnalysisSchema);

// ============================================================
// PULL REQUEST MODEL
// ============================================================
export interface IPullRequest extends Document {
  repositoryId: mongoose.Types.ObjectId;
  analysisId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  githubPrNumber: number;
  githubPrUrl: string;
  title: string;
  body: string;
  branch: string;
  baseBranch: string;
  status: 'open' | 'closed' | 'merged';
  createdAt: Date;
  updatedAt: Date;
}

const PullRequestSchema = new Schema<IPullRequest>({
  repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true, index: true },
  analysisId: { type: Schema.Types.ObjectId, ref: 'Analysis', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  githubPrNumber: { type: Number, required: true },
  githubPrUrl: { type: String, required: true },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  branch: { type: String, required: true },
  baseBranch: { type: String, required: true },
  status: { type: String, enum: ['open', 'closed', 'merged'], default: 'open' },
}, { timestamps: true });

export const PullRequest = mongoose.model<IPullRequest>('PullRequest', PullRequestSchema);
