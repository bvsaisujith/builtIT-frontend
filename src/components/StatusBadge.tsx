import type { SubmissionStatus } from '@/lib/types';

const LABELS: Record<SubmissionStatus, string> = {
  NOT_SUBMITTED: 'Not started',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
};

export default function StatusBadge({ status }: { status: SubmissionStatus }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="dot"></span>
      {LABELS[status]}
    </span>
  );
}
