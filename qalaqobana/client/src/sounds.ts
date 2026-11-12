import { storage } from './socket';

/** ხმები გენერირდება ბრაუზერში (Web Audio) — აუდიო ფაილები არ არის საჭირო */
let ctx: AudioContext | null = null;
let muted = storage.get('muted') === '1';

export const isMuted = () => muted;
export function setMuted(value: boolean) {
  muted = value;
  storage.set('muted', value ? '1' : null);
}

/** ბრაუზერები ხმას მხოლოდ მომხმარებლის პირველი შეხების შემდეგ რთავენ */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* ხმა არ არის ხელმისაწვდომი */
  }
}

function beep(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15, delay = 0) {
  if (muted || !ctx || ctx.state !== 'running') return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export const sounds = {
  /** ასოების ტრიალი */
  tick: () => beep(700 + Math.random() * 500, 0.04, 'square', 0.04),
  /** ასო გამოჩნდა */
  reveal: () => {
    beep(523, 0.14, 'triangle', 0.2);
    beep(659, 0.14, 'triangle', 0.2, 0.12);
    beep(784, 0.14, 'triangle', 0.2, 0.24);
    beep(1047, 0.4, 'triangle', 0.22, 0.36);
  },
  /** ათვლა 3-2-1 */
  count: () => beep(440, 0.12, 'sine', 0.15),
  go: () => beep(880, 0.3, 'sine', 0.2),
  /** "სტოპ!" */
  stop: () => {
    beep(330, 0.18, 'sawtooth', 0.18);
    beep(247, 0.18, 'sawtooth', 0.18, 0.16);
    beep(196, 0.45, 'sawtooth', 0.2, 0.32);
  },
  /** ბოლო 10 წამი */
  warn: () => beep(1000, 0.07, 'square', 0.07),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => beep(f, 0.3, 'triangle', 0.2, i * 0.13)),
};
