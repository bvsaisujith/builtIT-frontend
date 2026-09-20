'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import AdminGuard from '@/components/AdminGuard';
import StatusBadge from '@/components/StatusBadge';
import Pagination from '@/components/Pagination';
import { RUBRICS, rubricMaxTotal } from '@/lib/rubrics';
import { fetchAdminOverview, type AdminSubmissionSummary } from '@/lib/admin-client';
import type { AdminTeamRow } from '@/lib/data';
import type { EventConfig } from '@/lib/types';

type StageKey = 'AIM' | 'FINAL';

type RowFilter = 'all' | 'aim-done' | 'aim-pending' | 'final-done' | 'final-pending';

const FILTER_LABELS: Record<RowFilter, string> = {
  all: 'All teams',
  'aim-done': 'Aim submitted',
  'aim-pending': 'Aim pending',
  'final-done': 'Final submitted',
  'final-pending': 'Final pending',
};

/** Teams rendered per page — search/filter always run over ALL teams first. */
const PAGE_SIZE = 20;

function submissionFor(
  submissions: AdminSubmissionSummary[],
  teamId: string,
  stage: StageKey,
): AdminSubmissionSummary | undefined {
  return submissions.find(s => s.team_id === teamId && s.stage === stage);
}

function isDone(row: AdminSubmissionSummary | undefined): boolean {
  // Anything past NOT_SUBMITTED counts as submitted.
  return !!row && row.status !== 'NOT_SUBMITTED';
}

function ReviewContent() {
  const [teams, setTeams] = useState<AdminTeamRow[]>([]);
  const [submissions, setSubmissions] = useState<AdminSubmissionSummary[]>([]);
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RowFilter>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const listingRef = useRef<HTMLDivElement | null>(null);
  const pageSettled = useRef(false);

  useEffect(() => {
    (async () => {
      const data = await fetchAdminOverview();
      if (!data) {
        setError('Could not load admin data. Check the server configuration.');
        setLoading(false);
        return;
      }
      setTeams(data.teams);
      setSubmissions(data.submissions);
      setConfig(data.config);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const aimDone = teams.filter(t => isDone(submissionFor(submissions, t.id, 'AIM'))).length;
    const finalDone = teams.filter(t => isDone(submissionFor(submissions, t.id, 'FINAL'))).length;
    const pendingReview = submissions.filter(s => s.status === 'SUBMITTED').length;
    return { total: teams.length, aimDone, finalDone, pendingReview };
  }, [teams, submissions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teams.filter(t => {
      if (q) {
        const haystack = [t.name, t.team_code ?? '', t.domain?.name ?? '', t.problem_statement?.title ?? '']
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      switch (filter) {
        case 'aim-done':
          return isDone(submissionFor(submissions, t.id, 'AIM'));
        case 'aim-pending':
          return !isDone(submissionFor(submissions, t.id, 'AIM'));
        case 'final-done':
          return isDone(submissionFor(submissions, t.id, 'FINAL'));
        case 'final-pending':
          return !isDone(submissionFor(submissions, t.id, 'FINAL'));
        default:
          return true;
      }
    });
  }, [teams, submissions, query, filter]);

  // The search box and the filter always run across the WHOLE team list above;
  // only then is the active page sliced out. That is what keeps a term typed on
  // page 1 able to match a team that would otherwise sit on page 3.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageTeams = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  // Any search or filter change restarts the listing at page 1.
  useEffect(() => {
    setPage(1);
  }, [query, filter]);

  // Safety net: never stay on a page that no longer exists.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Bring the top of the table back into view whenever the page changes.
  useEffect(() => {
    if (!pageSettled.current) {
      pageSettled.current = true;
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    listingRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }, [page]);

  const hasFilters = query.trim() !== '' || filter !== 'all';
  const firstShown = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(page * PAGE_SIZE, filtered.length);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-bracket">&lt; / &gt;</div>
        <p className="eyebrow">Loading submissions...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <Link href="/admin" className="btn-text">← Admin console</Link>

      <h1 style={{ marginTop: '12px' }}>Review submissions</h1>
      <p className="subtitle">
        Every team, both submission stages — 20 teams per page. The search box always covers
        all teams, not just the page you are on. Click a team to open its details, links and rubric.
      </p>

      {error && <div className="auth-error-banner" style={{ marginBottom: '16px' }}><p>{error}</p></div>}

      {/* Summary tiles */}
      <div className="dash-grid" style={{ marginBottom: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="dash-card"><h3>{stats.total}</h3><p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Teams</p></div>
        <div className="dash-card"><h3>{stats.aimDone}</h3><p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Aim submissions</p></div>
        <div className="dash-card"><h3>{stats.finalDone}</h3><p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Final submissions</p></div>
        <div className="dash-card"><h3>{stats.pendingReview}</h3><p style={{ fontSize: '13px', color: 'var(--color-warning)' }}>Awaiting review</p></div>
      </div>

      {/* Toolbar */}
      <div className="teams-toolbar" style={{ marginBottom: '18px' }}>
        <div className="input-shell teams-search">
          <input
            className="form-input"
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search all teams by name, code, domain or problem..."
            aria-label="Search teams"
          />
        </div>
        <div className="teams-toolbar-right">
          <label className="teams-sort">
            <span>Show</span>
            <select value={filter} onChange={e => setFilter(e.target.value as RowFilter)} aria-label="Filter teams">
              {(Object.keys(FILTER_LABELS) as RowFilter[]).map(key => (
                <option key={key} value={key}>{FILTER_LABELS[key]}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {config?.aim_deadline && (
        <p className="teams-result-count" style={{ display: 'block', marginBottom: '14px' }}>
          Aim deadline {new Date(config.aim_deadline).toLocaleString()}
          {config?.final_deadline ? ` · Final deadline ${new Date(config.final_deadline).toLocaleString()}` : ''}
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">&lt; / &gt;</div>
          <h3>No teams match</h3>
          <p>Try a different search term or filter.</p>
        </div>
      ) : (
        <div ref={listingRef} className="teams-listing">
          <p className="teams-result-count" aria-live="polite" style={{ display: 'block', marginBottom: '14px' }}>
            {`Showing ${firstShown}–${lastShown} of ${filtered.length} team${filtered.length === 1 ? '' : 's'}`}
            {hasFilters ? ` (filtered from ${teams.length})` : ''}
            {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}
          </p>

          <div className="dash-card" style={{ overflowX: 'auto' }}>
            <table className="review-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Domain</th>
                  <th>Problem</th>
                  <th>Aim · round 1</th>
                  <th>Final · round 2</th>
                </tr>
              </thead>
              <tbody>
                {pageTeams.map(t => {
                  const aim = submissionFor(submissions, t.id, 'AIM');
                  const final = submissionFor(submissions, t.id, 'FINAL');
                  return (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/admin/review/${t.id}`} className="review-team-link">
                          {t.name}
                        </Link>
                        <span className="review-sub">
                          {t.team_code ?? '—'} · {t.member_count} member{t.member_count === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td>{t.domain?.name ?? <span className="text-muted">—</span>}</td>
                      <td className="review-problem">{t.problem_statement?.title ?? <span className="text-muted">—</span>}</td>
                      <td>
                        {aim ? <StatusBadge status={aim.status as Parameters<typeof StatusBadge>[0]['status']} /> : <span className="text-muted">Not started</span>}
                        {aim?.submitted_at && <span className="review-sub">{new Date(aim.submitted_at).toLocaleDateString()}</span>}
                        {aim && aim.score !== null && (
                          <span className="review-score">
                            {aim.score} / {rubricMaxTotal(RUBRICS.AIM)}
                          </span>
                        )}
                      </td>
                      <td>
                        {final ? <StatusBadge status={final.status as Parameters<typeof StatusBadge>[0]['status']} /> : <span className="text-muted">Not started</span>}
                        {final?.submitted_at && <span className="review-sub">{new Date(final.submitted_at).toLocaleDateString()}</span>}
                        {final && final.score !== null && (
                          <span className="review-score">
                            {final.score} / {rubricMaxTotal(RUBRICS.FINAL)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onChange={setPage}
            ariaLabel="Review teams pagination"
          />
        </div>
      )}
    </div>
  );
}

export default function AdminReviewPage() {
  return (
    <AdminGuard>
      <ReviewContent />
    </AdminGuard>
  );
}
