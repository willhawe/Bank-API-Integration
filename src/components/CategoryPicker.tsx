import { CATEGORIES, type Category } from "../domain/types";

interface CategoryPickerProps {
  onSelect: (category: Category) => void;
  disabled?: boolean;
}

export function CategoryPicker({ onSelect, disabled }: CategoryPickerProps) {
  return (
    <div className="category-picker" role="group" aria-label="Choose category">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          type="button"
          className={`category-btn category-btn--${cat.toLowerCase()}`}
          onClick={() => onSelect(cat)}
          disabled={disabled}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
