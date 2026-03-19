'use client';
import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Error]', error);
  }, [error]);

  return (
    <html>
      <body style={{ background: '#0a0a0f', color: 'white', fontFamily: 'sans-serif' }}>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1.5rem',
            }}>
              <AlertTriangle size={24} color="#ef4444" />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
              Application Error
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 24 }}>
              {error.message || 'Something went wrong. Please try reloading.'}
            </p>
            {error.digest && (
              <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.2)', marginBottom: 20 }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', background: '#18181f',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, color: 'rgba(255,255,255,0.7)',
                cursor: 'pointer', fontSize: 14,
              }}
            >
              <RefreshCw size={14} />
              Reload page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
