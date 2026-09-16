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

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  roll_number: string;
  phone: string;
  github_username: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  category: Category;
  leader_id: string;
  is_locked: boolean;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  joined_at: string;
  profile: Pick<Profile, 'id' | 'full_name' | 'email'>;
}

export interface ProblemStatement {
  id: string;
  team_id: string | null;
  title: string;
  description: string;
  category: Category;
  is_open: boolean;
  created_at: string;
}

export interface Submission {
  id: string;
  team_id: string;
  stage: SubmissionStage;
  aim_summary: string | null;
  ppt_file_path: string | null;
  ppt_file_name: string | null;
  deployed_url: string | null;
  repo_url: string | null;
  demo_video_url: string | null;
  status: SubmissionStatus;
  submitted_at: string | null;
  feedback: string | null;
  score: number | null;
  created_at: string;
}

export interface EventConfig {
  id: number;
  aim_deadline: string | null;
  final_deadline: string | null;
  registration_open: boolean;
}

export interface TeamWithDetails extends Team {
  members: TeamMember[];
  problem_statement: ProblemStatement | null;
  submissions: {
    aim: Submission | null;
    final: Submission | null;
  };
}
