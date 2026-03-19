'use client';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Repository, AnalysisResult } from '@/types';
import {
  GitBranch, Bug, GitPullRequest, Zap,
  TrendingUp, Clock, CheckCircle, AlertCircle
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [recentAnalyses, setRecentAnalyses] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/');
    if (status === 'authenticated') {
      Promise.all([api.getRepositories()]).then(([r]) => {
        setRepos(r);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [status]);

  const stats = [
    { label: 'Repositories', value: repos.length, icon: GitBranch, color: 'text-accent-blue', bg: 'bg-accent-blue/10 border-accent-blue/20' },
    { label: 'Indexed Repos', value: repos.filter(r => r.isIndexed).length, icon: Zap, color: 'text-accent-green', bg: 'bg-accent-green/10 border-accent-green/20' },
    { label: 'Analyses Run', value: recentAnalyses.length, icon: Bug, color: 'text-accent-purple', bg: 'bg-accent-purple/10 border-accent-purple/20' },
    { label: 'PRs Created', value: 0, icon: GitPullRequest, color: 'text-accent-yellow', bg: 'bg-accent-yellow/10 border-accent-yellow/20' },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-60 flex-1 p-8">
        {/* Header */}
        <div className="mb-8">
          <p className="font-mono text-accent-green text-sm mb-1">// welcome back</p>
          <h1 className="font-display text-3xl font-bold text-white">
            {session?.user?.name?.split(' ')[0] || 'Developer'}{' '}
            <span className="gradient-text">Dashboard</span>
          </h1>
          <p className="text-white/40 mt-2 text-sm">
            AI-powered debugging assistant · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {stats.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`bg-surface-1 border rounded-xl p-5 border-border`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white/40 text-xs font-mono mb-1">{label}</p>
                  <p className={`text-3xl font-display font-bold ${color}`}>
                    {loading ? '—' : value}
                  </p>
                </div>
                <div className={`p-2 rounded-lg border ${bg}`}>
                  <Icon size={16} className={color} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="col-span-1 bg-surface-1 border border-border rounded-xl p-5">
            <h2 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
              <Zap size={14} className="text-accent-green" />
              Quick Actions
            </h2>
            <div className="space-y-2">
              <Link href="/repos" className="flex items-center gap-3 p-3 rounded-lg bg-surface-2 hover:bg-surface-3 transition-colors group">
                <GitBranch size={14} className="text-accent-blue" />
                <span className="text-sm text-white/70 group-hover:text-white">Connect Repository</span>
              </Link>
              <Link href="/debug" className="flex items-center gap-3 p-3 rounded-lg bg-surface-2 hover:bg-surface-3 transition-colors group">
                <Bug size={14} className="text-accent-purple" />
                <span className="text-sm text-white/70 group-hover:text-white">Analyze an Error</span>
              </Link>
              <Link href="/pulls" className="flex items-center gap-3 p-3 rounded-lg bg-surface-2 hover:bg-surface-3 transition-colors group">
                <GitPullRequest size={14} className="text-accent-green" />
                <span className="text-sm text-white/70 group-hover:text-white">View Pull Requests</span>
              </Link>
            </div>
          </div>

          {/* Recent Repositories */}
          <div className="col-span-2 bg-surface-1 border border-border rounded-xl p-5">
            <h2 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
              <GitBranch size={14} className="text-accent-blue" />
              Recent Repositories
            </h2>
            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-surface-2 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : repos.length === 0 ? (
              <div className="text-center py-8">
                <GitBranch size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No repositories yet</p>
                <Link href="/repos" className="mt-3 inline-flex items-center gap-1 text-accent-green text-sm hover:underline">
                  Connect your first repo →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {repos.slice(0, 5).map((repo) => (
                  <Link
                    key={repo.id}
                    href={`/repos/${repo._id}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-surface-2 hover:bg-surface-3 transition-colors group"
                  >
                    <div className={`w-2 h-2 rounded-full ${repo.isIndexed ? 'bg-accent-green' : 'bg-white/20'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/80 font-mono truncate">{repo.fullName}</p>
                      <p className="text-xs text-white/30">{repo.language || 'Unknown'}</p>
                    </div>
                    {repo.isIndexed ? (
                      <CheckCircle size={12} className="text-accent-green" />
                    ) : (
                      <AlertCircle size={12} className="text-white/20" />
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
