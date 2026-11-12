import { useState } from 'react';
import { caps } from '../caps';
import type { RoomState } from '../../../shared/types';
import { AnswersTable, type CellRef } from '../components/AnswersTable';
import { Timer } from '../components/Timer';
import { send, toast } from '../socket';

export function Review({ state }: { state: RoomState }) {
  const round = state.round!;
  const me = state.players.find((p) => p.id === state.youId)!;
  const isHost = me.isHost;
  const [selected, setSelected] = useState<CellRef | null>(null);
  const [mergeFrom, setMergeFrom] = useState<CellRef | null>(null);

  const online = state.players.filter((p) => p.online);
  const readyCount = online.filter((p) => round.ready.includes(p.id)).length;
  const iAmReady = round.ready.includes(state.youId);

  const vote = (ref: CellRef) => {
    if (ref.playerId === state.youId) return toast('საკუთარ პასუხს ვერ მონიშნავ');
    send('review:vote', ref);
  };

  const onCell = (ref: CellRef) => {
    if (mergeFrom) {
      if (ref.categoryId !== mergeFrom.categoryId) return toast('აირჩიე პასუხი იმავე სვეტიდან');
      if (ref.playerId !== mergeFrom.playerId)
        send('host:merge', { categoryId: ref.categoryId, a: mergeFrom.playerId, b: ref.playerId });
      setMergeFrom(null);
      return;
    }
    if (isHost) setSelected(ref);
    else vote(ref);
  };

  const cell = selected ? round.table?.[selected.playerId]?.[selected.categoryId] : null;
  const author = selected ? state.players.find((p) => p.id === selected.playerId) : null;
  const category = selected ? round.categories.find((c) => c.id === selected.categoryId) : null;
  const merged =
    !!selected &&
    (round.merges[selected.categoryId] ?? []).some((pair) => pair.includes(selected.playerId));
  const act = (fn: () => void) => {
    fn();
    setSelected(null);
  };

  return (
    <div className="space-y-3">
      <div className="card flex items-center gap-3 py-3">
        <div className="tile h-14 w-14 text-4xl">
          {round.letter}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-extrabold">{caps('შემოწმება')}</div>
          <div className="text-xs font-semibold leading-tight text-violet-600">
            {isHost
              ? 'დააჭირე პასუხს: მონიშნე არასწორად, გადაფარე ან გააერთიანე'
              : 'დააჭირე სხვის პასუხს, თუ არასწორია. ნახევარზე მეტი ხმა — პასუხი უარყოფილია'}
          </div>
        </div>
        <Timer endsAt={state.phaseEndsAt} />
      </div>

      {mergeFrom && (
        <div className="flex items-center justify-between gap-2 rounded-leaf bg-amber-300 px-4 py-3 text-sm font-bold text-violet-950 shadow-lg">
          <span>🔗 აირჩიე მეორე პასუხი იმავე სვეტში</span>
          <button className="rounded-full bg-white/70 px-3 py-1" onClick={() => setMergeFrom(null)}>
            გაუქმება
          </button>
        </div>
      )}

      <div className="card p-2 sm:p-3">
        <AnswersTable state={state} mode="review" onCell={onCell} highlight={mergeFrom} />
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] font-semibold text-violet-600">
          <span>👎 ხმები / საჭირო</span>
          <span>🔗 ერთნაირი პასუხი (5 ქულა)</span>
          <span>👑 ჰოსტის გადაწყვეტილება</span>
          <span className="text-rose-600">წითელი — უარყოფილი</span>
        </div>
      </div>

      <div className="sticky bottom-3">
        <button
          className={`w-full text-lg shadow-2xl ${iAmReady ? 'btn-ghost' : 'btn-primary'}`}
          disabled={iAmReady}
          onClick={() => send('review:ready')}
        >
          {iAmReady ? `✓ მზად ხარ — ველოდებით დანარჩენებს (${readyCount}/${online.length})` : caps(`მზად ვარ (${readyCount}/${online.length})`)}
        </button>
      </div>

      {/* ჰოსტის მოქმედებები არჩეულ პასუხზე */}
      {selected && cell && author && category && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-violet-950/60 p-3 sm:items-center"
          onClick={() => setSelected(null)}
        >
          <div
            className="card w-full max-w-sm animate-rise space-y-2"
            role="dialog"
            aria-label="პასუხის მოქმედებები"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-xs font-semibold text-violet-500">
                {author.name} · {category.icon} {category.name}
              </div>
              <div className="break-words text-2xl font-extrabold">{cell.text}</div>
            </div>
            {selected.playerId !== state.youId && (
              <button className="btn-ghost w-full" onClick={() => act(() => vote(selected))}>
                {cell.votes.includes(state.youId) ? '↩️ ჩემი ხმის მოხსნა' : '👎 არასწორია (ჩემი ხმა)'}
              </button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                className="btn bg-emerald-500 text-white"
                onClick={() => act(() => send('host:override', { ...selected, decision: 'accept' }))}
              >
                👑 მიღება
              </button>
              <button
                className="btn bg-rose-500 text-white"
                onClick={() => act(() => send('host:override', { ...selected, decision: 'reject' }))}
              >
                👑 უარყოფა
              </button>
            </div>
            {cell.override && (
              <button
                className="btn-ghost w-full"
                onClick={() => act(() => send('host:override', { ...selected, decision: null }))}
              >
                ↩️ ჰოსტის გადაწყვეტილების მოხსნა
              </button>
            )}
            <button className="btn-ghost w-full" onClick={() => act(() => setMergeFrom(selected))}>
              🔗 გაერთიანება სხვა პასუხთან
            </button>
            {merged && (
              <button
                className="btn-ghost w-full"
                onClick={() =>
                  act(() => send('host:unmerge', { categoryId: selected.categoryId, playerId: selected.playerId }))
                }
              >
                ✂️ გაერთიანების მოხსნა
              </button>
            )}
            <button className="w-full py-2 text-sm font-bold text-violet-500" onClick={() => setSelected(null)}>
              დახურვა
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
