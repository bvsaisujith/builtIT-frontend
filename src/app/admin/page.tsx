'use client';

import { useState, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import AdminGuard from '@/components/AdminGuard';
import {
  fetchAdminOverview,
  saveEventConfig,
  createDomain,
  setDomainActive,
  createProblemStatement,
  setProblemActive,
  adminDeleteTeam,
  adminDeleteParticipant,
  fetchAdminWinners,
  saveWinners,
} from '@/lib/admin-client';
import type { AdminTeamRow, AdminParticipantRow } from '@/lib/data';
import type { Domain, ProblemStatement, EventConfig } from '@/lib/types';

function AdminContent() {
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [problems, setProblems] = useState<ProblemStatement[]>([]);
  const [teams, setTeams] = useState<AdminTeamRow[]>([]);
  const [participants, setParticipants] = useState<AdminParticipantRow[]>([]);
  const [aimDeadline, setAimDeadline] = useState('');
  const [finalDeadline, setFinalDeadline] = useState('');
  const [regOpen, setRegOpen] = useState(true);
  const [maxSize, setMaxSize] = useState(4);
  const [newDomain, setNewDomain] = useState({ name: '', slug: '', short_label: '' });
  const [newProblem, setNewProblem] = useState({ title: '', description: '', domain_id: '' });
  const [winners, setWinners] = useState({ first_team_id: '', second_team_id: '', third_team_id: '' });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    const data = await fetchAdminOverview();
    if (!data) {
      setError('Could not load admin data. Check the server configuration.');
      setLoading(false);
      return;
    }
    const cfg = data.config;
    if (cfg) {
      setConfig(cfg);
      setAimDeadline(cfg.aim_deadline ? cfg.aim_deadline.slice(0, 16) : '');
      setFinalDeadline(cfg.final_deadline ? cfg.final_deadline.slice(0, 16) : '');
      setRegOpen(cfg.registration_open);
      setMaxSize(cfg.max_team_size);
    }
    setDomains(data.domains);
    setTeams(data.teams);
    setParticipants(data.participants);
    setProblems(data.problems);
    const savedWinners = await fetchAdminWinners();
    setWinners({
      first_team_id: savedWinners.first_team_id ?? '',
      second_team_id: savedWinners.second_team_id ?? '',
      third_team_id: savedWinners.third_team_id ?? '',
    });
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      await reload();
    })();
  }, []);

  const flash = (msg: string | null, err: string | null) => {
    setOk(msg);
    setError(err);
  };

  const handleDeleteTeam = async (team: AdminTeamRow) => {
    setError(null); setOk(null);
    if (!window.confirm(`Remove team "${team.name}" (${team.team_code ?? 'no code'})? This deletes its members list, join requests and submissions. This cannot be undone.`)) return;
    setBusyId(team.id);
    const { error: err } = await adminDeleteTeam(team.id);
    setBusyId(null);
    flash(err ? null : `Team "${team.name}" removed.`, err);
    if (!err) await reload();
  };

  const handleDeleteParticipant = async (p: AdminParticipantRow) => {
    setError(null); setOk(null);
    if (!window.confirm(`Remove participant "${p.full_name ?? p.email ?? p.id}"? Their account, profile, teams they lead and memberships are deleted permanently. This cannot be undone.`)) return;
    setBusyId(p.id);
    const { error: err } = await adminDeleteParticipant(p.id);
    setBusyId(null);
    flash(err ? null : 'Participant removed.', err);
    if (!err) await reload();
  };

  const handleSaveConfig = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null); setOk(null);
    const { error: err } = await saveEventConfig({
      aim_deadline: aimDeadline ? new Date(aimDeadline).toISOString() : null,
      final_deadline: finalDeadline ? new Date(finalDeadline).toISOString() : null,
      registration_open: regOpen,
      max_team_size: maxSize,
    });
    flash(err ? null : 'Event configuration saved.', err);
    if (!err) await reload();
  };

  const handleCreateDomain = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null); setOk(null);
    const { error: err } = await createDomain({
      name: newDomain.name,
      slug: newDomain.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
      short_label: newDomain.short_label || null,
    });
    flash(err ? null : `Domain "${newDomain.name}" created.`, err);
    if (!err) { setNewDomain({ name: '', slug: '', short_label: '' }); await reload(); }
  };

  const handleCreateProblem = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null); setOk(null);
    if (!newProblem.domain_id) { setError('Choose a domain for the problem.'); return; }
    const { error: err } = await createProblemStatement({
      title: newProblem.title,
      description: newProblem.description,
      domain_id: newProblem.domain_id,
    });
    flash(err ? null : 'Problem statement created.', err);
    if (!err) { setNewProblem({ title: '', description: '', domain_id: '' }); await reload(); }
  };

  const toggleDomain = async (d: Domain) => {
    const { error: err } = await setDomainActive(d.id, !d.is_active);
    if (err) flash(null, err); else await reload();
  };

  const toggleProblem = async (p: ProblemStatement) => {
    const { error: err } = await setProblemActive(p.id, !p.is_active);
    if (err) flash(null, err); else await reload();
  };

  const handleSaveWinners = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null); setOk(null);
    const chosen = [winners.first_team_id, winners.second_team_id, winners.third_team_id].filter(Boolean);
    if (new Set(chosen).size !== chosen.length) {
      setError('Each winner position must be a different team.');
      return;
    }
    const { error: err } = await saveWinners({
      first_team_id: winners.first_team_id || null,
      second_team_id: winners.second_team_id || null,
      third_team_id: winners.third_team_id || null,
    });
    flash(err ? null : 'Winners saved.', err);
    if (!err) await reload();
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-bracket">&lt; / &gt;</div>
        <p className="eyebrow">Loading admin console...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <h1>Admin console</h1>
      <p className="subtitle">Event configuration, domains, problem statements and participants.</p>

      {error && <div className="auth-error-banner" style={{ marginBottom: '16px' }}>{error}</div>}
      {ok && <div className="submit-success" style={{ marginBottom: '16px' }}><p>{ok}</p></div>}

      <div className="dash-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '20px' }}>
        <div className="dash-card"><h3>{teams.length}</h3><p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Teams</p></div>
        <div className="dash-card"><h3>{participants.length}</h3><p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Participants</p></div>
        <div className="dash-card"><h3>{participants.filter(p => p.profile_completed_at).length}</h3><p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Profiles complete</p></div>
      </div>

      <div className="dash-card" style={{ marginBottom: '20px' }}>
        <h3>Event configuration</h3>
        <form className="auth-form" onSubmit={handleSaveConfig}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Aim deadline</label>
              <input className="form-input" type="datetime-local" value={aimDeadline} onChange={e => setAimDeadline(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Final deadline</label>
              <input className="form-input" type="datetime-local" value={finalDeadline} onChange={e => setFinalDeadline(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Max team size</label>
              <input className="form-input" type="number" min={1} max={10} value={maxSize} onChange={e => setMaxSize(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label className="form-label">Registration</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                <input type="checkbox" checked={regOpen} onChange={e => setRegOpen(e.target.checked)} />
                {regOpen ? 'Open' : 'Closed'}
              </label>
            </div>
          </div>
          <button type="submit" className="btn-primary" style={{ justifyContent: 'center' }}>Save configuration</button>
        </form>
      </div>

      <div className="dash-grid">
        <div className="dash-card">
          <h3>Domains</h3>
          <div className="member-list">
            {domains.map(d => (
              <div key={d.id} className="member-item" style={{ justifyContent: 'space-between' }}>
                <span className="member-name">{d.name} <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>({d.slug})</span></span>
                <button className={d.is_active ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'} onClick={() => toggleDomain(d)}>
                  {d.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            ))}
          </div>
          <form className="auth-form" onSubmit={handleCreateDomain} style={{ marginTop: '16px' }}>
            <div className="form-group">
              <label className="form-label">New domain name</label>
              <input className="form-input" type="text" value={newDomain.name} onChange={e => setNewDomain(p => ({ ...p, name: e.target.value }))} placeholder="Blockchain" required />
            </div>
            <div className="form-group">
              <label className="form-label">Short label (optional)</label>
              <input className="form-input" type="text" value={newDomain.short_label} onChange={e => setNewDomain(p => ({ ...p, short_label: e.target.value }))} placeholder="CHAIN" />
            </div>
            <button type="submit" className="btn-secondary btn-sm" style={{ justifyContent: 'center' }}>Add domain</button>
          </form>
        </div>

        <div className="dash-card">
          <h3>Problem statements</h3>
          <div className="member-list" style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {problems.map(p => (
              <div key={p.id} className="member-item" style={{ justifyContent: 'space-between' }}>
                <span className="member-name" style={{ fontSize: '13px' }}>
                  {p.title}
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block' }}>
                    {domains.find(d => d.id === p.domain_id)?.name ?? '—'}{p.team_id ? ' · team-authored' : ''}
                  </span>
                </span>
                <button className={p.is_active ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'} onClick={() => toggleProblem(p)}>
                  {p.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            ))}
          </div>
          <form className="auth-form" onSubmit={handleCreateProblem} style={{ marginTop: '16px' }}>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" type="text" value={newProblem.title} onChange={e => setNewProblem(p => ({ ...p, title: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={newProblem.description} onChange={e => setNewProblem(p => ({ ...p, description: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Domain</label>
              <select className="form-input" value={newProblem.domain_id} onChange={e => setNewProblem(p => ({ ...p, domain_id: e.target.value }))} required>
                <option value="">Select domain…</option>
                {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <button type="submit" className="btn-secondary btn-sm" style={{ justifyContent: 'center' }}>Add problem</button>
          </form>
        </div>
      </div>

      <div className="dash-card" style={{ marginTop: '20px' }}>
        <h3>Winners</h3>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '-4px' }}>
          Pick the podium for the <Link href="/winners">winners page</Link>. Leave a position empty to hide it.
        </p>
        <form className="auth-form" onSubmit={handleSaveWinners}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">🥇 1st place</label>
              <select
                className="form-input"
                value={winners.first_team_id}
                onChange={e => setWinners(p => ({ ...p, first_team_id: e.target.value }))}
              >
                <option value="">Not announced</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.team_code ?? 'no code'})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">🥈 2nd place</label>
              <select
                className="form-input"
                value={winners.second_team_id}
                onChange={e => setWinners(p => ({ ...p, second_team_id: e.target.value }))}
              >
                <option value="">Not announced</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.team_code ?? 'no code'})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">🥉 3rd place</label>
              <select
                className="form-input"
                value={winners.third_team_id}
                onChange={e => setWinners(p => ({ ...p, third_team_id: e.target.value }))}
              >
                <option value="">Not announced</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.team_code ?? 'no code'})</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="btn-secondary btn-sm" style={{ justifyContent: 'center' }}>Save winners</button>
        </form>
      </div>

      <div className="dash-card" style={{ marginTop: '20px' }}>
        <div className="team-card-header">
          <h3>Teams</h3>
          <Link
            href="/admin/review"
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '12px' }}
          >
            Review submissions →
          </Link>
        </div>
        {teams.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>No teams yet.</p>
        ) : (
          <div className="member-list">
            {teams.map(t => (
              <div key={t.id} className="member-item" style={{ justifyContent: 'space-between' }}>
                <span className="member-name">
                  {t.name}
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block', fontFamily: "'JetBrains Mono', monospace" }}>
                    {t.team_code ?? '—'} · {t.member_count} members · {t.domain?.name ?? 'no domain'}
                    {t.problem_statement ? ` · ${t.problem_statement.title}` : ''}
                  </span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="value" style={{ fontSize: '11px' }}>{t.is_locked ? 'Locked' : 'Open'}</span>
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={busyId === t.id}
                    onClick={() => handleDeleteTeam(t)}
                  >
                    {busyId === t.id ? 'Removing…' : 'Remove'}
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dash-card" style={{ marginTop: '20px' }}>
        <h3>Participants</h3>
        <div className="member-list" style={{ maxHeight: '320px', overflowY: 'auto' }}>
          {participants.map(p => (
            <div key={p.id} className="member-item" style={{ justifyContent: 'space-between' }}>
              <span className="member-name" style={{ fontSize: '13px' }}>
                {p.full_name ?? 'Unnamed'}
                <span style={{ color: 'var(--color-text-muted)', fontSize: '11px', display: 'block' }}>
                  {[p.email, p.roll_number ? `Roll ${p.roll_number}` : null, p.year ? `${p.year} Sec ${p.section ?? '—'}` : null].filter(Boolean).join(' · ') || '—'}
                </span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '11px', color: p.role === 'admin' ? 'var(--color-accent-secondary)' : 'var(--color-text-muted)' }}>
                  {p.role}{p.profile_completed_at ? '' : ' · incomplete'}
                </span>
                {p.role === 'admin' ? null : (
                  <button
                    type="button"
                    className="btn-danger"
                    disabled={busyId === p.id}
                    onClick={() => handleDeleteParticipant(p)}
                  >
                    {busyId === p.id ? 'Removing…' : 'Remove'}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Link href="/dashboard" className="btn-text" style={{ marginTop: '24px' }}>← Dashboard</Link>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminGuard>
      <AdminContent />
    </AdminGuard>
  );
}
