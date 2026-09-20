'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import StatusBadge from '@/components/StatusBadge';
import Countdown from '@/components/Countdown';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import {
  getMyTeam,
  getEventConfig,
  getTeamCode,
  getPendingJoinRequests,
  respondToJoinRequest,
  type PendingJoinRequest,
} from '@/lib/data';
import type { TeamWithDetails, EventConfig } from '@/lib/types';

function DashboardContent() {
  const router = useRouter();
  const { profile } = useAuth();
  const [team, setTeam] = useState<TeamWithDetails | null>(null);
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [isLeader, setIsLeader] = useState(false);
  const [joinRequests, setJoinRequests] = useState<PendingJoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const myTeam = await getMyTeam();
      if (!myTeam) { router.push('/team/join'); return; }
      setTeam(myTeam);
      const cfg = await getEventConfig();
      setConfig(cfg);
      const { data: { user: me } } = await supabase.auth.getUser();
      const leader = !!me && me.id === myTeam.leader_id;
      setIsLeader(leader);
      if (leader) {
        setJoinRequests(await getPendingJoinRequests(myTeam.id));
      }
      setLoading(false);
    })();
  }, [router]);

  const handleRespond = async (requestId: string, action: 'approve' | 'reject') => {
    setActionError(null);
    setActionBusy(requestId);
    const { error } = await respondToJoinRequest(requestId, action);
    setActionBusy(null);
    if (error) { setActionError(error); return; }
    setJoinRequests(prev => prev.filter(r => r.id !== requestId));
    const refreshed = await getMyTeam();
    if (refreshed) setTeam(refreshed);
  };

  if (loading || !team) {
    return (
      <div className="page-loading">
        <div className="loading-bracket">&lt; / &gt;</div>
        <p className="eyebrow">Loading...</p>
      </div>
    );
  }

  const teamCode = getTeamCode(team);
  const memberCount = team.members.length;
  const maxMembers = config?.max_team_size ?? 4;
  const aimSub = team.submissions.aim;
  const finalSub = team.submissions.final;
  const aimDone = !!aimSub?.submitted_at;
  const finalDone = !!finalSub?.submitted_at;

  return (
    <div className="dashboard-page">
      {/* 1 — Welcome / profile */}
      <section className="dash-hero">
        <div className="dash-hero-left">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="dash-hero-avatar" />
          ) : (
            <span className="dash-hero-avatar dash-hero-avatar-fallback">&lt; / &gt;</span>
          )}
          <div>
            <span className="eyebrow">Welcome back</span>
            <h1 style={{ fontSize: 'clamp(22px, 3vw, 30px)', lineHeight: 1.2 }}>
              {profile?.full_name ?? 'Participant'}
            </h1>
            <p className="subtitle" style={{ marginTop: '4px' }}>
              {profile?.github_username && (
                <a
                  href={profile.github_url ?? `https://github.com/${profile.github_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--color-accent-secondary)' }}
                >
                  @{profile.github_username}
                </a>
              )}
              {profile?.github_username && ' · '}
              <strong>{team.name}</strong>
              {teamCode && (
                <> · <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-accent-secondary)' }}>{teamCode}</span></>
              )}
            </p>
          </div>
        </div>
        <div className="dash-hero-actions">
          <Link href="/teams" className="btn-secondary btn-sm">Browse teams</Link>
          <Link href="/problem-statements" className="btn-secondary btn-sm">Problems</Link>
        </div>
      </section>

      {/* 2 — Status tiles (quick actions) */}
      <section className="dash-status-grid">
        <Link href="/team/join" className="status-tile">
          <span className="status-tile-label">Team</span>
          <span className="status-tile-value">{memberCount} / {maxMembers}</span>
          <span className="status-tile-hint">
            {memberCount >= maxMembers ? 'Team is full' : 'Invite teammates with your code'}
          </span>
        </Link>

        <Link href="/problem-statements" className="status-tile">
          <span className="status-tile-label">Domain</span>
          <span className="status-tile-value">{team.domain?.name ?? '—'}</span>
          <span className="status-tile-hint">
            {team.problem_statement?.title
              ? team.problem_statement.title
              : isLeader
                ? memberCount < 3
                  ? `Need ${3 - memberCount} more member${3 - memberCount === 1 ? '' : 's'} before selecting (min 3)`
                  : 'Select your problem statement'
                : 'Leader has not selected yet'}
          </span>
        </Link>

        <Link href="/submit/aim" className="status-tile">
          <span className="status-tile-label">Submission 1 · Aim</span>
          <span className="status-tile-value">{aimDone ? <StatusBadge status={aimSub!.status} /> : 'Pending'}</span>
          <span className="status-tile-hint">{aimDone ? 'Tap to review or edit' : 'Due before final submission'}</span>
        </Link>

        <Link href="/submit/final" className="status-tile">
          <span className="status-tile-label">Submission 2 · Final</span>
          <span className="status-tile-value">{finalDone ? <StatusBadge status={finalSub!.status} /> : aimDone ? 'Ready' : 'Locked'}</span>
          <span className="status-tile-hint">{finalDone ? 'Tap to review or edit' : aimDone ? 'Deploy link + repo' : 'Complete Submission 1 first'}</span>
        </Link>
      </section>

      {/* 3 - Deadlines */}
      {(config?.aim_deadline || config?.final_deadline) && (
        <section className="dash-grid" style={{ marginTop: '20px' }}>
          {config?.aim_deadline && (
            <div className="dash-card">
              <h3>Aim deadline</h3>
              <Countdown deadline={config.aim_deadline} label="Aim submission" />
            </div>
          )}
          {config?.final_deadline && (
            <div className="dash-card">
              <h3>Final deadline</h3>
              <Countdown deadline={config.final_deadline} label="Final submission" />
            </div>
          )}
        </section>
      )}

      {/* 4 - Join requests (leader only) */}
      {isLeader && joinRequests.length > 0 && (
        <div className="dash-card" style={{ marginTop: '20px' }}>
          <h3>Join requests ({joinRequests.length})</h3>
          {actionError && <div className="auth-error-banner" style={{ marginBottom: '12px' }}>{actionError}</div>}
          <div className="member-list">
            {joinRequests.map(r => (
              <div key={r.id} className="member-row">
                {r.avatar_url ? (
                  <img src={r.avatar_url} alt="" referrerPolicy="no-referrer" className="member-avatar" />
                ) : (
                  <span className="member-avatar member-avatar-fallback">&lt; / &gt;</span>
                )}
                <div className="member-info">
                  <span className="member-name">
                    {r.full_name?.trim() || r.github_username || 'New participant'}
                  </span>
                  <span className="member-github">
                    {r.github_username ? (
                      <a
                        href={r.github_url ?? `https://github.com/${r.github_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        @{r.github_username}
                      </a>
                    ) : '—'}
                    {<> · Sent {new Date(r.created_at).toLocaleDateString()}</>}
                  </span>
                  {r.message && <span className="member-github">&ldquo;{r.message}&rdquo;</span>}
                </div>
                <div className="member-actions">
                  <button
                    className="btn-primary btn-sm"
                    disabled={actionBusy === r.id}
                    onClick={() => handleRespond(r.id, 'approve')}
                  >
                    {actionBusy === r.id ? '...' : 'Approve'}
                  </button>
                  <button
                    className="btn-text"
                    disabled={actionBusy === r.id}
                    onClick={() => handleRespond(r.id, 'reject')}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5 - Team members */}
      <div className="dash-card" style={{ marginTop: '20px' }}>
        <div className="team-card-header">
          <h3>Team members ({memberCount}/{maxMembers})</h3>
          {teamCode && (
            <span className="team-code-chip" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{teamCode}</span>
          )}
        </div>
        {memberCount < maxMembers && (
          <div className="waiting-banner" style={{ marginBottom: '16px' }}>
            <span>Share code <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{teamCode}</strong> so teammates can request to join.</span>
          </div>
        )}
        <div className="member-list">
          {team.members.map(m => (
            <div key={m.user_id} className="member-row">
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" referrerPolicy="no-referrer" className="member-avatar" />
              ) : (
                <span className="member-avatar member-avatar-fallback">&lt; / &gt;</span>
              )}
              <div className="member-info">
                <span className="member-name">
                  {m.full_name ?? 'Participant'}
                  {m.is_leader && <span className="leader-chip">Leader</span>}
                </span>
                <span className="member-github">
                  {m.github_username ? (
                    <a href={m.github_url ?? `https://github.com/${m.github_username}`} target="_blank" rel="noopener noreferrer">
                      @{m.github_username}
                    </a>
                  ) : '—'}
                  {m.year && <> · {m.year}</>}
                  {m.section && <> · Sec {m.section}</>}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="form-hint" style={{ marginTop: '12px' }}>
          Only public information is shown to teammates. Contact details stay private.
        </p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
