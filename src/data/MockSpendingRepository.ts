import type { Category, MerchantRule, Transaction } from "../domain/types";
import {
  applyRulesToTransactions,
  upsertMerchantRule,
} from "../rules/merchantRules";
import type { SpendingRepository } from "./SpendingRepository";
import { MOCK_TRANSACTIONS } from "./mockTransactions";

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

export class MockSpendingRepository implements SpendingRepository {
  async getTransactions(): Promise<Transaction[]> {
    const stored = loadJson<Transaction[] | null>(TX_KEY, null);
    const base = stored ?? structuredClone(MOCK_TRANSACTIONS);
    const rules = await this.getMerchantRules();
    return applyRulesToTransactions(base, rules);
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

    const updatedRules = upsertMerchantRule(
      rules,
      target.merchant,
      category,
    );
    await this.saveMerchantRules(updatedRules);

    const updated = transactions.map((t) => {
      const matchesMerchant =
        t.merchant.trim().toLowerCase() ===
        target.merchant.trim().toLowerCase();
      if (t.id === transactionId || (matchesMerchant && !t.category)) {
        return {
          ...t,
          category,
          autoCategorised: t.id !== transactionId ? true : false,
        };
      }
      return t;
    });

    await this.saveTransactions(
      updated.map((t) => ({
        ...t,
        autoCategorised: t.autoCategorised ? true : undefined,
      })),
    );

    return this.getTransactions();
  }
}
