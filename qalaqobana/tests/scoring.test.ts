import { describe, expect, it } from 'vitest';
import { latinToGeorgian } from '../shared/keyboard';
import { normalizeAnswer, startsWithLetter } from '../shared/normalize';
import {
  cellKey,
  checkAnswer,
  findWinners,
  isRejectedByVotes,
  POINTS,
  scoreRound,
  sumRound,
  type ScoreInput,
} from '../shared/scoring';

const CITY = { id: 'city' };
const BRAND = { id: 'brand', allowLatin: true };

/** მოკლე ჩანაწერი: ერთი კატეგორია, პასუხები მოთამაშეების მიხედვით */
function round(
  letter: string,
  answers: Record<string, string>,
  extra: Partial<ScoreInput> = {},
  category: { id: string; allowLatin?: boolean } = CITY,
) {
  const playerIds = Object.keys(answers);
  const result = scoreRound({
    letter,
    categories: [category],
    playerIds,
    answers: Object.fromEntries(playerIds.map((p) => [p, { [category.id]: answers[p] }])),
    rejected: new Set(),
    merges: {},
    ...extra,
  });
  return Object.fromEntries(playerIds.map((p) => [p, result[p][category.id]]));
}

describe('ნორმალიზაცია', () => {
  it('ჭრის ჰარებს და შლის ზედმეტს', () => {
    expect(normalizeAnswer('  ბათუმი  ')).toBe('ბათუმი');
    expect(normalizeAnswer('ნიუ   იორკი')).toBe(normalizeAnswer('ნიუ იორკი'));
  });
  it('ლათინურს აპატარავებს', () => {
    expect(normalizeAnswer('BMW')).toBe('bmw');
  });
  it('შლის პუნქტუაციას და დეფისებს', () => {
    expect(normalizeAnswer('კოკა-კოლა!')).toBe(normalizeAnswer('კოკა კოლა'));
    expect(normalizeAnswer('„ბორჯომი".')).toBe('ბორჯომი');
  });
  it('მხოლოდ პუნქტუაცია ცარიელად ითვლება', () => {
    expect(normalizeAnswer(' -- ')).toBe('');
  });
});

describe('ასოს შემოწმება', () => {
  it('ქართული ასო', () => {
    expect(startsWithLetter('ბათუმი', 'ბ')).toBe(true);
    expect(startsWithLetter('ქუთაისი', 'ბ')).toBe(false);
  });
  it('ლათინური მხოლოდ იქ მიიღება, სადაც ნებადართულია', () => {
    expect(startsWithLetter('Adidas', 'ა', true)).toBe(true);
    expect(startsWithLetter('BMW', 'ბ', true)).toBe(true);
    expect(startsWithLetter('Gucci', 'გ', true)).toBe(true);
    expect(startsWithLetter('Adidas', 'ა', false)).toBe(false);
    expect(startsWithLetter('Nike', 'ა', true)).toBe(false);
  });
  it('ორასოიანი ლათინური დასაწყისი', () => {
    expect(startsWithLetter('Chanel', 'ჩ', true)).toBe(true);
    expect(startsWithLetter('Shell', 'შ', true)).toBe(true);
  });
  it('checkAnswer: ცარიელი / არასწორი ასო / სწორი', () => {
    expect(checkAnswer('', 'ბ')).toBe('empty');
    expect(checkAnswer('   ', 'ბ')).toBe('empty');
    expect(checkAnswer('თბილისი', 'ბ')).toBe('wrongLetter');
    expect(checkAnswer('ბათუმი', 'ბ')).toBe('ok');
  });
});

describe('ხმის მიცემა', () => {
  it('უარყოფილია მხოლოდ ნახევარზე მეტი ხმით', () => {
    expect(isRejectedByVotes(2, 5)).toBe(false);
    expect(isRejectedByVotes(3, 5)).toBe(true);
    expect(isRejectedByVotes(2, 4)).toBe(false); // ზუსტად ნახევარი — არ არის საკმარისი
    expect(isRejectedByVotes(3, 4)).toBe(true);
    expect(isRejectedByVotes(0, 0)).toBe(false);
  });
});

describe('ქულების წესი', () => {
  it('20 — მიღებული პასუხი მხოლოდ ერთს აქვს (დანარჩენებს ცარიელი)', () => {
    const r = round('ბ', { a: 'ბათუმი', b: '', c: '', d: '' });
    expect(r.a).toMatchObject({ points: POINTS.only, reason: 'only' });
    expect(r.b).toMatchObject({ points: 0, reason: 'empty' });
  });

  it('20 — დანარჩენების პასუხი უარყოფილია ან არასწორი ასოთია', () => {
    const r = round(
      'ბ',
      { a: 'ბათუმი', b: 'ბლაბლა', c: 'თბილისი', d: '' },
      { rejected: new Set([cellKey('b', 'city')]) },
    );
    expect(r.a.points).toBe(20);
    expect(r.b).toMatchObject({ points: 0, reason: 'rejected' });
    expect(r.c).toMatchObject({ points: 0, reason: 'wrongLetter' });
    expect(r.d).toMatchObject({ points: 0, reason: 'empty' });
  });

  it('10 — უნიკალური პასუხი, როცა სხვებსაც აქვთ განსხვავებული', () => {
    const r = round('ბ', { a: 'ბათუმი', b: 'ბორჯომი', c: 'ბაღდათი', d: '' });
    expect(r.a).toMatchObject({ points: POINTS.unique, reason: 'unique' });
    expect(r.b.points).toBe(10);
    expect(r.c.points).toBe(10);
  });

  it('5 — იგივე პასუხი სხვასაც აქვს (ნორმალიზებული დამთხვევა)', () => {
    const r = round('ბ', { a: 'ბათუმი', b: '  ბათუმი ', c: 'ბათუმი!', d: 'ბორჯომი' });
    expect(r.a).toMatchObject({ points: POINTS.shared, reason: 'shared' });
    expect(r.b.points).toBe(5);
    expect(r.c.points).toBe(5);
    expect(r.d.points).toBe(10);
    expect(r.a.group).toBe(r.b.group);
    expect(r.d.group).toBeNull();
  });

  it('5 — ჰოსტის გაერთიანება ("ბათუმი" და "ბათუმ")', () => {
    const r = round(
      'ბ',
      { a: 'ბათუმი', b: 'ბათუმ', c: 'ბორჯომი' },
      { merges: { city: [['a', 'b']] } },
    );
    expect(r.a.points).toBe(5);
    expect(r.b.points).toBe(5);
    expect(r.c.points).toBe(10);
  });

  it('გაერთიანება ჯაჭვურად მუშაობს (a=b, b=c)', () => {
    const r = round(
      'ბ',
      { a: 'ბათუმი', b: 'ბათუმ', c: 'ბათომი', d: 'ბორჯომი' },
      { merges: { city: [['a', 'b'], ['b', 'c']] } },
    );
    expect([r.a.points, r.b.points, r.c.points, r.d.points]).toEqual([5, 5, 5, 10]);
  });

  it('უარყოფილ პასუხთან გაერთიანება არ ითვლება', () => {
    const r = round(
      'ბ',
      { a: 'ბათუმი', b: 'ბათუმ', c: 'ბორჯომი' },
      { merges: { city: [['a', 'b']] }, rejected: new Set([cellKey('b', 'city')]) },
    );
    expect(r.a.points).toBe(10);
    expect(r.b.points).toBe(0);
  });

  it('ერთნაირი პასუხი, რომელთაგან ერთი უარყოფილია → მეორე უნიკალურია', () => {
    const r = round(
      'ბ',
      { a: 'ბათუმი', b: 'ბათუმი', c: 'ბორჯომი' },
      { rejected: new Set([cellKey('b', 'city')]) },
    );
    expect(r.a.points).toBe(10);
  });

  it('0 — ცარიელი, არასწორი ასო, უარყოფილი', () => {
    const r = round(
      'ბ',
      { a: '', b: 'გორი', c: 'ბუ' },
      { rejected: new Set([cellKey('c', 'city')]) },
    );
    expect([r.a.points, r.b.points, r.c.points]).toEqual([0, 0, 0]);
    expect([r.a.reason, r.b.reason, r.c.reason]).toEqual(['empty', 'wrongLetter', 'rejected']);
  });

  it('ყველას ცარიელი აქვს → ყველას 0', () => {
    const r = round('ბ', { a: '', b: '', c: '' });
    expect(Object.values(r).every((c) => c.points === 0)).toBe(true);
  });

  it('ბრენდი: ლათინური პასუხი მიიღება და რეგისტრი არ მოქმედებს', () => {
    const r = round('ბ', { a: 'BMW', b: 'bmw', c: 'ბოში', d: 'Nike' }, {}, BRAND);
    expect(r.a.points).toBe(5);
    expect(r.b.points).toBe(5);
    expect(r.c.points).toBe(10);
    expect(r.d).toMatchObject({ points: 0, reason: 'wrongLetter' });
  });

  it('ჩვეულებრივ კატეგორიაში ლათინური არ მიიღება', () => {
    const r = round('ბ', { a: 'Batumi', b: 'ბათუმი' });
    expect(r.a).toMatchObject({ points: 0, reason: 'wrongLetter' });
    expect(r.b.points).toBe(20);
  });

  it('კატეგორიები ერთმანეთისგან დამოუკიდებლად ითვლება და ჯამდება', () => {
    const result = scoreRound({
      letter: 'ბ',
      categories: [CITY, BRAND],
      playerIds: ['a', 'b'],
      answers: { a: { city: 'ბათუმი', brand: 'BMW' }, b: { city: 'ბათუმი', brand: '' } },
      rejected: new Set(),
      merges: {},
    });
    expect(sumRound(result, 'a')).toBe(5 + 20);
    expect(sumRound(result, 'b')).toBe(5);
  });
});

describe('გამარჯვებული', () => {
  it('ერთი გამარჯვებული', () => {
    expect(findWinners({ a: 50, b: 30, c: 10 })).toEqual(['a']);
  });
  it('ფრე — გამარჯვება იყოფა', () => {
    expect(findWinners({ a: 50, b: 50, c: 10 }).sort()).toEqual(['a', 'b']);
  });
  it('ცარიელი სია', () => {
    expect(findWinners({})).toEqual([]);
  });
});

describe('QWERTY → ქართული', () => {
  it('გადაჰყავს სტანდარტული განლაგებით', () => {
    expect(latinToGeorgian('Tbilisi')).toBe('თბილისი');
    expect(latinToGeorgian('baTumi')).toBe('ბათუმი');
    expect(latinToGeorgian('WiaTura')).toBe('ჭიათურა');
    expect(latinToGeorgian('ქუთაისი 1')).toBe('ქუთაისი 1');
  });
});
