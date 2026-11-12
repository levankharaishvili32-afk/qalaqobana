import { useEffect } from 'react';
import { useSecondsLeft } from '../socket';
import { sounds } from '../sounds';

/** ტაიმერი სერვერის დროით; ბოლო 10 წამში წითლდება და (სურვილისამებრ) წიკწიკებს */
export function Timer({ endsAt, warnSound = false }: { endsAt: number | null; warnSound?: boolean }) {
  const left = useSecondsLeft(endsAt);
  const urgent = endsAt !== null && left <= 10;

  useEffect(() => {
    if (warnSound && urgent && left > 0) sounds.warn();
  }, [left, urgent, warnSound]);

  if (endsAt === null) return null;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div
      role="timer"
      className={`rounded-2xl px-3 py-1.5 text-center font-mono text-2xl font-extrabold tabular-nums ${
        urgent ? 'animate-shake bg-rose-500 text-white' : 'bg-violet-100 text-violet-900'
      }`}
    >
      {mm}:{ss}
    </div>
  );
}
