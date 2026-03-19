'use client';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Repository, IndexingStatus } from '@/types';
import {
  GitBranch, RefreshCw, Zap, Lock, Globe,
  CheckCircle, Loader2, AlertCircle, ExternalLink, Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

// Helper: get the correct ID from a repo object regardless of backend transform
const getRepoId = (repo: Repository): string =>
  (repo._id || repo.id || '') as string;

export default function ReposPage() {
  const { status } = useSession();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [indexingJobs, setIndexingJobs] = useState<Record<string, IndexingStatus>>({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/');
    if (status === 'authenticated') loadRepos();
  }, [status]);

  const loadRepos = async () => {
    try {
      const data = await api.getRepositories();
      setRepos(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const data = await api.syncRepositories();
      setRepos(data);
      toast.success(`Synced ${data.length} repositories`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleIndex = async (repo: Repository) => {
    const jobKey = getRepoId(repo);
    setIndexingJobs(prev => ({
      ...prev,
      [jobKey]: { status: 'cloning', progress: 0, message: 'Starting indexing...' }
    }));

    try {
      const { jobId } = await api.indexRepository({
        repositoryId: jobKey,
        owner: repo.owner,
        repo: repo.name,
      });

      // Poll for status
      const poll = setInterval(async () => {
        try {
          const jobStatus = await api.getIndexingStatus(jobId);
          setIndexingJobs(prev => ({ ...prev, [jobKey]: jobStatus }));
          if (jobStatus.status === 'complete' || jobStatus.status === 'error') {
            clearInterval(poll);
            if (jobStatus.status === 'complete') {
              toast.success(`${repo.name} indexed successfully!`);
              setRepos(prev => prev.map(r =>
                getRepoId(r) === jobKey ? { ...r, isIndexed: true } : r
              ));
            } else {
              toast.error(`Indexing failed: ${jobStatus.message}`);
            }
          }
        } catch { clearInterval(poll); }
      }, 2000);
    } catch (err: any) {
      toast.error(err.message);
      setIndexingJobs(prev => {
        const n = { ...prev };
        delete n[jobKey];
        return n;
      });
    }
  };

  const filtered = repos.filter(r =>
    r.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.language?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusBadge = (repo: Repository) => {
    const job = indexingJobs[getRepoId(repo)];
    if (job) {
      const steps: Record<string, string> = {
        cloning: 'Cloning...', scanning: 'Scanning files...', chunking: 'Chunking code...',
        embedding: 'Generating embeddings...', storing: 'Storing vectors...'
      };
      return (
        <div className="flex items-center gap-2">
          <Loader2 size={12} className="animate-spin text-accent-blue" />
          <span className="text-xs text-accent-blue font-mono">{steps[job.status] || job.message}</span>
          <div className="w-16 h-1 bg-surface-3 rounded-full overflow-hidden">
            <div className="h-full bg-accent-blue rounded-full transition-all duration-500" style={{ width: `${job.progress}%` }} />
          </div>
        </div>
      );
    }
    if (repo.isIndexed) return (
      <span className="flex items-center gap-1 text-xs text-accent-green font-mono">
        <CheckCircle size={10} /> Indexed
      </span>
    );
    return <span className="text-xs text-white/30 font-mono">Not indexed</span>;
  };

  const LANG_COLORS: Record<string, string> = {
    TypeScript: '#3178c6', JavaScript: '#f7df1e', Python: '#3572a5',
    Go: '#00add8', Rust: '#dea584', Java: '#b07219',
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-60 flex-1 p-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="font-mono text-accent-green text-sm mb-1">// repository management</p>
            <h1 className="font-display text-3xl font-bold text-white">Repositories</h1>
            <p className="text-white/40 text-sm mt-1">{repos.length} connected · {repos.filter(r => r.isIndexed).length} indexed</p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 border border-border rounded-lg text-sm text-white/70 hover:text-white transition-all"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync from GitHub'}
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-surface-1 border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-border-active transition-colors font-mono"
          />
        </div>

        {/* Repos Table */}
        <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_150px_120px_100px] gap-4 px-5 py-3 border-b border-border text-xs font-mono text-white/30 uppercase tracking-wider">
            <span>Repository</span>
            <span>Language</span>
            <span>Status</span>
            <span>Visibility</span>
            <span>Actions</span>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <Loader2 size={24} className="animate-spin text-white/20 mx-auto" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <GitBranch size={40} className="text-white/10 mx-auto mb-3" />
              <p className="text-white/30">No repositories found</p>
              <button onClick={handleSync} className="mt-3 text-accent-green text-sm hover:underline">
                Sync from GitHub
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(repo => {
                const repoId = getRepoId(repo);
                return (
                  <div key={repoId} className="grid grid-cols-[1fr_100px_150px_120px_100px] gap-4 px-5 py-4 items-center hover:bg-surface-2 transition-colors">
                    {/* Name */}
                    <div className="min-w-0">
                      <Link
                        href={`/repos/${repoId}`}
                        className="font-mono text-sm font-medium text-white/80 hover:text-white hover:underline truncate block"
                      >
                        {repo.fullName}
                      </Link>
                      {repo.description && (
                        <p className="text-xs text-white/30 truncate mt-0.5">{repo.description}</p>
                      )}
                    </div>

                    {/* Language */}
                    <div className="flex items-center gap-1.5">
                      {repo.language && (
                        <>
                          <div className="w-2 h-2 rounded-full" style={{ background: LANG_COLORS[repo.language] || '#888' }} />
                          <span className="text-xs text-white/50">{repo.language}</span>
                        </>
                      )}
                    </div>

                    {/* Status */}
                    <div>{statusBadge(repo)}</div>

                    {/* Visibility */}
                    <div className="flex items-center gap-1 text-xs text-white/30">
                      {repo.isPrivate ? <Lock size={10} /> : <Globe size={10} />}
                      {repo.isPrivate ? 'Private' : 'Public'}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {!repo.isIndexed && !indexingJobs[repoId] && (
                        <button
                          onClick={() => handleIndex(repo)}
                          className="flex items-center gap-1 px-2 py-1 bg-accent-green/10 border border-accent-green/30 text-accent-green text-xs rounded hover:bg-accent-green/20 transition-colors font-mono"
                        >
                          <Zap size={10} />
                          Index
                        </button>
                      )}
                      <a
                        href={`https://github.com/${repo.fullName}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-white/20 hover:text-white/60 transition-colors"
                      >
                        <ExternalLink size={12} />
                      </a>
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