import { useState, type FormEvent } from 'react';
import { ALPHABET, DEFAULT_LETTERS, HARD_LETTERS } from '../../../shared/config/alphabet';
import { CATEGORIES } from '../../../shared/config/categories';
import { LIMITS } from '../../../shared/config/gameDefaults';
import type { RoomState, Settings } from '../../../shared/types';
import { PlayerList } from '../components/PlayerList';
import { send, shareLink, toast } from '../socket';

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-violet-700">{props.label}</span>
        <span className="text-lg font-extrabold text-fuchsia-600">
          {props.value}
          {props.suffix}
        </span>
      </div>
      <input
        type="range"
        className="w-full accent-fuchsia-600 disabled:opacity-60"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(Number(e.target.value))}
        aria-label={props.label}
      />
    </div>
  );
}

export function Lobby({ state }: { state: RoomState }) {
  const me = state.players.find((p) => p.id === state.youId)!;
  const isHost = me.isHost;
  const s = state.settings;
  const [newCategory, setNewCategory] = useState('');
  const update = (patch: Partial<Settings>) => send('host:updateSettings', patch);

  const onlineCount = state.players.filter((p) => p.online).length;
  const missing = Math.max(0, LIMITS.minPlayers - onlineCount);
  const link = shareLink(state.code);

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch {
      toast(text);
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'ქალაქობანა', text: `შემოდი ოთახში „${state.name}"`, url: link });
        return;
      } catch {
        /* გაზიარება გაუქმდა */
      }
    }
    void copy(link, 'ლინკი დაკოპირდა');
  };

  const allCategories = [...CATEGORIES, ...s.customCategories];
  const toggleCategory = (id: string) => {
    const next = s.categoryIds.includes(id) ? s.categoryIds.filter((c) => c !== id) : [...s.categoryIds, id];
    update({ categoryIds: next });
  };
  const addCategory = (e: FormEvent) => {
    e.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    if (s.customCategories.length >= LIMITS.customCategoriesMax)
      return toast(`მაქსიმუმ ${LIMITS.customCategoriesMax} საკუთარი კატეგორია`);
    // id-ს და იკონს სერვერი ანიჭებს; ახალი კატეგორია მაშინვე ჩართულია
    update({ customCategories: [...s.customCategories, { id: '', name, icon: '', custom: true }] });
    setNewCategory('');
  };
  const removeCategory = (id: string) =>
    update({ customCategories: s.customCategories.filter((c) => c.id !== id) });
  const toggleLetter = (l: string) =>
    update({ letters: s.letters.includes(l) ? s.letters.filter((x) => x !== l) : [...s.letters, l] });

  return (
    <div className="space-y-3">
      <div className="card text-center">
        <div className="text-sm font-semibold text-violet-600">ოთახის კოდი</div>
        <button
          onClick={() => copy(state.code, 'კოდი დაკოპირდა')}
          className="font-mono text-5xl font-extrabold tracking-[0.2em] text-fuchsia-600"
          title="დააჭირე დასაკოპირებლად"
        >
          {state.code}
        </button>
        <div className="mt-1 text-xs font-semibold text-violet-500">
          {state.hasPassword ? '🔒 ოთახს პაროლი აქვს' : 'გაუზიარე მეგობრებს კოდი ან ლინკი'}
        </div>
        <button onClick={share} className="btn-violet mt-3 w-full">
          🔗 ლინკის გაზიარება
        </button>
      </div>

      <div className="card">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-lg font-extrabold">მოთამაშეები</h2>
          <span className="font-extrabold text-fuchsia-600">
            {state.players.length} / {s.maxPlayers}
          </span>
        </div>
        <PlayerList state={state} canKick={isHost} />
      </div>

      <div className="card space-y-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-extrabold">პარამეტრები</h2>
          {!isHost && <span className="text-xs font-semibold text-violet-500">ცვლის მხოლოდ ჰოსტი</span>}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Slider
            label="მოთამაშეების მაქსიმუმი"
            value={s.maxPlayers}
            min={Math.max(LIMITS.minPlayers, state.players.length)}
            max={LIMITS.maxPlayers}
            disabled={!isHost || state.players.length >= LIMITS.maxPlayers}
            onChange={(v) => update({ maxPlayers: v })}
          />
          <Slider
            label="რაუნდები"
            value={s.rounds}
            min={LIMITS.rounds.min}
            max={LIMITS.rounds.max}
            disabled={!isHost}
            onChange={(v) => update({ rounds: v })}
          />
          <Slider
            label="წერის დრო"
            value={s.writeSeconds}
            min={LIMITS.writeSeconds.min}
            max={LIMITS.writeSeconds.max}
            step={10}
            suffix=" წმ"
            disabled={!isHost}
            onChange={(v) => update({ writeSeconds: v })}
          />
        </div>

        <div>
          <div className="label">კატეგორიები</div>
          <div className="flex flex-wrap gap-2">
            {allCategories.map((c) => {
              const on = s.categoryIds.includes(c.id);
              return (
                <span key={c.id} className="inline-flex">
                  <button
                    disabled={!isHost}
                    onClick={() => toggleCategory(c.id)}
                    aria-pressed={on}
                    className={`chip ${c.custom && isHost ? 'rounded-r-none pr-2' : ''} ${
                      on ? 'bg-fuchsia-600 text-white' : 'bg-violet-100 text-violet-400 line-through'
                    }`}
                  >
                    <span>{c.icon}</span>
                    {c.name}
                  </button>
                  {c.custom && isHost && (
                    <button
                      onClick={() => removeCategory(c.id)}
                      className="chip rounded-l-none bg-violet-200 px-2 text-violet-700"
                      aria-label={`${c.name} — წაშლა`}
                    >
                      ✕
                    </button>
                  )}
                </span>
              );
            })}
          </div>
          {isHost && (
            <form onSubmit={addCategory} className="mt-3 flex gap-2">
              <input
                className="field py-2"
                value={newCategory}
                maxLength={LIMITS.categoryNameMax}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="მაგ. ფილმი"
                aria-label="საკუთარი კატეგორია"
              />
              <button className="btn-ghost shrink-0 py-2">დამატება</button>
            </form>
          )}
        </div>

        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-violet-700">
              ასოები <span className="text-fuchsia-600">({s.letters.length})</span>
            </span>
            {isHost && (
              <span className="flex gap-2 text-xs font-bold">
                <button className="rounded-full bg-violet-100 px-3 py-1" onClick={() => update({ letters: ALPHABET })}>
                  ყველა
                </button>
                <button
                  className="rounded-full bg-violet-100 px-3 py-1"
                  onClick={() => update({ letters: DEFAULT_LETTERS })}
                >
                  რთულების გარეშე
                </button>
              </span>
            )}
          </div>
          <div className="grid grid-cols-9 gap-1.5 sm:grid-cols-11">
            {ALPHABET.map((l) => {
              const on = s.letters.includes(l);
              return (
                <button
                  key={l}
                  disabled={!isHost}
                  onClick={() => toggleLetter(l)}
                  aria-pressed={on}
                  aria-label={`ასო ${l}`}
                  className={`aspect-square rounded-xl text-lg font-extrabold transition ${
                    on
                      ? HARD_LETTERS.includes(l)
                        ? 'bg-orange-400 text-white'
                        : 'bg-violet-600 text-white'
                      : 'bg-violet-100 text-violet-300'
                  }`}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="sticky bottom-3">
        {isHost ? (
          <button
            className="btn-primary w-full text-xl shadow-2xl"
            disabled={missing > 0}
            onClick={() => send('host:start')}
          >
            {missing > 0 ? `დაიწყე — აკლია ${missing} მოთამაშე` : '🚀 დაიწყე'}
          </button>
        ) : (
          <div className="rounded-2xl bg-violet-950/80 px-4 py-3 text-center font-bold text-white backdrop-blur">
            {missing > 0 ? `აკლია ${missing} მოთამაშე` : 'ველოდებით, სანამ ჰოსტი თამაშს დაიწყებს…'}
          </div>
        )}
      </div>
    </div>
  );
}
