import { formatGbp } from "../domain/spending";

interface SpentTodayHeaderProps {
  total: number;
  uncategorisedCount: number;
}

export function SpentTodayHeader({
  total,
  uncategorisedCount,
}: SpentTodayHeaderProps) {
  return (
    <header className="spent-header">
      <p className="spent-header__label">Spent today</p>
      <p className="spent-header__amount">{formatGbp(total)}</p>
      {uncategorisedCount > 0 && (
        <p className="spent-header__hint">
          {uncategorisedCount} transaction
          {uncategorisedCount === 1 ? "" : "s"} need categorising
        </p>
      )}
    </header>
  );
}
