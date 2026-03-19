'use client';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Zap, GitBranch, Bug, GitPullRequest,
  ArrowRight, Github, Shield, Cpu, Code2
} from 'lucide-react';

const FEATURES = [
  {
    icon: GitBranch,
    title: 'Repository Indexing',
    desc: 'Clones your repo, chunks all code files, and stores vector embeddings in ChromaDB for semantic search.',
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10 border-accent-blue/20',
  },
  {
    icon: Bug,
    title: 'AI Error Analysis',
    desc: 'Paste any stack trace or error. GPT-4.1 retrieves relevant code via RAG and identifies the exact root cause.',
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10 border-accent-purple/20',
  },
  {
    icon: Code2,
    title: 'Patch Generation',
    desc: 'The AI produces a precise unified diff patch — minimal changes, correct syntax, tested logic.',
    color: 'text-accent-yellow',
    bg: 'bg-accent-yellow/10 border-accent-yellow/20',
  },
  {
    icon: GitPullRequest,
    title: 'Auto Pull Request',
    desc: 'One click creates a branch, commits the fix, and opens a GitHub PR — ready for your review.',
    color: 'text-accent-green',
    bg: 'bg-accent-green/10 border-accent-green/20',
  },
];

const PIPELINE_STEPS = [
  { id: '01', label: 'Clone Repo', sublabel: 'shallow git clone' },
  { id: '02', label: 'Chunk Code', sublabel: 'language-aware splitting' },
  { id: '03', label: 'Embed', sublabel: 'text-embedding-3-small' },
  { id: '04', label: 'Vector Search', sublabel: 'cosine similarity' },
  { id: '05', label: 'GPT-4.1', sublabel: 'root cause + fix' },
  { id: '06', label: 'Open PR', sublabel: 'GitHub API' },
];

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') router.replace('/dashboard');
  }, [status, router]);

  const handleSignIn = async () => {
    setSigning(true);
    await signIn('github', { callbackUrl: '/dashboard' });
  };

  return (
    <div className="min-h-screen bg-surface-0 noise overflow-x-hidden">
      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Gradient orbs */}
      <div className="fixed top-[-200px] left-[-200px] w-[600px] h-[600px] bg-accent-green/5 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-200px] right-[-200px] w-[600px] h-[600px] bg-accent-blue/5 rounded-full blur-[120px] pointer-events-none z-0" />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="flex items-center justify-between px-8 py-5 border-b border-border backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-green/10 border border-accent-green/30 flex items-center justify-center">
              <Zap size={15} className="text-accent-green" />
            </div>
            <span className="font-display font-bold text-white">AI Debugger</span>
            <span className="px-2 py-0.5 text-xs font-mono bg-accent-green/10 text-accent-green border border-accent-green/20 rounded-full">v1.0</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm text-white/40 hover:text-white transition-colors">Features</a>
            <a href="#pipeline" className="text-sm text-white/40 hover:text-white transition-colors">How it works</a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors"
            >
              <Github size={14} />
              GitHub
            </a>
          </div>
        </nav>

        {/* Hero */}
        <section className="max-w-5xl mx-auto px-8 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-2 border border-border rounded-full text-xs font-mono text-white/40 mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
            Powered by GPT-4.1 + ChromaDB RAG
          </div>

          <h1 className="font-display text-6xl font-extrabold text-white leading-[1.05] mb-6">
            Debug faster with
            <br />
            <span className="gradient-text text-glow-green">AI-generated fixes</span>
          </h1>

          <p className="text-lg text-white/40 max-w-2xl mx-auto leading-relaxed mb-10">
            Paste a stack trace. The AI finds the root cause in your codebase,
            generates a precise patch, and opens a pull request — in under 60 seconds.
          </p>

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleSignIn}
              disabled={signing || status === 'loading'}
              className="flex items-center gap-2.5 px-6 py-3 bg-white text-surface-0 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all shadow-lg shadow-white/10 disabled:opacity-50"
            >
              <Github size={18} />
              {signing ? 'Redirecting...' : 'Continue with GitHub'}
              <ArrowRight size={14} />
            </button>
            <a
              href="#pipeline"
              className="flex items-center gap-2 px-6 py-3 bg-surface-2 border border-border text-white/60 rounded-xl text-sm hover:text-white hover:border-border-active transition-all"
            >
              See how it works
            </a>
          </div>

          <p className="mt-4 text-xs text-white/20 font-mono">
            Free to use · Requires GitHub OAuth · Your code stays private
          </p>
        </section>

        {/* Pipeline viz */}
        <section id="pipeline" className="max-w-5xl mx-auto px-8 pb-20">
          <div className="bg-surface-1 border border-border rounded-2xl p-8 overflow-hidden">
            <p className="font-mono text-xs text-accent-green mb-2">// rag pipeline</p>
            <h2 className="font-display text-2xl font-bold text-white mb-8">
              From error to pull request in 6 steps
            </h2>

            <div className="flex items-center gap-0 overflow-x-auto pb-2">
              {PIPELINE_STEPS.map((step, i) => (
                <div key={step.id} className="flex items-center flex-shrink-0">
                  <div className="flex flex-col items-center gap-2 px-4">
                    <div className="w-10 h-10 rounded-lg bg-surface-2 border border-border flex items-center justify-center">
                      <span className="font-mono text-xs text-accent-green font-bold">{step.id}</span>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-white/70 whitespace-nowrap">{step.label}</p>
                      <p className="text-xs text-white/25 font-mono whitespace-nowrap">{step.sublabel}</p>
                    </div>
                  </div>
                  {i < PIPELINE_STEPS.length - 1 && (
                    <div className="flex items-center">
                      <div className="w-8 h-px bg-gradient-to-r from-border to-accent-green/30" />
                      <div className="w-1 h-1 rounded-full bg-accent-green/40" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="max-w-5xl mx-auto px-8 pb-20">
          <p className="font-mono text-xs text-accent-green mb-2">// capabilities</p>
          <h2 className="font-display text-3xl font-bold text-white mb-10">Everything you need to ship fixes faster</h2>

          <div className="grid grid-cols-2 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc, color, bg }) => (
              <div key={title} className="bg-surface-1 border border-border rounded-xl p-6 hover:border-border-active transition-colors group">
                <div className={`w-10 h-10 rounded-lg border flex items-center justify-center mb-4 ${bg}`}>
                  <Icon size={18} className={color} />
                </div>
                <h3 className="font-display font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Security */}
        <section className="max-w-5xl mx-auto px-8 pb-20">
          <div className="bg-surface-1 border border-border rounded-2xl p-8 flex items-start gap-8">
            <div className="w-12 h-12 rounded-xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center flex-shrink-0">
              <Shield size={22} className="text-accent-green" />
            </div>
            <div>
              <h3 className="font-display font-bold text-white text-xl mb-2">Security first</h3>
              <p className="text-white/40 text-sm leading-relaxed max-w-2xl">
                Your GitHub access token is AES-256 encrypted before being stored.
                The AI only reads your code — it never pushes to main directly.
                All PRs require your explicit approval. Tokens are never logged or exposed in API responses.
              </p>
              <div className="flex items-center gap-6 mt-4">
                {['AES-256 token encryption', 'PR-only workflow', 'No main branch writes', 'GitHub OAuth scoped'].map(item => (
                  <span key={item} className="flex items-center gap-1.5 text-xs font-mono text-white/30">
                    <div className="w-1 h-1 rounded-full bg-accent-green" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-5xl mx-auto px-8 pb-24 text-center">
          <div className="bg-surface-1 border border-border rounded-2xl p-12">
            <Cpu size={32} className="text-accent-green mx-auto mb-4" />
            <h2 className="font-display text-3xl font-bold text-white mb-3">
              Ready to debug smarter?
            </h2>
            <p className="text-white/40 mb-8 text-sm">
              Connect your GitHub account and start fixing bugs in minutes.
            </p>
            <button
              onClick={handleSignIn}
              disabled={signing}
              className="inline-flex items-center gap-2.5 px-8 py-3.5 bg-accent-green text-surface-0 rounded-xl font-bold text-sm hover:bg-accent-green/90 transition-all glow-green"
            >
              <Github size={18} />
              Get started with GitHub
              <ArrowRight size={14} />
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border px-8 py-6">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-accent-green" />
              <span className="text-xs text-white/30 font-mono">AI GitHub Debugger</span>
            </div>
            <p className="text-xs text-white/20 font-mono">
              Built with Next.js · FastAPI · LangChain · ChromaDB
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
