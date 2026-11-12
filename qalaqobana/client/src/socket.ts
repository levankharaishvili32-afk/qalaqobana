import { useEffect, useState, useSyncExternalStore } from 'react';
import { io } from 'socket.io-client';
import type { CreatePayload, JoinAck, JoinPayload, RoomState } from '../../shared/types';

/**
 * Vercel-ზე სერვერი /api/server მისამართზე დგას და მხოლოდ WebSocket-ს იღებს;
 * ყველგან სხვაგან ჩვეულებრივი /socket.io მისამართია (იხ. vite.config.ts).
 */
export const socket = io(
  __ON_VERCEL__
    ? { path: '/api/server/socket.io', transports: ['websocket'] }
    : { transports: ['websocket', 'polling'] },
);

interface Store {
  state: RoomState | null;
  connected: boolean;
  /** ძველი სესიის აღდგენა მიმდინარეობს */
  rejoining: boolean;
  /** შეტყობინება მთავარ გვერდზე (მაგ. "გაგაგდეს") */
  notice: string | null;
  toast: string | null;
}

let store: Store = { state: null, connected: false, rejoining: false, notice: null, toast: null };
const listeners = new Set<() => void>();
function set(patch: Partial<Store>) {
  store = { ...store, ...patch };
  listeners.forEach((l) => l());
}
export function useStore(): Store {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => store,
  );
}

// ---------- სერვერის საათი ----------
let clockOffset = 0;
export const serverNow = () => Date.now() + clockOffset;

/** ფაზის დასრულებამდე დარჩენილი წამები (სერვერის დროით) */
export function useSecondsLeft(endsAt: number | null): number {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 200);
    return () => clearInterval(t);
  }, []);
  return endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - serverNow()) / 1000));
}

// ---------- სესია (ტოკენი ბრაუზერში) ----------
/** ?p=2 — ცალკე "პროფილი" იმავე ბრაუზერში, რომ ერთ კომპიუტერზე რამდენიმე მოთამაშით გატესტოთ */
const profile = new URLSearchParams(location.search).get('p') ?? '';
const key = (name: string) => `qalaqobana${profile ? `:${profile}` : ''}:${name}`;

export const storage = {
  get(name: string): string | null {
    try {
      return localStorage.getItem(key(name));
    } catch {
      return null;
    }
  },
  set(name: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key(name));
      else localStorage.setItem(key(name), value);
    } catch {
      /* პრივატულ რეჟიმში შენახვა შეიძლება აკრძალული იყოს */
    }
  },
};

interface Session {
  playerId: string;
  token: string;
}
function getSession(code: string): Session | null {
  try {
    return JSON.parse(storage.get(`room:${code}`) ?? 'null');
  } catch {
    return null;
  }
}

export function urlCode(): string | null {
  const m = location.pathname.match(/^\/r\/([A-Za-z0-9]{6})\/?$/);
  return m ? m[1].toUpperCase() : null;
}
function goTo(path: string) {
  if (location.pathname !== path) history.pushState(null, '', path + location.search);
}
export function shareLink(code: string) {
  return `${location.origin}/r/${code}`;
}

function onJoined(ack: JoinAck) {
  if (!ack.ok) return;
  storage.set(`room:${ack.code}`, JSON.stringify({ playerId: ack.playerId, token: ack.token }));
  goTo(`/r/${ack.code}`);
  set({ notice: null });
}

export function createRoom(payload: CreatePayload): Promise<JoinAck> {
  return new Promise((resolve) =>
    socket.emit('room:create', payload, (ack: JoinAck) => {
      onJoined(ack);
      resolve(ack);
    }),
  );
}
export function joinRoom(payload: JoinPayload): Promise<JoinAck> {
  return new Promise((resolve) =>
    socket.emit('room:join', payload, (ack: JoinAck) => {
      onJoined(ack);
      resolve(ack);
    }),
  );
}
export function roomInfo(code: string) {
  return new Promise<{ ok: true; name: string; hasPassword: boolean } | { ok: false; error: string }>(
    (resolve) => socket.emit('room:info', { code }, resolve),
  );
}
export function leaveRoom() {
  const code = store.state?.code;
  socket.emit('room:leave');
  if (code) storage.set(`room:${code}`, null);
  set({ state: null });
  goTo('/');
}
export function send(event: string, payload: object = {}) {
  socket.emit(event, payload);
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(message: string) {
  set({ toast: message });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => set({ toast: null }), 3500);
}
export function clearNotice() {
  set({ notice: null });
}

/** კავშირის (ხელახლა) დამყარებისას ვცდილობთ იმავე ადგილზე დაბრუნებას */
function tryRejoin() {
  const code = store.state?.code ?? urlCode();
  const session = code ? getSession(code) : null;
  if (!code || !session) return;
  set({ rejoining: !store.state });
  socket.emit('room:rejoin', { code, ...session }, (ack: JoinAck) => {
    if (!ack.ok) {
      storage.set(`room:${code}`, null);
      set({ rejoining: false, state: null });
    } else {
      set({ rejoining: false });
    }
  });
}

socket.on('connect', () => {
  set({ connected: true });
  tryRejoin();
});
socket.on('disconnect', () => set({ connected: false }));
socket.on('room:state', (state: RoomState) => {
  clockOffset = state.serverNow - Date.now();
  set({ state, rejoining: false });
});
socket.on('room:error', (e: { message: string }) => toast(e.message));
socket.on('room:kicked', (e: { message: string }) => {
  const code = store.state?.code;
  if (code) storage.set(`room:${code}`, null);
  set({ state: null, notice: e.message });
  goTo('/');
});
socket.on('room:closed', (e: { message: string }) => {
  set({ state: null, notice: e.message });
});
window.addEventListener('popstate', () => {
  if (!urlCode() && store.state) leaveRoom();
});
