interface CategoryIconProps {
  type: string;
  size?: number;
}

import type { ReactElement } from 'react';

const PATHS: Record<string, ReactElement> = {
  shield: <><path d="M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Z" /><path d="m9.5 12 1.7 1.7 3.5-3.5" /></>,
  cloud: <><path d="M7 18h10.2a4.3 4.3 0 0 0 .5-8.6A6 6 0 0 0 6.4 8.2 4.9 4.9 0 0 0 7 18Z" /></>,
  signal: <><path d="M12 18h.01" /><path d="M8.5 14.5a5 5 0 0 1 7 0" /><path d="M5.3 11.3a9.5 9.5 0 0 1 13.4 0" /><path d="M2.5 8.5a13.5 13.5 0 0 1 19 0" /></>,
  brain: <><path d="M9 4.5a3 3 0 0 0-5.5 1.6A3.5 3.5 0 0 0 4 12a3.5 3.5 0 0 0 2.5 5.9A3 3 0 0 0 12 16V7a3 3 0 0 0-3-2.5Z" /><path d="M15 4.5a3 3 0 0 1 5.5 1.6A3.5 3.5 0 0 1 20 12a3.5 3.5 0 0 1-2.5 5.9A3 3 0 0 1 12 16V7a3 3 0 0 1 3-2.5Z" /><path d="M8 9h1M7.5 13h2M16 9h-1M16.5 13h-2" /></>,
  data: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
  vr: <><rect x="3" y="7" width="18" height="10" rx="3" /><path d="M3 11h5l2 3h4l2-3h5M9 9h.01M15 9h.01" /></>,
  gear: <><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19.4 15 .1.1-1.7 2.9-.2-.1a3 3 0 0 0-3 .1l-.2.1a3 3 0 0 0-1.5 2.5v.2H9.5v-.2A3 3 0 0 0 8 18l-.2-.1a3 3 0 0 0-3-.1l-.2.1-1.7-2.9.1-.1a3 3 0 0 0 1.5-2.6v-.2A3 3 0 0 0 3 9.6l-.1-.1 1.7-2.9.2.1a3 3 0 0 0 3-.1L8 6.5a3 3 0 0 0 1.5-2.5v-.2h3.4V4a3 3 0 0 0 1.5 2.5l.2.1a3 3 0 0 0 3 .1l.2-.1 1.7 2.9-.1.1a3 3 0 0 0-1.5 2.6v.2a3 3 0 0 0 1.5 2.6Z" /></>,
  atom: <><circle cx="12" cy="12" r="2" /><ellipse cx="12" cy="12" rx="9" ry="4" /><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(60 12 12)" /><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(120 12 12)" /></>,
};

export default function CategoryIcon({ type, size = 38 }: CategoryIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      className="category-icon"
    >
      {PATHS[type]}
    </svg>
  );
}
