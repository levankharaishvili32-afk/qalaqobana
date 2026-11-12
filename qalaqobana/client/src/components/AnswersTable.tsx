import type { AnswerCell, RoomState } from '../../../shared/types';

export interface CellRef {
  playerId: string;
  categoryId: string;
}

const GROUP_COLORS = ['bg-sky-100', 'bg-amber-100', 'bg-teal-100', 'bg-pink-100', 'bg-indigo-100'];

/** ქულის ფერი: 20 — ოქროსფერი, 10 — მწვანე, 5 — ცისფერი, 0 — ნაცრისფერი */
export function pointsClass(points: number) {
  if (points >= 20) return 'bg-amber-400 text-violet-950';
  if (points >= 10) return 'bg-emerald-500 text-white';
  if (points > 0) return 'bg-sky-500 text-white';
  return 'bg-slate-200 text-slate-500';
}

function cellTone(cell: AnswerCell, mode: 'review' | 'scores') {
  if (cell.check !== 'ok') return 'bg-slate-100 text-slate-400';
  if (cell.rejected) return 'bg-rose-100 text-rose-700';
  if (mode === 'scores') {
    if (cell.points >= 20) return 'bg-amber-100';
    if (cell.points >= 10) return 'bg-emerald-50';
    return 'bg-sky-100';
  }
  return cell.group !== null ? GROUP_COLORS[cell.group % GROUP_COLORS.length] : 'bg-white';
}

/**
 * ცხრილი: სტრიქონები — მოთამაშეები, სვეტები — კატეგორიები.
 * ტელეფონზე სახელების სვეტი დამაგრებულია და ცხრილი ჰორიზონტალურად სრიალებს.
 */
export function AnswersTable(props: {
  state: RoomState;
  mode: 'review' | 'scores';
  onCell?: (ref: CellRef) => void;
  /** გაერთიანების რეჟიმი: ამ სვეტის პასუხები მონიშნულია */
  highlight?: CellRef | null;
}) {
  const { state, mode, onCell, highlight } = props;
  const round = state.round!;
  const table = round.table ?? {};
  const players = round.participants
    .map((id) => state.players.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p && !!table[p.id]);

  return (
    <div className="-mx-1 overflow-x-auto rounded-2xl border-2 border-violet-100">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-20 w-20 min-w-20 bg-violet-600 px-2 py-2 text-left text-xs font-bold text-white sm:w-28 sm:min-w-28">
              მოთამაშე
            </th>
            {round.categories.map((c) => (
              <th
                key={c.id}
                className={`min-w-[5.4rem] whitespace-nowrap px-2 py-2 text-xs font-bold text-white ${
                  highlight?.categoryId === c.id ? 'bg-fuchsia-600' : 'bg-violet-600'
                }`}
              >
                {c.icon} {c.name}
              </th>
            ))}
            {mode === 'scores' && <th className="min-w-12 bg-violet-600 px-2 py-2 text-xs font-bold text-white">ჯამი</th>}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => {
            const mine = p.id === state.youId;
            return (
              <tr key={p.id}>
                <th
                  className={`sticky left-0 z-10 border-t border-violet-100 px-2 py-1 text-left text-xs font-extrabold leading-tight ${
                    mine ? 'bg-amber-200' : 'bg-violet-50'
                  }`}
                >
                  <span className="line-clamp-2 break-words">{p.name}</span>
                  {mode === 'review' && round.ready.includes(p.id) && (
                    <span className="text-[10px] font-bold text-emerald-600">✓ მზადაა</span>
                  )}
                </th>
                {round.categories.map((c) => {
                  const cell = table[p.id][c.id];
                  const valid = cell.check === 'ok';
                  const clickable = mode === 'review' && valid && !!onCell;
                  const isSource = highlight?.playerId === p.id && highlight.categoryId === c.id;
                  const mergeTarget = !!highlight && highlight.categoryId === c.id && valid && !isSource;
                  const iVoted = cell.votes.includes(state.youId);
                  return (
                    <td key={c.id} className="border-l border-t border-violet-100 p-0">
                      <button
                        type="button"
                        disabled={!clickable}
                        onClick={() => onCell?.({ playerId: p.id, categoryId: c.id })}
                        className={`flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-0.5 px-1.5 py-1 text-center font-semibold leading-tight transition ${cellTone(
                          cell,
                          mode,
                        )} ${isSource ? 'ring-4 ring-inset ring-fuchsia-500' : ''} ${
                          mergeTarget ? 'ring-2 ring-inset ring-fuchsia-300' : ''
                        } ${clickable ? 'active:brightness-95' : 'cursor-default'}`}
                      >
                        <span className={`break-words ${cell.rejected || cell.check === 'wrongLetter' ? 'line-through' : ''}`}>
                          {cell.check === 'empty' ? '—' : cell.text}
                        </span>
                        <span className="flex flex-wrap items-center justify-center gap-1 text-[10px] font-bold">
                          {cell.check === 'wrongLetter' && <span>სხვა ასო</span>}
                          {valid && cell.votes.length > 0 && (
                            <span className={`rounded-full px-1.5 ${iVoted ? 'bg-rose-500 text-white' : 'bg-rose-200 text-rose-800'}`}>
                              👎 {cell.votes.length}/{cell.needed}
                            </span>
                          )}
                          {cell.override && (
                            <span className="rounded-full bg-amber-300 px-1.5 text-violet-950">
                              👑 {cell.override === 'accept' ? 'მიღებულია' : 'უარყოფილია'}
                            </span>
                          )}
                          {valid && !cell.rejected && cell.group !== null && <span title="ერთნაირი პასუხი">🔗</span>}
                          {mode === 'scores' && (
                            <span className={`rounded-full px-2 py-0.5 text-xs ${pointsClass(cell.points)}`}>
                              {cell.points}
                            </span>
                          )}
                        </span>
                      </button>
                    </td>
                  );
                })}
                {mode === 'scores' && (
                  <td className="border-l border-t border-violet-100 bg-violet-50 px-2 text-center text-base font-extrabold text-fuchsia-600">
                    +{round.roundTotals?.[p.id] ?? 0}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
