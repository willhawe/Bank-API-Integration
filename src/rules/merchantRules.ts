import type { Category, MerchantRule, Transaction } from "../domain/types";

/** Normalise merchant names for rule matching (case-insensitive, trimmed). */
export function normaliseMerchant(merchant: string): string {
  return merchant.trim().toLowerCase();
}

export function findRuleForMerchant(
  merchant: string,
  rules: MerchantRule[],
): MerchantRule | undefined {
  const key = normaliseMerchant(merchant);
  return rules.find((r) => normaliseMerchant(r.merchantPattern) === key);
}

export function upsertMerchantRule(
  rules: MerchantRule[],
  merchant: string,
  category: Category,
): MerchantRule[] {
  const pattern = merchant.trim();
  const key = normaliseMerchant(pattern);
  const without = rules.filter(
    (r) => normaliseMerchant(r.merchantPattern) !== key,
  );
  return [...without, { merchantPattern: pattern, category }];
}

/** Apply saved rules to uncategorised transactions. */
export function applyRulesToTransactions(
  transactions: Transaction[],
  rules: MerchantRule[],
): Transaction[] {
  return transactions.map((tx) => {
    if (tx.category) return tx;
    const rule = findRuleForMerchant(tx.merchant, rules);
    if (!rule) return tx;
    return {
      ...tx,
      category: rule.category,
      autoCategorised: true,
    };
  });
}
