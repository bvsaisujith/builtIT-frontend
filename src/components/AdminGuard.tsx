'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { isAdmin } from '@/lib/data';
import { checkAdminSession } from '@/lib/admin-client';

export default function AdminGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [admin, setAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1) Standalone (username/password) admin session cookie - the primary
      //    path for organizers. The middleware already enforces it server-side.
      if (await checkAdminSession()) {
        if (!cancelled) setAdmin(true);
        return;
      }

      // 2) Fallback: Supabase user with the admin role (GitHub-based admins).
      if (loading) return;
      if (!user) { if (!cancelled) setAdmin(false); return; }
      const allowed = await isAdmin();
      if (!cancelled) setAdmin(allowed);
    })();

    return () => { cancelled = true; };
  }, [user, loading]);

  if (admin === null || (loading && admin !== true)) {
    return (
      <div className="page-loading">
        <div className="loading-bracket">&lt; / &gt;</div>
        <p className="eyebrow">Checking access...</p>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Access denied</h1>
          <p className="auth-subtitle">
            This area is restricted to event administrators.
          </p>
          <Link href="/dashboard" className="btn-primary" style={{ justifyContent: 'center' }}>
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}