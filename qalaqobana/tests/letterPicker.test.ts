import { describe, expect, it } from 'vitest';
import { ALPHABET, DEFAULT_LETTERS, HARD_LETTERS, LATIN_PREFIXES } from '../shared/config/alphabet';
import { pickLetter, secureRandomInt } from '../server/letterPicker';
import { generateCode } from '../server/roomManager';

describe('ანბანი', () => {
  it('33 განსხვავებული ასოა', () => {
    expect(ALPHABET).toHaveLength(33);
    expect(new Set(ALPHABET).size).toBe(33);
  });
  it('ნაგულისხმევ ნაკრებში რთული ასოები არ არის', () => {
    expect(DEFAULT_LETTERS).toHaveLength(27);
    for (const l of HARD_LETTERS) expect(DEFAULT_LETTERS).not.toContain(l);
  });
  it('ტრანსლიტერაციის ცხრილი ყველა ასოს ფარავს', () => {
    for (const l of ALPHABET) expect(LATIN_PREFIXES[l]?.length).toBeGreaterThan(0);
  });
});

describe('ასოს არჩევა', () => {
  it('ირჩევს მხოლოდ ნაკრებიდან', () => {
    const pool = ['ა', 'ბ', 'გ'];
    for (let i = 0; i < 100; i++) expect(pool).toContain(pickLetter(pool, []).letter);
  });

  it('ერთ თამაშში ასო არ მეორდება, სანამ ნაკრები არ ამოიწურება', () => {
    let used: string[] = [];
    const seen: string[] = [];
    for (let i = 0; i < DEFAULT_LETTERS.length; i++) {
      const picked = pickLetter(DEFAULT_LETTERS, used);
      seen.push(picked.letter);
      used = picked.used;
    }
    expect(new Set(seen).size).toBe(DEFAULT_LETTERS.length);
  });

  it('ნაკრების ამოწურვის შემდეგ თავიდან ივსება და ბოლო ასო ზედიზედ არ მეორდება', () => {
    const pool = ['ა', 'ბ', 'გ'];
    for (let attempt = 0; attempt < 50; attempt++) {
      let used: string[] = [];
      const seen: string[] = [];
      for (let i = 0; i < 9; i++) {
        const picked = pickLetter(pool, used);
        seen.push(picked.letter);
        used = picked.used;
      }
      for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
      expect(new Set(seen.slice(0, 3)).size).toBe(3);
    }
  });

  it('ერთასოიანი ნაკრებიც მუშაობს', () => {
    expect(pickLetter(['ა'], ['ა']).letter).toBe('ა');
  });

  it('ცარიელ ნაკრებზე შეცდომას აგდებს', () => {
    expect(() => pickLetter([], [])).toThrow();
  });

  it('იყენებს გადაცემულ შემთხვევითობის წყაროს', () => {
    expect(pickLetter(['ა', 'ბ', 'გ'], [], () => 2).letter).toBe('გ');
    expect(pickLetter(['ა', 'ბ', 'გ'], ['ა'], () => 0).letter).toBe('ბ');
  });

  it('გამორთული ასო აღარ ითვლება გამოყენებულად', () => {
    const picked = pickLetter(['ა', 'ბ'], ['ჟ', 'ა']);
    expect(picked.letter).toBe('ბ');
    expect(picked.used).toEqual(['ა', 'ბ']);
  });

  it('შემთხვევითობა დაახლოებით თანაბარია', () => {
    const counts: Record<string, number> = {};
    const n = 27_000;
    for (let i = 0; i < n; i++) {
      const { letter } = pickLetter(DEFAULT_LETTERS, []);
      counts[letter] = (counts[letter] ?? 0) + 1;
    }
    for (const l of DEFAULT_LETTERS) {
      expect(counts[l]).toBeGreaterThan(800);
      expect(counts[l]).toBeLessThan(1200);
    }
  });

  it('secureRandomInt შუალედს არ სცდება', () => {
    for (let i = 0; i < 1000; i++) {
      const v = secureRandomInt(5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
    }
  });
});

describe('ოთახის კოდი', () => {
  it('6 სიმბოლოა და ადვილად აღრეულ სიმბოლოებს არ შეიცავს', () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  });
});
