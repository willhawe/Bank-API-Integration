export const CATEGORIES = [
  "Transport",
  "Groceries",
  "Food",
  "Shopping",
  "Entertainment",
  "Bills",
  "Travel",
  "Other",
] as const;

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

export function categoryClassName(category: string): string {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

const CUSTOM_CATEGORIES_KEY = "customCategories";

export function loadCustomCategories(): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_CATEGORIES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function saveCustomCategories(categories: string[]): void {
  localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(categories));
}
