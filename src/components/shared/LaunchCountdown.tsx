import { useEffect, useState } from 'react';

/*
  Launch: Sunday 23 August 2026, 10:00 PM MST.

  MST is UTC-7, so 22:00 MST == 05:00 UTC the following day. Pinned as an
  absolute UTC instant rather than a local-time string so the countdown means
  the same moment for every visitor regardless of their own timezone - a
  trader in London and one in Denver both see it hit zero simultaneously.

  Note this is fixed-offset MST (UTC-7) as stated, not America/Denver, which
  would be on daylight time (UTC-6) in August. If the intent was 10PM as the
  clock reads in Denver during summer, this should be 04:00Z instead.
*/
export const LAUNCH_AT = new Date('2026-08-24T05:00:00Z');

function remaining(target: Date) {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return null;
  return {
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    minutes: Math.floor((ms % 3600000) / 60000),
    seconds: Math.floor((ms % 60000) / 1000),
  };
}

export default function LaunchCountdown({ className = '' }: { className?: string }) {
  const [left, setLeft] = useState(() => remaining(LAUNCH_AT));

  useEffect(() => {
    const id = setInterval(() => setLeft(remaining(LAUNCH_AT)), 1000);
    return () => clearInterval(id);
  }, []);

  // After the moment passes this becomes a live announcement rather than a
  // countdown stuck at zero, so the page never contradicts itself.
  if (!left) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
        </span>
        <span className="text-sm font-medium text-blue-400">We're live — TradeX is open</span>
      </div>
    );
  }

  const units: [number, string][] = [
    [left.days, left.days === 1 ? 'day' : 'days'],
    [left.hours, 'hrs'],
    [left.minutes, 'min'],
    [left.seconds, 'sec'],
  ];

  return (
    <div className={className}>
      <p className="text-xs sm:text-sm text-gray-400 mb-2">
        Launching <span className="text-white font-medium">Sunday, August 23 at 10:00 PM MST</span>
      </p>
      <div className="flex items-center justify-center gap-2 sm:gap-3">
        {units.map(([value, label]) => (
          <div
            key={label}
            className="min-w-[3.25rem] sm:min-w-[4rem] rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] px-2 py-2 sm:px-3 sm:py-2.5 backdrop-blur-sm"
          >
            <div className="text-lg sm:text-2xl font-bold tabular-nums leading-none bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
              {String(value).padStart(2, '0')}
            </div>
            <div className="mt-1 text-[10px] sm:text-xs uppercase tracking-wide text-gray-500">
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
