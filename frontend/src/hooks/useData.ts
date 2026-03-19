import useSWR, { mutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import api from '@/lib/api';
import {
  Repository, AnalysisResult, PullRequest,
  AnalyzeErrorRequest, CreatePRRequest, IndexRepoRequest
} from '@/types';

// ── SWR fetchers ──────────────────────────────────────────
const reposFetcher = () => api.getRepositories();
const repoFetcher = (id: string) => api.getRepository(id);
const analysisFetcher = (id: string) => api.getAnalysis(id);
const historyFetcher = (repoId: string) => api.getAnalysisHistory(repoId);
const prsFetcher = (repoId: string) => api.getPullRequests(repoId);

// ── Hooks ─────────────────────────────────────────────────

/**
 * All repositories for current user
 */
export function useRepositories() {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    'repositories',
    reposFetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );
  return {
    repos: data || [],
    indexedRepos: data?.filter(r => r.isIndexed) || [],
    isLoading,
    error,
    revalidate,
  };
}

/**
 * Single repository by ID
 */
export function useRepository(id: string | null) {
  const { data, error, isLoading } = useSWR(
    id ? `repo:${id}` : null,
    () => repoFetcher(id!),
    { revalidateOnFocus: false }
  );
  return { repo: data, isLoading, error };
}

/**
 * Analysis history for a repo
 */
export function useAnalysisHistory(repositoryId: string | null) {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    repositoryId ? `history:${repositoryId}` : null,
    () => historyFetcher(repositoryId!),
    { revalidateOnFocus: false }
  );
  return { analyses: data || [], isLoading, error, revalidate };
}

/**
 * Single analysis by ID
 */
export function useAnalysis(id: string | null) {
  const { data, error, isLoading } = useSWR(
    id ? `analysis:${id}` : null,
    () => analysisFetcher(id!),
    { revalidateOnFocus: false }
  );
  return { analysis: data, isLoading, error };
}

/**
 * Pull requests for a repo
 */
export function usePullRequests(repositoryId: string | null) {
  const { data, error, isLoading, mutate: revalidate } = useSWR(
    repositoryId ? `prs:${repositoryId}` : null,
    () => prsFetcher(repositoryId!),
    { revalidateOnFocus: false }
  );
  return { prs: data || [], isLoading, error, revalidate };
}

/**
 * Mutation: sync repos from GitHub
 */
export function useSyncRepos() {
  return useSWRMutation(
    'repositories',
    () => api.syncRepositories(),
    {
      onSuccess: () => mutate('repositories'),
    }
  );
}

/**
 * Mutation: index a repository
 */
export function useIndexRepo() {
  return useSWRMutation(
    'index-repo',
    (_: string, { arg }: { arg: IndexRepoRequest }) => api.indexRepository(arg)
  );
}

/**
 * Mutation: analyze error
 */
export function useAnalyzeError() {
  return useSWRMutation(
    'analyze-error',
    (_: string, { arg }: { arg: AnalyzeErrorRequest }) => api.analyzeError(arg),
    {
      onSuccess: (data) => {
        // Invalidate history cache for this repo
        mutate(`history:${data.repositoryId}`);
      },
    }
  );
}

/**
 * Mutation: create pull request
 */
export function useCreatePR() {
  return useSWRMutation(
    'create-pr',
    (_: string, { arg }: { arg: CreatePRRequest }) => api.createPullRequest(arg),
    {
      onSuccess: (data) => {
        mutate(`prs:${data.pullRequest.repositoryId}`);
      },
    }
  );
}

/**
 * Polling hook: watch indexing job status
 */
export function useIndexingStatus(jobId: string | null) {
  const { data, error } = useSWR(
    jobId ? `indexing-status:${jobId}` : null,
    () => api.getIndexingStatus(jobId!),
    {
      refreshInterval: (data) => {
        // Stop polling when done
        if (data?.status === 'complete' || data?.status === 'error') return 0;
        return 2000;
      },
      revalidateOnFocus: false,
    }
  );
  return {
    status: data,
    isComplete: data?.status === 'complete',
    isError: data?.status === 'error',
    error,
  };
}
