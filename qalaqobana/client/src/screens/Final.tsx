import { useEffect, useMemo } from 'react';
import type { RoomState } from '../../../shared/types';
import { Leaderboard } from '../components/Leaderboard';
import { send } from '../socket';
import { sounds } from '../sounds';

const CONFETTI_COLORS = ['#fbbf24', '#f472b6', '#34d399', '#60a5fa', '#ffffff', '#fb923c'];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 50 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.5,
        duration: 3 + Math.random() * 3,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    [],
  );
  return (
    <div aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti animate-fall"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export function Final({ state }: { state: RoomState }) {
  const isHost = state.players.find((p) => p.id === state.youId)!.isHost;
  const winners = state.players.filter((p) => state.winners.includes(p.id));
  const iWon = state.winners.includes(state.youId);

  useEffect(() => {
    sounds.win();
  }, []);

  return (
    <div className="space-y-3">
      <Confetti />
      <div className="card text-center">
        <div className="animate-pop text-7xl leading-tight">🏆</div>
        <div className="mt-3 text-sm font-bold text-violet-600">
          {winners.length > 1 ? 'ფრე! გამარჯვება იყოფა' : 'გამარჯვებული'}
        </div>
        <div className="break-words text-3xl font-extrabold text-fuchsia-600">
          {winners.map((w) => w.name).join(' და ') || '—'}
        </div>
        {winners[0] && <div className="mt-1 text-lg font-extrabold">{winners[0].score} ქულა</div>}
        {iWon && <div className="mt-2 font-bold text-emerald-600">გილოცავ! 🎉</div>}
      </div>

      <div className="card">
        <h2 className="mb-2 text-lg font-extrabold">საბოლოო ცხრილი</h2>
        <Leaderboard state={state} />
      </div>

      <div className="sticky bottom-3">
        {isHost ? (
          <button className="btn-primary w-full text-lg shadow-2xl" onClick={() => send('host:newGame')}>
            🔄 ახალი თამაში
          </button>
        ) : (
          <div className="rounded-2xl bg-violet-950/80 px-4 py-3 text-center font-bold text-white backdrop-blur">
            ჰოსტს შეუძლია ახალი თამაშის დაწყება იმავე ოთახში
          </div>
        )}
      </div>
    </div>
  );
}
