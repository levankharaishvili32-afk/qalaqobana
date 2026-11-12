/** QWERTY → ქართული კლავიატურის სტანდარტული განლაგება */
const MAP: Record<string, string> = {
  a: 'ა', b: 'ბ', g: 'გ', d: 'დ', e: 'ე', v: 'ვ', z: 'ზ', T: 'თ', i: 'ი', k: 'კ', l: 'ლ',
  m: 'მ', n: 'ნ', o: 'ო', p: 'პ', J: 'ჟ', r: 'რ', s: 'ს', t: 'ტ', u: 'უ', f: 'ფ', q: 'ქ',
  R: 'ღ', y: 'ყ', S: 'შ', C: 'ჩ', c: 'ც', Z: 'ძ', w: 'წ', W: 'ჭ', x: 'ხ', j: 'ჯ', h: 'ჰ',
};

/** ლათინური კლავიშებით აკრეფილი ტექსტი გადაჰყავს ქართულ ასოებზე */
export function latinToGeorgian(text: string): string {
  let out = '';
  for (const ch of text) out += MAP[ch] ?? MAP[ch.toLowerCase()] ?? ch;
  return out;
}
