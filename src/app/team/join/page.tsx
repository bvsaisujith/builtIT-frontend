'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '@/components/AuthGuard';
import { supabase } from '@/lib/supabase';
import { CATEGORIES, type Category } from '@/lib/types';
import { getMyTeam, getTeamCode } from '@/lib/data';

function TeamJoinContent() {
  const router = useRouter();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [teamName, setTeamName] = useState('');
  const [category, setCategory] = useState<Category>(CATEGORIES[0].name);
  const [teamCode, setTeamCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const team = await getMyTeam();
      if (team) router.push('/dashboard');
    })();
  }, [router]);

  const handleCreate = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Not authenticated'); setLoading(false); return; }

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({ name: teamName, category, leader_id: user.id })
      .select()
      .single();

    if (teamError) {
      setError(teamError.message);
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase
      .from('team_memberships')
      .insert({ team_id: team.id, user_id: user.id });

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push('/dashboard');
  };

  const handleJoin = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Not authenticated'); setLoading(false); return; }

    const { data: teams, error: findError } = await supabase
      .from('teams')
      .select('id, is_locked')
      .ilike('id', `${teamCode.toLowerCase()}%`)
      .limit(1);

    if (findError || !teams || teams.length === 0) {
      setError('Invalid team code.');
      setLoading(false);
      return;
    }

    const team = teams[0];
    if (team.is_locked) {
      setError('This team is locked and cannot accept new members.');
      setLoading(false);
      return;
    }

    const { count } = await supabase
      .from('team_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', team.id);

    if (count !== null && count >= 3) {
      setError('This team is full (3 members max).');
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase
      .from('team_memberships')
      .insert({ team_id: team.id, user_id: user.id });

    if (memberError) {
      setError(memberError.message.includes('unique') ? 'You are already on a team.' : memberError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push('/dashboard');
  };

  return (
    <div className="team-page">
      <h1>Form your team</h1>
      <p className="subtitle">Create a new team or join an existing one with a team code.</p>

      <div className="team-options">
        <div className="team-option-card">
          <h3>Create a team</h3>
          <p className="option-desc">Start a new team and become the team leader.</p>
          <form className="team-option-form" onSubmit={handleCreate}>
            <div className="form-group">
              <label className="form-label">Team name</label>
              <input
                className="form-input"
                type="text"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                placeholder="The Innovators"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select
                className="form-input"
                value={category}
                onChange={e => setCategory(e.target.value as Category)}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.name} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary" disabled={loading} style={{ justifyContent: 'center' }}>
              {loading ? 'Creating...' : 'Create team'}
            </button>
          </form>
        </div>

        <div className="team-option-card">
          <h3>Join a team</h3>
          <p className="option-desc">Have a team code? Enter it below to join.</p>
          <form className="team-option-form" onSubmit={handleJoin}>
            <div className="form-group">
              <label className="form-label">Team code</label>
              <input
                className="form-input"
                type="text"
                value={teamCode}
                onChange={e => setTeamCode(e.target.value)}
                placeholder="ABCD1234"
                style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' }}
                required
              />
              <span className="form-hint">Ask your team leader for the 8-character code.</span>
            </div>
            <button type="submit" className="btn-secondary" disabled={loading} style={{ justifyContent: 'center' }}>
              {loading ? 'Joining...' : 'Join team'}
            </button>
          </form>
        </div>
      </div>

      {error && <div className="auth-error-banner" style={{ marginTop: '24px' }}>{error}</div>}
    </div>
  );
}

export default function TeamJoinPage() {
  return (
    <AuthGuard>
      <TeamJoinContent />
    </AuthGuard>
  );
}
