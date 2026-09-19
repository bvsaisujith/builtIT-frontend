'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import CategoryIcon from '@/components/CategoryIcon';
import {
  getMyTeam,
  getActiveDomains,
  getCuratedProblemStatements,
  selectTeamProblem,
  isTeamLeader,
} from '@/lib/data';
import type { Domain, ProblemStatement, TeamWithDetails } from '@/lib/types';

function ProblemsContent() {
  const router = useRouter();
  const [team, setTeam] = useState<TeamWithDetails | null>(null);
  const [leader, setLeader] = useState(false);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [activeDomain, setActiveDomain] = useState<Domain | null>(null);
  const [problems, setProblems] = useState<ProblemStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProblem, setSelectedProblem] = useState<ProblemStatement | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadProblems = useCallback(async (domain: Domain) => {
    setActiveDomain(domain);
    setProblems(await getCuratedProblemStatements(domain.id));
  }, []);

  useEffect(() => {
    (async () => {
      const myTeam = await getMyTeam();
      if (!myTeam) { router.push('/team/join'); return; }
      setTeam(myTeam);
      setLeader(await isTeamLeader(myTeam.id));

      const doms = await getActiveDomains();
      setDomains(doms);
      if (doms.length > 0) await loadProblems(doms[0]);
      setLoading(false);
    })();
  }, [router, loadProblems]);

  const handleSelect = (problem: ProblemStatement) => {
    setSelectedProblem(problem);
    setConfirmOpen(true);
  };

  const confirmSelect = async () => {
    if (!selectedProblem || !team || !activeDomain) return;
    setError(null);
    setSubmitting(true);

    const { error: updateError } = await selectTeamProblem(
      team.id,
      activeDomain.id,
      selectedProblem.id,
    );

    setSubmitting(false);
    if (updateError) {
      setError(updateError);
      return;
    }
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-bracket">&lt; / &gt;</div>
        <p className="eyebrow">Loading...</p>
      </div>
    );
  }

  const isLeader = leader && !team?.is_locked;
  const memberCount = team?.members.length ?? 0;
  const MIN_MEMBERS = 3;
  const needsMoreMembers = isLeader && !team?.problem_statement && memberCount < MIN_MEMBERS;

  return (
    <div className="problems-page">
      <h1>Domains &amp; problem statements</h1>
      <p className="subtitle">
        {isLeader
          ? 'Pick a domain, then choose a problem statement for your team.'
          : 'Only the team leader can select or change the domain and problem statement. You can browse below.'}
      </p>

      {team?.problem_statement && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Current selection</h4>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            <strong style={{ color: '#fff' }}>{team.problem_statement.title}</strong>
            {team.domain && <> · {team.domain.name}</>}
          </p>
        </div>
      )}

      {!isLeader && team?.problem_statement && (
        <div className="waiting-banner" style={{ marginBottom: '24px' }}>
          <span>Your team already has a problem statement. Ask the leader to change it if needed.</span>
        </div>
      )}

      {needsMoreMembers && (
        <div className="waiting-banner" style={{ marginBottom: '24px' }}>
          <span>
            <strong>3 team members are required</strong> before your team can select a problem
            statement. Your team currently has <strong>{memberCount} of {MIN_MEMBERS}</strong> —
            share your team code from the dashboard so teammates can join.
          </span>
        </div>
      )}

      <h3 style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '16px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Step 1 — choose a domain
      </h3>

      <div className="categories-grid">
        {domains.map(domain => (
          <button
            key={domain.id}
            type="button"
            className={activeDomain?.id === domain.id ? 'category-card active' : 'category-card'}
            onClick={() => loadProblems(domain)}
          >
            <CategoryIcon type={domain.icon ?? 'data'} />
            <span className="category-name">{domain.name}</span>
          </button>
        ))}
      </div>

      <h3 style={{ fontSize: '14px', color: 'var(--color-text-muted)', margin: '32px 0 16px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Step 2 — pick a problem in {activeDomain?.name ?? 'the domain'}
      </h3>

      {problems.length === 0 ? (
        <div className="empty-state">
          <p>No active problem statements in this domain yet.</p>
        </div>
      ) : (
        <div className="problem-list">
          {problems.map(problem => (
            <div key={problem.id} className="problem-card">
              <div className="problem-category">{activeDomain?.name}</div>
              <h3>{problem.title}</h3>
              <p>{problem.description}</p>
              <button
                className="btn-secondary select-btn"
                onClick={() => handleSelect(problem)}
                disabled={!isLeader || needsMoreMembers}
              >
                {!isLeader ? 'Leader only' : needsMoreMembers ? 'Need 3 members' : 'Select this problem'}
              </button>
            </div>
          ))}
        </div>
      )}

      {confirmOpen && selectedProblem && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.77)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '24px' }} onClick={() => setConfirmOpen(false)}>
          <div className="auth-card" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>Confirm selection</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', lineHeight: 1.6, marginBottom: '20px' }}>
              Domain: <strong style={{ color: '#fff' }}>{activeDomain?.name}</strong>
              <br />
              Problem: <strong style={{ color: '#fff' }}>{selectedProblem.title}</strong>
              <br /><br />
              This will be your team&apos;s problem statement. You can change it later (while the team is unlocked).
            </p>
            {error && <div className="auth-error-banner">{error}</div>}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={confirmSelect} disabled={submitting} style={{ justifyContent: 'center' }}>
                {submitting ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProblemStatementsPage() {
  return (
    <AuthGuard>
      <ProblemsContent />
    </AuthGuard>
  );
}
