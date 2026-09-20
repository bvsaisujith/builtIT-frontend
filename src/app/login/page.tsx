'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function LoginPageContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'auth_failed'
      ? 'GitHub sign-in failed or was cancelled. Please try again.'
      : null,
  );
  const [loading, setLoading] = useState(false);

  const handleGitHubLogin = async () => {
    setError(null);
    setLoading(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // No custom scope: Supabase's default is `user:email`, which its
        // GitHub provider requires to fetch the participant's email during
        // profile retrieval. Overriding the scope (e.g. read:user) strips
        // that permission and breaks sign-in with "Error getting user
        // profile from external provider".
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-glow" aria-hidden="true" />

      <div className="auth-card login-card">
        <div className="login-head">
          <div className="login-brand">
            <span className="brand-bracket">&lt;</span>
            <img src="/buildit_logo.jpeg" alt="built IT 2K26" className="brand-logo" />
            <span className="brand-bracket">&gt;</span>
          </div>

          <span className="eyebrow login-eyebrow">participant access</span>
          <h1>Welcome back</h1>
          <p className="auth-subtitle">Log in to continue building.</p>
        </div>

        {error && (
          <div className="auth-error-banner login-error" role="alert">
            <i className="icon-alert" aria-hidden="true">!</i>
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          className="btn-primary login-submit"
          onClick={handleGitHubLogin}
          disabled={loading}
        >
          {loading ? (
            <>
              <i className="spinner" aria-hidden="true" />
              Redirecting to GitHub…
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" width="17" height="17" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              Continue with GitHub
            </>
          )}
        </button>

        <div className="auth-footer">
          GitHub is the only supported sign-in method.
        </div>

        <div className="login-meta">
          <span>Open innovation</span>
          <span aria-hidden="true">·</span>
          <span>21 Sept 2026</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
