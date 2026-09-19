'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import Countdown from '@/components/Countdown';
import { supabase } from '@/lib/supabase';
import { getMyTeam, getEventConfig } from '@/lib/data';
import type { TeamWithDetails, EventConfig } from '@/lib/types';

function FinalSubmitContent() {
  const router = useRouter();
  const [team, setTeam] = useState<TeamWithDetails | null>(null);
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [deployedUrl, setDeployedUrl] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [demoVideoUrl, setDemoVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [blocked, setBlocked] = useState<'no-team' | 'no-aim' | null>(null);

  useEffect(() => {
    (async () => {
      const myTeam = await getMyTeam();
      if (!myTeam) { setBlocked('no-team'); setLoading(false); return; }

      setTeam(myTeam);
      const cfg = await getEventConfig();
      setConfig(cfg);

      if (!myTeam.submissions.aim) { setBlocked('no-aim'); setLoading(false); return; }

      if (myTeam.submissions.final) {
        setDeployedUrl(myTeam.submissions.final.deployed_url ?? '');
        setRepoUrl(myTeam.submissions.final.repo_url ?? '');
        setDemoVideoUrl(myTeam.submissions.final.demo_video_url ?? '');
      }
      setLoading(false);
    })();
  }, [router]);

  const deadlinePassed = config?.final_deadline
    ? new Date(config.final_deadline).getTime() < Date.now()
    : false;

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!team) return;
    setError(null);
    if (!deployedUrl.trim()) { setError('Deployed app URL is required.'); return; }
    if (!repoUrl.trim()) { setError('Repository URL is required.'); return; }

    setSubmitting(true);
    const existing = team.submissions.final;

    if (existing) {
      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          deployed_url: deployedUrl,
          repo_url: repoUrl,
          demo_video_url: demoVideoUrl || null,
          status: 'SUBMITTED',
          submitted_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (updateError) setError(updateError.message);
    } else {
      const { error: insertError } = await supabase
        .from('submissions')
        .insert({
          team_id: team.id,
          stage: 'FINAL',
          deployed_url: deployedUrl,
          repo_url: repoUrl,
          demo_video_url: demoVideoUrl || null,
          status: 'SUBMITTED',
          submitted_at: new Date().toISOString(),
        });
      if (insertError) setError(insertError.message);
    }

    setSubmitting(false);
    if (!error) setSuccess(true);
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-bracket">&lt; / &gt;</div>
        <p className="eyebrow">Loading...</p>
      </div>
    );
  }

  if (blocked === 'no-team') {
    return (
      <div className="submit-page">
        <Link href="/dashboard" className="btn-text" style={{ marginBottom: '16px' }}>← Dashboard</Link>
        <h1>Submission 2: Final Deploy</h1>
        <div className="empty-state">
          <div className="empty-icon">&lt; / &gt;</div>
          <h3>You need a team first</h3>
          <p>Final submissions are made per team. Create or join a team, then come back here.</p>
          <Link href="/team/join" className="btn-primary btn-sm" style={{ marginTop: '14px' }}>
            Set up your team →
          </Link>
        </div>
      </div>
    );
  }

  if (blocked === 'no-aim') {
    return (
      <div className="submit-page">
        <Link href="/dashboard" className="btn-text" style={{ marginBottom: '16px' }}>← Dashboard</Link>
        <h1>Submission 2: Final Deploy</h1>
        <div className="empty-state">
          <div className="empty-icon">1 → 2</div>
          <h3>Submission 1 (Aim + PPT) is required first</h3>
          <p>
            Before submitting your final app, your team must complete Submission 1:
            an aim summary and presentation deck. Once that is submitted, this page unlocks.
          </p>
          <Link href="/submit/aim" className="btn-primary btn-sm" style={{ marginTop: '14px' }}>
            Go to Submission 1 →
          </Link>
        </div>
      </div>
    );
  }

  const existing = team?.submissions.final;

  return (
    <div className="submit-page">
      <Link href="/dashboard" className="btn-text" style={{ marginBottom: '16px' }}>← Dashboard</Link>
      <h1>Submission 2: Final Deployed App</h1>
      <p className="subtitle">Submit your deployed application, repository, and optional demo video.</p>

      {config?.final_deadline && (
        <Countdown deadline={config.final_deadline} label="Final submission deadline" />
      )}

      {deadlinePassed && (
        <div className="auth-error-banner" style={{ marginBottom: '24px' }}>
          The final submission deadline has passed.
        </div>
      )}

      {success && existing && (
        <div className="submit-success">
          <h4>Submitted successfully</h4>
          <p>
            Deployed: {existing.deployed_url}<br />
            Repo: {existing.repo_url}<br />
            Submitted at: {new Date(existing.submitted_at ?? Date.now()).toLocaleString()}
          </p>
        </div>
      )}

      {!deadlinePassed && (
        <form className="submit-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Deployed app URL</label>
            <input
              className="form-input"
              type="url"
              value={deployedUrl}
              onChange={e => setDeployedUrl(e.target.value)}
              placeholder="https://your-app.vercel.app"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Repository URL</label>
            <input
              className="form-input"
              type="url"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              placeholder="https://github.com/your-team/your-project"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Demo video URL <span className="text-muted">(optional)</span></label>
            <input
              className="form-input"
              type="url"
              value={demoVideoUrl}
              onChange={e => setDemoVideoUrl(e.target.value)}
              placeholder="https://youtu.be/..."
            />
          </div>

          {error && <div className="auth-error-banner">{error}</div>}

          <button type="submit" className="btn-primary" disabled={submitting} style={{ justifyContent: 'center' }}>
            {submitting ? 'Submitting...' : existing ? 'Update submission' : 'Submit'}
          </button>
        </form>
      )}

      {deadlinePassed && !existing && (
        <div className="empty-state" style={{ marginTop: '8px' }}>
          <div className="empty-icon">&lt; / &gt;</div>
          <h3>The final submission deadline has passed</h3>
          <p>
            Your team did not have a final submission recorded before the deadline
            ({config?.final_deadline ? new Date(config.final_deadline).toLocaleString() : 'deadline'}).
            Contact the organizers if you believe this is a mistake.
          </p>
          <Link href="/dashboard" className="btn-secondary btn-sm" style={{ marginTop: '14px' }}>
            ← Back to dashboard
          </Link>
        </div>
      )}

      {deadlinePassed && existing && (
        <div className="card">
          <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Your submission</h4>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
            Deployed: <a href={existing.deployed_url ?? '#'} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent-secondary)' }}>{existing.deployed_url}</a>
          </p>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
            Repo: <a href={existing.repo_url ?? '#'} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent-secondary)' }}>{existing.repo_url}</a>
          </p>
          {existing.demo_video_url && (
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              Demo: <a href={existing.demo_video_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent-secondary)' }}>{existing.demo_video_url}</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function FinalSubmitPage() {
  return (
    <AuthGuard>
      <FinalSubmitContent />
    </AuthGuard>
  );
}
