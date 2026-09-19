'use client';

import { useState, useEffect, type FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getMyTeam } from '@/lib/data';
import { useAuth } from '@/lib/auth-context';

function LoginPageContent() {
  const router = useRouter();
  const { profileCompleted } = useAuth();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'auth_failed'
      ? 'GitHub sign-in failed or was cancelled. Try again or use email + password.'
      : null,
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError('Invalid email or password.');
      setLoading(false);
      return;
    }

    const team = await getMyTeam();
    setLoading(false);
    const dest = team ? '/dashboard' : profileCompleted ? '/dashboard' : '/team/join';
    router.push(dest);
  };

  const handleGitHubLogin = async () => {
    setError(null);
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
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <span className="eyebrow">&lt; BUILT IT 2K26 &gt;</span>
        <h1>Welcome back</h1>
        <p className="auth-subtitle">Log in to continue building.</p>

        {error && <div className="auth-error-banner">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••"
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading} style={{ justifyContent: 'center' }}>
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="btn-secondary"
          style={{ justifyContent: 'center', width: '100%' }}
          onClick={handleGitHubLogin}
        >
          Continue with GitHub
        </button>

        <div className="auth-footer">
          GitHub is the supported sign-in method.
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
