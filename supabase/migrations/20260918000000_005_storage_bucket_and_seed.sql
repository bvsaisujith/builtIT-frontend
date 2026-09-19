/*
# Storage bucket + policies + curated problem statements

## Why
Migration 001–004 create the tables, but two things the app needs were never provisioned:

1. The `submissions` storage bucket. `src/app/submit/aim/page.tsx` uploads the PPT deck to
   `submissions/teams/<teamId>/aim-presentation.<ext>`. Without the bucket (and policies on
   `storage.objects`) that upload fails with a permission/not-found error.
2. Seed rows for `problem_statements`. `src/app/problem-statements/page.tsx` lists rows where
   `team_id IS NULL` (the "curated list"). With no seed rows the page shows "No problem
   statements in this category yet."

## Storage path convention (must match the client code)
  teams/<team_id>/aim-presentation.<ext>
  -> (storage.foldername(name))[1] = 'teams'
  -> (storage.foldername(name))[2] = <team_id>

Policies below allow only members of that team to insert/read/update their own files.
Bucket is private (public = false) so decks are accessed through the app, not guessed URLs.
*/

-- 1. BUCKET
INSERT INTO storage.buckets (id, name, public)
VALUES ('submissions', 'submissions', false)
ON CONFLICT (id) DO NOTHING;

-- 2. STORAGE POLICIES (team-scoped)
DROP POLICY IF EXISTS "submissions_insert_own_team" ON storage.objects;
CREATE POLICY "submissions_insert_own_team" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] = 'teams'
    AND EXISTS (
      SELECT 1 FROM public.team_memberships tm
      WHERE tm.team_id::text = (storage.foldername(name))[2]
        AND tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "submissions_select_own_team" ON storage.objects;
CREATE POLICY "submissions_select_own_team" ON storage.objects FOR SELECT
  TO authenticated USING (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] = 'teams'
    AND EXISTS (
      SELECT 1 FROM public.team_memberships tm
      WHERE tm.team_id::text = (storage.foldername(name))[2]
        AND tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "submissions_update_own_team" ON storage.objects;
CREATE POLICY "submissions_update_own_team" ON storage.objects FOR UPDATE
  TO authenticated USING (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] = 'teams'
    AND EXISTS (
      SELECT 1 FROM public.team_memberships tm
      WHERE tm.team_id::text = (storage.foldername(name))[2]
        AND tm.user_id = auth.uid()
    )
  ) WITH CHECK (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] = 'teams'
    AND EXISTS (
      SELECT 1 FROM public.team_memberships tm
      WHERE tm.team_id::text = (storage.foldername(name))[2]
        AND tm.user_id = auth.uid()
    )
  );

-- 3. CURATED PROBLEM STATEMENTS (team_id NULL = open/curated)
INSERT INTO problem_statements (title, description, category, is_open)
VALUES
  ('Campus Asset Tracker',
   'Design a system that tracks department assets (labs, equipment, devices) and flags missing or overdue items automatically.',
   'IoT', true),
  ('Smart Attendance That Cannot Be Faked',
   'Build an attendance mechanism resistant to proxy marking, using a combination of presence signals and verification.',
   'AI', true),
  ('Student Support Chatbot',
   'Create an assistant that answers common academic and administrative queries and routes complex cases to the right staff.',
   'AI', true),
  ('Campus Energy Optimizer',
   'Analyse consumption data and recommend or automate actions that reduce electricity usage in college buildings.',
   'Automation', true),
  ('Secure Document Workflow',
   'A tamper-evident document approval flow with clear audit trails for departments handling sensitive records.',
   'Cyber Security', true),
  ('Cloud Cost Dashboard',
   'Give small teams visibility into cloud spend, with alerts and suggestions to cut unnecessary cost.',
   'Cloud', true),
  ('Result Analytics for Faculty',
   'Turn raw exam and attendance data into early-warning insights that identify students who need support.',
   'Data Science', true),
  ('Virtual Lab Walkthrough',
   'An immersive walkthrough of a laboratory or workshop so students can prepare before they enter the physical space.',
   'AR / VR', true)
ON CONFLICT DO NOTHING;
