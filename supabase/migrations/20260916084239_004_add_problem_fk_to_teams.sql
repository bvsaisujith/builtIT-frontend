/*
# Add problem_statement_id FK to teams

## Change
- Add `problem_statement_id` column to `teams` table (nullable FK to problem_statements)
- This allows teams to link to a selected problem statement
- RLS: already covered by existing update_own_team policy
*/

ALTER TABLE teams ADD COLUMN IF NOT EXISTS problem_statement_id uuid REFERENCES problem_statements(id) ON DELETE SET NULL;
