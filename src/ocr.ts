export interface ExtractedItem {
  name: string;
  priceCents: number;
}

// Covers both printed till receipts and on-screen self-checkout displays
// (running totals, prompts, and UI chrome that isn't a purchased item).
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
  // self-checkout screen chrome
  "please scan",
  "scan item",
  "scan next",
  "scan your",
  "start scanning",
  "place item in bag",
  "place in bagging",
  "bagging area",
  "unexpected item",
  "remove item",
  "weigh item",
  "please wait",
  "please take",
  "call for assistance",
  "assistance required",
  "assistance needed",
  "attendant",
  "help needed",
  "press start",
  "continue shopping",
  "finish and pay",
  "finish shopping",
  "pay now",
  "select payment",
  "insert card",
  "tap card",
  "swipe card",
  "self checkout",
  "self-checkout",
  "your basket",
  "in basket",
  "running total",
  "number of items",
];

export async function extractReceiptItems(imageDataUrl: string): Promise<ExtractedItem[]> {
  const preprocessed = await preprocessForOcr(imageDataUrl);
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const {
      data: { text },
    } = await worker.recognize(preprocessed);
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

    const name = cleanItemName(line.slice(0, priceMatch.index));
    if (!name || name.length < 2 || /^\d+$/.test(name)) continue;

    items.push({ name, priceCents });
  }

  return items;
}

function cleanItemName(raw: string): string {
  return raw
    .replace(/^\d+\s*[x@]\s+/i, "") // leading "3 x " quantity multiplier
    .replace(/\d+\s*@\s*£?\d+(?:\.\d{2})?/gi, "") // "2 @ £0.75" unit-price fragment
    .replace(/\bx\s*\d+\b/gi, "") // trailing "x3"
    .replace(/[*#]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Photographed receipts and self-checkout screens both suffer from uneven
// lighting/glare; a grayscale + contrast pass measurably improves Tesseract's
// hit rate on both without needing separate code paths for each.
async function preprocessForOcr(dataUrl: string): Promise<string> {
  try {
    const image = await loadImage(dataUrl);
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      const gray = r * 0.299 + g * 0.587 + b * 0.114;
      const contrasted = clamp((gray - 128) * 1.4 + 128);
      data[i] = contrasted;
      data[i + 1] = contrasted;
      data[i + 2] = contrasted;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    return dataUrl;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image for OCR preprocessing"));
    image.src = src;
  });
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, value));
}
