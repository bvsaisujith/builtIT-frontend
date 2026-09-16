'use client';

import { useEffect, useState } from 'react';

interface CountdownProps {
  deadline: string | null;
  label?: string;
}

function getTimeRemaining(deadline: string) {
  const total = new Date(deadline).getTime() - Date.now();
  if (total <= 0) return { total: 0, hours: 0, minutes: 0, seconds: 0, days: 0 };
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const seconds = Math.floor((total / 1000) % 60);
  return { total, days, hours, minutes, seconds };
}

export default function Countdown({ deadline, label = 'Time remaining' }: CountdownProps) {
  const [time, setTime] = useState(getTimeRemaining(deadline ?? ''));

  useEffect(() => {
    if (!deadline) return;
    const interval = setInterval(() => {
      setTime(getTimeRemaining(deadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return null;

  if (time.total <= 0) {
    return (
      <div className="countdown countdown-passed">
        <span className="countdown-label">{label}</span>
        <span className="countdown-value">Deadline passed</span>
      </div>
    );
  }

  return (
    <div className="countdown">
      <span className="countdown-label">{label}</span>
      <div className="countdown-timer">
        {time.days > 0 && (
          <div className="countdown-unit">
            <strong>{time.days}</strong>
            <span>days</span>
          </div>
        )}
        <div className="countdown-unit">
          <strong>{String(time.hours).padStart(2, '0')}</strong>
          <span>hrs</span>
        </div>
        <div className="countdown-unit">
          <strong>{String(time.minutes).padStart(2, '0')}</strong>
          <span>min</span>
        </div>
        <div className="countdown-unit">
          <strong>{String(time.seconds).padStart(2, '0')}</strong>
          <span>sec</span>
        </div>
      </div>
    </div>
  );
}
