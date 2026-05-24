import { todayIso } from "../domain/spending";
import { applyRulesToTransactions, upsertMerchantRule } from "../rules/merchantRules";
import type { BankAccount, Category, MerchantRule, Transaction } from "../domain/types";
import type { SpendingRepository } from "./SpendingRepository";

const TX_KEY = "spending-tracker:transactions";
const RULES_KEY = "spending-tracker:merchant-rules";

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function nDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayIso(d);
}

function mapAccount(displayName: string): BankAccount {
  const lower = (displayName ?? "").toLowerCase();
  if (lower.includes("amex") || lower.includes("american express")) return "amex";
  return "chase";
}

interface RawTx {
  transaction_id: string;
  timestamp: string;
  merchant: string;
  amount: number;
  account_display_name: string;
}

export class TrueLayerRepository implements SpendingRepository {
  constructor(private readonly accessToken: string) {}

  async getTransactions(): Promise<Transaction[]> {
    const from = nDaysAgo(7);
    const to = todayIso();

    const res = await fetch(
      `/api/transactions?access_token=${encodeURIComponent(this.accessToken)}&from=${from}&to=${to}`,
    );

    if (!res.ok) throw new Error("Failed to fetch transactions from TrueLayer");

    const { transactions: raw } = (await res.json()) as { transactions: RawTx[] };

    // Map to our Transaction shape
    const fresh: Transaction[] = raw.map((tx) => ({
      id: tx.transaction_id,
      merchant: tx.merchant,
      amount: tx.amount,
      date: tx.timestamp.slice(0, 10),
      account: mapAccount(tx.account_display_name),
      category: null,
    }));

    // Overlay saved categories (keyed by id) so categorisation survives refreshes
    const saved = loadJson<Transaction[]>(TX_KEY, []);
    const categoryById = new Map(saved.map((t) => [t.id, t.category]));
    const autoCatById = new Map(saved.map((t) => [t.id, t.autoCategorised]));

    const withCategories = fresh.map((t) => ({
      ...t,
      category: categoryById.get(t.id) ?? null,
      autoCategorised: autoCatById.get(t.id),
    }));

    const rules = await this.getMerchantRules();
    const result = applyRulesToTransactions(withCategories, rules);
    saveJson(TX_KEY, result);
    return result;
  }

  async saveTransactions(transactions: Transaction[]): Promise<void> {
    saveJson(TX_KEY, transactions);
  }

  async getMerchantRules(): Promise<MerchantRule[]> {
    return loadJson<MerchantRule[]>(RULES_KEY, []);
  }

  async saveMerchantRules(rules: MerchantRule[]): Promise<void> {
    saveJson(RULES_KEY, rules);
  }

  async categoriseTransaction(
    transactionId: string,
    category: Category,
  ): Promise<Transaction[]> {
    const [transactions, rules] = await Promise.all([
      this.getTransactions(),
      this.getMerchantRules(),
    ]);

    const target = transactions.find((t) => t.id === transactionId);
    if (!target) return transactions;

    const updatedRules = upsertMerchantRule(rules, target.merchant, category);
    await this.saveMerchantRules(updatedRules);

    const updated = transactions.map((t) => {
      const matchesMerchant =
        t.merchant.trim().toLowerCase() === target.merchant.trim().toLowerCase();
      if (t.id === transactionId || (matchesMerchant && !t.category)) {
        return { ...t, category, autoCategorised: t.id !== transactionId || undefined };
      }
      return t;
    });

    await this.saveTransactions(updated);
    return updated;
  }
}
