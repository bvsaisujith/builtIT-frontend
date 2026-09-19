'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const goToProfile = async (userId: string) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('profile_completed_at')
        .eq('id', userId)
        .maybeSingle();

      if (cancelled) return;
      if (profile?.profile_completed_at) {
        router.replace('/dashboard', { scroll: false });
      } else {
        router.replace('/complete-profile', { scroll: false });
      }
    };

    // Surface OAuth errors carried in the hash (e.g. #error=access_denied)
    // or in query params (?error=...).
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const query = new URLSearchParams(window.location.search);
    const oauthError = hash.get('error_description') || hash.get('error')
      || query.get('error_description') || query.get('error');
    if (oauthError) {
      setError(oauthError);
      setTimeout(() => router.replace('/login?error=auth_failed', { scroll: false }), 2500);
      return;
    }

    const processOAuthCallback = async () => {
      // The implicit flow delivers tokens in the URL hash; supabase-js parses
      // it asynchronously. First try an immediate session lookup...
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await goToProfile(session.user.id);
        return;
      }

      // ...then wait for the SIGNED_IN event (hash parsing completing),
      // with a hard timeout so we never hang on this page.
      const timeout = setTimeout(async () => {
        if (cancelled) return;
        const { data: { session: retrySession } } = await supabase.auth.getSession();
        if (retrySession?.user) {
          await goToProfile(retrySession.user.id);
        } else if (!cancelled) {
          router.replace('/login?error=auth_failed', { scroll: false });
        }
      }, 8000);

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
        if (event === 'SIGNED_IN' && s?.user && !cancelled) {
          clearTimeout(timeout);
          subscription.unsubscribe();
          await goToProfile(s.user.id);
        }
      });
    };

    processOAuthCallback();
    return () => { cancelled = true; };
  }, [router]);

  if (error) {
    return (
      <div className="page-loading">
        <div className="loading-bracket">&lt; / &gt;</div>
        <p className="eyebrow">GitHub sign-in failed</p>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', maxWidth: '420px', textAlign: 'center' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="page-loading">
      <div className="loading-bracket">&lt; / &gt;</div>
      <p className="eyebrow">Signing you in...</p>
    </div>
  );
}