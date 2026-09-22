'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getWinners } from '@/lib/data';
import type { WinnerRow } from '@/lib/types';

// Push events come from the winners table (migration 015, added to the
// supabase_realtime publication). Polling and a focus refresh are the
// fallbacks in case Realtime is unavailable.
const POLL_INTERVAL_MS = 60_000;
const REFETCH_DEBOUNCE_MS = 600;

const MEDALS: Record<number, { label: string; medal: string; cls: string }> = {
  1: { label: '1st Place', medal: '🥇', cls: 'win-first' },
  2: { label: '2nd Place', medal: '🥈', cls: 'win-second' },
  3: { label: '3rd Place', medal: '🥉', cls: 'win-third' },
};

// Podium display order: 2nd, 1st, 3rd.
const PODIUM_ORDER = [2, 1, 3];

// Choreography beats (ms): reveal 3rd, then 2nd, crown the winner last.
const REVEAL_DELAY_MS: Record<number, number> = { 1: 1250, 2: 900, 3: 600 };
// Slots with no team yet come in early, then the announced places follow.
const EMPTY_SLOT_DELAY_MS = 320;

// One-shot confetti burst once the winner lands. Fixed table (no Math.random)
// so server render and hydration agree; colors are the three medal metals.
const CONFETTI: { left: string; delay: number; duration: number; drift: string; spin: string; size: number; cls: string }[] = [
  { left: '8%', delay: 1.9, duration: 2.8, drift: '34px', spin: '520deg', size: 7, cls: 'gold' },
  { left: '16%', delay: 2.1, duration: 3.0, drift: '-46px', spin: '-620deg', size: 5, cls: 'silver' },
  { left: '24%', delay: 1.8, duration: 2.5, drift: '28px', spin: '460deg', size: 6, cls: 'bronze' },
  { left: '31%', delay: 2.4, duration: 3.2, drift: '52px', spin: '700deg', size: 4, cls: 'gold' },
  { left: '38%', delay: 2.0, duration: 2.7, drift: '-30px', spin: '-520deg', size: 7, cls: 'silver' },
  { left: '45%', delay: 1.7, duration: 2.4, drift: '22px', spin: '430deg', size: 5, cls: 'gold' },
  { left: '52%', delay: 2.2, duration: 3.1, drift: '-40px', spin: '-560deg', size: 6, cls: 'bronze' },
  { left: '59%', delay: 1.9, duration: 2.6, drift: '36px', spin: '540deg', size: 7, cls: 'silver' },
  { left: '66%', delay: 2.3, duration: 2.9, drift: '-26px', spin: '-480deg', size: 4, cls: 'gold' },
  { left: '73%', delay: 2.0, duration: 3.3, drift: '44px', spin: '640deg', size: 5, cls: 'bronze' },
  { left: '80%', delay: 1.8, duration: 2.5, drift: '-38px', spin: '-500deg', size: 7, cls: 'gold' },
  { left: '88%', delay: 2.15, duration: 3.0, drift: '30px', spin: '580deg', size: 6, cls: 'silver' },
];

// Every animated element carries a --d delay so the CSS can choreograph the
// whole page from one variable (see globals.css "WINNERS" section).
const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;

export default function WinnersPage() {
  const [rows, setRows] = useState<WinnerRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const reloadTimer = useRef<number | null>(null);

  const reload = useCallback(async () => {
    const { rows: next, error: fetchError } = await getWinners();
    setRows(next);
    setError(fetchError);
    setLoading(false);
  }, []);

  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) window.clearTimeout(reloadTimer.current);
    reloadTimer.current = window.setTimeout(() => { void reload(); }, REFETCH_DEBOUNCE_MS);
  }, [reload]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Live: a push signal fires the moment the organizers update the podium.
  useEffect(() => {
    const channel = supabase
      .channel('winners')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'winners' },
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

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-bracket">&lt; / &gt;</div>
        <p className="eyebrow">Loading winners...</p>
      </div>
    );
  }

  const tableMissing = !!error && /does not exist|schema cache/i.test(error);
  const byPosition = new Map(rows.map(r => [r.position, r]));
  const podium = PODIUM_ORDER.map(pos => byPosition.get(pos) ?? null);

  return (
    <div className="winners-page">
      <div className="lb-hero">
        <div>
          <span className="eyebrow win-in" style={d(0)}>&lt; / &gt; final standings</span>
          <h1 className="winners-title win-in" style={d(140)}>Winners</h1>
          <p className="subtitle win-in" style={d(300)}>
            The top three teams of built IT 2K26, chosen by the organizers.
          </p>
        </div>
        <span
          className={(live ? 'lb-live' : 'lb-live lb-live-off') + ' win-in'}
          style={d(480)}
          title={live ? 'Updating instantly as the podium changes' : 'Refreshing periodically'}
        >
          <span className="lb-live-dot" />
          {live ? 'Live' : 'Auto-refresh'}
        </span>
      </div>

      {error && (
        <div className="auth-error-banner win-in" style={{ marginBottom: '20px', ...d(160) }}>
          <p>
            {tableMissing
              ? 'Winners are not set up yet — migrations 015/016 (winners, get_winners) have not been applied.'
              : error}
          </p>
        </div>
      )}

      {rows.length === 0 && !error ? (
        <div className="empty-state win-in" style={d(220)}>
          <div className="empty-icon">&lt; / &gt;</div>
          <h3>Winners announced soon</h3>
          <p>The podium will appear here as soon as the organizers announce the results.</p>
        </div>
      ) : (
        <div className="podium-stage">
          <span className="podium-spotlight" aria-hidden="true" />
          <div className="podium-confetti" aria-hidden="true">
            {CONFETTI.map((c, i) => (
              <i
                key={i}
                className={c.cls}
                style={{
                  left: c.left,
                  '--s': `${c.size}px`,
                  '--dl': `${c.delay}s`,
                  '--t': `${c.duration}s`,
                  '--dx': c.drift,
                  '--rot': c.spin,
                } as CSSProperties}
              />
            ))}
          </div>
          <div className="podium">
            {podium.map((row, index) => {
              const position = PODIUM_ORDER[index];
              const meta = MEDALS[position];
              if (!row) {
                return (
                  <div
                    key={position}
                    className={`podium-slot ${meta.cls} podium-empty`}
                    style={d(EMPTY_SLOT_DELAY_MS)}
                  >
                    <span className="podium-medal" aria-hidden="true">{meta.medal}</span>
                    <span className="podium-position">{meta.label}</span>
                    <span className="podium-tba">To be announced</span>
                  </div>
                );
              }
              return (
                <Link
                  key={position}
                  href={`/team/${row.team_id}`}
                  className={`podium-slot ${meta.cls}`}
                  style={d(REVEAL_DELAY_MS[position])}
                >
                  {position === 1 && <span className="podium-crown" aria-hidden="true">👑</span>}
                  <span className="podium-medal" aria-hidden="true">{meta.medal}</span>
                  <span className="podium-position">{meta.label}</span>
                  <span className="podium-team-name">{row.team_name || 'Unknown team'}</span>
                  {row.team_code && (
                    <span className="podium-team-code">{row.team_code}</span>
                  )}
                  <span className="podium-arrow" aria-hidden="true">→</span>
                  <span className="podium-sparkles" aria-hidden="true">
                    {Array.from({ length: 6 }).map((_, i) => <i key={i} />)}
                  </span>
                  <span className="podium-sheen" aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <p className="form-hint win-in" style={{ marginTop: '24px', ...d(2150) }}>
        Congratulations to all winning teams — and thank you to everyone who participated.
      </p>
    </div>
  );
}
