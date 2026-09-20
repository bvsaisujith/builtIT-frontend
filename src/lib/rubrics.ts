// ---------------------------------------------------------------------------
// Judging rubrics for the two review rounds
// ---------------------------------------------------------------------------
// Single source of truth: the admin review screen and the API route that
// persists an evaluation both read from here, so the criterion keys, labels and
// maximum points can never drift apart.
//
//   Round 1 -> the AIM submission (stage 'AIM')
//   Round 2 -> the FINAL submission (stage 'FINAL')
//
// Both rubrics total 100 points. The stored breakdown lives in
// submissions.criteria_scores (jsonb) keyed by `key` below, and the round total
// in submissions.score - see supabase/migrations/..._013_review_scores.sql.
// ---------------------------------------------------------------------------

import type { SubmissionStage } from './types';

export type ReviewRound = 'ROUND_1' | 'ROUND_2';

export interface RubricCriterion {
  /** Stable key used in submissions.criteria_scores. */
  key: string;
  /** Human label shown in the review screen. */
  label: string;
  /** Maximum points this criterion can earn. */
  max: number;
}

export interface Rubric {
  round: ReviewRound;
  stage: SubmissionStage;
  title: string;
  subtitle: string;
  criteria: RubricCriterion[];
}

export const ROUND_1_RUBRIC: Rubric = {
  round: 'ROUND_1',
  stage: 'AIM',
  title: 'Round 1 evaluation',
  subtitle: 'Aim + presentation deck',
  criteria: [
    { key: 'problem_understanding', label: 'Problem Understanding', max: 25 },
    { key: 'innovation_creativity', label: 'Innovation & Creativity', max: 25 },
    { key: 'real_world_impact', label: 'Real-World Impact', max: 25 },
    { key: 'presentation_ppt', label: 'Presentation & PPT', max: 15 },
    { key: 'feasibility', label: 'Feasibility of the Idea', max: 10 },
  ],
};

export const ROUND_2_RUBRIC: Rubric = {
  round: 'ROUND_2',
  stage: 'FINAL',
  title: 'Round 2 evaluation',
  subtitle: 'Final submission + demo',
  criteria: [
    { key: 'problem_understanding', label: 'Problem Understanding', max: 10 },
    { key: 'innovation_creativity', label: 'Innovation & Creativity', max: 15 },
    { key: 'implementation', label: 'Implementation', max: 15 },
    { key: 'technical_implementation', label: 'Technical Implementation', max: 10 },
    { key: 'real_world_impact', label: 'Real-World Impact', max: 15 },
    { key: 'ui_ux', label: 'UI/UX', max: 10 },
    { key: 'working_prototype', label: 'Working Prototype', max: 15 },
    { key: 'final_presentation', label: 'Final Presentation & Demo', max: 10 },
  ],
};

export const RUBRICS: Record<SubmissionStage, Rubric> = {
  AIM: ROUND_1_RUBRIC,
  FINAL: ROUND_2_RUBRIC,
};

/** Points per criterion key. Missing keys simply have not been scored yet. */
export type CriterionScores = Record<string, number>;

export function rubricForStage(stage: SubmissionStage): Rubric {
  return RUBRICS[stage];
}

export function rubricMaxTotal(rubric: Rubric): number {
  return rubric.criteria.reduce((sum, c) => sum + c.max, 0);
}

/**
 * Clamp one criterion value into 0..max. Returns null when the value is not a
 * usable number, so callers can distinguish "not scored" from a real zero.
 */
export function clampCriterion(rubric: Rubric, key: string, value: unknown): number | null {
  const criterion = rubric.criteria.find(c => c.key === key);
  if (!criterion) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(Math.max(Math.trunc(parsed), 0), criterion.max);
}

/**
 * Normalise an untrusted criteria payload into a clean map: unknown keys are
 * dropped and every value is clamped to its criterion maximum.
 */
export function normaliseCriterionScores(
  rubric: Rubric,
  raw: unknown,
): CriterionScores {
  if (!raw || typeof raw !== 'object') return {};
  const input = raw as Record<string, unknown>;
  const out: CriterionScores = {};
  for (const criterion of rubric.criteria) {
    const value = clampCriterion(rubric, criterion.key, input[criterion.key]);
    if (value !== null) out[criterion.key] = value;
  }
  return out;
}

/** Sum of the given scores (already clamped), or 0 when nothing is scored. */
export function criterionTotal(rubric: Rubric, scores: CriterionScores | null | undefined): number {
  if (!scores) return 0;
  return rubric.criteria.reduce((sum, c) => {
    const value = clampCriterion(rubric, c.key, scores[c.key]);
    return value === null ? sum : sum + value;
  }, 0);
}

/** How many criteria still have no value - drives the "incomplete" badge. */
export function unscoredCount(rubric: Rubric, scores: CriterionScores | null | undefined): number {
  if (!scores) return rubric.criteria.length;
  return rubric.criteria.filter(c => clampCriterion(rubric, c.key, scores[c.key]) === null).length;
}
