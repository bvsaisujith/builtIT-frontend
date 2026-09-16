'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import { supabase } from '@/lib/supabase';
import { CATEGORIES, type Category, type ProblemStatement, type TeamWithDetails } from '@/lib/types';
import { getMyTeam, getProblemStatements } from '@/lib/data';

function ProblemsContent() {
  const router = useRouter();
  const [team, setTeam] = useState<TeamWithDetails | null>(null);
  const [problems, setProblems] = useState<ProblemStatement[]>([]);
  const [filter, setFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [selectedProblem, setSelectedProblem] = useState<ProblemStatement | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selfAuthored, setSelfAuthored] = useState(false);
  const [newProblem, setNewProblem] = useState({ title: '', description: '', category: CATEGORIES[0].name as Category });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const myTeam = await getMyTeam();
      if (!myTeam) { router.push('/team/join'); return; }
      setTeam(myTeam);
      if (myTeam.problem_statement) { router.push('/dashboard'); return; }

      const probs = await getProblemStatements();
      setProblems(probs);
      setLoading(false);
    })();
  }, [router]);

  const filteredProblems = filter === 'All' ? problems : problems.filter(p => p.category === filter);

  const handleSelect = (problem: ProblemStatement) => {
    setSelectedProblem(problem);
    setConfirmOpen(true);
  };

  const confirmSelect = async () => {
    if (!selectedProblem || !team) return;
    setError(null);
    setLoading(true);

    const { error: updateError } = await supabase
      .from('teams')
      .update({ problem_statement_id: selectedProblem.id })
      .eq('id', team.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push('/dashboard');
  };

  const handleSelfAuthored = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!team) return;
    setError(null);
    setLoading(true);

    const { data, error: insertError } = await supabase
      .from('problem_statements')
      .insert({
        team_id: team.id,
        title: newProblem.title,
        description: newProblem.description,
        category: newProblem.category,
        is_open: false,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('teams')
      .update({ problem_statement_id: data.id })
      .eq('id', team.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
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

  return (
    <div className="problems-page">
      <h1>Problem statements</h1>
      <p className="subtitle">Choose a problem to solve, or write your own under one of the 8 categories.</p>

      <div className="category-filter">
        <button
          className={filter === 'All' ? 'filter-chip active' : 'filter-chip'}
          onClick={() => setFilter('All')}
        >All</button>
        {CATEGORIES.map(cat => (
          <button
            key={cat.name}
            className={filter === cat.name ? 'filter-chip active' : 'filter-chip'}
            onClick={() => setFilter(cat.name)}
          >{cat.name}</button>
        ))}
      </div>

      <div className="problem-form">
        <h3>Write your own problem statement</h3>
        <form className="auth-form" onSubmit={handleSelfAuthored}>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              className="form-input"
              type="text"
              value={newProblem.title}
              onChange={e => setNewProblem(prev => ({ ...prev, title: e.target.value }))}
              placeholder="A clear title for your problem"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              value={newProblem.description}
              onChange={e => setNewProblem(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the problem you want to solve..."
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-input"
              value={newProblem.category}
              onChange={e => setNewProblem(prev => ({ ...prev, category: e.target.value as Category }))}
            >
              {CATEGORIES.map(cat => (
                <option key={cat.name} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{ justifyContent: 'center' }}>
            {loading ? 'Saving...' : 'Submit problem statement'}
          </button>
        </form>
      </div>

      <h3 style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '16px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Or pick from curated list
      </h3>

      {filteredProblems.length === 0 ? (
        <div className="empty-state">
          <p>No problem statements in this category yet.</p>
        </div>
      ) : (
        <div className="problem-list">
          {filteredProblems.map(problem => (
            <div key={problem.id} className="problem-card">
              <div className="problem-category">{problem.category}</div>
              <h3>{problem.title}</h3>
              <p>{problem.description}</p>
              <button className="btn-secondary select-btn" onClick={() => handleSelect(problem)}>
                Select this problem
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
              You&apos;re about to lock in: <strong style={{ color: '#fff' }}>{selectedProblem.title}</strong>
              <br /><br />
              This will be your team&apos;s problem statement. You can change it later from the dashboard.
            </p>
            {error && <div className="auth-error-banner">{error}</div>}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={confirmSelect} disabled={loading} style={{ justifyContent: 'center' }}>
                {loading ? 'Confirming...' : 'Confirm'}
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
