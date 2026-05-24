import type { AccountTotals, Category, CategoryTotal, DailyTotal, Transaction } from "./types";

export function isSameDay(isoDate: string, reference: Date = new Date()): boolean {
  const d = new Date(isoDate + "T12:00:00");
  return (
    d.getFullYear() === reference.getFullYear() &&
    d.getMonth() === reference.getMonth() &&
    d.getDate() === reference.getDate()
  );
}

export function todayIso(reference: Date = new Date()): string {
  const y = reference.getFullYear();
  const m = String(reference.getMonth() + 1).padStart(2, "0");
  const d = String(reference.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function filterToday(
  transactions: Transaction[],
  reference: Date = new Date(),
): Transaction[] {
  return transactions.filter((t) => isSameDay(t.date, reference));
}

export function sumAmount(transactions: Transaction[]): number {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

export function categoryTotals(
  transactions: Transaction[],
): CategoryTotal[] {
  const map = new Map<Category, number>();
  for (const t of transactions) {
    if (!t.category) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

export function formatGbp(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount);
}

export function filterLastNDays(
  transactions: Transaction[],
  n: number,
  reference: Date = new Date(),
): Transaction[] {
  const cutoff = new Date(reference);
  cutoff.setDate(cutoff.getDate() - (n - 1));
  const cutoffDate = todayIso(cutoff);
  return transactions.filter((t) => t.date >= cutoffDate);
}

export function buildDailyTotals(
  transactions: Transaction[],
  days = 7,
  reference: Date = new Date(),
): DailyTotal[] {
  const result: DailyTotal[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(reference);
    d.setDate(d.getDate() - i);
    const date = todayIso(d);
    result.push({
      date,
      total: sumAmount(transactions.filter((t) => t.date === date)),
    });
  }
  return result;
}

export function accountTotals(transactions: Transaction[]): AccountTotals {
  return {
    amex: sumAmount(transactions.filter((t) => t.account === "amex")),
    chase: sumAmount(transactions.filter((t) => t.account === "chase")),
  };
}
