import { LATIN_PREFIXES } from './config/alphabet.js';

/** რასაც მოთამაშეები ხედავენ: მოჭრილი, ზედმეტი ჰარების გარეშე */
export function cleanDisplay(raw: string): string {
  return String(raw ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

/**
 * შედარების გასაღები: ორი პასუხი "ერთნაირია", თუ გასაღებები ემთხვევა.
 * - ლათინური ასოები პატარავდება
 * - პუნქტუაცია, დეფისები და სიმბოლოები იშლება
 * - ჰარები იშლება ("ნიუ-იორკი" = "ნიუ იორკი" = "ნიუიორკი")
 */
export function normalizeAnswer(raw: string): string {
  return cleanDisplay(raw)
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, '')
    .replace(/\s+/g, '');
}

/** იწყება თუ არა პასუხი რაუნდის ასოთი (allowLatin — ლათინური შესაბამისობაც ითვლება) */
export function startsWithLetter(raw: string, letter: string, allowLatin = false): boolean {
  const key = normalizeAnswer(raw);
  if (!key) return false;
  if (key.startsWith(letter)) return true;
  if (!allowLatin) return false;
  return (LATIN_PREFIXES[letter] ?? []).some((p) => key.startsWith(p.toLowerCase()));
}
