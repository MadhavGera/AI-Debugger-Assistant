import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/layout/Providers';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI GitHub Debugger',
  description: 'AI-powered debugging assistant that auto-generates pull requests',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Syne:wght@400;600;700;800&family=Geist:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.className} bg-surface-0 text-white antialiased`}>
        <Providers>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#18181f',
                color: '#fff',
                border: '1px solid #ffffff15',
                fontFamily: 'Geist, sans-serif',
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
