import { AccountSplit } from "./components/AccountSplit";
import { CategoryPicker } from "./components/CategoryPicker";
import { CategoryTotals } from "./components/CategoryTotals";
import { SpentTodayHeader } from "./components/SpentTodayHeader";
import { TransactionRow } from "./components/TransactionRow";
import { WeeklyChart } from "./components/WeeklyChart";
import { useSpendingTracker } from "./hooks/useSpendingTracker";

export default function App() {
  const {
    todayTransactions,
    spentToday,
    totalsByCategory,
    uncategorisedCount,
    weekTotal,
    weekDailyTotals,
    todayAccountTotals,
    loading,
    error,
    selectedId,
    setSelectedId,
    categorise,
    resetDemoData,
  } = useSpendingTracker();

  const selected = todayTransactions.find((t) => t.id === selectedId);

  return (
    <div className="app">
      <SpentTodayHeader
        total={spentToday}
        uncategorisedCount={uncategorisedCount}
      />

      <WeeklyChart dailyTotals={weekDailyTotals} weekTotal={weekTotal} />

      <AccountSplit totals={todayAccountTotals} />

      <CategoryTotals totals={totalsByCategory} />

      <section className="transactions-section">
        <div className="section-header">
          <h2 className="section-title">Today&apos;s transactions</h2>
          <button
            type="button"
            className="text-btn"
            onClick={() => void resetDemoData()}
          >
            Reset demo
          </button>
        </div>

        {error && <p className="error-banner">{error}</p>}
        {loading && todayTransactions.length === 0 && (
          <p className="loading">Loading…</p>
        )}

        <ul className="transaction-list">
          {todayTransactions.map((tx) => (
            <li key={tx.id}>
              <TransactionRow
                transaction={tx}
                selected={tx.id === selectedId}
                onSelect={() =>
                  setSelectedId((id) => (id === tx.id ? null : tx.id))
                }
              />
            </li>
          ))}
        </ul>

        {todayTransactions.length === 0 && !loading && (
          <p className="empty-state">No transactions today.</p>
        )}
      </section>

      {selected && (
        <footer className="categorise-panel">
          <p className="categorise-panel__prompt">
            Categorise <strong>{selected.merchant}</strong>
            <span className="categorise-panel__sub">
              Future {selected.merchant} payments will use this category
            </span>
          </p>
          <CategoryPicker
            disabled={loading}
            onSelect={(category) => void categorise(selected.id, category)}
          />
        </footer>
      )}
    </div>
  );
}
