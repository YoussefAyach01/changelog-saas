function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Text colour (dark ink or white) with the better contrast on the given #rrggbb background. */
export function readableInk(bg: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(bg)) return "#ffffff";
  const L = lum(bg);
  return 1.05 / (L + 0.05) >= (L + 0.05) / (lum("#0b1b33") + 0.05) ? "#ffffff" : "#0b1b33";
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
