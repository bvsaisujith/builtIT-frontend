'use client';

// ---------------------------------------------------------------------------
// Standalone admin login - NOT a participant account.
// Anyone holding the shared username + password can open /admin/login and get
// an HMAC-signed session cookie. No Supabase user is created, no participant
// privileges are granted, and participants can never reach /admin/*.
// ---------------------------------------------------------------------------

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(body?.error ?? 'Invalid admin username or password.');
        setLoading(false);
        return;
      }

      // The login response set the session cookie; refresh so the middleware
      // and any server components re-evaluate with it.
      router.replace('/admin');
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
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
            <span className="brand-bracket" style={{ fontSize: '28px' }}>⚙</span>
            <span className="brand-bracket">&gt;</span>
          </div>

          <span className="eyebrow login-eyebrow">organizer access</span>
          <h1>Admin console</h1>
          <p className="auth-subtitle">Restricted to event organizers.</p>
        </div>

        {error && (
          <div className="auth-error-banner login-error" role="alert">
            <i className="icon-alert" aria-hidden="true">!</i>
            <span>{error}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-username">Username</label>
            <div className="input-shell">
              <span className="input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
                </svg>
              </span>
              <input
                id="admin-username"
                className="form-input has-icon"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin username"
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="admin-password">Password</label>
            <div className="input-shell">
              <span className="input-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              </span>
              <input
                id="admin-password"
                className="form-input has-icon"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="admin password"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button className="btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in as organizer'}
          </button>
        </form>
      </div>
    </div>
  );
}
