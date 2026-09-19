'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { isAdmin } from '@/lib/data';

export default function AdminGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [admin, setAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { setAdmin(false); return; }
    isAdmin().then(setAdmin);
  }, [user, loading]);

  if (loading || admin === null) {
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