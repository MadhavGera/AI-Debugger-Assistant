import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/layout/Providers';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ['latin'],
  variable: '--font-mono',
});
export const metadata: Metadata = {
  title: 'AI GitHub Debugger',
  description: 'AI-powered debugging assistant that auto-generates pull requests',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-surface-0 text-slate-300 antialiased`}>
        <Providers>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#18181f',
                color: '#f8fafc', // slate-50
                border: '1px solid #ffffff15',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: '#00ff88', secondary: '#0a0a0f' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#0a0a0f' } },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
