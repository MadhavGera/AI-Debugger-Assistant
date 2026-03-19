'use client';
import { useSession } from 'next-auth/react';
import { redirect, useParams } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Repository, AnalysisResult, PullRequest } from '@/types';
import {
  GitBranch, Bug, GitPullRequest, ExternalLink, Zap,
  Loader2, CheckCircle, Clock, FileCode, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function RepoDetailPage() {
  const { status } = useSession();
  const params = useParams();
  const repoId = params.id as string;

  const [repo, setRepo] = useState<Repository | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [prs, setPRs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [indexing, setIndexing] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/');
    if (status === 'authenticated') loadAll();
  }, [status]);

  const loadAll = async () => {
    try {
      const [repoData, analysisData, prData] = await Promise.all([
        api.getRepository(repoId),
        api.getAnalysisHistory(repoId),
        api.getPullRequests(repoId),
      ]);
      setRepo(repoData);
      setAnalyses(analysisData);
      setPRs(prData);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReindex = async () => {
    if (!repo) return;
    setIndexing(true);
    try {
      await api.indexRepository({ repositoryId: repo.id, owner: repo.owner, repo: repo.name });
      toast.success('Reindexing started');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIndexing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="ml-60 flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-white/20" />
        </main>
      </div>
    );
  }

  if (!repo) return null;

  const LANG_COLORS: Record<string, string> = {
    TypeScript: '#3178c6', JavaScript: '#f7df1e', Python: '#3572a5',
    Go: '#00add8', Rust: '#dea584',
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-60 flex-1 p-8">
        {/* Back */}
        <Link href="/repos" className="inline-flex items-center gap-1.5 text-white/30 hover:text-white/60 text-sm mb-6 transition-colors">
          <ArrowLeft size={14} />
          All Repositories
        </Link>

        {/* Repo Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-display text-2xl font-bold text-white font-mono">{repo.fullName}</h1>
              {repo.language && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-surface-2 rounded-md border border-border">
                  <div className="w-2 h-2 rounded-full" style={{ background: LANG_COLORS[repo.language] || '#888' }} />
                  <span className="text-xs text-white/50">{repo.language}</span>
                </div>
              )}
              <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
                repo.isIndexed
                  ? 'text-accent-green bg-accent-green/10 border-accent-green/20'
                  : 'text-white/30 bg-surface-2 border-border'
              }`}>
                {repo.isIndexed ? 'Indexed' : 'Not indexed'}
              </span>
            </div>
            {repo.description && <p className="text-sm text-white/40">{repo.description}</p>}
            <div className="flex items-center gap-4 mt-2">
              {repo.isIndexed && (
                <>
                  <span className="text-xs font-mono text-white/25">{repo.fileCount} files</span>
                  <span className="text-xs font-mono text-white/25">{repo.chunkCount} chunks</span>
                </>
              )}
              <span className="text-xs font-mono text-white/25">branch: {repo.defaultBranch}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReindex}
              disabled={indexing}
              className="flex items-center gap-2 px-3 py-2 bg-surface-2 border border-border rounded-lg text-xs text-white/50 hover:text-white transition-all"
            >
              <Zap size={12} className={indexing ? 'animate-spin' : ''} />
              {indexing ? 'Indexing...' : 'Re-index'}
            </button>
            <Link
              href={`/debug?repo=${repo.id}`}
              className="flex items-center gap-2 px-3 py-2 bg-accent-green/10 border border-accent-green/30 text-accent-green rounded-lg text-xs hover:bg-accent-green/20 transition-all"
            >
              <Bug size={12} />
              Analyze Error
            </Link>
            <a
              href={`https://github.com/${repo.fullName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-white/20 hover:text-white/60 bg-surface-2 border border-border rounded-lg transition-colors"
            >
              <ExternalLink size={14} />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Stats */}
          <div className="col-span-3 grid grid-cols-3 gap-4">
            {[
              { label: 'Analyses Run', value: analyses.length, icon: Bug, color: 'text-accent-purple' },
              { label: 'Pull Requests', value: prs.length, icon: GitPullRequest, color: 'text-accent-blue' },
              { label: 'Open PRs', value: prs.filter(p => p.status === 'open').length, icon: GitBranch, color: 'text-accent-green' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-surface-1 border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={12} className={color} />
                  <p className="text-xs font-mono text-white/30">{label}</p>
                </div>
                <p className={`text-3xl font-display font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Analysis History */}
          <div className="col-span-2 bg-surface-1 border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <Bug size={14} className="text-accent-purple" />
              <h2 className="font-display font-semibold text-white text-sm">Analysis History</h2>
            </div>
            {analyses.length === 0 ? (
              <div className="p-10 text-center">
                <Bug size={28} className="text-white/10 mx-auto mb-2" />
                <p className="text-white/30 text-sm">No analyses yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {analyses.map(a => (
                  <div key={a.id} className="px-5 py-4 hover:bg-surface-2 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white/70 truncate">{a.rootCause}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs font-mono text-white/25">
                            {new Date(a.createdAt).toLocaleString()}
                          </span>
                          <span className="text-xs font-mono text-white/25">{a.model}</span>
                          <span className="flex items-center gap-1 text-xs font-mono text-white/25">
                            <FileCode size={9} />
                            {a.affectedFiles?.length || 0} files
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-mono text-accent-green">
                          {Math.round((a.confidence || 0) * 100)}%
                        </span>
                        <Link
                          href={`/debug?analysis=${a.id}`}
                          className="p-1 text-white/20 hover:text-white/60 transition-colors"
                        >
                          <ExternalLink size={12} />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PR History */}
          <div className="col-span-1 bg-surface-1 border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <GitPullRequest size={14} className="text-accent-blue" />
              <h2 className="font-display font-semibold text-white text-sm">Pull Requests</h2>
            </div>
            {prs.length === 0 ? (
              <div className="p-10 text-center">
                <GitPullRequest size={28} className="text-white/10 mx-auto mb-2" />
                <p className="text-white/30 text-xs">No PRs yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {prs.map(pr => (
                  <a
                    key={pr.id}
                    href={pr.githubPrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2 transition-colors group"
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      pr.status === 'open' ? 'bg-accent-green' :
                      pr.status === 'merged' ? 'bg-accent-purple' : 'bg-white/20'
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white/60 group-hover:text-white/80 truncate transition-colors">{pr.title}</p>
                      <p className="text-xs font-mono text-white/20 mt-0.5">#{pr.githubPrNumber}</p>
                    </div>
                    <ExternalLink size={10} className="text-white/20 group-hover:text-white/40 mt-1 transition-colors flex-shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
