'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getLeaderboard } from '@/lib/data';
import type { LeaderboardRow } from '@/lib/types';

// Push events come from the leaderboard_signals table (migration 014). Polling
// and a focus refresh are the fallbacks in case Realtime is unavailable.
const POLL_INTERVAL_MS = 30_000;
const REFETCH_DEBOUNCE_MS = 600;

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const reloadTimer = useRef<number | null>(null);

  const reload = useCallback(async () => {
    const { rows: next, error: fetchError } = await getLeaderboard();
    setRows(next);
    setError(fetchError);
    setUpdatedAt(Date.now());
    setLoading(false);
  }, []);

  // Coalesce a burst of events (e.g. one evaluation save touching several
  // rounds) into a single refetch.
  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => { void reload(); }, REFETCH_DEBOUNCE_MS);
  }, [reload]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Live: a push signal fires the moment any team's evaluation table row
  // changes (score saved, decision recorded, submission edited).
  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-signals')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leaderboard_signals' },
        scheduleReload,
      )
      .subscribe(status => setLive(status === 'SUBSCRIBED'));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scheduleReload]);

  // Fallback: poll on an interval and refetch when the tab becomes visible.
  useEffect(() => {
    const poll = window.setInterval(() => { void reload(); }, POLL_INTERVAL_MS);
    const onFocus = () => { void reload(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [reload]);

  // "Updated Ns ago" ticker.
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-bracket">&lt; / &gt;</div>
        <p className="eyebrow">Loading leaderboard...</p>
      </div>
    );
  }

  const agoSeconds = updatedAt === null
    ? null
    : Math.max(0, Math.floor((now - updatedAt) / 1000));
  const migrationMissing = !!error && /does not exist|schema cache/i.test(error);

  return (
    <div className="leaderboard-page">
      <div className="lb-hero">
        <div>
          <span className="eyebrow">&lt; / &gt; live standings</span>
          <h1>Leaderboard</h1>
          <p className="subtitle">Total score across both rounds. Open a team to see who is on it.</p>
        </div>
        <span className={live ? 'lb-live' : 'lb-live lb-live-off'} title={live ? 'Updating instantly as evaluations are saved' : 'Realtime unavailable — refreshing every 30 seconds'}>
          <span className="lb-live-dot" />
          {live ? 'Live' : 'Auto-refresh'}
          {agoSeconds !== null && (
            <span className="lb-live-updated">· updated {agoSeconds}s ago</span>
          )}
        </span>
      </div>

      {error && (
        <div className="auth-error-banner" style={{ marginBottom: '20px' }}>
          <p>
            {migrationMissing
              ? 'The leaderboard is not set up yet — migration 014 (get_leaderboard) has not been applied.'
              : error}
          </p>
        </div>
      )}

      {rows.length === 0 && !error ? (
        <div className="empty-state">
          <div className="empty-icon">&lt; / &gt;</div>
          <h3>No evaluations yet</h3>
          <p>Teams appear here as soon as the organizers score the first round.</p>
        </div>
      ) : (
        <ol className="lb-list">
          {rows.map(row => {
            const top = row.team_rank <= 3 ? ` lb-top-${row.team_rank}` : '';
            return (
              <li key={row.team_id} className={`lb-row${top}`}>
                <Link href={`/team/${row.team_id}`} className="lb-row-link">
                  <span className={`lb-rank${top ? ` lb-rank-top-${row.team_rank}` : ''}`}>
                    {row.team_rank}
                  </span>
                  <span className="lb-team-name">{row.team_name}</span>
                  <span className="lb-total" title="Total score">{row.total}</span>
                  <span className="lb-arrow" aria-hidden="true">→</span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      <p className="form-hint" style={{ marginTop: '24px' }}>
        Scores update automatically after every evaluation. Rankings are shared for equal totals.
      </p>
    </div>
  );
}
