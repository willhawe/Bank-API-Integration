import type { Category, MerchantRule, Transaction } from "../domain/types";

/** Data access boundary — swap MockSpendingRepository for Supabase later. */
export interface SpendingRepository {
  getTransactions(): Promise<Transaction[]>;
  saveTransactions(transactions: Transaction[]): Promise<void>;
  getMerchantRules(): Promise<MerchantRule[]>;
  saveMerchantRules(rules: MerchantRule[]): Promise<void>;
  categoriseTransaction(
    transactionId: string,
    category: Category,
  ): Promise<Transaction[]>;
}
