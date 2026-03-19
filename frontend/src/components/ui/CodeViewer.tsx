'use client';
import { useState, useCallback } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { Code2, GitCompare, Copy, Check, Maximize2, Minimize2 } from 'lucide-react';
import { clsx } from 'clsx';

interface CodeViewerProps {
  /** Show a single file */
  code?: string;
  language?: string;
  filename?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

interface DiffViewerProps {
  original: string;
  modified: string;
  language?: string;
  filename?: string;
}

// ── Shared Monaco theme ────────────────────────────────────
const MONACO_THEME = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [
    { token: 'comment', foreground: '4d5566', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'c792ea' },
    { token: 'string', foreground: 'c3e88d' },
    { token: 'number', foreground: 'f78c6c' },
    { token: 'type', foreground: '82aaff' },
    { token: 'function', foreground: '82aaff' },
    { token: 'variable', foreground: 'eeffff' },
    { token: 'operator', foreground: '89ddff' },
  ],
  colors: {
    'editor.background': '#111118',
    'editor.foreground': '#eeffff',
    'editor.lineHighlightBackground': '#ffffff08',
    'editor.selectionBackground': '#3b82f620',
    'editorLineNumber.foreground': '#ffffff20',
    'editorLineNumber.activeForeground': '#ffffff50',
    'editorIndentGuide.background': '#ffffff08',
    'editorIndentGuide.activeBackground': '#ffffff15',
    'editorGutter.background': '#111118',
    'scrollbarSlider.background': '#ffffff10',
    'scrollbarSlider.hoverBackground': '#ffffff20',
    'editorWidget.background': '#18181f',
    'editorSuggestWidget.background': '#18181f',
    'editorSuggestWidget.border': '#ffffff10',
    'editorCursor.foreground': '#00ff88',
    'editor.findMatchBackground': '#00ff8820',
    'editor.findMatchHighlightBackground': '#00ff8812',
  },
};

const MONACO_OPTIONS = {
  fontSize: 13,
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  fontLigatures: true,
  lineHeight: 1.7,
  padding: { top: 16, bottom: 16 },
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: 'on' as const,
  automaticLayout: true,
  scrollbar: {
    verticalScrollbarSize: 6,
    horizontalScrollbarSize: 6,
  },
  renderLineHighlight: 'line' as const,
  cursorBlinking: 'smooth' as const,
  smoothScrolling: true,
  bracketPairColorization: { enabled: true },
  guides: { indentation: true },
  folding: true,
  lineNumbers: 'on' as const,
};

// ── Code Viewer ────────────────────────────────────────────
export function CodeViewer({
  code = '',
  language = 'typescript',
  filename,
  readOnly = true,
  onChange,
}: CodeViewerProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMount = useCallback((_: any, monaco: any) => {
    monaco.editor.defineTheme('ai-debugger', MONACO_THEME);
    monaco.editor.setTheme('ai-debugger');
  }, []);

  return (
    <div className={clsx(
      'bg-surface-1 border border-border rounded-xl overflow-hidden flex flex-col',
      expanded ? 'fixed inset-4 z-50' : ''
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-2">
        <div className="flex items-center gap-2">
          <Code2 size={13} className="text-accent-blue" />
          {filename && (
            <span className="text-xs font-mono text-white/50">{filename}</span>
          )}
          <span className="text-xs font-mono text-white/20 bg-surface-3 px-1.5 py-0.5 rounded">
            {language}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-white/40 hover:text-white/70 bg-surface-3 hover:bg-surface-4 rounded transition-all"
          >
            {copied ? <Check size={11} className="text-accent-green" /> : <Copy size={11} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-white/30 hover:text-white/60 transition-colors"
          >
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className={expanded ? 'flex-1' : 'h-64'}>
        <Editor
          value={code}
          language={language}
          options={{
            ...MONACO_OPTIONS,
            readOnly,
            lineNumbers: 'on',
          }}
          onChange={readOnly ? undefined : (v) => onChange?.(v || '')}
          onMount={handleMount}
          loading={
            <div className="h-full flex items-center justify-center bg-surface-1">
              <div className="flex items-center gap-2 text-white/20">
                <Code2 size={14} className="animate-pulse" />
                <span className="text-xs font-mono">Loading editor...</span>
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}

// ── Diff Viewer ────────────────────────────────────────────
export function MonacoDiffViewer({
  original,
  modified,
  language = 'typescript',
  filename,
}: DiffViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [inline, setInline] = useState(false);

  const handleMount = useCallback((_: any, monaco: any) => {
    monaco.editor.defineTheme('ai-debugger', MONACO_THEME);
    monaco.editor.setTheme('ai-debugger');
  }, []);

  const addedLines = modified.split('\n').length - original.split('\n').length;

  return (
    <div className={clsx(
      'bg-surface-1 border border-border rounded-xl overflow-hidden flex flex-col',
      expanded ? 'fixed inset-4 z-50 shadow-2xl' : ''
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-2">
        <div className="flex items-center gap-2">
          <GitCompare size={13} className="text-accent-yellow" />
          {filename && <span className="text-xs font-mono text-white/50">{filename}</span>}
          <span className="text-xs font-mono text-accent-green/70">
            {addedLines >= 0 ? `+${addedLines}` : addedLines}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setInline(!inline)}
            className={clsx(
              'px-2.5 py-1 text-xs font-mono rounded transition-all',
              inline
                ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30'
                : 'text-white/30 hover:text-white/60'
            )}
          >
            {inline ? 'Inline' : 'Split'}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-white/30 hover:text-white/60 transition-colors"
          >
            {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Diff Editor */}
      <div className={expanded ? 'flex-1' : 'h-80'}>
        <DiffEditor
          original={original}
          modified={modified}
          language={language}
          options={{
            ...MONACO_OPTIONS,
            readOnly: true,
            renderSideBySide: !inline,
            enableSplitViewResizing: true,
            originalEditable: false,
          }}
          onMount={handleMount}
          loading={
            <div className="h-full flex items-center justify-center bg-surface-1">
              <GitCompare size={14} className="text-white/20 animate-pulse" />
            </div>
          }
        />
      </div>
    </div>
  );
}
