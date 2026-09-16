/*
# built IT 2K26 — RLS Policies

Enables RLS on all tables and adds ownership/membership-scoped policies.

## Security summary
- Profiles: users CRUD their own profile only
- Teams: team members can SELECT/UPDATE; any authenticated user can INSERT (as leader)
- Team memberships: members can read their team's memberships; users insert/delete only their own
- Problem statements: all authenticated can SELECT; team members can INSERT/UPDATE for their team
- Submissions: team members can CRUD their team's submissions
- Event config: all authenticated can SELECT; any authenticated can INSERT/UPDATE (organizer use)
*/

-- Enable RLS everywhere
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE problem_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_config ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- TEAMS policies
DROP POLICY IF EXISTS "select_own_teams" ON teams;
CREATE POLICY "select_own_teams" ON teams FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM team_memberships tm WHERE tm.team_id = teams.id AND tm.user_id = auth.uid())
    OR leader_id = auth.uid()
  );

DROP POLICY IF EXISTS "insert_team" ON teams;
CREATE POLICY "insert_team" ON teams FOR INSERT
  TO authenticated WITH CHECK (leader_id = auth.uid());

DROP POLICY IF EXISTS "update_own_team" ON teams;
CREATE POLICY "update_own_team" ON teams FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM team_memberships tm WHERE tm.team_id = teams.id AND tm.user_id = auth.uid())
    OR leader_id = auth.uid()
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM team_memberships tm WHERE tm.team_id = teams.id AND tm.user_id = auth.uid())
    OR leader_id = auth.uid()
  );

-- TEAM MEMBERSHIPS policies
DROP POLICY IF EXISTS "select_own_memberships" ON team_memberships;
CREATE POLICY "select_own_memberships" ON team_memberships FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM team_memberships tm2 WHERE tm2.team_id = team_memberships.team_id AND tm2.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_membership" ON team_memberships;
CREATE POLICY "insert_own_membership" ON team_memberships FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_membership" ON team_memberships;
CREATE POLICY "delete_own_membership" ON team_memberships FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- PROBLEM STATEMENTS policies
DROP POLICY IF EXISTS "select_problem_statements" ON problem_statements;
CREATE POLICY "select_problem_statements" ON problem_statements FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_problem_statement" ON problem_statements;
CREATE POLICY "insert_own_problem_statement" ON problem_statements FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM team_memberships tm WHERE tm.team_id = problem_statements.team_id AND tm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_problem_statement" ON problem_statements;
CREATE POLICY "update_own_problem_statement" ON problem_statements FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM team_memberships tm WHERE tm.team_id = problem_statements.team_id AND tm.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM team_memberships tm WHERE tm.team_id = problem_statements.team_id AND tm.user_id = auth.uid())
  );

-- SUBMISSIONS policies
DROP POLICY IF EXISTS "select_own_submissions" ON submissions;
CREATE POLICY "select_own_submissions" ON submissions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM team_memberships tm WHERE tm.team_id = submissions.team_id AND tm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_submission" ON submissions;
CREATE POLICY "insert_own_submission" ON submissions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM team_memberships tm WHERE tm.team_id = submissions.team_id AND tm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_submission" ON submissions;
CREATE POLICY "update_own_submission" ON submissions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM team_memberships tm WHERE tm.team_id = submissions.team_id AND tm.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM team_memberships tm WHERE tm.team_id = submissions.team_id AND tm.user_id = auth.uid())
  );

-- EVENT CONFIG policies
DROP POLICY IF EXISTS "select_event_config" ON event_config;
CREATE POLICY "select_event_config" ON event_config FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_event_config" ON event_config;
CREATE POLICY "insert_event_config" ON event_config FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_event_config" ON event_config;
CREATE POLICY "update_event_config" ON event_config FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
