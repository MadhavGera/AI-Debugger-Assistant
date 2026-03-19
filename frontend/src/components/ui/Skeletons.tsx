'use client';
import { clsx } from 'clsx';

// ── Base Skeleton ─────────────────────────────────────────
interface SkeletonProps {
  className?: string;
  lines?: number;
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={clsx('animate-pulse bg-surface-3 rounded-md', className)} />
  );
}

// ── Repo Card Skeleton ────────────────────────────────────
export function RepoCardSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-border">
      <Skeleton className="w-2 h-2 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-2.5 w-72" />
      </div>
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-3 w-12" />
    </div>
  );
}

// ── Analysis Skeleton ─────────────────────────────────────
export function AnalysisSkeleton() {
  return (
    <div className="space-y-4">
      {/* Root cause */}
      <div className="bg-surface-1 border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="w-3 h-3 rounded-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      {/* Explanation */}
      <div className="bg-surface-1 border border-border rounded-xl p-5 space-y-2">
        <Skeleton className="h-3 w-28 mb-3" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3.5 w-4/5" />
      </div>
      {/* Files */}
      <div className="bg-surface-1 border border-border rounded-xl p-5 space-y-3">
        <Skeleton className="h-3 w-32 mb-2" />
        {[...Array(2)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 bg-surface-2 rounded-lg px-3 py-2.5">
            <Skeleton className="w-1 h-4 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-2.5 w-64" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Patch Skeleton ────────────────────────────────────────
export function PatchSkeleton() {
  return (
    <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Skeleton className="w-3.5 h-3.5 rounded" />
          <Skeleton className="h-3.5 w-28" />
        </div>
        <Skeleton className="h-7 w-20 rounded-lg" />
      </div>
      {/* Fake diff lines */}
      <div className="p-4 space-y-1 font-mono text-xs">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-6 h-3 rounded" />
            <Skeleton className="w-3 h-3 rounded" />
            <Skeleton className={clsx('h-3 rounded', i % 3 === 0 ? 'w-3/4' : i % 3 === 1 ? 'w-1/2' : 'w-2/3')} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stats Skeleton ────────────────────────────────────────
export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-surface-1 border border-border rounded-xl p-5 space-y-2">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-8 w-12" />
            </div>
            <Skeleton className="w-8 h-8 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── PR List Skeleton ──────────────────────────────────────
export function PRListSkeleton() {
  return (
    <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-start gap-4 px-5 py-4 border-b border-border last:border-0">
          <Skeleton className="w-8 h-8 rounded-md mt-0.5" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-80" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-2.5 w-32" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-12 rounded" />
            <Skeleton className="w-6 h-6 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
