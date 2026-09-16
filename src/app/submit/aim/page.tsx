'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import Countdown from '@/components/Countdown';
import FileUpload from '@/components/FileUpload';
import { supabase } from '@/lib/supabase';
import { getMyTeam, getEventConfig } from '@/lib/data';
import type { TeamWithDetails, EventConfig } from '@/lib/types';

function AimSubmitContent() {
  const router = useRouter();
  const [team, setTeam] = useState<TeamWithDetails | null>(null);
  const [config, setConfig] = useState<EventConfig | null>(null);
  const [aimSummary, setAimSummary] = useState('');
  const [file, setFile] = useState<File | null>(null);
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
    if (!file && !team.submissions.aim?.ppt_file_path) { setError('Please upload your PPT file.'); return; }

    setSubmitting(true);
    let filePath = team.submissions.aim?.ppt_file_path ?? null;
    let fileName = team.submissions.aim?.ppt_file_name ?? null;

    if (file) {
      const ext = file.name.split('.').pop();
      const path = `teams/${team.id}/aim-presentation.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(path, file, { upsert: true });
      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`);
        setSubmitting(false);
        return;
      }
      filePath = path;
      fileName = file.name;
    }

    const existing = team.submissions.aim;
    if (existing) {
      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          aim_summary: aimSummary,
          ppt_file_path: filePath,
          ppt_file_name: fileName,
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
          ppt_file_path: filePath,
          ppt_file_name: fileName,
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
      <h1>Submission 1: Aim + PPT</h1>
      <p className="subtitle">Describe your aim and upload your presentation deck.</p>

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
            File: {existing.ppt_file_name ?? file?.name}<br />
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
            <label className="form-label">Presentation (PPT/PPTX)</label>
            <FileUpload
              onFileSelect={setFile}
              accept=".ppt,.pptx"
              currentFileName={existing?.ppt_file_name}
              maxSizeMB={50}
            />
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
            File: {existing.ppt_file_name}
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
