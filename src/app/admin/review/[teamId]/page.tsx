'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminGuard from '@/components/AdminGuard';
import StatusBadge from '@/components/StatusBadge';
import EvaluationPanel from '@/components/EvaluationPanel';
import { RUBRICS, rubricMaxTotal } from '@/lib/rubrics';
import {
  fetchAdminTeamDetail,
  type AdminSubmissionRow,
  type AdminTeamDetail,
  type SavedEvaluation,
} from '@/lib/admin-client';
import type { SubmissionStage } from '@/lib/types';

function fmtDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : '—';
}

// On-time / late / no-deadline compliance tag.
function DeadlineTag({ submittedAt, deadline }: { submittedAt: string | null; deadline: string | null }) {
  if (!submittedAt) return null;
  if (!deadline) return <span className="review-deadline">No deadline set</span>;
  const onTime = new Date(submittedAt).getTime() <= new Date(deadline).getTime();
  return (
    <span className="review-deadline" style={{ color: onTime ? 'var(--color-success)' : 'var(--color-danger)' }}>
      {onTime ? 'On time' : 'Late'}
    </span>
  );
}

function SubmissionCard({
  stage,
  submission,
  deadline,
}: {
  stage: 'AIM' | 'FINAL';
  submission: AdminSubmissionRow | undefined;
  deadline: string | null;
}) {
  return (
    <div className="dash-card">
      <div className="team-card-header">
        <h3>{stage === 'AIM' ? 'Submission 1 · Aim' : 'Submission 2 · Final'}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {submission && submission.score !== null && (
            <span className="review-score" title="Round score">
              {submission.score} / {rubricMaxTotal(RUBRICS[stage])}
            </span>
          )}
          {submission ? (
            <StatusBadge status={submission.status as Parameters<typeof StatusBadge>[0]['status']} />
          ) : (
            <span className="status-badge status-NOT_SUBMITTED"><span className="dot" />Not started</span>
          )}
        </div>
      </div>

      {!submission ? (
        <div className="empty-state" style={{ padding: '24px 0' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>
            This team has not made this submission yet.
          </p>
        </div>
      ) : (
        <div className="sub-detail">
          <p className="sub-detail-row">
            <span className="sub-detail-label">Submitted</span>
            {fmtDate(submission.submitted_at)}
            <DeadlineTag submittedAt={submission.submitted_at} deadline={deadline} />
          </p>

          {stage === 'AIM' && (
            <>
              {submission.aim_summary && (
                <div className="sub-detail-block">
                  <span className="sub-detail-label">Aim summary</span>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {submission.aim_summary}
                  </p>
                </div>
              )}
              <div className="sub-detail-block">
                <span className="sub-detail-label">Presentation</span>
                {submission.ppt_drive_url ? (
                  <a href={submission.ppt_drive_url} target="_blank" rel="noopener noreferrer" className="review-link">
                    Open Drive link <span>↗</span>
                  </a>
                ) : submission.ppt_file_name ? (
                  <span className="text-muted">Legacy upload: {submission.ppt_file_name}</span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </div>
            </>
          )}

          {stage === 'FINAL' && (
            <div className="dev-links" style={{ marginTop: '4px' }}>
              {submission.deployed_url ? (
                <a href={submission.deployed_url} target="_blank" rel="noopener noreferrer">Deployed app <span>↗</span></a>
              ) : null}
              {submission.repo_url ? (
                <a href={submission.repo_url} target="_blank" rel="noopener noreferrer">Repository <span>↗</span></a>
              ) : null}
              {submission.demo_video_url ? (
                <a href={submission.demo_video_url} target="_blank" rel="noopener noreferrer">Demo video <span>↗</span></a>
              ) : null}
              {!submission.deployed_url && !submission.repo_url && !submission.demo_video_url && (
                <span className="text-muted">No links provided.</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamReviewContent() {
  const params = useParams<{ teamId: string }>();
  const teamId = params?.teamId;
  const [detail, setDetail] = useState<AdminTeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // Per-round confirmation banner, e.g. "Evaluation saved — 82 / 100".
  const [flash, setFlash] = useState<{ stage: SubmissionStage; message: string } | null>(null);

  useEffect(() => {
    if (!teamId) return;
    (async () => {
      const data = await fetchAdminTeamDetail(teamId);
      if (!data || !data.team) setNotFound(true);
      else setDetail(data);
      setLoading(false);
    })();
  }, [teamId]);

  /**
   * Merge a saved evaluation back into the loaded detail, so the badges, round
   * totals and the "last scored" stamp update without a full page reload.
   */
  const handleSaved = (stage: SubmissionStage, saved: SavedEvaluation) => {
    setDetail(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        submissions: prev.submissions.map(s =>
          s.id === saved.id
            ? {
                ...s,
                score: saved.score,
                criteria_scores: saved.criteria_scores,
                feedback: saved.feedback,
                status: saved.status,
                reviewed_at: saved.reviewed_at,
                reviewed_by: saved.reviewed_by,
              }
            : s,
        ),
      };
    });

    const decision = saved.status.replace('_', ' ').toLowerCase();
    setFlash({
      stage,
      message: saved.score === null
        ? `Decision saved — marked ${decision}.`
        : `Evaluation saved — ${saved.score} / ${rubricMaxTotal(RUBRICS[stage])} (${decision}).`,
    });
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-bracket">&lt; / &gt;</div>
        <p className="eyebrow">Loading team...</p>
      </div>
    );
  }

  if (notFound || !detail || !detail.team) {
    return (
      <div className="empty-state">
        <div className="empty-icon">404</div>
        <h3>Team not found</h3>
        <p>This team may have been removed or the link is incorrect.</p>
        <Link href="/admin/review" className="btn-secondary btn-sm" style={{ marginTop: '12px' }}>
          ← Back to review
        </Link>
      </div>
    );
  }

  const { team, members, submissions, deadlines } = detail;
  const aim = submissions.find(s => s.stage === 'AIM');
  const final = submissions.find(s => s.stage === 'FINAL');

  return (
    <div className="dashboard-page">
      <Link href="/admin/review" className="btn-text">← All submissions</Link>

      <div className="team-detail-header">
        <div>
          <h1>{team.name}</h1>
          <p className="subtitle">
            {team.domain?.name ?? 'No domain selected'}
            {team.team_code && (
              <> · <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-accent-secondary)' }}>{team.team_code}</span></>
            )}
            {' · '}Created {fmtDate(team.created_at)}
            {team.is_locked ? ' · Locked' : ' · Open'}
          </p>
        </div>
        <span className="meta-chip">{members.length} member{members.length === 1 ? '' : 's'}</span>
      </div>

      <div className="dash-grid" style={{ marginTop: '24px' }}>
        <div className="dash-card">
          <h3>Problem statement</h3>
          {team.problem_statement ? (
            <>
              <p style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>{team.problem_statement.title}</p>
              {team.problem_statement.description && (
                <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>
                  {team.problem_statement.description}
                </p>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>No problem statement selected yet.</p>
          )}
        </div>

        <div className="dash-card">
          <h3>Members ({members.length})</h3>
          <div className="member-list">
            {members.map(m => (
              <div key={m.user_id} className="member-row">
                {m.profile?.avatar_url ? (
                  <img src={m.profile.avatar_url} alt="" referrerPolicy="no-referrer" className="member-avatar" />
                ) : (
                  <span className="member-avatar member-avatar-fallback">&lt; / &gt;</span>
                )}
                <div className="member-info">
                  <span className="member-name">
                    {m.profile?.full_name ?? 'Participant'}
                    {m.is_leader && <span className="leader-chip">Leader</span>}
                  </span>
                  <span className="member-github">
                    {m.profile?.github_username ? (
                      <a
                        href={`https://github.com/${m.profile.github_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        @{m.profile.github_username}
                      </a>
                    ) : '—'}
                    {m.profile?.year && <> · {m.profile.year}</>}
                    {m.profile?.section && <> · Sec {m.profile.section}</>}
                    {m.profile?.roll_number && <> · Roll {m.profile.roll_number}</>}
                    {m.profile?.email && <> · {m.profile.email}</>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dash-grid" style={{ marginTop: '20px' }}>
        <SubmissionCard stage="AIM" submission={aim} deadline={deadlines?.aim_deadline ?? null} />
        <SubmissionCard stage="FINAL" submission={final} deadline={deadlines?.final_deadline ?? null} />
      </div>

      {/* Judging: round 1 (aim + PPT) and round 2 (final build + demo) */}
      <h2 style={{ marginTop: '36px', fontSize: '22px' }}>Round evaluation</h2>
      <p className="form-hint" style={{ marginBottom: '18px' }}>
        Round 1 scores the aim and presentation deck. Round 2 scores the final build and demo.
        Each rubric totals 100 points; scores and feedback stay visible to organizers only.
      </p>

      <div className="eval-stack">
        <EvaluationPanel
          rubric={RUBRICS.AIM}
          submission={aim}
          flash={flash?.stage === 'AIM' ? flash.message : null}
          onSaved={saved => handleSaved('AIM', saved)}
        />
        <EvaluationPanel
          rubric={RUBRICS.FINAL}
          submission={final}
          flash={flash?.stage === 'FINAL' ? flash.message : null}
          onSaved={saved => handleSaved('FINAL', saved)}
        />
      </div>
    </div>
  );
}

export default function AdminTeamReviewPage() {
  return (
    <AdminGuard>
      <TeamReviewContent />
    </AdminGuard>
  );
}
