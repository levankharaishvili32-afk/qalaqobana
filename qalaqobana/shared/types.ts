import type { Category } from './config/categories';
import type { AutoCheck, ScoreReason } from './scoring';

export type Phase = 'lobby' | 'reveal' | 'writing' | 'review' | 'scores' | 'final';

export interface Settings {
  maxPlayers: number;
  rounds: number;
  writeSeconds: number;
  /** ჩართული კატეგორიების id-ები (ჩაშენებულიც და ოთახის საკუთარიც) */
  categoryIds: string[];
  /** მხოლოდ ამ ოთახის კატეგორიები */
  customCategories: Category[];
  /** ჩართული ასოები */
  letters: string[];
}

export interface PublicPlayer {
  id: string;
  name: string;
  isHost: boolean;
  online: boolean;
  score: number;
}

export interface AnswerCell {
  text: string;
  check: AutoCheck;
  /** ვინ მონიშნა არასწორად */
  votes: string[];
  /** რამდენი ხმაა საჭირო უარყოფისთვის */
  needed: number;
  override: 'accept' | 'reject' | null;
  rejected: boolean;
  points: number;
  reason: ScoreReason;
  group: number | null;
}

export interface RoundView {
  number: number;
  total: number;
  /** null სანამ ასოები "ტრიალებს" */
  letter: string | null;
  categories: Category[];
  /** ამ რაუნდში მონაწილე მოთამაშეების id-ები */
  participants: string[];
  stopBy: string | null;
  /** მხოლოდ შემოწმებისა და ქულების ფაზაში: table[playerId][categoryId] */
  table: Record<string, Record<string, AnswerCell>> | null;
  merges: Record<string, [string, string][]>;
  ready: string[];
  roundTotals: Record<string, number> | null;
}

export interface RoomState {
  code: string;
  name: string;
  hasPassword: boolean;
  settings: Settings;
  phase: Phase;
  phaseEndsAt: number | null;
  serverNow: number;
  players: PublicPlayer[];
  youId: string;
  round: RoundView | null;
  /** მხოლოდ თქვენი შევსებული ველები (წერის ფაზაში) */
  myDraft: Record<string, string>;
  /** 4-ზე ნაკლები მოთამაშე დარჩა — ჰოსტმა უნდა გადაწყვიტოს */
  awaitingHost: boolean;
  winners: string[];
}

export type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: string };
export type JoinAck = Ack<{ code: string; playerId: string; token: string }>;

export interface CreatePayload {
  roomName: string;
  nickname: string;
  password?: string;
}
export interface JoinPayload {
  code: string;
  nickname: string;
  password?: string;
}
export interface RejoinPayload {
  code: string;
  playerId: string;
  token: string;
}
