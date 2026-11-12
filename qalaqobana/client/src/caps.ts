/**
 * ქართული მხედრული → მთავრული (ბრენდის სათაურების სტილი).
 * ბრაუზერები ქართულს CSS-ის text-transform-ით არ ადიდებენ, ამიტომ გადაყვანა კოდით ხდება.
 */
export function caps(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    out += code >= 0x10d0 && code <= 0x10fa ? String.fromCodePoint(code + 0xbc0) : ch.toUpperCase();
  }
  return out;
}
