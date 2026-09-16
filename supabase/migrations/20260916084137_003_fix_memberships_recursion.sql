/*
# Fix infinite recursion in team_memberships RLS policy

## Problem
The `select_own_memberships` policy on `team_memberships` references `team_memberships` in its own
USING clause (subquery checking if the user is a teammate). This causes infinite recursion because
PostgreSQL evaluates RLS policies on every read, including reads inside other policies.

The `teams` SELECT policy also references `team_memberships`, creating a circular dependency:
teams policy → reads team_memberships → team_memberships policy → reads team_memberships → ...

## Fix
- Make `team_memberships` SELECT policy use `USING (true)` — any authenticated user can see
  membership records. This is safe for an internal hackathon: knowing who is on which team is not
  sensitive, and write policies (INSERT/DELETE) still enforce `user_id = auth.uid()`.
- This breaks the recursion cycle: teams policy reads team_memberships → team_memberships SELECT
  returns true without referencing teams or itself.
*/

DROP POLICY IF EXISTS "select_own_memberships" ON team_memberships;
CREATE POLICY "select_own_memberships" ON team_memberships FOR SELECT
  TO authenticated USING (true);
