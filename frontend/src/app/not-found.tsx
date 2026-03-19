import Link from 'next/link';
import { Home, Bug } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center">
      <div className="text-center px-4">
        <p className="font-mono text-accent-green text-sm mb-2">// 404</p>
        <h1 className="font-display text-6xl font-extrabold text-white mb-3">
          Not Found
        </h1>
        <p className="text-white/40 text-sm mb-8 max-w-sm mx-auto">
          The page you're looking for doesn't exist or you don't have access to it.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-5 py-2.5 bg-accent-green text-surface-0 rounded-xl text-sm font-semibold hover:bg-accent-green/90 transition-all"
          >
            <Home size={14} />
            Go to Dashboard
          </Link>
          <Link
            href="/debug"
            className="flex items-center gap-2 px-5 py-2.5 bg-surface-2 border border-border text-white/60 rounded-xl text-sm hover:text-white transition-all"
          >
            <Bug size={14} />
            Debug Page
          </Link>
        </div>
        <div className="mt-16 font-mono text-xs text-white/10">
          <div>{'>'} cd /dashboard</div>
          <div>{'>'} <span className="text-accent-green animate-pulse">█</span></div>
        </div>
      </div>
    </div>
  );
}
