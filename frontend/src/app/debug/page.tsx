'use client';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Repository, AnalysisResult, AnalysisStep } from '@/types';
import {
  Bug, Zap, GitBranch, ChevronDown, Loader2,
  AlertCircle, CheckCircle, FileCode, GitPullRequest, Copy, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PatchViewer } from '@/components/debug/PatchViewer';
import { AnalysisReport } from '@/components/debug/AnalysisReport';
import { clsx } from 'clsx';

const ANALYSIS_STEPS: AnalysisStep[] = [
  { id: 'embed', label: 'Embedding error context', status: 'pending' },
  { id: 'search', label: 'Searching vector database', status: 'pending' },
  { id: 'retrieve', label: 'Retrieving relevant code', status: 'pending' },
  { id: 'analyze', label: 'Analyzing root cause', status: 'pending' },
  { id: 'generate', label: 'Generating fix patch', status: 'pending' },
];

export default function DebugPage() {
  const { status } = useSession();
  const [repos, setRepos] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [errorInput, setErrorInput] = useState('');
  const [errorType, setErrorType] = useState<'message' | 'stacktrace' | 'github_issue'>('stacktrace');
  const [analyzing, setAnalyzing] = useState(false);
  const [steps, setSteps] = useState<AnalysisStep[]>(ANALYSIS_STEPS);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [creatingPR, setCreatingPR] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/');
    if (status === 'authenticated') {
      api.getRepositories().then(r => setRepos(r.filter(repo => repo.isIndexed)));
    }
  }, [status]);

  const simulateSteps = async () => {
    const delays = [800, 1200, 1500, 3000, 2000];
    for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
      setSteps(prev => prev.map((s, idx) => ({
        ...s,
        status: idx < i ? 'complete' : idx === i ? 'active' : 'pending'
      })));
      await new Promise(r => setTimeout(r, delays[i]));
    }
  };

  const handleAnalyze = async () => {
    if (!selectedRepo) return toast.error('Select a repository first');
    if (!errorInput.trim()) return toast.error('Enter an error message');

    setAnalyzing(true);
    setResult(null);
    setSteps(ANALYSIS_STEPS.map(s => ({ ...s, status: 'pending' })));

    try {
      // Run steps animation + API in parallel
      const [_, analysisResult] = await Promise.all([
        simulateSteps(),
        api.analyzeError({
          repositoryId: selectedRepo.id,
          errorInput,
          errorType,
        })
      ]);

      setSteps(ANALYSIS_STEPS.map(s => ({ ...s, status: 'complete' })));
      setResult(analysisResult);
      toast.success('Analysis complete!');
    } catch (err: any) {
      setSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error' } : s));
      toast.error(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreatePR = async () => {
    if (!result || !selectedRepo) return;
    setCreatingPR(true);
    try {
      const { pullRequest } = await api.createPullRequest({
        analysisId: result.id,
        repositoryId: selectedRepo.id,
        title: `fix: ${result.rootCause.slice(0, 60)}`,
        body: `## AI-Generated Fix\n\n${result.explanation}\n\n### Root Cause\n${result.rootCause}`,
      });
      toast.success('Pull request created!');
      window.open(pullRequest.githubPrUrl, '_blank');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingPR(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-60 flex-1 p-8">
        <div className="mb-8">
          <p className="font-mono text-accent-green text-sm mb-1">// ai debugging engine</p>
          <h1 className="font-display text-3xl font-bold text-white">
            Debug <span className="gradient-text">Assistant</span>
          </h1>
          <p className="text-white/40 text-sm mt-1">Paste an error, AI finds the bug and opens a PR</p>
        </div>

        <div className="grid grid-cols-5 gap-6">
          {/* Input Panel */}
          <div className="col-span-2 space-y-4">
            {/* Repo Select */}
            <div className="bg-surface-1 border border-border rounded-xl p-5">
              <label className="block text-xs font-mono text-white/40 mb-3 uppercase tracking-wider">
                Target Repository
              </label>
              <div className="relative">
                <select
                  value={selectedRepo?.id || ''}
                  onChange={e => setSelectedRepo(repos.find(r => r.id === e.target.value) || null)}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-white appearance-none focus:outline-none focus:border-border-active font-mono"
                >
                  <option value="">Select a repository...</option>
                  {repos.map(r => (
                    <option key={r.id} value={r.id}>{r.fullName}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              </div>
              {repos.length === 0 && (
                <p className="text-xs text-accent-yellow mt-2 flex items-center gap-1">
                  <AlertCircle size={10} />
                  No indexed repos. <a href="/repos" className="underline">Index one first</a>
                </p>
              )}
            </div>

            {/* Error Type */}
            <div className="bg-surface-1 border border-border rounded-xl p-5">
              <label className="block text-xs font-mono text-white/40 mb-3 uppercase tracking-wider">
                Input Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['message', 'stacktrace', 'github_issue'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setErrorType(type)}
                    className={clsx(
                      'py-2 px-2 rounded-lg text-xs font-mono transition-all',
                      errorType === type
                        ? 'bg-accent-green/10 border border-accent-green/30 text-accent-green'
                        : 'bg-surface-2 border border-border text-white/40 hover:text-white/60'
                    )}
                  >
                    {type === 'message' ? 'Error' : type === 'stacktrace' ? 'Stack Trace' : 'GH Issue'}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Input */}
            <div className="bg-surface-1 border border-border rounded-xl p-5">
              <label className="block text-xs font-mono text-white/40 mb-3 uppercase tracking-wider">
                {errorType === 'github_issue' ? 'Issue URL' : 'Error Input'}
              </label>
              <textarea
                value={errorInput}
                onChange={e => setErrorInput(e.target.value)}
                placeholder={
                  errorType === 'github_issue'
                    ? 'https://github.com/owner/repo/issues/123'
                    : errorType === 'stacktrace'
                    ? 'TypeError: Cannot read property \'map\' of undefined\n  at UserList (UserList.jsx:12)\n  at renderWithHooks...'
                    : 'Describe the error or paste the error message...'
                }
                rows={10}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-border-active font-mono resize-none transition-colors"
              />
            </div>

            {/* Analyze Button */}
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !selectedRepo || !errorInput.trim()}
              className={clsx(
                'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all',
                analyzing || !selectedRepo || !errorInput.trim()
                  ? 'bg-surface-2 text-white/20 cursor-not-allowed'
                  : 'bg-accent-green text-surface-0 hover:bg-accent-green/90 glow-green'
              )}
            >
              {analyzing ? (
                <><Loader2 size={16} className="animate-spin" /> Analyzing...</>
              ) : (
                <><Zap size={16} /> Analyze & Generate Fix</>
              )}
            </button>
          </div>

          {/* Analysis Panel */}
          <div className="col-span-3 space-y-4">
            {/* Steps Tracker */}
            {(analyzing || result) && (
              <div className="bg-surface-1 border border-border rounded-xl p-5">
                <h3 className="text-xs font-mono text-white/40 uppercase tracking-wider mb-4">Analysis Pipeline</h3>
                <div className="space-y-3">
                  {steps.map((step, i) => (
                    <div key={step.id} className="flex items-center gap-3 relative">
                      {i < steps.length - 1 && <div className="step-connector" />}
                      <div className={clsx('w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 z-10', {
                        'border-accent-green bg-accent-green/10': step.status === 'complete',
                        'border-accent-blue bg-accent-blue/10': step.status === 'active',
                        'border-accent-red bg-accent-red/10': step.status === 'error',
                        'border-white/10 bg-surface-2': step.status === 'pending',
                      })}>
                        {step.status === 'complete' && <CheckCircle size={10} className="text-accent-green" />}
                        {step.status === 'active' && <Loader2 size={10} className="text-accent-blue animate-spin" />}
                        {step.status === 'error' && <AlertCircle size={10} className="text-accent-red" />}
                        {step.status === 'pending' && <div className="w-1.5 h-1.5 rounded-full bg-white/20" />}
                      </div>
                      <span className={clsx('text-sm font-mono', {
                        'text-accent-green': step.status === 'complete',
                        'text-white': step.status === 'active',
                        'text-accent-red': step.status === 'error',
                        'text-white/30': step.status === 'pending',
                      })}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Result */}
            {result && (
              <>
                <AnalysisReport result={result} />
                <PatchViewer patch={result.patch} patchHunks={result.patchPreview} />

                {/* PR Button */}
                <button
                  onClick={handleCreatePR}
                  disabled={creatingPR}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-accent-blue/10 border border-accent-blue/30 text-accent-blue rounded-xl text-sm font-semibold hover:bg-accent-blue/20 transition-all"
                >
                  {creatingPR ? (
                    <><Loader2 size={16} className="animate-spin" /> Creating PR...</>
                  ) : (
                    <><GitPullRequest size={16} /> Open Pull Request on GitHub</>
                  )}
                </button>
              </>
            )}

            {/* Empty State */}
            {!analyzing && !result && (
              <div className="bg-surface-1 border border-border rounded-xl p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-accent-green/5 border border-accent-green/10 flex items-center justify-center mx-auto mb-4">
                  <Bug size={28} className="text-accent-green/30" />
                </div>
                <p className="text-white/30 font-mono text-sm">Paste an error message to begin analysis</p>
                <p className="text-white/15 font-mono text-xs mt-2">AI will find the bug and generate a patch</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
