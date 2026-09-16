/*
# built IT 2K26 — Tables (no RLS yet)

Creates all tables for the hackathon platform.
RLS policies are added in a follow-up migration so cross-table references resolve.
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  roll_number text UNIQUE NOT NULL,
  phone text NOT NULL,
  github_username text,
  created_at timestamptz DEFAULT now()
);

-- TEAMS
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  category text NOT NULL,
  leader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_locked boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- TEAM MEMBERSHIPS
CREATE TABLE IF NOT EXISTS team_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id),
  UNIQUE(user_id)
);

-- PROBLEM STATEMENTS
CREATE TABLE IF NOT EXISTS problem_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  is_open boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- SUBMISSIONS
CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('AIM', 'FINAL')),
  aim_summary text,
  ppt_file_path text,
  ppt_file_name text,
  deployed_url text,
  repo_url text,
  demo_video_url text,
  status text NOT NULL DEFAULT 'NOT_SUBMITTED' CHECK (status IN ('NOT_SUBMITTED', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED')),
  submitted_at timestamptz,
  feedback text,
  score integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, stage)
);

-- EVENT CONFIG (singleton)
CREATE TABLE IF NOT EXISTS event_config (
  id integer PRIMARY KEY DEFAULT 1,
  aim_deadline timestamptz,
  final_deadline timestamptz,
  registration_open boolean DEFAULT true,
  CONSTRAINT singleton CHECK (id = 1)
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, roll_number, phone, github_username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'roll_number', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'github_username', NULL)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Default event config
INSERT INTO event_config (id, aim_deadline, final_deadline, registration_open)
VALUES (1, '2026-09-16 14:00:00+00', '2026-09-16 20:00:00+00', true)
ON CONFLICT (id) DO NOTHING;
