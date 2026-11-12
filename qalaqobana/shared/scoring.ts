/**
 * ქულების წესი — ერთადერთი ადგილი, სადაც ქულები ითვლება.
 * წესის შესაცვლელად საკმარისია POINTS-ის ან scoreRound-ის შეცვლა.
 * ფუნქციები "სუფთაა": არაფერზეა დამოკიდებული გარდა გადაცემული მონაცემებისა.
 */
import { normalizeAnswer, startsWithLetter } from './normalize';

/** ქულების ოდენობა თითოეული შემთხვევისთვის */
export const POINTS = {
  /** ამ კატეგორიაში მიღებული პასუხი მხოლოდ ერთ მოთამაშეს აქვს */
  only: 20,
  /** უნიკალური პასუხი (სხვებსაც აქვთ, მაგრამ განსხვავებული) */
  unique: 10,
  /** იგივე პასუხი სხვასაც აქვს */
  shared: 5,
  /** ცარიელი, არასწორი ასო ან უარყოფილი */
  none: 0,
} as const;

export type AutoCheck = 'ok' | 'empty' | 'wrongLetter';
export type ScoreReason = 'only' | 'unique' | 'shared' | 'empty' | 'wrongLetter' | 'rejected';

export interface CellScore {
  points: number;
  reason: ScoreReason;
  /** ერთნაირი პასუხების ჯგუფის ნომერი (null — თუ პასუხი არავის ემთხვევა) */
  group: number | null;
}

export interface ScoreInput {
  letter: string;
  categories: { id: string; allowLatin?: boolean }[];
  playerIds: string[];
  /** answers[playerId][categoryId] = პასუხის ტექსტი */
  answers: Record<string, Record<string, string>>;
  /** ხმის მიცემით ან ჰოსტის გადაწყვეტილებით უარყოფილი პასუხები — cellKey(playerId, categoryId) */
  rejected: Set<string>;
  /** ჰოსტის მიერ "ერთნაირად" გაერთიანებული წყვილები: merges[categoryId] = [[playerA, playerB], ...] */
  merges: Record<string, [string, string][]>;
}

export type ScoreResult = Record<string, Record<string, CellScore>>;

export const cellKey = (playerId: string, categoryId: string) => `${playerId}:${categoryId}`;

/** ავტომატური შემოწმება ხმის მიცემამდე */
export function checkAnswer(text: string, letter: string, allowLatin = false): AutoCheck {
  if (!normalizeAnswer(text)) return 'empty';
  return startsWithLetter(text, letter, allowLatin) ? 'ok' : 'wrongLetter';
}

/** პასუხი უარყოფილია, თუ ხმის უფლების მქონეთა ნახევარზე მეტმა მონიშნა */
export function isRejectedByVotes(votes: number, eligibleVoters: number): boolean {
  return eligibleVoters > 0 && votes > eligibleVoters / 2;
}

/** ერთი რაუნდის ქულები ყველა მოთამაშისთვის და კატეგორიისთვის */
export function scoreRound(input: ScoreInput): ScoreResult {
  const result: ScoreResult = {};
  for (const pid of input.playerIds) result[pid] = {};

  for (const cat of input.categories) {
    // 1. ავტომატური შემოწმება და უარყოფილების გამოკლება
    const accepted: string[] = [];
    for (const pid of input.playerIds) {
      const text = input.answers[pid]?.[cat.id] ?? '';
      const check = checkAnswer(text, input.letter, !!cat.allowLatin);
      if (check !== 'ok') {
        result[pid][cat.id] = { points: POINTS.none, reason: check, group: null };
      } else if (input.rejected.has(cellKey(pid, cat.id))) {
        result[pid][cat.id] = { points: POINTS.none, reason: 'rejected', group: null };
      } else {
        accepted.push(pid);
      }
    }

    // 2. ერთნაირი პასუხების დაჯგუფება: ნორმალიზებული დამთხვევა + ჰოსტის გაერთიანებები
    const parent = new Map<string, string>(accepted.map((p) => [p, p]));
    const find = (p: string): string => {
      let root = p;
      while (parent.get(root) !== root) root = parent.get(root)!;
      parent.set(p, root);
      return root;
    };
    const union = (a: string, b: string) => {
      if (parent.has(a) && parent.has(b)) parent.set(find(a), find(b));
    };
    const byKey = new Map<string, string>();
    for (const pid of accepted) {
      const key = normalizeAnswer(input.answers[pid][cat.id]);
      const first = byKey.get(key);
      if (first) union(pid, first);
      else byKey.set(key, pid);
    }
    for (const [a, b] of input.merges[cat.id] ?? []) union(a, b);

    const groupSize = new Map<string, number>();
    for (const pid of accepted) groupSize.set(find(pid), (groupSize.get(find(pid)) ?? 0) + 1);
    const groupNo = new Map<string, number>();

    // 3. ქულები
    for (const pid of accepted) {
      const root = find(pid);
      if (groupSize.get(root)! > 1) {
        if (!groupNo.has(root)) groupNo.set(root, groupNo.size);
        result[pid][cat.id] = { points: POINTS.shared, reason: 'shared', group: groupNo.get(root)! };
      } else if (accepted.length === 1) {
        result[pid][cat.id] = { points: POINTS.only, reason: 'only', group: null };
      } else {
        result[pid][cat.id] = { points: POINTS.unique, reason: 'unique', group: null };
      }
    }
  }
  return result;
}

/** მოთამაშის რაუნდის ჯამი */
export function sumRound(result: ScoreResult, playerId: string): number {
  return Object.values(result[playerId] ?? {}).reduce((s, c) => s + c.points, 0);
}

/** გამარჯვებულები — ფრის შემთხვევაში გამარჯვება იყოფა */
export function findWinners(totals: Record<string, number>): string[] {
  const ids = Object.keys(totals);
  if (ids.length === 0) return [];
  const max = Math.max(...ids.map((id) => totals[id]));
  return ids.filter((id) => totals[id] === max);
}
