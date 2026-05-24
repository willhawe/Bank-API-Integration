export const CATEGORIES = [
  "Alcohol",
  "Food",
  "Coffee",
  "Transport",
  "Bills",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type BankAccount = "amex" | "chase";

export interface Transaction {
  id: string;
  merchant: string;
  amount: number;
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  account: BankAccount;
  category: Category | null;
  /** True when category was inferred from a merchant rule */
  autoCategorised?: boolean;
}

export interface CategoryTotal {
  category: Category;
  total: number;
}

export interface DailyTotal {
  date: string;
  total: number;
}

export interface AccountTotals {
  amex: number;
  chase: number;
}

export interface MerchantRule {
  merchantPattern: string;
  category: Category;
}
