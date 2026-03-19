'use client';
import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    // In production, send to error tracking (e.g. Sentry)
    if (process.env.NODE_ENV === 'production') {
      console.error('[ErrorBoundary]', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center p-8 rounded-xl bg-surface-1 border border-accent-red/20 text-center">
          <div className="w-12 h-12 rounded-xl bg-accent-red/10 border border-accent-red/20 flex items-center justify-center mb-4">
            <AlertTriangle size={20} className="text-accent-red" />
          </div>
          <h3 className="font-display font-semibold text-white mb-1">Something went wrong</h3>
          <p className="text-sm text-white/40 mb-4 max-w-sm">
            {this.state.error?.message || 'An unexpected error occurred in this component.'}
          </p>
          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details className="text-left mb-4 w-full max-w-lg">
              <summary className="text-xs font-mono text-white/30 cursor-pointer hover:text-white/50 mb-2">
                Stack trace
              </summary>
              <pre className="text-xs font-mono text-accent-red/70 bg-surface-2 p-3 rounded-lg overflow-auto max-h-48">
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 border border-border rounded-lg text-sm text-white/60 hover:text-white transition-all"
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
