'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  LayoutDashboard, GitBranch, Bug, GitPullRequest,
  Settings, LogOut, Zap, ChevronRight
} from 'lucide-react';
import Image from 'next/image';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/repos', icon: GitBranch, label: 'Repositories' },
  { href: '/debug', icon: Bug, label: 'Debugger' },
  { href: '/pulls', icon: GitPullRequest, label: 'Pull Requests' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-surface-1 border-r border-border flex flex-col z-50">
      {/* Logo */}
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-green/10 border border-accent-green/30 flex items-center justify-center glow-green">
            <Zap size={16} className="text-accent-green" />
          </div>
          <div>
            <p className="font-display font-bold text-sm text-white leading-none">AI Debugger</p>
            <p className="text-xs text-white/30 mt-0.5 font-mono">v1.0.0</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                active
                  ? 'bg-accent-green/10 text-accent-green border border-accent-green/20'
                  : 'text-white/50 hover:text-white/80 hover:bg-surface-3'
              )}
            >
              <Icon size={16} className={active ? 'text-accent-green' : ''} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={12} className="text-accent-green/50" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface-2">
          {session?.user?.image && (
            <Image
              src={session.user.image}
              alt="avatar"
              width={28}
              height={28}
              className="rounded-full ring-1 ring-border"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white/80 truncate">
              {(session?.user as any)?.login || session?.user?.name}
            </p>
            <p className="text-xs text-white/30 font-mono">GitHub</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="p-1 text-white/30 hover:text-accent-red transition-colors"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
