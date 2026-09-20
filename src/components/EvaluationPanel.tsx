'use client';

import { useEffect, useMemo, useState } from 'react';
import StatusBadge from '@/components/StatusBadge';
import {
  clampCriterion,
  criterionTotal,
  rubricMaxTotal,
  unscoredCount,
  type CriterionScores,
  type Rubric,
} from '@/lib/rubrics';
import {
  saveEvaluation,
  type AdminSubmissionRow,
  type ReviewDecision,
  type SavedEvaluation,
} from '@/lib/admin-client';

// Raw text per criterion while editing: '' means "not scored yet".
type ScoreDraft = Record<string, string>;

function seedDraft(rubric: Rubric, stored: CriterionScores | null | undefined): ScoreDraft {
  const draft: ScoreDraft = {};
  for (const criterion of rubric.criteria) {
    const value = stored?.[criterion.key];
    draft[criterion.key] = typeof value === 'number' ? String(value) : '';
  }
  return draft;
}

/** Draft text -> clamped numbers, dropping criteria left blank. */
function toNumbers(rubric: Rubric, draft: ScoreDraft): CriterionScores {
  const out: CriterionScores = {};
  for (const criterion of rubric.criteria) {
    const raw = draft[criterion.key];
    if (raw === undefined || raw.trim() === '') continue;
    const value = clampCriterion(rubric, criterion.key, raw);
    if (value !== null) out[criterion.key] = value;
  }
  return out;
}

interface EvaluationPanelProps {
  rubric: Rubric;
  /** The team's submission for this stage; undefined when nothing was submitted. */
  submission: AdminSubmissionRow | undefined;
  /** Transient confirmation text shown inside this panel. */
  flash: string | null;
  onSaved: (saved: SavedEvaluation) => void;
}

export default function EvaluationPanel({ rubric, submission, flash, onSaved }: EvaluationPanelProps) {
  const [draft, setDraft] = useState<ScoreDraft>({});
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Seed the editor from the stored evaluation. Local edits never touch the
  // props, so this only re-runs after a fetch or a successful save.
  useEffect(() => {
    setDraft(seedDraft(rubric, submission?.criteria_scores ?? null));
    setFeedback(submission?.feedback ?? '');
    setError(null);
  }, [rubric, submission?.id, submission?.criteria_scores, submission?.feedback]);

  const numbers = useMemo(() => toNumbers(rubric, draft), [rubric, draft]);
  const maxTotal = rubricMaxTotal(rubric);
  const total = criterionTotal(rubric, numbers);
  const missing = unscoredCount(rubric, numbers);
  const scored = Object.keys(numbers).length > 0;

  const handleScore = (key: string, raw: string) => {
    // Digits only while typing; the value is clamped on blur and again on save.
    setDraft(prev => ({ ...prev, [key]: raw.replace(/[^\d]/g, '').slice(0, 3) }));
  };

  const snapScore = (key: string) => {
    const value = clampCriterion(rubric, key, draft[key]);
    setDraft(prev => ({ ...prev, [key]: value === null ? '' : String(value) }));
  };

  const persist = async (decision?: ReviewDecision) => {
    if (!submission) return;
    setError(null);
    setBusy(decision ?? 'save');

    const { error: saveError, submission: saved } = await saveEvaluation({
      submissionId: submission.id,
      criteria: numbers,
      feedback,
      status: decision,
    });

    setBusy(null);
    if (saveError) {
      // The judging columns arrive with migration 013; make that explicit
      // instead of surfacing a bare Postgres "column does not exist".
      setError(
        /criteria_scores|reviewed_|does not exist/i.test(saveError)
          ? `${saveError} — check that supabase/migrations/20260920030000_013_review_scores.sql has been applied.`
          : saveError,
      );
      return;
    }
    if (saved) onSaved(saved);
  };

  const disabled = !submission || busy !== null;

  return (
    <div className="dash-card">
      <div className="team-card-header">
        <div>
          <h3>{rubric.title}</h3>
          <span className="review-sub" style={{ marginTop: 0 }}>
            {rubric.subtitle} · {rubric.criteria.length} criteria · {maxTotal} points
          </span>
        </div>
        {submission ? (
          <StatusBadge status={submission.status as Parameters<typeof StatusBadge>[0]['status']} />
        ) : (
          <span className="status-badge status-NOT_SUBMITTED"><span className="dot" />Not submitted</span>
        )}
      </div>

      {!submission && (
        <p className="form-hint" style={{ marginBottom: '14px' }}>
          This team has not made this submission yet, so there is nothing to score. The rubric is shown for reference.
        </p>
      )}

      <div className="rubric">
        {rubric.criteria.map(criterion => {
          const raw = draft[criterion.key] ?? '';
          const clamped = clampCriterion(rubric, criterion.key, raw);
          const over = raw !== '' && clamped !== Number(raw);
          return (
            <div key={criterion.key} className="rubric-row">
              <div className="rubric-label">
                <label htmlFor={`${rubric.round}-${criterion.key}`}>{criterion.label}</label>
                {over && <span className="rubric-over">max {criterion.max}</span>}
              </div>
              <span className="rubric-max">/ {criterion.max}</span>
              <input
                id={`${rubric.round}-${criterion.key}`}
                className="form-input rubric-input"
                type="number"
                min={0}
                max={criterion.max}
                inputMode="numeric"
                value={raw}
                onChange={e => handleScore(criterion.key, e.target.value)}
                onBlur={() => snapScore(criterion.key)}
                placeholder="—"
                disabled={disabled}
              />
            </div>
          );
        })}
      </div>

      <div className="rubric-total">
        <span className="sub-detail-label" style={{ marginBottom: 0 }}>Round total</span>
        <strong className={scored ? 'rubric-total-value' : 'rubric-total-value rubric-total-empty'}>
          {total}
        </strong>
        <span className="rubric-total-max">/ {maxTotal}</span>
        {missing > 0 && (
          <span className="form-hint" style={{ marginLeft: 'auto' }}>
            {missing} criterion{missing === 1 ? '' : 'a'} left unscored
          </span>
        )}
      </div>

      <div className="form-group" style={{ marginTop: '16px' }}>
        <label className="form-label" htmlFor={`${rubric.round}-feedback`}>Feedback for the team</label>
        <textarea
          id={`${rubric.round}-feedback`}
          className="form-textarea"
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          placeholder="What worked, what to improve before the next round..."
          style={{ minHeight: '90px' }}
          maxLength={4000}
          disabled={disabled}
        />
      </div>

      {error && <div className="auth-error-banner" style={{ marginTop: '14px' }}><p>{error}</p></div>}
      {flash && !error && (
        <div className="submit-success" style={{ marginTop: '14px', marginBottom: 0, padding: '12px 16px' }}>
          <p>{flash}</p>
        </div>
      )}

      {submission?.reviewed_at && (
        <p className="form-hint" style={{ marginTop: '10px' }}>
          Last scored {new Date(submission.reviewed_at).toLocaleString()}
          {submission.reviewed_by ? ` by ${submission.reviewed_by}` : ''}
        </p>
      )}

      <div className="rubric-actions">
        <button type="button" className="btn-primary" onClick={() => persist()} disabled={disabled}>
          {busy === 'save' ? 'Saving...' : 'Save evaluation'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => persist('UNDER_REVIEW')}
          disabled={disabled}
        >
          {busy === 'UNDER_REVIEW' ? '...' : 'Under review'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => persist('ACCEPTED')}
          disabled={disabled}
        >
          {busy === 'ACCEPTED' ? '...' : 'Accept'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => persist('REJECTED')}
          disabled={disabled}
        >
          {busy === 'REJECTED' ? '...' : 'Reject'}
        </button>
      </div>

      <p className="form-hint" style={{ marginTop: '12px' }}>
        Points and feedback are for organizers only. The decision buttons save the current scores and feedback first.
      </p>
    </div>
  );
}
