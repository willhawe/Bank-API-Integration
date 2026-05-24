import { formatGbp } from "../domain/spending";
import type { Transaction } from "../domain/types";

interface TransactionRowProps {
  transaction: Transaction;
  selected: boolean;
  onSelect: () => void;
}

const ACCOUNT_LABEL: Record<Transaction["account"], string> = {
  amex: "Amex",
  chase: "Chase",
};

export function TransactionRow({
  transaction,
  selected,
  onSelect,
}: TransactionRowProps) {
  const uncategorised = !transaction.category;

  return (
    <button
      type="button"
      className={[
        "transaction-row",
        uncategorised ? "transaction-row--uncategorised" : "",
        selected ? "transaction-row--selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className="transaction-row__main">
        <span className="transaction-row__merchant">{transaction.merchant}</span>
        <span className="transaction-row__amount">
          {formatGbp(transaction.amount)}
        </span>
      </div>
      <div className="transaction-row__meta">
        <span className="transaction-row__account">
          {ACCOUNT_LABEL[transaction.account]}
        </span>
        {transaction.category ? (
          <span
            className={`transaction-row__badge transaction-row__badge--${transaction.category.toLowerCase()}`}
          >
            {transaction.autoCategorised
              ? `${transaction.category} · rule`
              : transaction.category}
          </span>
        ) : (
          <span className="transaction-row__badge transaction-row__badge--needs">
            Tap to categorise
          </span>
        )}
      </div>
    </button>
  );
}
