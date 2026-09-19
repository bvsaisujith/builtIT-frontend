'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import { getTeamsDirectory, type TeamDirectoryRow } from '@/lib/data';

function TeamsDirectoryContent() {
  const [teams, setTeams] = useState<TeamDirectoryRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setTeams(await getTeamsDirectory());
      setLoading(false);
    })();
  }, []);

  const filtered = teams.filter(t => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.team_code ?? '').toLowerCase().includes(q) ||
      (t.domain_name ?? '').toLowerCase().includes(q) ||
      (t.problem_title ?? '').toLowerCase().includes(q) ||
      (t.leader_name ?? '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-bracket">&lt; / &gt;</div>
        <p className="eyebrow">Loading teams...</p>
      </div>
    );
  }

  return (
    <div className="teams-directory-page">
      <h1>Teams</h1>
      <p className="subtitle">
        {teams.length} team{teams.length === 1 ? '' : 's'} competing this year. Click a team to see its members and problem statement.
      </p>

      <div className="form-group" style={{ maxWidth: '420px', marginBottom: '28px' }}>
        <input
          className="form-input"
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name, code, domain or leader..."
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">&lt; / &gt;</div>
          <h3>{query ? 'No teams match your search' : 'No teams yet'}</h3>
          <p>{query ? 'Try a different search term.' : 'Be the first — create a team from your dashboard.'}</p>
        </div>
      ) : (
        <div className="directory-grid">
          {filtered.map(team => (
            <Link key={team.id} href={`/team/${team.id}`} className="team-card">
              <div className="team-card-header">
                <h3>{team.name}</h3>
                {team.team_code && (
                  <span className="team-code-chip" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {team.team_code}
                  </span>
                )}
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
