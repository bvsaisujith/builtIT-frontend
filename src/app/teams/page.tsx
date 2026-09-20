'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import { getTeamsDirectory, type TeamDirectoryRow } from '@/lib/data';

type SortKey = 'name' | 'members' | 'newest';

const SORT_KEYS = ['name', 'members', 'newest'] as const;

const SORT_LABELS: Record<SortKey, string> = {
  name: 'A → Z',
  members: 'Most members',
  newest: 'Newest',
};

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.2" y2="16.2" />
    </svg>
  );
}

function TeamsDirectoryContent() {
  const [teams, setTeams] = useState<TeamDirectoryRow[]>([]);
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('name');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await getTeamsDirectory();
      if (!cancelled) {
        setTeams(rows);
        setLoading(false);
      }
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
        return rows.sort((a, b) => b.member_count - a.member_count || a.name.localeCompare(b.name));
      case 'newest':
        return rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      default:
        return rows.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [teams, query, domain, sort]);

  const hasFilters = query.trim() !== '' || domain !== null;
  const clearFilters = () => {
    setQuery('');
    setDomain(null);
  };
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
            {filtered.length}/{teams.length} shown
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
        <div className="directory-grid" data-reveal data-reveal-stagger>
          {filtered.map((team, i) => (
            <Link key={team.id} href={`/team/${team.id}`} className="team-card">
              <div className="team-card-top">
                <span className="team-card-index" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
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
          ))}
        </div>
      )}
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
