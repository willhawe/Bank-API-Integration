import { formatGbp } from "../domain/spending";
import type { AccountTotals } from "../domain/types";

interface AccountSplitProps {
  totals: AccountTotals;
}

export function AccountSplit({ totals }: AccountSplitProps) {
  if (totals.amex === 0 && totals.chase === 0) return null;

  return (
    <div className="account-split" aria-label="Spending by card today">
      <div className="account-split__card account-split__card--amex">
        <span className="account-split__label">Amex</span>
        <span className="account-split__amount">{formatGbp(totals.amex)}</span>
      </div>
      <div className="account-split__card account-split__card--chase">
        <span className="account-split__label">Chase</span>
        <span className="account-split__amount">{formatGbp(totals.chase)}</span>
      </div>
    </div>
  );
}
