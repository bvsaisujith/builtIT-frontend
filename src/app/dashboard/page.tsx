'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import StatusBadge from '@/components/StatusBadge';
import { getMyTeam, getEventConfig, getTeamCode } from '@/lib/data';
import type { TeamWithDetails, EventConfig } from '@/lib/types';

function DashboardContent() {
  const router = useRouter();
  const [team, setTeam] = useState<TeamWithDetails | null>(null);
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const myTeam = await getMyTeam();
      if (!myTeam) { router.push('/team/join'); return; }
      setTeam(myTeam);
      const cfg = await getEventConfig();
      setConfig(cfg);
      setLoading(false);
    })();
  }, [router]);

  if (loading || !team) {
    return (
      <div className="page-loading">
        <div className="loading-bracket">&lt; / &gt;</div>
        <p className="eyebrow">Loading...</p>
      </div>
    );
  }

  const teamCode = getTeamCode(team.id);
  const memberCount = team.members.length;
  const aimSub = team.submissions.aim;
  const finalSub = team.submissions.final;

  const teamFormed = memberCount > 0;
  const aimSubmitted = aimSub?.status !== 'NOT_SUBMITTED' && aimSub?.submitted_at !== null;
  const finalSubmitted = finalSub?.status !== 'NOT_SUBMITTED' && finalSub?.submitted_at !== null;

  return (
    <div className="dashboard-page">
      <h1>{team.name}</h1>
      <p className="subtitle">{team.category} · Team code: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-accent-secondary)' }}>{teamCode}</span></p>

      {memberCount < 3 && (
        <div className="waiting-banner">
          <span>Waiting for teammates ({memberCount}/3 joined) — share code <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>{teamCode}</strong></span>
        </div>
      )}

      {config && (config.aim_deadline || config.final_deadline) && (
        <div className="deadlines-strip">
          {config.aim_deadline && (
            <div className="deadline-pill">
              <span className="deadline-label">Aim Deadline</span>
              <div className="deadline-value">
                {new Date(config.aim_deadline).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}
          {config.final_deadline && (
            <div className="deadline-pill">
              <span className="deadline-label">Final Deadline</span>
              <div className="deadline-value">
                {new Date(config.final_deadline).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="dash-grid">
        <div className="dash-card">
          <h3>Team Info</h3>
          <div className="team-info-row">
            <span className="label">Name</span>
            <span className="value">{team.name}</span>
          </div>
          <div className="team-info-row">
            <span className="label">Category</span>
            <span className="value">{team.category}</span>
          </div>
          <div className="team-info-row">
            <span className="label">Team code</span>
            <span className="value mono">{teamCode}</span>
          </div>
          <div className="team-info-row">
            <span className="label">Members</span>
            <span className="value">{memberCount} / 3</span>
          </div>
          <div className="team-info-row">
            <span className="label">Status</span>
            <span className="value">{team.is_locked ? 'Locked' : 'Open'}</span>
          </div>

          <div className="member-list">
            {team.members.map(m => (
              <div key={m.id} className="member-item">
                <span className="member-name">{m.profile?.full_name ?? 'Unknown'}</span>
                {m.user_id === team.leader_id && <span className="leader-tag">LEADER</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="dash-card">
          <h3>Problem Statement</h3>
          {team.problem_statement ? (
            <>
              <div className="team-info-row">
                <span className="label">Title</span>
                <span className="value">{team.problem_statement.title}</span>
              </div>
              <div className="team-info-row">
                <span className="label">Category</span>
                <span className="value">{team.problem_statement.category}</span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginTop: '12px' }}>
                {team.problem_statement.description}
              </p>
              <Link href="/problem-statements" className="btn-text" style={{ marginTop: '16px' }}>
                Change problem →
              </Link>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '16px' }}>
                No problem statement selected yet.
              </p>
              <Link href="/problem-statements" className="btn-primary btn-sm">
                Select a problem →
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="dash-card" style={{ marginBottom: '20px' }}>
        <h3>Progress Tracker</h3>
        <div className="progress-tracker">
          <div className={`progress-step ${teamFormed ? 'complete' : ''}`}>
            <div className="step-status">
              <StatusBadge status={teamFormed ? 'SUBMITTED' : 'NOT_SUBMITTED'} />
            </div>
            <span className="step-label">Team Formed</span>
          </div>
          <div className={`progress-step ${aimSubmitted ? 'complete' : teamFormed ? 'active' : ''}`}>
            <div className="step-status">
              <StatusBadge status={aimSub?.status ?? 'NOT_SUBMITTED'} />
            </div>
            <span className="step-label">Aim Submitted</span>
          </div>
          <div className={`progress-step ${finalSubmitted ? 'complete' : ''}`}>
            <div className="step-status">
              <StatusBadge status={finalSub?.status ?? 'NOT_SUBMITTED'} />
            </div>
            <span className="step-label">Final Submitted</span>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="dash-card">
          <h3>Submission 1: Aim + PPT</h3>
          {aimSub && aimSub.submitted_at ? (
            <>
              <div className="team-info-row">
                <span className="label">Status</span>
                <StatusBadge status={aimSub.status} />
              </div>
              <div className="team-info-row">
                <span className="label">Submitted</span>
                <span className="value" style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace" }}>
                  {new Date(aimSub.submitted_at).toLocaleString()}
                </span>
              </div>
              {aimSub.ppt_file_name && (
                <div className="team-info-row">
                  <span className="label">File</span>
                  <span className="value" style={{ fontSize: '13px' }}>{aimSub.ppt_file_name}</span>
                </div>
              )}
              {aimSub.feedback && (
                <div className="feedback-panel" style={{ marginTop: '16px' }}>
                  <h4>Feedback</h4>
                  <p>{aimSub.feedback}</p>
                  {aimSub.score !== null && <span className="feedback-score">{aimSub.score}/100</span>}
                </div>
              )}
              <Link href="/submit/aim" className="btn-text" style={{ marginTop: '16px' }}>
                Edit submission →
              </Link>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '16px' }}>
                Not submitted yet.
              </p>
              <Link href="/submit/aim" className="btn-primary btn-sm">
                Go to submission →
              </Link>
            </div>
          )}
        </div>

        <div className="dash-card">
          <h3>Submission 2: Final App</h3>
          {finalSub && finalSub.submitted_at ? (
            <>
              <div className="team-info-row">
                <span className="label">Status</span>
                <StatusBadge status={finalSub.status} />
              </div>
              <div className="team-info-row">
                <span className="label">Submitted</span>
                <span className="value" style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace" }}>
                  {new Date(finalSub.submitted_at).toLocaleString()}
                </span>
              </div>
              {finalSub.deployed_url && (
                <div className="team-info-row">
                  <span className="label">Deployed</span>
                  <a href={finalSub.deployed_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent-secondary)', fontSize: '13px' }}>
                    Open ↗
                  </a>
                </div>
              )}
              {finalSub.repo_url && (
                <div className="team-info-row">
                  <span className="label">Repo</span>
                  <a href={finalSub.repo_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent-secondary)', fontSize: '13px' }}>
                    Open ↗
                  </a>
                </div>
              )}
              {finalSub.feedback && (
                <div className="feedback-panel" style={{ marginTop: '16px' }}>
                  <h4>Feedback</h4>
                  <p>{finalSub.feedback}</p>
                  {finalSub.score !== null && <span className="feedback-score">{finalSub.score}/100</span>}
                </div>
              )}
              <Link href="/submit/final" className="btn-text" style={{ marginTop: '16px' }}>
                Edit submission →
              </Link>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginBottom: '16px' }}>
                {aimSub?.submitted_at ? 'Not submitted yet.' : 'Complete Submission 1 first.'}
              </p>
              {aimSub?.submitted_at && (
                <Link href="/submit/final" className="btn-primary btn-sm">
                  Go to submission →
                </Link>
              )}
            </div>
          )}
        </div>
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
