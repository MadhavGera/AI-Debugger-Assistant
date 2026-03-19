'use client';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Repository, PullRequest } from '@/types';
import {
  GitPullRequest, ExternalLink, GitMerge,
  Circle, CheckCircle2, XCircle, Loader2, GitBranch
} from 'lucide-react';
import { clsx } from 'clsx';

const STATUS_CONFIG = {
  open: { label: 'Open', icon: Circle, color: 'text-accent-green', bg: 'bg-accent-green/10 border-accent-green/20' },
  merged: { label: 'Merged', icon: GitMerge, color: 'text-accent-purple', bg: 'bg-accent-purple/10 border-accent-purple/20' },
  closed: { label: 'Closed', icon: XCircle, color: 'text-white/30', bg: 'bg-surface-3 border-border' },
};

export default function PullsPage() {
  const { status } = useSession();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [allPRs, setAllPRs] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'merged' | 'closed'>('all');

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/');
    if (status === 'authenticated') loadData();
  }, [status]);

  const loadData = async () => {
    try {
      const repoList = await api.getRepositories();
      setRepos(repoList);
      const prArrays = await Promise.all(
        repoList.map(r => api.getPullRequests(r._id || r.id).catch(() => []))
      );
      setAllPRs(prArrays.flat().sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getRepoName = (repoId: string) =>
    repos.find(r => r.id === repoId)?.fullName || repoId;

  const filtered = filter === 'all' ? allPRs : allPRs.filter(pr => pr.status === filter);

  const stats = {
    total: allPRs.length,
    open: allPRs.filter(p => p.status === 'open').length,
    merged: allPRs.filter(p => p.status === 'merged').length,
    closed: allPRs.filter(p => p.status === 'closed').length,
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-60 flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <p className="font-mono text-accent-green text-sm mb-1">// generated pull requests</p>
          <h1 className="font-display text-3xl font-bold text-white">Pull Requests</h1>
          <p className="text-white/40 text-sm mt-1">AI-generated fixes submitted as GitHub PRs</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total PRs', value: stats.total, color: 'text-white' },
            { label: 'Open', value: stats.open, color: 'text-accent-green' },
            { label: 'Merged', value: stats.merged, color: 'text-accent-purple' },
            { label: 'Closed', value: stats.closed, color: 'text-white/30' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-surface-1 border border-border rounded-xl p-4">
              <p className="text-xs font-mono text-white/30 mb-1">{label}</p>
              <p className={`text-2xl font-display font-bold ${color}`}>{loading ? '—' : value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-6">
          {(['all', 'open', 'merged', 'closed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-4 py-1.5 rounded-lg text-sm font-mono transition-all capitalize',
                filter === f
                  ? 'bg-surface-3 border border-border-active text-white'
                  : 'text-white/30 hover:text-white/60'
              )}
            >
              {f} {f !== 'all' && `(${stats[f as keyof typeof stats]})`}
            </button>
          ))}
        </div>

        {/* PR List */}
        <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 size={24} className="animate-spin text-white/20 mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <GitPullRequest size={40} className="text-white/10 mx-auto mb-3" />
              <p className="text-white/30 text-sm">No pull requests yet</p>
              <p className="text-white/15 text-xs font-mono mt-1">
                Analyze an error on the Debug page to generate your first PR
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(pr => {
                const cfg = STATUS_CONFIG[pr.status];
                const Icon = cfg.icon;
                return (
                  <div key={pr.id} className="flex items-start gap-4 px-5 py-4 hover:bg-surface-2 transition-colors">
                    {/* Status icon */}
                    <div className={`mt-0.5 p-1.5 rounded-md border ${cfg.bg}`}>
                      <Icon size={12} className={cfg.color} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white/80 truncate">{pr.title}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="flex items-center gap-1 text-xs font-mono text-white/30">
                              <GitBranch size={10} />
                              {getRepoName((pr as any).repositoryId)}
                            </span>
                            <span className="text-xs font-mono text-white/20">
                              {pr.branch} → {pr.baseBranch}
                            </span>
                            <span className="text-xs text-white/20">
                              {new Date(pr.createdAt).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric'
                              })}
                            </span>
                          </div>
                        </div>

                        {/* PR number + link */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs font-mono px-2 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
                            #{pr.githubPrNumber}
                          </span>
                          <a
                            href={pr.githubPrUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-white/20 hover:text-white/60 transition-colors"
                          >
                            <ExternalLink size={13} />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
