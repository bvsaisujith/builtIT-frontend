'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import { getMyTeamId, getTeamsDirectory, type TeamDirectoryRow } from '@/lib/data';

type SortKey = 'name' | 'members' | 'newest';

const SORT_KEYS = ['name', 'members', 'newest'] as const;

const SORT_LABELS: Record<SortKey, string> = {
  name: 'A → Z',
  members: 'Most members',
  newest: 'Newest',
};

/** Hard cap on the number of teams rendered per page. */
const PAGE_SIZE = 20;

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.2" y2="16.2" />
    </svg>
  );
}

/** Compact pager window — e.g. 1 … 4 [5] 6 … 12 */
function pageWindow(current: number, total: number): (number | 'gap')[] {
  const wanted = new Set<number>([1, total, current - 1, current, current + 1]);
  const pages = [...wanted].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  let prev = 0;
  for (const p of pages) {
    if (prev !== 0 && p - prev > 1) out.push('gap');
    out.push(p);
    prev = p;
  }
  return out;
}

function TeamsDirectoryContent() {
  const [teams, setTeams] = useState<TeamDirectoryRow[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('name');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const listingRef = useRef<HTMLDivElement | null>(null);
  const pageSettled = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Directory rows and the "which team am I on?" lookup resolve together so
      // the very first paint already has the viewer's own team pinned in place.
      const [rows, mine] = await Promise.all([getTeamsDirectory(), getMyTeamId()]);
      if (cancelled) return;
      setTeams(rows);
      setMyTeamId(mine);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const domains = useMemo(
    () =>
      [...new Set(teams.map(t => t.domain_name).filter((d): d is string => Boolean(d)))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [teams]
  );

  const stats = useMemo(
    () => ({
      teams: teams.length,
      members: teams.reduce((sum, t) => sum + t.member_count, 0),
      domains: domains.length,
      problems: teams.filter(t => t.problem_title).length,
    }),
    [teams, domains]
  );

  // Search + domain filtering always run across the whole directory (every
  // page), then the chosen ordering is applied, and finally the viewer's own
  // team is pinned to the front so it is guaranteed to sit on page 1.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = teams.filter(t => {
      if (domain && t.domain_name !== domain) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.team_code ?? '').toLowerCase().includes(q) ||
        (t.domain_name ?? '').toLowerCase().includes(q) ||
        (t.problem_title ?? '').toLowerCase().includes(q) ||
        (t.leader_name ?? '').toLowerCase().includes(q)
      );
    });
    switch (sort) {
      case 'members':
        rows.sort((a, b) => b.member_count - a.member_count || a.name.localeCompare(b.name));
        break;
      case 'newest':
        rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      default:
        rows.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (myTeamId) {
      const mine = rows.findIndex(t => t.id === myTeamId);
      if (mine > 0) rows.unshift(rows.splice(mine, 1)[0]);
    }
    return rows;
  }, [teams, query, domain, sort, myTeamId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageTeams = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const myTeamIndex = filtered.findIndex(t => t.id === myTeamId);
  const myTeamPage = myTeamIndex >= 0 ? Math.floor(myTeamIndex / PAGE_SIZE) + 1 : null;
  const myTeamOnPage = myTeamPage !== null && myTeamPage === page;

  // Any search / filter / sort change restarts the listing at page 1.
  useEffect(() => {
    setPage(1);
  }, [query, domain, sort]);

  // Safety net: never leave the viewer on a page that no longer exists.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Bring the top of the listing back into view whenever the page changes.
  useEffect(() => {
    if (!pageSettled.current) {
      pageSettled.current = true;
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    listingRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }, [page]);

  const hasFilters = query.trim() !== '' || domain !== null;
  const clearFilters = () => {
    setQuery('');
    setDomain(null);
  };

  const goToPage = (next: number) => setPage(Math.min(Math.max(1, next), totalPages));

  /** Jump straight to the viewer's own team, dropping filters if it is hidden. */
  const goToMyTeam = () => {
    if (!myTeamId) return;
    if (myTeamPage !== null) {
      goToPage(myTeamPage);
      return;
    }
    setQuery('');
    setDomain(null);
    setSort('name');
  };

  let mineChipLabel = 'Your team';
  let mineChipTitle = 'Your team is hidden by the current filters — click to reset them';
  if (myTeamOnPage) {
    mineChipLabel = 'Your team · pinned';
    mineChipTitle = 'Your team is pinned to the top of this page';
  } else if (myTeamPage) {
    mineChipLabel = `Your team · page ${myTeamPage}`;
    mineChipTitle = `Your team is on page ${myTeamPage} — click to jump there`;
  }

  const firstShown = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastShown = Math.min(page * PAGE_SIZE, filtered.length);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-bracket">&lt; / &gt;</div>
        <p className="eyebrow">Loading teams...</p>
      </div>
    );
  }

  return (
    <div className="teams-page">
      {/* Hero */}
      <section className="teams-hero" data-reveal>
        <div className="teams-hero-copy">
          <span className="eyebrow">&lt; / &gt; event directory</span>
          <h1>Teams</h1>
          <p className="subtitle">
            Every team competing at Built IT 2K26. Open a team to see its roster, leader and problem statement.
          </p>
        </div>
        <div className="teams-hero-stats" aria-label="Directory stats">
          <div><strong>{stats.teams}</strong><span>Teams</span></div>
          <div><strong>{stats.members}</strong><span>Members</span></div>
          <div><strong>{stats.domains}</strong><span>Domains</span></div>
          <div><strong>{stats.problems}</strong><span>Problems picked</span></div>
        </div>
      </section>

      {/* Search + sort toolbar */}
      <section className="teams-toolbar" data-reveal>
        <div className="input-shell teams-search">
          <span className="input-icon"><SearchIcon /></span>
          <input
            className="form-input has-icon"
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, code, domain, problem or leader..."
            aria-label="Search teams"
          />
          {query && (
            <button type="button" className="input-toggle" onClick={() => setQuery('')}>
              Clear
            </button>
          )}
        </div>
        <div className="teams-toolbar-right">
          {myTeamId && (
            <button
              type="button"
              className={`teams-mine-chip${myTeamOnPage ? ' current' : ''}`}
              onClick={goToMyTeam}
              disabled={myTeamOnPage}
              title={mineChipTitle}
            >
              {mineChipLabel}
            </button>
          )}
          <label className="teams-sort">
            <span>Sort</span>
            <select value={sort} onChange={e => setSort(e.target.value as SortKey)} aria-label="Sort teams">
              {SORT_KEYS.map(key => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <span className="teams-result-count" aria-live="polite">
            {filtered.length === 0
              ? 'No teams shown'
              : `Showing ${firstShown}–${lastShown} of ${filtered.length}${hasFilters ? ` (${teams.length} total)` : ''}`}
          </span>
        </div>
      </section>

      {/* Domain filter chips */}
      {domains.length > 0 && (
        <div className="teams-filters" data-reveal role="group" aria-label="Filter by domain">
          <button
            type="button"
            className={`filter-chip${domain === null ? ' active' : ''}`}
            onClick={() => setDomain(null)}
          >
            All domains
          </button>
          {domains.map(d => (
            <button
              key={d}
              type="button"
              className={`filter-chip${domain === d ? ' active' : ''}`}
              onClick={() => setDomain(domain === d ? null : d)}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {/* Paginated listing — the search/filter state above always applies to the
          full directory, never just the slice currently on screen. */}
      <div className="teams-listing" ref={listingRef}>
        {filtered.length === 0 ? (
          <div className="empty-state teams-empty" data-reveal>
            <div className="empty-icon">&lt; / &gt;</div>
            <h3>{hasFilters ? 'No teams match your filters' : 'No teams yet'}</h3>
            <p>
              {hasFilters
                ? 'Try a different search term or clear the filters.'
                : 'Be the first — create a team from your dashboard.'}
            </p>
            {hasFilters && (
              <button type="button" className="btn-secondary btn-sm" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="directory-grid" data-reveal data-reveal-stagger>
              {pageTeams.map((team, i) => {
                const isMine = team.id === myTeamId;
                return (
                  <Link
                    key={team.id}
                    href={`/team/${team.id}`}
                    className={isMine ? 'team-card is-mine' : 'team-card'}
                  >
                    <div className="team-card-top">
                      <span className="team-card-index" aria-hidden="true">
                        {String((page - 1) * PAGE_SIZE + i + 1).padStart(2, '0')}
                      </span>
                      <h3 className="team-card-name">{team.name}</h3>
                      {team.team_code && <span className="team-code-chip">{team.team_code}</span>}
                      <span className="team-card-arrow" aria-hidden="true">→</span>
                    </div>

                    <div className="team-card-leader">
                      {team.leader_avatar ? (
                        <img src={team.leader_avatar} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="team-card-leader-fallback">&lt; / &gt;</span>
                      )}
                      <div>
                        <span className="team-card-leader-label">Leader</span>
                        <span className="team-card-leader-name">
                          {team.leader_name ?? 'Unknown'}
                          {team.leader_github && <span className="text-muted"> · @{team.leader_github}</span>}
                        </span>
                      </div>
                    </div>

                    <div className="team-card-meta">
                      {isMine && <span className="meta-chip meta-chip-you">Your team</span>}
                      <span className="meta-chip">{team.member_count} member{team.member_count === 1 ? '' : 's'}</span>
                      {team.domain_name && <span className="meta-chip meta-chip-accent">{team.domain_name}</span>}
                      {team.is_locked && <span className="meta-chip meta-chip-muted">Locked</span>}
                    </div>

                    {team.problem_title && (
                      <p className="team-card-problem">
                        <span className="team-card-problem-label">Problem:</span> {team.problem_title}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>

            {totalPages > 1 && (
              <nav className="pagination" aria-label="Teams pagination">
                <button
                  type="button"
                  className="page-btn page-btn-wide"
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                >
                  ← Prev
                </button>

                <div className="page-numbers">
                  {pageWindow(page, totalPages).map((p, i) =>
                    p === 'gap' ? (
                      <span key={`gap-${i}`} className="page-gap" aria-hidden="true">…</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        className={p === page ? 'page-btn active' : 'page-btn'}
                        onClick={() => goToPage(p)}
                        aria-label={`Page ${p}`}
                        aria-current={p === page ? 'page' : undefined}
                      >
                        {p}
                      </button>
                    )
                  )}
                </div>

                <button
                  type="button"
                  className="page-btn page-btn-wide"
                  onClick={() => goToPage(page + 1)}
                  disabled={page === totalPages}
                >
                  Next →
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function TeamsDirectoryPage() {
  return (
    <AuthGuard>
      <TeamsDirectoryContent />
    </AuthGuard>
  );
}
