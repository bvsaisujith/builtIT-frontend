'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import Countdown from '@/components/Countdown';
import { supabase } from '@/lib/supabase';
import { getMyTeam, getEventConfig } from '@/lib/data';
import type { TeamWithDetails, EventConfig } from '@/lib/types';

// Only Google Drive links are accepted for the presentation deck.
function isGoogleDriveUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === 'drive.google.com' || host === 'docs.google.com';
  } catch {
    return false;
  }
}

function AimSubmitContent() {
  const router = useRouter();
  const [team, setTeam] = useState<TeamWithDetails | null>(null);
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [aimSummary, setAimSummary] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const myTeam = await getMyTeam();
      if (!myTeam) { router.push('/team/join'); return; }
      setTeam(myTeam);
      const cfg = await getEventConfig();
      setConfig(cfg);
      if (myTeam.submissions.aim) {
        setAimSummary(myTeam.submissions.aim.aim_summary ?? '');
        setDriveUrl(myTeam.submissions.aim.ppt_drive_url ?? '');
      }
      setLoading(false);
    })();
  }, [router]);

  const deadlinePassed = config?.aim_deadline
    ? new Date(config.aim_deadline).getTime() < Date.now()
    : false;

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!team) return;
    setError(null);
    if (!aimSummary.trim()) { setError('Please write your aim summary.'); return; }

    const link = driveUrl.trim();
    if (!link) { setError('Please paste your Google Drive link for the presentation.'); return; }
    if (!isGoogleDriveUrl(link)) {
      setError('The link must be a Google Drive link (drive.google.com or docs.google.com). Make sure sharing is set to "Anyone with the link".');
      return;
    }

    setSubmitting(true);
    const existing = team.submissions.aim;

    if (existing) {
      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          aim_summary: aimSummary,
          ppt_drive_url: link,
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
          stage: 'AIM',
          aim_summary: aimSummary,
          ppt_drive_url: link,
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

  const existing = team?.submissions.aim;

  return (
    <div className="submit-page">
      <Link href="/dashboard" className="btn-text" style={{ marginBottom: '16px' }}>← Dashboard</Link>
      <h1>Submission 1: Aim + Presentation</h1>
      <p className="subtitle">Describe your aim and share your presentation deck via a Google Drive link.</p>

      {config?.aim_deadline && (
        <Countdown deadline={config.aim_deadline} label="Aim submission deadline" />
      )}

      {deadlinePassed && (
        <div className="auth-error-banner" style={{ marginBottom: '24px' }}>
          The submission deadline has passed. You can no longer submit or edit.
        </div>
      )}

      {success && existing && (
        <div className="submit-success">
          <h4>Submitted successfully</h4>
          <p>
            Presentation: <a href={existing.ppt_drive_url ?? driveUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent-secondary)' }}>{existing.ppt_drive_url ?? driveUrl}</a><br />
            Submitted at: {new Date(existing.submitted_at ?? Date.now()).toLocaleString()}
          </p>
        </div>
      )}

      {!deadlinePassed && (
        <form className="submit-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Aim summary</label>
            <textarea
              className="form-textarea"
              value={aimSummary}
              onChange={e => setAimSummary(e.target.value)}
              placeholder="Describe the aim of your project — what problem are you solving and what is your approach?"
              style={{ minHeight: '140px' }}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Presentation (Google Drive link)</label>
            <input
              className="form-input"
              type="url"
              value={driveUrl}
              onChange={e => setDriveUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              required
            />
            <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '6px' }}>
              Upload your PPT to Google Drive and paste the share link here. Set sharing to
              “Anyone with the link” so the organizers can open it.
            </p>
          </div>

          {error && <div className="auth-error-banner">{error}</div>}

          <button type="submit" className="btn-primary" disabled={submitting} style={{ justifyContent: 'center' }}>
            {submitting ? 'Submitting...' : existing ? 'Update submission' : 'Submit'}
          </button>
        </form>
      )}

      {deadlinePassed && existing && (
        <div className="card">
          <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Your submission</h4>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
            {existing.aim_summary}
          </p>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
            Presentation:{' '}
            {existing.ppt_drive_url ? (
              <a href={existing.ppt_drive_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent-secondary)' }}>{existing.ppt_drive_url}</a>
            ) : (
              existing.ppt_file_name ?? '—'
            )}
          </p>
        </div>
      )}
    </div>
  );
}

export default function AimSubmitPage() {
  return (
    <AuthGuard>
      <AimSubmitContent />
    </AuthGuard>
  );
}
