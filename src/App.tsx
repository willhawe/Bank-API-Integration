import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";
import { AccountSplit } from "./components/AccountSplit";
import { CategoryPicker } from "./components/CategoryPicker";
import { CategoryTotals } from "./components/CategoryTotals";
import { ConnectBanks } from "./components/ConnectBanks";
import { SpentTodayHeader } from "./components/SpentTodayHeader";
import { TransactionRow } from "./components/TransactionRow";
import { WeeklyChart } from "./components/WeeklyChart";
import { hasTrueLayerToken, saveTrueLayerToken } from "./data";
import { useSpendingTracker } from "./hooks/useSpendingTracker";

function extractToken(search: string): { token: string; expires: number } | null {
  const params = new URLSearchParams(search);
  const token = params.get("tl_token");
  const expires = params.get("tl_expires");
  if (token && expires) return { token, expires: Number(expires) };
  return null;
}

function useTokenFromUrl() {
  const [connected, setConnected] = useState(hasTrueLayerToken);

  // Web: token arrives in URL search params after OAuth redirect
  useEffect(() => {
    const result = extractToken(window.location.search);
    if (result) {
      saveTrueLayerToken(result.token, result.expires);
      setConnected(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("tl_error")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Native: token arrives via deep link care.bramble.spending://callback?tl_token=...
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapApp.addListener("appUrlOpen", async ({ url }) => {
      const result = extractToken(new URL(url).search);
      if (result) {
        saveTrueLayerToken(result.token, result.expires);
        setConnected(true);
        await Browser.close();
      }
    });

    return () => { void listener.then((l) => l.remove()); };
  }, []);

  return { connected, setConnected };
}

export default function App() {
  const { connected, setConnected } = useTokenFromUrl();

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

      <ConnectBanks
        connected={connected}
        onDisconnect={() => {
          setConnected(false);
          void resetDemoData();
        }}
      />

      <WeeklyChart dailyTotals={weekDailyTotals} weekTotal={weekTotal} />

      <AccountSplit totals={todayAccountTotals} />

      <CategoryTotals totals={totalsByCategory} />

      <section className="transactions-section">
        <div className="section-header">
          <h2 className="section-title">Today&apos;s transactions</h2>
          {!connected && (
            <button
              type="button"
              className="text-btn"
              onClick={() => void resetDemoData()}
            >
              Reset demo
            </button>
          )}
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
