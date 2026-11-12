import { POINTS } from '../../../shared/scoring';
import { caps } from '../caps';
import type { RoomState } from '../../../shared/types';
import { AnswersTable, pointsClass } from '../components/AnswersTable';
import { Leaderboard } from '../components/Leaderboard';
import { send, useSecondsLeft } from '../socket';

export function Scores({ state }: { state: RoomState }) {
  const round = state.round!;
  const isHost = state.players.find((p) => p.id === state.youId)!.isHost;
  const isLast = round.number >= round.total;
  const left = useSecondsLeft(state.phaseEndsAt);
  const myGain = round.roundTotals?.[state.youId];

  return (
    <div className="space-y-3">
      <div className="card flex items-center gap-3 py-3">
        <div className="tile h-14 w-14 text-4xl">
          {round.letter}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-extrabold">
            რაუნდი {round.number} / {round.total} — ქულები
          </div>
          {myGain !== undefined && (
            <div className="text-sm font-bold text-emerald-600">ამ რაუნდში დააგროვე +{myGain}</div>
          )}
        </div>
      </div>

      <div className="card p-2 sm:p-3">
        <AnswersTable state={state} mode="scores" />
        <div className="mt-2 flex flex-wrap gap-2 px-1 text-[11px] font-bold">
          <span className={`rounded-full px-2 py-0.5 ${pointsClass(POINTS.only)}`}>{POINTS.only} — მხოლოდ შენ გაქვს</span>
          <span className={`rounded-full px-2 py-0.5 ${pointsClass(POINTS.unique)}`}>{POINTS.unique} — უნიკალური</span>
          <span className={`rounded-full px-2 py-0.5 ${pointsClass(POINTS.shared)}`}>{POINTS.shared} — სხვასაც აქვს</span>
          <span className={`rounded-full px-2 py-0.5 ${pointsClass(0)}`}>0 — ცარიელი / არასწორი</span>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-2 text-lg font-extrabold">{caps('ჯამური ცხრილი')}</h2>
        <Leaderboard state={state} showRound />
      </div>

      <div className="sticky bottom-3 space-y-2">
        {state.awaitingHost ? (
          <div className="card border-4 border-amber-400 text-center">
            <div className="font-extrabold">დარჩა 4-ზე ნაკლები მოთამაშე</div>
            {isHost ? (
              <>
                <div className="mb-3 text-sm font-semibold text-violet-600">გავაგრძელოთ თამაში?</div>
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn-primary" onClick={() => send('host:continue')}>
                    გაგრძელება
                  </button>
                  <button className="btn-ghost" onClick={() => send('host:endGame')}>
                    დასრულება
                  </button>
                </div>
              </>
            ) : (
              <div className="text-sm font-semibold text-violet-600">ჰოსტი წყვეტს, გაგრძელდეს თუ არა თამაში…</div>
            )}
          </div>
        ) : isHost ? (
          <button className="btn-primary w-full text-lg shadow-2xl" onClick={() => send('host:next')}>
            {caps(isLast ? '🏁 საბოლოო შედეგები' : '➡️ შემდეგი რაუნდი')}
            {left > 0 && <span className="font-semibold opacity-70">({left})</span>}
          </button>
        ) : (
          <div className="bar">
            {isLast ? 'საბოლოო შედეგები' : 'შემდეგი რაუნდი'} {left > 0 ? `${left} წამში…` : 'მალე…'}
          </div>
        )}
      </div>
    </div>
  );
}
