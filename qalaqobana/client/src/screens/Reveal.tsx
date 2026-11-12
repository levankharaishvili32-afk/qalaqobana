import { useEffect, useRef, useState } from 'react';
import { caps } from '../caps';
import { ALPHABET } from '../../../shared/config/alphabet';
import type { RoomState } from '../../../shared/types';
import { useSecondsLeft } from '../socket';
import { sounds } from '../sounds';

/** ასოს გამოცხადება: ასოები "ტრიალებს", ჩერდება, შემდეგ 3-წამიანი ათვლა */
export function Reveal({ state }: { state: RoomState }) {
  const letter = state.round?.letter ?? null;
  const pool = state.settings.letters.length > 1 ? state.settings.letters : ALPHABET;
  const [spin, setSpin] = useState(pool[0]);
  const left = useSecondsLeft(state.phaseEndsAt);
  const lastCount = useRef(0);

  // ნამდვილ ასოს სერვერი მხოლოდ ტრიალის ბოლოს აგზავნის — მანამდე შემთხვევით ასოებს ვაჩვენებთ
  useEffect(() => {
    if (letter) return;
    const t = setInterval(() => {
      setSpin(pool[Math.floor(Math.random() * pool.length)]);
      sounds.tick();
    }, 80);
    return () => clearInterval(t);
  }, [letter, pool]);

  useEffect(() => {
    if (letter) sounds.reveal();
  }, [letter]);

  useEffect(() => {
    if (!letter || left === lastCount.current) return;
    lastCount.current = left;
    if (left >= 1 && left <= 3) sounds.count();
  }, [left, letter]);

  return (
    <div className="flex flex-col items-center pt-8 text-center text-white">
      <div className="text-lg font-bold text-white/90">
        რაუნდი {state.round?.number} / {state.round?.total}
      </div>
      <div className="mt-1 text-2xl font-extrabold drop-shadow">{caps(letter ? 'ასოა…' : 'ვირჩევთ ასოს…')}</div>

      <div
        key={letter ?? 'spin'}
        style={{ borderRadius: '1.25rem 4.5rem 1.25rem 4.5rem' }}
        className={`mt-8 flex h-56 w-56 items-center justify-center text-[9rem] font-extrabold leading-none shadow-2xl ${
          letter ? 'animate-pop bg-brand-full text-white' : 'bg-white text-violet-300'
        }`}
        aria-live="polite"
      >
        {letter ?? spin}
      </div>

      <div className="mt-8 h-24">
        {letter && left > 0 && (
          <>
            <div className="font-bold text-white/90">ვიწყებთ…</div>
            <div key={left} className="animate-pop text-7xl font-extrabold drop-shadow-lg">
              {Math.min(left, 3)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
