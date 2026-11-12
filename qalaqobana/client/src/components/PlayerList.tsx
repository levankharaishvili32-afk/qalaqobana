import type { RoomState } from '../../../shared/types';
import { send } from '../socket';

/** მოთამაშეების სია ლობიში */
export function PlayerList({ state, canKick }: { state: RoomState; canKick: boolean }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {state.players.map((p) => (
        <li
          key={p.id}
          className={`flex items-center gap-2 rounded-2xl px-3 py-2 ${
            p.id === state.youId ? 'bg-amber-100' : 'bg-violet-50'
          } ${p.online ? '' : 'opacity-50'}`}
        >
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${p.online ? 'bg-emerald-500' : 'bg-slate-400'}`}
            title={p.online ? 'ონლაინ' : 'გათიშულია'}
          />
          <span className="min-w-0 flex-1 truncate font-bold">
            {p.name}
            {p.id === state.youId && <span className="font-semibold text-violet-500"> (შენ)</span>}
          </span>
          {p.isHost && (
            <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-extrabold">👑 ჰოსტი</span>
          )}
          {!p.online && <span className="shrink-0 text-xs font-semibold">გათიშულია</span>}
          {canKick && p.id !== state.youId && (
            <button
              onClick={() => {
                if (confirm(`გავაგდოთ ${p.name}?`)) send('host:kick', { playerId: p.id });
              }}
              className="h-8 w-8 shrink-0 rounded-full bg-rose-100 font-bold text-rose-600 hover:bg-rose-200"
              aria-label={`${p.name} — გაგდება`}
              title="გაგდება"
            >
              ✕
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
