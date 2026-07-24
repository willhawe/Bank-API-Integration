export interface ExtractedItem {
  name: string;
  priceCents: number;
}

const EXCLUDE_KEYWORDS = [
  "total",
  "subtotal",
  "sub total",
  "balance",
  "change due",
  "cash",
  "card",
  "visa",
  "mastercard",
  "amex",
  "contactless",
  "vat",
  "tax",
  "amount",
  "thank you",
  "thanks for",
  "receipt",
  "items sold",
  "loyalty",
  "points earned",
  "savings",
  "you saved",
  "clubcard",
  "nectar",
  "balance to pay",
  "tender",
];

export async function extractReceiptItems(imageDataUrl: string): Promise<ExtractedItem[]> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(imageDataUrl);
    return parseReceiptText(text);
  } finally {
    await worker.terminate();
  }
}

export function parseReceiptText(text: string): ExtractedItem[] {
  const items: ExtractedItem[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const lower = line.toLowerCase();
    if (EXCLUDE_KEYWORDS.some((keyword) => lower.includes(keyword))) continue;

    const priceMatch = line.match(/£?\s*(\d{1,3}(?:,\d{3})*\.\d{2})\s*$/);
    if (!priceMatch?.[1] || priceMatch.index === undefined) continue;

    const priceCents = Math.round(Number(priceMatch[1].replace(/,/g, "")) * 100);
    if (priceCents <= 0) continue;

    const name = line
      .slice(0, priceMatch.index)
      .replace(/[*#]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (!name || name.length < 2 || /^\d+$/.test(name)) continue;

    items.push({ name, priceCents });
  }

  return items;
}
