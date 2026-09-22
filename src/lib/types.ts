// === Problem domain categories (legacy, kept for UI consistency) ===
export type Category =
  | 'Cyber Security'
  | 'Cloud'
  | 'IoT'
  | 'AI'
  | 'Data Science'
  | 'AR / VR'
  | 'Automation'
  | 'Quantum';

export const CATEGORIES: { name: Category; short: string; icon: string }[] = [
  { name: 'Cyber Security', short: 'CYBER', icon: 'shield' },
  { name: 'Cloud', short: 'CLOUD', icon: 'cloud' },
  { name: 'IoT', short: 'IOT', icon: 'signal' },
  { name: 'AI', short: 'AI', icon: 'brain' },
  { name: 'Data Science', short: 'DATA', icon: 'data' },
  { name: 'AR / VR', short: 'AR/VR', icon: 'vr' },
  { name: 'Automation', short: 'AUTO', icon: 'gear' },
  { name: 'Quantum', short: 'QUANTUM', icon: 'atom' },
];

export type SubmissionStatus =
  | 'NOT_SUBMITTED'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'ACCEPTED'
  | 'REJECTED';

export type SubmissionStage = 'AIM' | 'FINAL';

// === Profile (migration 006) ===
export type UserRole = 'participant' | 'admin';

export interface Profile {
  id: string;
  email: string | null;          // nullable: GitHub OAuth may not expose email
  full_name: string;
  roll_number: string | null;    // nullable until /complete-profile
  phone: string | null;          // nullable until /complete-profile
  github_username: string | null;
  github_url: string | null;
  avatar_url: string | null;
  year: string | null;           // collected at /complete-profile
  section: string | null;        // collected at /complete-profile
  profile_completed_at: string | null;
  role: UserRole;
  created_at: string;
}

// === Domain (migration 006, requirement 7) ===
export interface Domain {
  id: string;
  name: string;
  slug: string;
  short_label: string | null;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export type DomainWithProblemCount = Domain & {
  problem_count: number;
};

// === Problem Statement (migration 006) ===
export interface ProblemStatement {
  id: string;
  team_id: string | null;       // null = curated/open
  title: string;
  description: string | null;
  category: string | null;      // legacy mirror of domain name
  domain_id: string;
  is_active: boolean;           // requirement 15
  display_order: number;
  created_at: string;
}

export interface ProblemStatementWithDomain extends ProblemStatement {
  domain: Domain;
}

// === Teams (migration 006) ===
export interface Team {
  id: string;
  name: string;
  team_code: string | null;     // requirement 10: BIT-XXXXXX
  category: string | null;       // legacy mirror
  domain_id: string | null;
  problem_statement_id: string | null;
  leader_id: string;
  is_locked: boolean;
  created_at: string;
}

export interface TeamConfig {
  max_team_size: number;
}

// === Team Member (RPC output — public fields only, requirement 17) ===
export interface TeamMemberPublic {
  id: string;
  user_id: string;
  full_name: string | null;
  github_username: string | null;
  github_url: string | null;
  avatar_url: string | null;
  year: string | null;
  section: string | null;
  is_leader: boolean;
  joined_at: string;
}

// === Team Join Request (migration 006, requirement 8) ===
export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface TeamJoinRequest {
  id: string;
  team_id: string;
  requester_id: string;
  message: string | null;
  status: JoinRequestStatus;
  created_at: string;
  responded_at: string | null;
  responded_by: string | null;
}

// === Submission (unchanged) ===
export interface Submission {
  id: string;
  team_id: string;
  stage: SubmissionStage;
  aim_summary: string | null;
  ppt_file_path: string | null;
  ppt_file_name: string | null;
  ppt_drive_url: string | null; // Google Drive link (replaces file upload)
  deployed_url: string | null;
  repo_url: string | null;
  demo_video_url: string | null;
  status: SubmissionStatus;
  submitted_at: string | null;
  feedback: string | null;
  score: number | null;
  created_at: string;
}

// === Event Config (migration 006) ===
export interface EventConfig {
  id: number;
  aim_deadline: string | null;
  final_deadline: string | null;
  registration_open: boolean;
  max_team_size: number;
}

// === Aggregated types ===
export interface TeamWithDetails extends Team {
  members: TeamMemberPublic[];
  problem_statement: ProblemStatement | null;
  domain: Domain | null;
  submissions: {
    aim: Submission | null;
    final: Submission | null;
  };
}

// === Public winners podium (migration 015/016) ===
// One row per announced podium position, as returned by the get_winners()
// SECURITY DEFINER RPC: position, team id, team name and team code only.
export interface WinnerRow {
  position: number; // 1 | 2 | 3
  team_id: string;
  team_name: string;
  team_code: string | null;
}

export interface AuthCheck {
  session: boolean;
  profile: Profile | null;
  role: UserRole;
}
