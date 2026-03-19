'use client';
import { AnalysisResult } from '@/types';
import { AlertTriangle, FileCode, Brain, Lightbulb, Target } from 'lucide-react';

interface Props { result: AnalysisResult; }

export function AnalysisReport({ result }: Props) {
  const confidence = Math.round(result.confidence * 100);
  const confColor = confidence >= 80 ? 'text-accent-green' : confidence >= 60 ? 'text-accent-yellow' : 'text-accent-red';

  return (
    <div className="bg-surface-1 border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-accent-purple" />
          <h3 className="font-display font-semibold text-white text-sm">AI Analysis Report</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/30 font-mono">{result.model}</span>
          <div className="flex items-center gap-1">
            <Target size={10} className={confColor} />
            <span className={`text-xs font-mono font-bold ${confColor}`}>{confidence}% confidence</span>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Root Cause */}
        <div className="bg-accent-red/5 border border-accent-red/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={12} className="text-accent-red" />
            <span className="text-xs font-mono text-accent-red uppercase tracking-wider">Root Cause</span>
          </div>
          <p className="text-sm text-white/80 leading-relaxed">{result.rootCause}</p>
        </div>

        {/* Explanation */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Brain size={12} className="text-accent-purple" />
            <span className="text-xs font-mono text-white/40 uppercase tracking-wider">Explanation</span>
          </div>
          <p className="text-sm text-white/60 leading-relaxed">{result.explanation}</p>
        </div>

        {/* Affected Files */}
        {result.affectedFiles?.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileCode size={12} className="text-accent-blue" />
              <span className="text-xs font-mono text-white/40 uppercase tracking-wider">
                Affected Files ({result.affectedFiles.length})
              </span>
            </div>
            <div className="space-y-2">
              {result.affectedFiles.map((f, i) => (
                <div key={i} className="flex items-start gap-3 bg-surface-2 rounded-lg px-3 py-2.5">
                  <div className="w-1 h-4 rounded-full bg-accent-blue/50 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-mono text-accent-blue">{f.path}</p>
                    <p className="text-xs text-white/40 mt-0.5">{f.reason}</p>
                  </div>
                  <span className="ml-auto text-xs font-mono text-white/30">
                    {Math.round(f.relevanceScore * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggested Fix */}
        <div className="bg-accent-green/5 border border-accent-green/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={12} className="text-accent-green" />
            <span className="text-xs font-mono text-accent-green uppercase tracking-wider">Suggested Fix</span>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">{result.suggestedFix}</p>
        </div>
      </div>
    </div>
  );
}
