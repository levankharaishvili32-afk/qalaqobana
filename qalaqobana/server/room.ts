import crypto from 'node:crypto';
import { ALPHABET, DEFAULT_LETTERS } from '../shared/config/alphabet.js';
import { CATEGORIES, CUSTOM_CATEGORY_ICON, type Category } from '../shared/config/categories.js';
import { LIMITS, TIMING } from '../shared/config/gameDefaults.js';
import { cleanDisplay, normalizeAnswer } from '../shared/normalize.js';
import {
  cellKey,
  checkAnswer,
  findWinners,
  isRejectedByVotes,
  scoreRound,
} from '../shared/scoring.js';
import type { AnswerCell, Phase, RoomState, RoundView, Settings } from '../shared/types.js';
import { pickLetter } from './letterPicker.js';

export interface Player {
  id: string;
  token: string;
  name: string;
  joinedAt: number;
  online: boolean;
  socketId: string | null;
  offlineSince: number | null;
  score: number;
}

interface RoundData {
  number: number;
  letter: string;
  letterVisible: boolean;
  categories: Category[];
  participants: string[];
  drafts: Record<string, Record<string, string>>;
  stopBy: string | null;
  votes: Map<string, Set<string>>;
  overrides: Map<string, 'accept' | 'reject'>;
  merges: Record<string, [string, string][]>;
  ready: Set<string>;
  /** შემოწმების დასრულებისას "გაყინული" ცხრილი */
  finalTable: Record<string, Record<string, AnswerCell>> | null;
  roundTotals: Record<string, number> | null;
}

export type Emit = (socketId: string, event: string, payload: unknown) => void;

const clamp = (n: unknown, min: number, max: number, def: number) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
};

export function defaultSettings(): Settings {
  return {
    maxPlayers: LIMITS.maxPlayers,
    rounds: LIMITS.rounds.def,
    writeSeconds: LIMITS.writeSeconds.def,
    categoryIds: CATEGORIES.map((c) => c.id),
    customCategories: [],
    letters: [...DEFAULT_LETTERS],
  };
}

/** ერთი ოთახი: მოთამაშეები, ფაზები, ტაიმერები. მთელი მდგომარეობა მხოლოდ აქ ინახება. */
export class Room {
  players: Player[] = [];
  hostId = '';
  settings: Settings = defaultSettings();
  phase: Phase = 'lobby';
  phaseEndsAt: number | null = null;
  round: RoundData | null = null;
  roundNumber = 0;
  usedLetters: string[] = [];
  awaitingHost = false;
  continueApproved = false;
  winners: string[] = [];
  emptySince: number | null = Date.now();

  private phaseTimer: NodeJS.Timeout | null = null;
  private miscTimers = new Set<NodeJS.Timeout>();

  constructor(
    readonly code: string,
    public name: string,
    private passwordHash: string | null,
    private emit: Emit,
    /** დროების მასშტაბი (ბოტების ტესტში < 1, რომ თამაში სწრაფად ჩატარდეს) */
    private scale = 1,
  ) {}

  // ---------- დამხმარეები ----------

  private ms(value: number) {
    return Math.max(1, Math.round(value * this.scale));
  }
  private setPhaseTimer(delay: number, fn: () => void) {
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = setTimeout(() => {
      this.phaseTimer = null;
      fn();
    }, delay);
  }
  private later(delay: number, fn: () => void) {
    const t = setTimeout(() => {
      this.miscTimers.delete(t);
      fn();
    }, delay);
    this.miscTimers.add(t);
  }
  dispose() {
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    for (const t of this.miscTimers) clearTimeout(t);
    this.miscTimers.clear();
  }

  static hashPassword(code: string, password: string) {
    return crypto.createHash('sha256').update(`${code}:${password}`).digest('hex');
  }
  checkPassword(password: string | undefined) {
    if (!this.passwordHash) return true;
    return Room.hashPassword(this.code, password ?? '') === this.passwordHash;
  }
  get hasPassword() {
    return !!this.passwordHash;
  }

  get(playerId: string) {
    return this.players.find((p) => p.id === playerId);
  }
  online() {
    return this.players.filter((p) => p.online);
  }
  isHost(p: Player) {
    return p.id === this.hostId;
  }
  allCategories(): Category[] {
    return [...CATEGORIES, ...this.settings.customCategories];
  }
  enabledCategories(): Category[] {
    return this.allCategories().filter((c) => this.settings.categoryIds.includes(c.id));
  }

  // ---------- მოთამაშეები ----------

  /** აბრუნებს ახალ მოთამაშეს ან შეცდომის ტექსტს */
  addPlayer(rawName: string): Player | string {
    const name = cleanDisplay(rawName).slice(0, LIMITS.nameMax);
    if (!name) return 'შეიყვანეთ მეტსახელი';
    if (this.players.length >= this.settings.maxPlayers) return 'ოთახი სავსეა';
    if (this.players.some((p) => p.name.toLowerCase() === name.toLowerCase()))
      return 'ეს მეტსახელი ამ ოთახში უკვე დაკავებულია';
    const player: Player = {
      id: crypto.randomBytes(6).toString('hex'),
      token: crypto.randomBytes(24).toString('hex'),
      name,
      joinedAt: Date.now(),
      online: false,
      socketId: null,
      offlineSince: Date.now(),
      score: 0,
    };
    this.players.push(player);
    if (!this.hostId) this.hostId = player.id;
    return player;
  }

  attach(player: Player, socketId: string) {
    if (player.socketId && player.socketId !== socketId) {
      this.emit(player.socketId, 'room:closed', { message: 'თამაში სხვა ჩანართში გაიხსნა' });
    }
    player.socketId = socketId;
    player.online = true;
    player.offlineSince = null;
    this.emptySince = null;
    this.ensureHost();
    this.broadcast();
  }

  /** კავშირი გაწყდა — ადგილი და ქულები ენახება */
  detach(socketId: string) {
    const player = this.players.find((p) => p.socketId === socketId);
    if (!player) return;
    player.socketId = null;
    player.online = false;
    player.offlineSince = Date.now();
    if (this.online().length === 0) this.emptySince = Date.now();
    const id = player.id;
    this.later(TIMING.hostOfflineMs, () => this.afterOffline(id));
    this.afterPresenceChange();
    this.broadcast();
  }

  private afterOffline(playerId: string) {
    const player = this.get(playerId);
    if (!player || player.online) return;
    if (this.phase === 'lobby' && !(this.isHost(player) && this.online().length === 0)) {
      // ლობიში გათიშული მოთამაშე ადგილს ათავისუფლებს
      this.removePlayer(playerId);
      return;
    }
    this.ensureHost();
    this.broadcast();
  }

  /** ჰოსტობა გადადის ყველაზე დიდხანს მყოფ ონლაინ მოთამაშეზე */
  private ensureHost() {
    const host = this.get(this.hostId);
    const hostGone =
      !host || (!host.online && Date.now() - (host.offlineSince ?? 0) >= TIMING.hostOfflineMs);
    if (!hostGone) return;
    const next = this.online().sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (next) this.hostId = next.id;
    else if (!host && this.players[0]) this.hostId = this.players[0].id;
  }

  /** მოთამაშის წაშლა (თვითონ გავიდა ან გააგდეს) */
  removePlayer(playerId: string, kicked = false) {
    const player = this.get(playerId);
    if (!player) return;
    if (player.socketId && kicked) {
      this.emit(player.socketId, 'room:kicked', { message: 'ჰოსტმა ოთახიდან გაგაგდოთ' });
    }
    this.players = this.players.filter((p) => p.id !== playerId);
    if (this.hostId === playerId) {
      this.hostId = '';
      const next =
        this.online().sort((a, b) => a.joinedAt - b.joinedAt)[0] ??
        [...this.players].sort((a, b) => a.joinedAt - b.joinedAt)[0];
      if (next) this.hostId = next.id;
    }
    if (this.online().length === 0) this.emptySince = this.emptySince ?? Date.now();
    this.afterPresenceChange();
    this.broadcast();
  }

  private afterPresenceChange() {
    if (this.phase === 'review') this.checkAllReady();
  }

  // ---------- პარამეტრები (მხოლოდ ლობიში) ----------

  updateSettings(patch: Partial<Settings>): string | null {
    if (this.phase !== 'lobby') return 'პარამეტრების შეცვლა მხოლოდ ლობიშია შესაძლებელი';
    const s = this.settings;
    if (patch.maxPlayers !== undefined) {
      s.maxPlayers = clamp(
        patch.maxPlayers,
        Math.max(LIMITS.minPlayers, this.players.length),
        LIMITS.maxPlayers,
        s.maxPlayers,
      );
    }
    if (patch.rounds !== undefined)
      s.rounds = clamp(patch.rounds, LIMITS.rounds.min, LIMITS.rounds.max, s.rounds);
    if (patch.writeSeconds !== undefined)
      s.writeSeconds = clamp(
        patch.writeSeconds,
        LIMITS.writeSeconds.min,
        LIMITS.writeSeconds.max,
        s.writeSeconds,
      );
    let addedIds: string[] = [];
    if (Array.isArray(patch.customCategories)) {
      const before = s.customCategories.map((c) => c.id);
      const seen = new Set<string>();
      s.customCategories = patch.customCategories
        .slice(0, LIMITS.customCategoriesMax)
        .map((c) => ({
          id: `custom-${normalizeAnswer(String(c?.name ?? ''))}`,
          name: cleanDisplay(String(c?.name ?? '')).slice(0, LIMITS.categoryNameMax),
          icon: CUSTOM_CATEGORY_ICON,
          custom: true,
        }))
        .filter((c) => {
          const key = normalizeAnswer(c.name);
          if (!key || seen.has(key) || CATEGORIES.some((b) => normalizeAnswer(b.name) === key))
            return false;
          seen.add(key);
          return true;
        });
      // ახლად დამატებული კატეგორია მაშინვე ჩართულია
      addedIds = s.customCategories.map((c) => c.id).filter((id) => !before.includes(id));
    }
    if (Array.isArray(patch.categoryIds) || Array.isArray(patch.customCategories)) {
      const wanted = [
        ...(Array.isArray(patch.categoryIds) ? patch.categoryIds.map(String) : s.categoryIds),
        ...addedIds,
      ];
      const valid = this.allCategories().map((c) => c.id);
      const next = valid.filter((id) => wanted.includes(id));
      if (next.length === 0) {
        // ბოლო ჩართული კატეგორია წაიშალა ან გამოირთო — ერთი მაინც უნდა დარჩეს
        s.categoryIds = s.categoryIds.filter((id) => valid.includes(id));
        if (s.categoryIds.length === 0) s.categoryIds = [valid[0]];
        this.broadcast();
        return 'მინიმუმ ერთი კატეგორია უნდა იყოს ჩართული';
      }
      s.categoryIds = next;
    }
    if (Array.isArray(patch.letters)) {
      const next = ALPHABET.filter((l) => patch.letters!.includes(l));
      if (next.length === 0) return 'მინიმუმ ერთი ასო უნდა იყოს ჩართული';
      s.letters = next;
    }
    this.broadcast();
    return null;
  }

  // ---------- თამაშის მსვლელობა ----------

  start(): string | null {
    if (this.phase !== 'lobby') return 'თამაში უკვე დაწყებულია';
    const missing = LIMITS.minPlayers - this.online().length;
    if (missing > 0) return `თამაშის დასაწყებად აკლია ${missing} მოთამაშე`;
    // ლობიში გათიშული მოთამაშეები თამაშში არ გადადიან
    this.players = this.players.filter((p) => p.online);
    for (const p of this.players) p.score = 0;
    this.roundNumber = 0;
    this.usedLetters = [];
    this.winners = [];
    this.awaitingHost = false;
    this.continueApproved = false;
    this.startRound();
    return null;
  }

  private startRound() {
    this.roundNumber += 1;
    this.awaitingHost = false;
    // ასო ირჩევა მხოლოდ სერვერზე, crypto.randomInt-ით
    const picked = pickLetter(this.settings.letters, this.usedLetters);
    this.usedLetters = picked.used;
    this.round = {
      number: this.roundNumber,
      letter: picked.letter,
      letterVisible: false,
      categories: this.enabledCategories(),
      participants: this.players.map((p) => p.id),
      drafts: {},
      stopBy: null,
      votes: new Map(),
      overrides: new Map(),
      merges: {},
      ready: new Set(),
      finalTable: null,
      roundTotals: null,
    };
    this.phase = 'reveal';
    const reveal = this.ms(TIMING.revealMs);
    const countdown = this.ms(TIMING.countdownMs);
    this.phaseEndsAt = Date.now() + reveal + countdown;
    this.broadcast();
    // ასო კლიენტებს მხოლოდ "ტრიალის" დასრულებისას ეგზავნება
    this.setPhaseTimer(reveal, () => {
      this.round!.letterVisible = true;
      this.broadcast();
      this.setPhaseTimer(countdown, () => this.startWriting());
    });
  }

  private startWriting() {
    this.phase = 'writing';
    const duration = this.ms(this.settings.writeSeconds * 1000);
    this.phaseEndsAt = Date.now() + duration;
    this.broadcast();
    this.setPhaseTimer(duration + this.ms(TIMING.submitGraceMs), () => this.startReview());
  }

  private writingOpen() {
    return (
      this.phase === 'writing' &&
      this.phaseEndsAt !== null &&
      Date.now() <= this.phaseEndsAt + this.ms(TIMING.submitGraceMs)
    );
  }

  /** მოთამაშის ველების შენახვა; დაგვიანებული პასუხი არ მიიღება */
  saveDraft(player: Player, answers: unknown): boolean {
    const r = this.round;
    if (!r || !this.writingOpen() || !r.participants.includes(player.id)) return false;
    if (!answers || typeof answers !== 'object') return false;
    const clean: Record<string, string> = {};
    for (const cat of r.categories) {
      const value = (answers as Record<string, unknown>)[cat.id];
      clean[cat.id] = typeof value === 'string' ? cleanDisplay(value).slice(0, LIMITS.answerMax) : '';
    }
    r.drafts[player.id] = clean;
    return true;
  }

  stop(player: Player, answers: unknown): string | null {
    const r = this.round;
    if (!r || this.phase !== 'writing') return 'წერის დრო დასრულდა';
    if (r.stopBy) return null;
    if (!this.saveDraft(player, answers)) return 'წერის დრო დასრულდა';
    const draft = r.drafts[player.id];
    if (r.categories.some((c) => !normalizeAnswer(draft[c.id] ?? '')))
      return '„სტოპ!"-ისთვის ყველა ველი უნდა იყოს შევსებული';
    r.stopBy = player.id;
    const newEnd = Date.now() + this.ms(TIMING.stopGraceMs);
    if (this.phaseEndsAt === null || newEnd < this.phaseEndsAt) {
      this.phaseEndsAt = newEnd;
      this.setPhaseTimer(this.ms(TIMING.stopGraceMs) + this.ms(TIMING.submitGraceMs), () =>
        this.startReview(),
      );
    }
    for (const p of this.online()) this.emit(p.socketId!, 'round:stopCalled', { by: player.id });
    this.broadcast();
    return null;
  }

  private startReview() {
    if (this.phase !== 'writing') return;
    this.phase = 'review';
    const duration = this.ms(TIMING.reviewMs);
    this.phaseEndsAt = Date.now() + duration;
    this.broadcast();
    this.setPhaseTimer(duration, () => this.finishReview());
  }

  private reviewCell(targetId: string, catId: string): string | null {
    const r = this.round;
    if (!r || this.phase !== 'review') return 'შემოწმება დასრულებულია';
    const cat = r.categories.find((c) => c.id === catId);
    if (!cat || !r.participants.includes(targetId)) return 'პასუხი ვერ მოიძებნა';
    const text = r.drafts[targetId]?.[catId] ?? '';
    if (checkAnswer(text, r.letter, !!cat.allowLatin) !== 'ok')
      return 'ეს პასუხი ავტომატურად 0 ქულაა';
    return null;
  }

  vote(player: Player, targetId: string, catId: string): string | null {
    const err = this.reviewCell(targetId, catId);
    if (err) return err;
    if (targetId === player.id) return 'საკუთარ პასუხს ვერ მონიშნავთ';
    const key = cellKey(targetId, catId);
    const set = this.round!.votes.get(key) ?? new Set<string>();
    if (set.has(player.id)) set.delete(player.id);
    else set.add(player.id);
    this.round!.votes.set(key, set);
    this.broadcast();
    return null;
  }

  override(targetId: string, catId: string, decision: unknown): string | null {
    const err = this.reviewCell(targetId, catId);
    if (err) return err;
    const key = cellKey(targetId, catId);
    if (decision === 'accept' || decision === 'reject') this.round!.overrides.set(key, decision);
    else this.round!.overrides.delete(key);
    this.broadcast();
    return null;
  }

  merge(catId: string, a: string, b: string): string | null {
    const err = this.reviewCell(a, catId) ?? this.reviewCell(b, catId);
    if (err) return err;
    if (a === b) return 'აირჩიეთ ორი სხვადასხვა მოთამაშის პასუხი';
    const list = (this.round!.merges[catId] ??= []);
    if (!list.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) list.push([a, b]);
    this.broadcast();
    return null;
  }

  unmerge(catId: string, playerId: string): string | null {
    const r = this.round;
    if (!r || this.phase !== 'review') return 'შემოწმება დასრულებულია';
    r.merges[catId] = (r.merges[catId] ?? []).filter(([x, y]) => x !== playerId && y !== playerId);
    this.broadcast();
    return null;
  }

  ready(player: Player) {
    if (this.phase !== 'review' || !this.round) return;
    this.round.ready.add(player.id);
    this.broadcast();
    this.checkAllReady();
  }

  private checkAllReady() {
    const online = this.online();
    if (this.phase === 'review' && online.length > 0 && online.every((p) => this.round!.ready.has(p.id)))
      this.finishReview();
  }

  /** ცხრილის გამოთვლა: ხმები → უარყოფა → ქულები (shared/scoring.ts) */
  private evaluate(): Record<string, Record<string, AnswerCell>> {
    const r = this.round!;
    const pids = r.participants.filter((id) => this.get(id));
    const onlineIds = this.online().map((p) => p.id);
    const rejected = new Set<string>();
    const meta = new Map<string, { votes: string[]; needed: number }>();
    for (const pid of pids) {
      const eligible = onlineIds.filter((id) => id !== pid).length;
      for (const cat of r.categories) {
        const key = cellKey(pid, cat.id);
        const votes = [...(r.votes.get(key) ?? [])].filter((v) => v !== pid && onlineIds.includes(v));
        const ov = r.overrides.get(key);
        const isRejected = ov ? ov === 'reject' : isRejectedByVotes(votes.length, eligible);
        if (isRejected) rejected.add(key);
        meta.set(key, { votes, needed: Math.floor(eligible / 2) + 1 });
      }
    }
    const scores = scoreRound({
      letter: r.letter,
      categories: r.categories,
      playerIds: pids,
      answers: r.drafts,
      rejected,
      merges: r.merges,
    });
    const table: Record<string, Record<string, AnswerCell>> = {};
    for (const pid of pids) {
      table[pid] = {};
      for (const cat of r.categories) {
        const key = cellKey(pid, cat.id);
        const text = r.drafts[pid]?.[cat.id] ?? '';
        const score = scores[pid][cat.id];
        table[pid][cat.id] = {
          text,
          check: checkAnswer(text, r.letter, !!cat.allowLatin),
          votes: meta.get(key)!.votes,
          needed: meta.get(key)!.needed,
          override: r.overrides.get(key) ?? null,
          rejected: rejected.has(key),
          points: score.points,
          reason: score.reason,
          group: score.group,
        };
      }
    }
    return table;
  }

  private finishReview() {
    if (this.phase !== 'review' || !this.round) return;
    const r = this.round;
    r.finalTable = this.evaluate();
    r.roundTotals = {};
    for (const pid of Object.keys(r.finalTable)) {
      const total = Object.values(r.finalTable[pid]).reduce((s, c) => s + c.points, 0);
      r.roundTotals[pid] = total;
      const player = this.get(pid);
      if (player) player.score += total;
    }
    this.phase = 'scores';
    const isLast = this.roundNumber >= this.settings.rounds;
    if (!isLast && this.online().length < LIMITS.minPlayers && !this.continueApproved) {
      // 4-ზე ნაკლები დარჩა: რაუნდი დასრულდა, ჰოსტი წყვეტს
      this.awaitingHost = true;
      this.phaseEndsAt = null;
      if (this.phaseTimer) clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    } else {
      const duration = this.ms(TIMING.scoresMs);
      this.phaseEndsAt = Date.now() + duration;
      this.setPhaseTimer(duration, () => this.next());
    }
    this.broadcast();
  }

  /** ქულების ეკრანიდან გადასვლა: შემდეგი რაუნდი ან ფინალი */
  next(): string | null {
    if (this.phase !== 'scores') return 'ახლა ეს შეუძლებელია';
    if (this.roundNumber >= this.settings.rounds) {
      this.finish();
      return null;
    }
    if (this.online().length < LIMITS.minPlayers && !this.continueApproved) {
      this.awaitingHost = true;
      this.phaseEndsAt = null;
      if (this.phaseTimer) clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
      this.broadcast();
      return null;
    }
    this.startRound();
    return null;
  }

  /** ჰოსტის გადაწყვეტილება, როცა 4-ზე ნაკლები დარჩა */
  continueGame(): string | null {
    if (this.phase !== 'scores') return 'ახლა ეს შეუძლებელია';
    this.continueApproved = true;
    return this.next();
  }

  endGame(): string | null {
    if (this.phase === 'lobby' || this.phase === 'final') return 'თამაში არ მიმდინარეობს';
    if (this.phase !== 'scores') return 'დაელოდეთ რაუნდის დასრულებას';
    this.finish();
    return null;
  }

  private finish() {
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.phaseTimer = null;
    this.phase = 'final';
    this.phaseEndsAt = null;
    this.awaitingHost = false;
    this.winners = findWinners(Object.fromEntries(this.players.map((p) => [p.id, p.score])));
    this.broadcast();
  }

  /** ახალი თამაში იმავე ოთახში */
  newGame(): string | null {
    if (this.phase !== 'final') return 'ჯერ მიმდინარე თამაში უნდა დასრულდეს';
    this.phase = 'lobby';
    this.phaseEndsAt = null;
    this.round = null;
    this.roundNumber = 0;
    this.usedLetters = [];
    this.winners = [];
    this.continueApproved = false;
    for (const p of this.players) p.score = 0;
    this.players = this.players.filter((p) => p.online || this.isHost(p));
    this.broadcast();
    return null;
  }

  // ---------- მდგომარეობის გაგზავნა ----------

  broadcast() {
    const r = this.round;
    const showTable = r && (this.phase === 'review' || this.phase === 'scores' || this.phase === 'final');
    const table = showTable ? (r.finalTable ?? this.evaluate()) : null;
    const roundView: RoundView | null = r
      ? {
          number: r.number,
          total: this.settings.rounds,
          letter: r.letterVisible ? r.letter : null,
          categories: r.categories,
          participants: r.participants.filter((id) => this.get(id)),
          stopBy: r.stopBy,
          table,
          merges: showTable ? r.merges : {},
          ready: [...r.ready],
          roundTotals: r.roundTotals,
        }
      : null;
    const base = {
      code: this.code,
      name: this.name,
      hasPassword: this.hasPassword,
      settings: this.settings,
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.id === this.hostId,
        online: p.online,
        score: p.score,
      })),
      round: roundView,
      awaitingHost: this.awaitingHost,
      winners: this.winners,
    };
    for (const p of this.players) {
      if (!p.socketId) continue;
      const state: RoomState = {
        ...base,
        serverNow: Date.now(),
        youId: p.id,
        // წერის ფაზაში თითოეული მხოლოდ საკუთარ პასუხებს იღებს
        myDraft: this.phase === 'writing' ? (r?.drafts[p.id] ?? {}) : {},
      };
      this.emit(p.socketId, 'room:state', state);
    }
  }
}
