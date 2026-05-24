import { useCallback, useEffect, useMemo, useState } from "react";
import { createSpendingRepository } from "../data";
import type { SpendingRepository } from "../data/SpendingRepository";
import {
  accountTotals,
  buildDailyTotals,
  categoryTotals,
  filterLastNDays,
  filterToday,
  formatGbp,
  sumAmount,
} from "../domain/spending";
import type { AccountTotals, Category, DailyTotal, Transaction } from "../domain/types";
import { syncWidgetTotal } from "../plugins/WidgetBridge";

interface SpendingState {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
}

export function useSpendingTracker(
  repository: SpendingRepository = createSpendingRepository(),
) {
  const [state, setState] = useState<SpendingState>({
    transactions: [],
    loading: true,
    error: null,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const transactions = await repository.getTransactions();
      setState({ transactions, loading: false, error: null });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Failed to load",
      }));
    }
  }, [repository]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const todayTransactions = useMemo(
    () => filterToday(state.transactions),
    [state.transactions],
  );

  const spentToday = useMemo(
    () => sumAmount(todayTransactions),
    [todayTransactions],
  );

  useEffect(() => {
    void syncWidgetTotal(formatGbp(spentToday));
  }, [spentToday]);

  const totalsByCategory = useMemo(
    () => categoryTotals(todayTransactions),
    [todayTransactions],
  );

  const uncategorisedCount = useMemo(
    () => todayTransactions.filter((t) => !t.category).length,
    [todayTransactions],
  );

  const weekTransactions = useMemo(
    () => filterLastNDays(state.transactions, 7),
    [state.transactions],
  );

  const weekTotal = useMemo(
    () => sumAmount(weekTransactions),
    [weekTransactions],
  );

  const weekDailyTotals = useMemo(
    (): DailyTotal[] => buildDailyTotals(weekTransactions),
    [weekTransactions],
  );

  const todayAccountTotals = useMemo(
    (): AccountTotals => accountTotals(todayTransactions),
    [todayTransactions],
  );

  const categorise = useCallback(
    async (transactionId: string, category: Category) => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const transactions = await repository.categoriseTransaction(
          transactionId,
          category,
        );
        setState({ transactions, loading: false, error: null });
        setSelectedId(null);
      } catch (e) {
        setState((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : "Failed to save",
        }));
      }
    },
    [repository],
  );

  const resetDemoData = useCallback(async () => {
    localStorage.removeItem("spending-tracker:transactions");
    localStorage.removeItem("spending-tracker:merchant-rules");
    await refresh();
    setSelectedId(null);
  }, [refresh]);

  return {
    todayTransactions,
    spentToday,
    totalsByCategory,
    uncategorisedCount,
    weekTotal,
    weekDailyTotals,
    todayAccountTotals,
    loading: state.loading,
    error: state.error,
    selectedId,
    setSelectedId,
    categorise,
    resetDemoData,
  };
}
