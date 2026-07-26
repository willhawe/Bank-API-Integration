export function inferCategory(merchant: string): string {
  const value = merchant.toLowerCase();
  if (/(tfl|rail|railway|train|uber|bolt|taxi|bus|tube|parking|petrol|shell|bp\b)/.test(value)) {
    return "Transport";
  }
  if (/(sainsbury|tesco|waitrose|aldi|lidl|morrisons|ocado|co-op|coop|marks and spencer|m&s)/.test(value)) {
    return "Groceries";
  }
  if (/(pret|caffe|coffee|starbucks|costa|nero|greggs|leon|itsu|mcdonald|restaurant|kitchen|pizza|deliveroo|uber eats)/.test(value)) {
    return "Food";
  }
  if (/(amazon|argos|ikea|john lewis|apple|currys|boots|zara|uniqlo|h&m)/.test(value)) {
    return "Shopping";
  }
  if (/(netflix|spotify|cinema|odeon|vue|theatre|ticketmaster|games|playstation|xbox)/.test(value)) {
    return "Entertainment";
  }
  if (/(octopus|british gas|thames water|ee\b|o2\b|vodafone|three|council tax|insurance|rent|mortgage)/.test(value)) {
    return "Bills";
  }
  if (/(hotel|airline|airways|easyjet|ryanair|ba\.com|booking\.com|airbnb)/.test(value)) {
    return "Travel";
  }
  return "Other";
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  const r = match ? parseInt(match[1] as string, 16) / 255 : 0;
  const g = match ? parseInt(match[2] as string, 16) / 255 : 0;
  const b = match ? parseInt(match[3] as string, 16) / 255 : 0;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l: l * 100 };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;

  return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = (n: number) => lNorm - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (n: number) =>
    Math.round(f(n) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Derives a distinguishable tint/shade of a category's base color for one of
// its sub-categories, keyed by sort position (0 = largest amount, closest to
// the true base hue; later indices step further away in lightness).
export function shadeColor(hex: string, index: number): string {
  const { h, s, l } = hexToHsl(hex);
  const direction = index % 2 === 0 ? 1 : -1;
  const magnitude = 10 + Math.floor(index / 2) * 14; // 10, 10, 24, 24, 38, 38...
  const targetL = clamp(l + direction * magnitude, 20, 88);
  const targetS = clamp(s - Math.floor(index / 2) * 6, 35, 100);
  return hslToHex(h, targetS, targetL);
}

export interface ChartSegment {
  key: string;
  label: string | null;
  color: string;
  amountCents: number;
}

// Splits one category's bar into colored segments: one per sub-category
// (shaded tints of the category's base color, largest first), plus an
// unshaded "remainder" segment for any amount not yet assigned a
// sub-category, so the bar's total length always equals item.amountCents.
// Categories with no sub-category usage yet return [] so callers can render
// today's plain single-color bar unchanged.
export function buildBarSegments(
  item: { amountCents: number; subcategories: { subcategory: string; amountCents: number }[] },
  baseColor: string,
): ChartSegment[] {
  if (item.subcategories.length === 0) return [];

  const segments: ChartSegment[] = item.subcategories.map((sub, index) => ({
    key: sub.subcategory,
    label: sub.subcategory,
    color: shadeColor(baseColor, index),
    amountCents: sub.amountCents,
  }));

  const remainder = item.amountCents - item.subcategories.reduce((total, sub) => total + sub.amountCents, 0);
  if (remainder > 0) {
    segments.push({ key: "", label: null, color: baseColor, amountCents: remainder });
  }

  return segments;
}
