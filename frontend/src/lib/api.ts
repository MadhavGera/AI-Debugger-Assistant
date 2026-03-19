import axios, { AxiosInstance } from 'axios';
import { getSession } from 'next-auth/react';
import {
  Repository, AnalysisResult, PullRequest,
  IndexRepoRequest, IndexRepoResponse,
  AnalyzeErrorRequest, CreatePRRequest, CreatePRResponse,
  IndexingStatus
} from '@/types';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BACKEND,
      timeout: 120000, // 2 min for AI operations
    });

    // Attach session token to every request
    this.client.interceptors.request.use(async (config) => {
      const session = await getSession();
      if (session) {
        config.headers['Authorization'] = `Bearer ${(session as any).accessToken}`;
        config.headers['X-GitHub-Login'] = (session as any).user?.login;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (r) => r,
      (err) => {
        const msg = err.response?.data?.error || err.message;
        return Promise.reject(new Error(msg));
      }
    );
  }

  // ── Repositories ─────────────────────────────────────
  async getRepositories(): Promise<Repository[]> {
    const { data } = await this.client.get('/repos');
    return data;
  }

  async getRepository(id: string): Promise<Repository> {
    const { data } = await this.client.get(`/repos/${id}`);
    return data;
  }

  async syncRepositories(): Promise<Repository[]> {
    const { data } = await this.client.post('/repos/sync');
    return data;
  }

  // ── Indexing ──────────────────────────────────────────
  async indexRepository(req: IndexRepoRequest): Promise<IndexRepoResponse> {
    const { data } = await this.client.post('/index-repo', req);
    return data;
  }

  async getIndexingStatus(jobId: string): Promise<IndexingStatus> {
    const { data } = await this.client.get(`/index-repo/status/${jobId}`);
    return data;
  }

  // ── Analysis ──────────────────────────────────────────
  async analyzeError(req: AnalyzeErrorRequest): Promise<AnalysisResult> {
    const { data } = await this.client.post('/analyze-error', req);
    return data;
  }

  async getAnalysis(id: string): Promise<AnalysisResult> {
    const { data } = await this.client.get(`/analyze-error/${id}`);
    return data;
  }

  async getAnalysisHistory(repositoryId: string): Promise<AnalysisResult[]> {
    const { data } = await this.client.get(`/analyze-error/history/${repositoryId}`);
    return data;
  }

  // ── Pull Requests ─────────────────────────────────────
  async createPullRequest(req: CreatePRRequest): Promise<CreatePRResponse> {
    const { data } = await this.client.post('/create-pr', req);
    return data;
  }

  async getPullRequests(repositoryId: string): Promise<PullRequest[]> {
    const { data } = await this.client.get(`/create-pr/list/${repositoryId}`);
    return data;
  }
}

export const api = new APIClient();
export default api;
