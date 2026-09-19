'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import { getTeamPublicDetail, type TeamPublicDetail } from '@/lib/data';

function TeamDetailContent() {
  const params = useParams<{ teamId: string }>();
  const teamId = params?.teamId;
  const [team, setTeam] = useState<TeamPublicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    (async () => {
      const detail = await getTeamPublicDetail(teamId);
      if (!detail) setNotFound(true);
      else setTeam(detail);
      setLoading(false);
    })();
  }, [teamId]);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-bracket">&lt; / &gt;</div>
        <p className="eyebrow">Loading team...</p>
      </div>
    );
  }

  if (notFound || !team) {
    return (
      <div className="empty-state">
        <div className="empty-icon">404</div>
        <h3>Team not found</h3>
        <p>This team may have been removed or the link is incorrect.</p>
        <Link href="/teams" className="btn-secondary btn-sm" style={{ marginTop: '12px' }}>
          ← Back to teams
        </Link>
      </div>
    );
  }

  return (
    <div className="team-detail-page">
      <Link href="/teams" className="btn-text">← All teams</Link>

      <div className="team-detail-header">
        <div>
          <h1>{team.name}</h1>
          <p className="subtitle">
            {team.domain_name ?? 'No domain selected'}
            {team.team_code && (
              <> · <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-accent-secondary)' }}>{team.team_code}</span></>
            )}
          </p>
        </div>
        <span className="meta-chip">{team.member_count} member{team.member_count === 1 ? '' : 's'}</span>
      </div>

      <div className="dash-grid" style={{ marginTop: '28px' }}>
        <div className="dash-card">
          <h3>Problem statement</h3>
          {team.problem_title ? (
            <>
              <p style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>{team.problem_title}</p>
              {team.problem_description && (
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>
                  {team.problem_description}
                </p>
              )}
            </>
          ) : (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
                This team has not selected a problem statement yet.
              </p>
            </div>
          )}
        </div>

        <div className="dash-card">
          <h3>Members ({team.members.length})</h3>
          <div className="member-list">
            {team.members.map(m => (
              <div key={m.member_id} className="member-row">
                {m.member_avatar_url ? (
                  <img src={m.member_avatar_url} alt="" referrerPolicy="no-referrer" className="member-avatar" />
                ) : (
                  <span className="member-avatar member-avatar-fallback">&lt; / &gt;</span>
                )}
                <div className="member-info">
                  <span className="member-name">
                    {m.member_full_name ?? 'Participant'}
                    {m.member_is_leader && <span className="leader-chip">Leader</span>}
                  </span>
                  <span className="member-github">
                    {m.member_github_username ? (
                      <a
                        href={m.member_github_url ?? `https://github.com/${m.member_github_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        @{m.member_github_username}
                      </a>
                    ) : '—'}
                    {m.member_year && <> · {m.member_year}</>}
                    {m.member_section && <> · Sec {m.member_section}</>}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="form-hint" style={{ marginTop: '12px' }}>
            Only public information is shown. Contact details stay private.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TeamDetailPage() {
  return (
    <AuthGuard>
      <TeamDetailContent />
    </AuthGuard>
  );
}
