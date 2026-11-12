import type { RoomState } from '../../../shared/types';

/** ჯამური ცხრილი: ადგილი, სახელი, რაუნდის ქულა და ჯამი */
export function Leaderboard({ state, showRound = false }: { state: RoomState; showRound?: boolean }) {
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  const top = sorted[0]?.score ?? 0;
  let place = 0;
  let prevScore: number | null = null;

  return (
    <ol className="space-y-1.5">
      {sorted.map((p, i) => {
        if (p.score !== prevScore) place = i + 1; // ფრის შემთხვევაში ადგილი ერთნაირია
        prevScore = p.score;
        const leader = p.score === top && top > 0;
        const gained = state.round?.roundTotals?.[p.id];
        return (
          <li
            key={p.id}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${
              p.id === state.youId ? 'bg-amber-100' : 'bg-violet-50'
            } ${p.online ? '' : 'opacity-60'}`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                leader ? 'bg-amber-400 text-violet-950' : 'bg-violet-200 text-violet-700'
              }`}
            >
              {leader ? '🏆' : place}
            </span>
            <span className="min-w-0 flex-1 truncate font-bold">
              {p.name}
              {!p.online && <span className="text-xs font-semibold"> · გათიშულია</span>}
            </span>
            {showRound && gained !== undefined && (
              <span className="shrink-0 text-sm font-bold text-emerald-600">+{gained}</span>
            )}
            <span className="w-12 shrink-0 text-right text-xl font-extrabold tabular-nums text-fuchsia-600">
              {p.score}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
