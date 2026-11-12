import { useEffect, useState } from 'react';
import type { RoomState } from '../../shared/types';
import { Final } from './screens/Final';
import { Home } from './screens/Home';
import { Lobby } from './screens/Lobby';
import { Reveal } from './screens/Reveal';
import { Review } from './screens/Review';
import { Scores } from './screens/Scores';
import { Writing } from './screens/Writing';
import { leaveRoom, useStore } from './socket';
import { isMuted, setMuted, unlockAudio } from './sounds';

function Screen({ state }: { state: RoomState }) {
  switch (state.phase) {
    case 'lobby':
      return <Lobby state={state} />;
    case 'reveal':
      return <Reveal state={state} />;
    case 'writing':
      // key — ყოველ რაუნდში ველები თავიდან იწყება
      return <Writing key={state.round?.number} state={state} />;
    case 'review':
      return <Review state={state} />;
    case 'scores':
      return <Scores state={state} />;
    case 'final':
      return <Final state={state} />;
  }
}

export default function App() {
  const { state, connected, toast } = useStore();
  const [muted, setMutedState] = useState(isMuted());

  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, []);

  const toggleMute = () => {
    setMuted(!muted);
    setMutedState(!muted);
  };
  const leave = () => {
    if (confirm('ნამდვილად გსურთ ოთახიდან გასვლა?')) leaveRoom();
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-3 pb-6 pt-3 sm:px-4">
      <header className="mb-3 flex items-center justify-between gap-2 text-white">
        <div className="min-w-0">
          <div className="truncate text-lg font-extrabold leading-tight drop-shadow">
            {state ? `🏙️ ${state.name}` : ''}
          </div>
          {state && state.round && state.phase !== 'lobby' && state.phase !== 'final' && (
            <div className="text-xs font-semibold text-white/80">
              რაუნდი {state.round.number} / {state.round.total}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={toggleMute}
            className="h-10 w-10 rounded-full bg-white/20 text-lg backdrop-blur transition hover:bg-white/30"
            aria-label={muted ? 'ხმის ჩართვა' : 'ხმის გამორთვა'}
            title={muted ? 'ხმის ჩართვა' : 'ხმის გამორთვა'}
          >
            {muted ? '🔇' : '🔊'}
          </button>
          {state && (
            <button
              onClick={leave}
              className="h-10 rounded-full bg-white/20 px-3 text-sm font-bold backdrop-blur transition hover:bg-white/30"
            >
              გასვლა
            </button>
          )}
        </div>
      </header>

      {!connected && (
        <div className="mb-3 rounded-2xl bg-rose-600 px-4 py-2 text-center text-sm font-bold text-white shadow-lg">
          კავშირი გაწყდა — ვცდილობ აღდგენას…
        </div>
      )}

      <main className="flex-1">{state ? <Screen state={state} /> : <Home />}</main>

      {toast && (
        <div className="fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
          <div className="animate-rise rounded-2xl bg-violet-950 px-4 py-3 text-center text-sm font-bold text-white shadow-2xl">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
