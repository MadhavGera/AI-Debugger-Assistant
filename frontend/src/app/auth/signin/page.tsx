'use client';
// export const dynamic = 'force-dynamic';
// import { signIn } from 'next-auth/react';
// import { useSearchParams } from 'next/navigation';
// import { Github, Zap, AlertCircle } from 'lucide-react';
// import { useState } from 'react';

// export default function SignInPage() {
//   const searchParams = useSearchParams();
//   const error = searchParams.get('error');
//   const [loading, setLoading] = useState(false);

//   const handleSignIn = async () => {
//     setLoading(true);
//     await signIn('github', { callbackUrl: '/dashboard' });
//   };

//   return (
//     <div className="min-h-screen bg-surface-0 flex items-center justify-center">
//       <div
//         className="fixed inset-0 pointer-events-none"
//         style={{
//           backgroundImage: `radial-gradient(circle at 50% 50%, rgba(0,255,136,0.04) 0%, transparent 70%)`,
//         }}
//       />
//       <div className="relative z-10 w-full max-w-sm px-4">
//         <div className="text-center mb-8">
//           <div className="w-14 h-14 rounded-2xl bg-accent-green/10 border border-accent-green/30 flex items-center justify-center mx-auto mb-5 glow-green">
//             <Zap size={24} className="text-accent-green" />
//           </div>
//           <h1 className="font-display text-2xl font-bold text-white">AI Debugger</h1>
//           <p className="text-white/40 text-sm mt-2">Sign in with GitHub to get started</p>
//         </div>

//         {error && (
//           <div className="flex items-center gap-2 p-3 bg-accent-red/10 border border-accent-red/20 rounded-lg mb-4 text-sm text-accent-red">
//             <AlertCircle size={14} />
//             {error === 'OAuthAccountNotLinked'
//               ? 'Account not linked. Try signing in again.'
//               : 'Sign-in failed. Please try again.'}
//           </div>
//         )}

//         <div className="bg-surface-1 border border-border rounded-2xl p-6">
//           <button
//             onClick={handleSignIn}
//             disabled={loading}
//             className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white text-surface-0 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all disabled:opacity-50"
//           >
//             <Github size={18} />
//             {loading ? 'Redirecting to GitHub...' : 'Continue with GitHub'}
//           </button>

//           <p className="text-xs text-white/25 text-center mt-4 leading-relaxed">
//             Requires <code className="font-mono text-white/40">repo</code> and{' '}
//             <code className="font-mono text-white/40">read:user</code> OAuth scopes
//             to access repositories and create pull requests.
//           </p>
//         </div>

//         <p className="text-center text-xs text-white/20 mt-4">
//           Your tokens are encrypted · No data sold · Open source
//         </p>
//       </div>
//     </div>
//   );
// }

import { Suspense } from 'react';
import SignInContent from './SignInContent';

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="text-white text-center">Loading...</div>}>
      <SignInContent />
    </Suspense>
  );
}