'use client';
import { useState } from 'react';
import { PatchHunk } from '@/types';
import { Code2, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

interface Props {
  patch: string;
  patchHunks: PatchHunk[];
}

export function PatchViewer({ patch, patchHunks }: Props) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const copyPatch = async () => {
    await navigator.clipboard.writeText(patch);
    setCopied(true);
    toast.success('Patch copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleCollapse = (path: string) => {
    setCollapsed(prev => ({ ...prev, [path]: !prev[path] }));
  };

  return (
    <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Code2 size={14} className="text-accent-yellow" />
          <h3 className="font-display font-semibold text-white text-sm">Patch Preview</h3>
          <span className="text-xs font-mono text-white/30 bg-surface-2 px-2 py-0.5 rounded">
            {patchHunks?.length || 0} file{patchHunks?.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={copyPatch}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-border rounded-lg text-xs text-white/60 hover:text-white transition-all"
        >
          {copied ? <Check size={12} className="text-accent-green" /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy Patch'}
        </button>
      </div>

      {/* Diff Files */}
      <div className="divide-y divide-border">
        {patchHunks?.map((hunk, hunkIdx) => (
          <div key={hunkIdx}>
            {/* File header */}
            <button
              onClick={() => toggleCollapse(hunk.filePath)}
              className="w-full flex items-center gap-2 px-5 py-3 bg-surface-2/50 hover:bg-surface-2 transition-colors text-left"
            >
              {collapsed[hunk.filePath] ? (
                <ChevronRight size={12} className="text-white/30" />
              ) : (
                <ChevronDown size={12} className="text-white/30" />
              )}
              <span className="font-mono text-xs text-accent-blue">{hunk.filePath}</span>
              <span className="ml-auto font-mono text-xs text-white/20">
                @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
              </span>
            </button>

            {/* Diff lines */}
            {!collapsed[hunk.filePath] && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <tbody>
                    {hunk.lines.map((line, lineIdx) => (
                      <tr
                        key={lineIdx}
                        className={clsx('', {
                          'bg-accent-green/8 hover:bg-accent-green/12': line.type === 'addition',
                          'bg-accent-red/8 hover:bg-accent-red/12': line.type === 'deletion',
                          'hover:bg-surface-2': line.type === 'context',
                        })}
                      >
                        <td className="w-10 px-3 py-0.5 text-white/15 text-right select-none border-r border-border">
                          {line.lineNumber || ''}
                        </td>
                        <td className={clsx('w-5 px-2 py-0.5 text-center select-none font-bold', {
                          'text-accent-green': line.type === 'addition',
                          'text-accent-red': line.type === 'deletion',
                          'text-white/20': line.type === 'context',
                        })}>
                          {line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' '}
                        </td>
                        <td className={clsx('px-3 py-0.5 whitespace-pre', {
                          'text-accent-green/90': line.type === 'addition',
                          'text-accent-red/80': line.type === 'deletion',
                          'text-white/50': line.type === 'context',
                        })}>
                          {line.content}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        {/* Raw patch fallback */}
        {(!patchHunks || patchHunks.length === 0) && patch && (
          <pre className="p-5 text-xs font-mono text-white/60 overflow-x-auto whitespace-pre leading-relaxed">
            {patch}
          </pre>
        )}
      </div>
    </div>
  );
}
