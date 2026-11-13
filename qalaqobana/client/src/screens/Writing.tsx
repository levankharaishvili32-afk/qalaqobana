import { useEffect, useRef, useState } from 'react';
import { caps } from '../caps';
import { LATIN_PREFIXES } from '../../../shared/config/alphabet';
import { LIMITS } from '../../../shared/config/gameDefaults';
import { latinToGeorgian } from '../../../shared/keyboard';
import { normalizeAnswer, startsWithLetter } from '../../../shared/normalize';
import type { RoomState } from '../../../shared/types';
import { Timer } from '../components/Timer';
import { send, storage } from '../socket';
import { sounds } from '../sounds';

export function Writing({ state }: { state: RoomState }) {
  const round = state.round!;
  const letter = round.letter ?? '';
  const playing = round.participants.includes(state.youId);
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({ ...state.myDraft }));
  const [convert, setConvert] = useState(storage.get('convert') !== '0');
  const latest = useRef(answers);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const stopper = round.stopBy ? state.players.find((p) => p.id === round.stopBy) : null;

  useEffect(() => {
    sounds.go();
  }, []);
  useEffect(() => {
    if (!round.stopBy) return;
    sounds.stop();
    // „სტოპ!"-ის შემდეგ წერა აღარ შეიძლება: რაც უკვე აკრეფილია, მაშინვე იგზავნება
    clearTimeout(timer.current);
    if (playing) send('round:draft', { answers: latest.current });
  }, [round.stopBy]);
  // ეკრანიდან გასვლისას ბოლო ცვლილებაც იგზავნება
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  /** ყოველი ცვლილება სერვერზე ინახება — ტაიმერის ამოწურვისას პასუხები ავტომატურად ითვლება გაგზავნილად */
  const change = (catId: string, raw: string, allowLatin: boolean) => {
    if (round.stopBy) return;
    const value = convert && !allowLatin ? latinToGeorgian(raw) : raw;
    const next = { ...latest.current, [catId]: value };
    latest.current = next;
    setAnswers(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => send('round:draft', { answers: latest.current }), 150);
  };

  const toggleConvert = () => {
    storage.set('convert', convert ? '0' : null);
    setConvert(!convert);
  };

  const allFilled = round.categories.every((c) => normalizeAnswer(answers[c.id] ?? ''));
  const stop = () => {
    clearTimeout(timer.current);
    send('round:stop', { answers: latest.current });
  };

  return (
    <div className="space-y-3">
      <div className="card sticky top-2 z-10 flex items-center gap-3 py-3">
        <div className="tile h-16 w-16 text-5xl">
          {letter}
        </div>
        <div className="min-w-0 flex-1 text-sm font-semibold leading-tight text-violet-700">
          {stopper ? (
            <span className="font-extrabold text-rose-600">
              ✋ {stopper.id === state.youId ? 'შენ დააჭირე' : `${stopper.name}-მა დააჭირა`} „სტოპ!"-ს
            </span>
          ) : (
            <>ჩაწერე სიტყვები ასოზე „{letter}"</>
          )}
        </div>
        <Timer endsAt={state.phaseEndsAt} warnSound />
      </div>

      {!playing ? (
        <div className="card text-center font-bold">
          თამაში უკვე მიმდინარეობს. ამ რაუნდს უყურებ, შემდეგიდან კი შენც ჩაერთვები 🙌
        </div>
      ) : (
        <>
          <div className="card space-y-3">
            {round.categories.map((c, i) => {
              const value = answers[c.id] ?? '';
              const filled = !!normalizeAnswer(value);
              const ok = filled && startsWithLetter(value, letter, !!c.allowLatin);
              return (
                <div key={c.id}>
                  <label className="label" htmlFor={`cat-${c.id}`}>
                    {c.icon} {c.name}
                    {c.allowLatin && (
                      <span className="font-normal text-violet-400">
                        {' '}
                        — ლათინურადაც შეიძლება ({LATIN_PREFIXES[letter]?.map((p) => p.toUpperCase()).join(' / ')})
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      id={`cat-${c.id}`}
                      className={`field pr-10 ${filled ? (ok ? 'border-emerald-400' : 'border-rose-400') : ''}`}
                      value={value}
                      maxLength={LIMITS.answerMax}
                      readOnly={!!round.stopBy}
                      onChange={(e) => change(c.id, e.target.value, !!c.allowLatin)}
                      placeholder={`${letter}…`}
                      autoFocus={i === 0}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      enterKeyHint="next"
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        const nextCat = round.categories[i + 1];
                        if (nextCat) document.getElementById(`cat-${nextCat.id}`)?.focus();
                        else (e.target as HTMLInputElement).blur();
                      }}
                    />
                    {filled && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-lg" aria-hidden>
                        {ok ? '✅' : '⚠️'}
                      </span>
                    )}
                  </div>
                  {filled && !ok && (
                    <div className="mt-1 text-xs font-bold text-rose-600">არ იწყება ასოთი „{letter}" — 0 ქულა</div>
                  )}
                </div>
              );
            })}
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-leaf bg-violet-950/80 px-4 py-3 text-sm font-semibold text-white backdrop-blur">
            <input
              type="checkbox"
              className="h-5 w-5 accent-amber-400"
              checked={convert}
              onChange={toggleConvert}
            />
            <span>
              ლათინური კლავიატურის ავტომატური გადაყვანა ქართულზე
              <span className="block text-xs font-normal text-white/80">მაგ. „Tbilisi" → „თბილისი"</span>
            </span>
          </label>

          <div className="sticky bottom-3">
            <button className="btn-danger w-full text-xl shadow-2xl" disabled={!allFilled || !!round.stopBy} onClick={stop}>
              {caps(round.stopBy ? 'თამაში გაჩერდა' : allFilled ? '✋ სტოპ!' : 'შეავსე ყველა ველი')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
