import { NextResponse, type NextRequest } from 'next/server';
import { badRequest, getAdminSession, readJson, serverError, unauthorized } from '@/lib/admin-api';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import {
  criterionTotal,
  normaliseCriterionScores,
  rubricForStage,
} from '@/lib/rubrics';
import type { SubmissionStage } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// All admin console mutations except event-config (which has its own route).
// Runs with the service role key, so RLS is bypassed; every call re-checks the
// admin session cookie first.
interface ActionsBody {
  action?: string;
  id?: string;
  is_active?: boolean;
  name?: string;
  slug?: string;
  short_label?: string | null;
  title?: string;
  description?: string;
  domain_id?: string;
  // --- judging (save_evaluation) ---
  criteria?: Record<string, number>;
  feedback?: string;
  status?: string;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Statuses an organizer may set from the review screen. 'SUBMITTED' is kept so
// a decision that was recorded by mistake can be reopened.
const REVIEW_DECISIONS = ['SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED'];

const FEEDBACK_MAX = 4000;

export async function POST(request: NextRequest) {
  const session = await getAdminSession(request);
  if (!session) return unauthorized();

  const body = await readJson<ActionsBody>(request);
  if (!body || typeof body.action !== 'string') return badRequest('Invalid request body.');

  try {
    const supabase = createServiceRoleClient();

    switch (body.action) {
      // ---- domains --------------------------------------------------------
      case 'create_domain': {
        const name = (body.name ?? '').trim();
        const slug = (body.slug ?? '').trim();
        if (!name) return badRequest('Domain name is required.');
        if (!SLUG_PATTERN.test(slug)) {
          return badRequest('Slug must be lowercase letters, numbers and dashes.');
        }

        const { data: maxRow } = await supabase
          .from('domains')
          .select('display_order')
          .order('display_order', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { error } = await supabase.from('domains').insert({
          name,
          slug,
          short_label: body.short_label || null,
          display_order: (maxRow?.display_order ?? 0) + 1,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }

      case 'set_domain_active': {
        if (!body.id || typeof body.is_active !== 'boolean') {
          return badRequest('id and is_active are required.');
        }
        const { error } = await supabase
          .from('domains')
          .update({ is_active: body.is_active })
          .eq('id', body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }

      // ---- curated problem statements --------------------------------------
      case 'create_problem': {
        const title = (body.title ?? '').trim();
        const description = (body.description ?? '').trim();
        const domainId = body.domain_id ?? '';
        if (!title || !description) return badRequest('Title and description are required.');
        if (!domainId) return badRequest('A domain is required.');

        const [{ data: maxRow }, { data: domain }] = await Promise.all([
          supabase
            .from('problem_statements')
            .select('display_order')
            .order('display_order', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from('domains').select('name').eq('id', domainId).maybeSingle(),
        ]);

        const { error } = await supabase.from('problem_statements').insert({
          team_id: null,
          title,
          description,
          domain_id: domainId,
          category: domain?.name ?? null,
          display_order: (maxRow?.display_order ?? 0) + 1,
          is_active: true,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }

      case 'set_problem_active': {
        if (!body.id || typeof body.is_active !== 'boolean') {
          return badRequest('id and is_active are required.');
        }
        const { error } = await supabase
          .from('problem_statements')
          .update({ is_active: body.is_active })
          .eq('id', body.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }

      // ---- destructive removals (SECURITY DEFINER RPCs, migration 009/011) --
      case 'delete_team': {
        if (!body.id) return badRequest('Team id is required.');
        const { error } = await supabase.rpc('admin_delete_team', { p_team_id: body.id });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }

      case 'delete_participant': {
        if (!body.id) return badRequest('Participant id is required.');
        const { error } = await supabase.rpc('admin_delete_participant', { p_user_id: body.id });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
      }

      // ---- judging: rubric evaluation for one submission --------------------
      // The submission row matches (team, stage), so the rubric is chosen by the
      // stage: AIM = round 1, FINAL = round 2 (src/lib/rubrics.ts).
      case 'save_evaluation': {
        if (!body.id) return badRequest('Submission id is required.');

        const { data: submission, error: submissionError } = await supabase
          .from('submissions')
          .select('id, stage')
          .eq('id', body.id)
          .maybeSingle();

        if (submissionError) {
          return NextResponse.json({ error: submissionError.message }, { status: 500 });
        }
        if (!submission) return badRequest('Submission not found.');

        const rubric = rubricForStage(submission.stage as SubmissionStage);

        // Only the fields present in the request are written, so a decision
        // button (status only) never wipes points that are already stored.
        const update: Record<string, unknown> = {
          reviewed_at: new Date().toISOString(),
          reviewed_by: session.username,
        };

        if (body.criteria !== undefined) {
          const scores = normaliseCriterionScores(rubric, body.criteria);
          const scored = Object.keys(scores).length;
          update.criteria_scores = scored > 0 ? scores : null;
          update.score = scored > 0 ? criterionTotal(rubric, scores) : null;
        }

        if (body.feedback !== undefined) {
          const feedback = (body.feedback ?? '').trim();
          if (feedback.length > FEEDBACK_MAX) {
            return badRequest(`Feedback must be at most ${FEEDBACK_MAX} characters.`);
          }
          update.feedback = feedback || null;
        }

        if (body.status !== undefined) {
          if (!REVIEW_DECISIONS.includes(body.status)) {
            return badRequest('Unknown review status.');
          }
          update.status = body.status;
        }

        const { data: saved, error: updateError } = await supabase
          .from('submissions')
          .update(update)
          .eq('id', body.id)
          .select('id, score, criteria_scores, feedback, status, reviewed_at, reviewed_by')
          .single();

        if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
        return NextResponse.json({ ok: true, submission: saved });
      }

      default:
        return badRequest(`Unknown action "${body.action}".`);
    }
  } catch (error) {
    return serverError(error);
  }
}
