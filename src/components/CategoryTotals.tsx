import { formatGbp } from "../domain/spending";
import type { CategoryTotal } from "../domain/types";

interface CategoryTotalsProps {
  totals: CategoryTotal[];
}

export function CategoryTotals({ totals }: CategoryTotalsProps) {
  if (totals.length === 0) return null;

  return (
    <section className="category-totals" aria-label="Spending by category today">
      <h2 className="section-title">By category</h2>
      <ul className="category-totals__list">
        {totals.map(({ category, total }) => (
          <li key={category} className="category-totals__item">
            <span
              className={`category-totals__dot category-totals__dot--${category.toLowerCase()}`}
            />
            <span className="category-totals__label">{category}</span>
            <span className="category-totals__value">{formatGbp(total)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
