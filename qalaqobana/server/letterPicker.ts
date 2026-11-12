import crypto from 'node:crypto';

/** შემთხვევითი მთელი რიცხვი [0, max) შუალედში */
export type RandomInt = (max: number) => number;

/** კრიპტოგრაფიულად უსაფრთხო შემთხვევითობა — მხოლოდ სერვერზე */
export const secureRandomInt: RandomInt = (max) => crypto.randomInt(max);

/**
 * ირჩევს ასოს ნაკრებიდან ისე, რომ ერთ თამაშში ასო არ გამეორდეს.
 * თუ ნაკრები ამოიწურა, თავიდან ივსება (ბოლო ასო ზედიზედ ორჯერ არ მოვა).
 * აბრუნებს არჩეულ ასოს და გამოყენებული ასოების განახლებულ სიას.
 */
export function pickLetter(
  pool: string[],
  used: string[],
  randomInt: RandomInt = secureRandomInt,
): { letter: string; used: string[] } {
  const unique = [...new Set(pool)];
  if (unique.length === 0) throw new Error('ასოების ნაკრები ცარიელია');

  let usedNow = used.filter((l) => unique.includes(l));
  let available = unique.filter((l) => !usedNow.includes(l));
  if (available.length === 0) {
    const last = used[used.length - 1];
    usedNow = [];
    available = unique.length > 1 ? unique.filter((l) => l !== last) : unique;
  }
  const letter = available[randomInt(available.length)];
  return { letter, used: [...usedNow, letter] };
}
