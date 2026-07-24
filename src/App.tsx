import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { NotificationScanner } from "./components/NotificationScanner";
import { parseStatementFile } from "./importPayments";
import {
  addManualPayment,
  canUseNotificationAccess,
  deletePayment,
  getNotificationSummary,
  openNotificationAccessSettings,
  setPaymentCategory,
  syncCategoryBreakdown,
  type ScannedPayment,
} from "./plugins/WidgetBridge";
import {
  syncPayments,
  getSupabaseRowUrl,
  isSupabaseConfigured,
  getTransactionBreakdown,
  getMonthlyCategoryTotals,
  getPaymentsForPeriod,
  updatePaymentCategory,
  markPaymentDeleted,
  saveReceiptImage,
  uploadReceiptPhoto,
  savePhoto,
  uploadMomentPhoto,
  addReceiptItem,
  removeReceiptItem,
  importStatementTransactions,
  getUnmatchedStatementRows,
  getOrphanTransactionCandidates,
  linkStatementTransaction,
  type SyncStatus,
  type TransactionBreakdown,
  type CategoryRange,
  type CategoryTotal,
  type StatementTransaction,
  type ReceiptItem,
} from "./supabase";
import { captureReceiptPhoto } from "./receipt";
import { extractReceiptItems } from "./ocr";
import {
  CATEGORIES,
  categoryClassName,
  inferCategory,
  loadCustomCategories,
  saveCustomCategories,
} from "./categories";

export default function App() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("not-configured");
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [openPaymentMenuId, setOpenPaymentMenuId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [breakdowns, setBreakdowns] = useState<Record<string, TransactionBreakdown>>({});
  const [scanBusyId, setScanBusyId] = useState<string | null>(null);
  const [momentBusyId, setMomentBusyId] = useState<string | null>(null);
  const [momentMessage, setMomentMessage] = useState("");
  const [itemDraftName, setItemDraftName] = useState("");
  const [itemDraftPrice, setItemDraftPrice] = useState("");
  const [breakdownMessage, setBreakdownMessage] = useState("");
  const [customCategories, setCustomCategories] = useState<string[]>(() => loadCustomCategories());
  const [categoryDraft, setCategoryDraft] = useState("");
  const [periodRange, setPeriodRange] = useState<CategoryRange>("month");
  const [periodDate, setPeriodDate] = useState(() => new Date());
  const [periodPayments, setPeriodPayments] = useState<ScannedPayment[]>([]);
  const [periodTotals, setPeriodTotals] = useState<CategoryTotal[]>([]);
  const [periodTotalCents, setPeriodTotalCents] = useState(0);
  const [orphanedIds, setOrphanedIds] = useState<Set<string>>(new Set());
  const [unmatchedStatementRows, setUnmatchedStatementRows] = useState<StatementTransaction[]>([]);
  const [linkingStatementId, setLinkingStatementId] = useState<string | null>(null);
  const [linkCandidates, setLinkCandidates] = useState<ScannedPayment[]>([]);
  const [linkMessage, setLinkMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const next = await getNotificationSummary();
      if (cancelled) return;
      setSyncStatus(await syncPayments(next.payments));
      await syncMonthlyCategoryWidget();
      await loadPeriodData();
      await loadUnmatchedStatementRows();
    }

    void refresh();
    const id = window.setInterval(() => void refresh(), 2000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [periodRange, periodDate]);

  useEffect(() => {
    document.body.style.overflow = openPaymentMenuId ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [openPaymentMenuId]);

  async function syncMonthlyCategoryWidget() {
    const totals = await getMonthlyCategoryTotals();
    await syncCategoryBreakdown(totals);
  }

  async function loadPeriodData() {
    const result = await getPaymentsForPeriod(periodRange, periodDate);
    setPeriodPayments(result.payments);
    setPeriodTotals(result.totals);
    setPeriodTotalCents(result.totalCents);
    setOrphanedIds(new Set(result.orphanedIds));
  }

  async function loadUnmatchedStatementRows() {
    setUnmatchedStatementRows(await getUnmatchedStatementRows());
  }

  async function refreshSummary() {
    const next = await getNotificationSummary();
    setSyncStatus(await syncPayments(next.payments));
    await syncMonthlyCategoryWidget();
    await loadPeriodData();
  }

  async function addPayment() {
    const amountCents = parseAmountCents(amount);
    if (!merchant.trim() || amountCents <= 0) {
      setFormMessage("Enter a merchant and amount.");
      return;
    }

    try {
      await addManualPayment(merchant, amountCents);
      setMerchant("");
      setAmount("");
      setFormMessage("Added.");
      await refreshSummary();
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Could not add payment.");
    }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    setImportMessage("Reading file...");
    try {
      const statement = await parseStatementFile(file);
      if (statement.rows.length === 0) {
        setImportMessage("No transactions found.");
        return;
      }
      if (!isSupabaseConfigured()) {
        setImportMessage("Statement parsed, but Supabase is not configured in this build.");
        return;
      }
      const result = await importStatementTransactions(statement.rows, statement.source, file.name);
      setImportMessage(
        `Imported ${result.inserted} transaction${result.inserted === 1 ? "" : "s"} — ` +
          `${result.matched} matched to notifications` +
          (result.unmatched > 0 ? `, ${result.unmatched} need manual linking.` : "."),
      );
      await loadUnmatchedStatementRows();
      await loadPeriodData();
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Could not import file.");
    }
  }

  async function startLinking(statementId: string, statementRow: StatementTransaction) {
    setLinkingStatementId(statementId);
    setLinkMessage("");
    setLinkCandidates(await getOrphanTransactionCandidates(statementRow));
  }

  function cancelLinking() {
    setLinkingStatementId(null);
    setLinkCandidates([]);
    setLinkMessage("");
  }

  async function confirmLink(statementId: string, transactionId: string) {
    const ok = await linkStatementTransaction(statementId, transactionId);
    if (!ok) {
      setLinkMessage("Could not link transaction.");
      return;
    }
    cancelLinking();
    await loadUnmatchedStatementRows();
    await loadPeriodData();
  }

  async function openScannerSettings() {
    if (!canUseNotificationAccess()) return;

    try {
      await openNotificationAccessSettings();
      setSettingsOpen(false);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Could not open Android settings.");
    }
  }

  async function removePayment(id: string) {
    // Best-effort native-cache delete (keeps today's widget total right);
    // silently no-ops off-device or once the payment has left the daily
    // cache, so Supabase below is the source of truth — mirrors chooseCategory.
    try {
      await deletePayment(id);
    } catch {
      // native store unavailable (e.g. web build)
    }

    const ok = await markPaymentDeleted(id);
    if (!ok) setFormMessage("Could not delete payment.");
    setOpenPaymentMenuId(null);
    await refreshSummary();
  }

  async function chooseCategory(id: string, category: string) {
    // Best-effort: keeps the native widget's cache in sync, but this silently
    // no-ops if the payment already rolled out of the native today-cache
    // (or was added via manual entry/import), so it must never be relied on
    // as the source of truth — Supabase is updated directly below instead.
    try {
      await setPaymentCategory(id, category);
    } catch {
      // native store unavailable (e.g. web build) — ignore, Supabase update still applies
    }

    const ok = await updatePaymentCategory(id, category);
    if (!ok) {
      setFormMessage("Could not set category.");
    }
    setOpenPaymentMenuId(null);
    await refreshSummary();
  }

  async function addCategory(id: string) {
    const name = categoryDraft.trim();
    if (!name) return;

    const isNew = ![...CATEGORIES, ...customCategories].some(
      (option) => option.toLowerCase() === name.toLowerCase(),
    );
    if (isNew) {
      const next = [...customCategories, name];
      setCustomCategories(next);
      saveCustomCategories(next);
    }

    setCategoryDraft("");
    await chooseCategory(id, name);
  }

  function togglePaymentMenu(id: string) {
    const opening = openPaymentMenuId !== id;
    setOpenPaymentMenuId(opening ? id : null);
    setItemDraftName("");
    setItemDraftPrice("");
    setBreakdownMessage("");
    setMomentMessage("");
    setCategoryDraft("");
    if (opening && !breakdowns[id]) {
      void loadBreakdown(id);
    }
  }

  async function loadBreakdown(id: string) {
    const detail = await getTransactionBreakdown(id);
    if (detail) setBreakdowns((prev) => ({ ...prev, [id]: detail }));
  }

  async function scanReceipt(id: string) {
    setScanBusyId(id);
    setBreakdownMessage("");
    try {
      const image = await captureReceiptPhoto();
      if (!image) {
        setBreakdownMessage("No photo captured.");
        return;
      }

      const uploadedUrl = await uploadReceiptPhoto(id, image);
      const saved = uploadedUrl ? await saveReceiptImage(id, uploadedUrl) : false;
      if (!saved || !uploadedUrl) {
        setBreakdownMessage("Could not save receipt photo.");
        return;
      }

      setBreakdowns((prev) => ({
        ...prev,
        [id]: { items: prev[id]?.items ?? [], receiptImage: uploadedUrl, photoUrl: prev[id]?.photoUrl ?? null },
      }));
      setBreakdownMessage("Receipt saved. Reading items...");

      const extracted = await extractReceiptItems(image);
      if (extracted.length === 0) {
        setBreakdownMessage("Receipt saved. No items detected — add them manually below.");
        return;
      }

      const added: ReceiptItem[] = [];
      for (const item of extracted) {
        const saved = await addReceiptItem(id, item.name, item.priceCents);
        if (saved) added.push(saved);
      }

      setBreakdowns((prev) => ({
        ...prev,
        [id]: {
          receiptImage: uploadedUrl,
          photoUrl: prev[id]?.photoUrl ?? null,
          items: [...(prev[id]?.items ?? []), ...added],
        },
      }));
      setBreakdownMessage(
        added.length > 0
          ? `Receipt saved. Added ${added.length} item${added.length === 1 ? "" : "s"} — review and edit below.`
          : "Receipt saved. Could not read items — add them manually below.",
      );
    } finally {
      setScanBusyId(null);
    }
  }

  async function takePhoto(id: string) {
    setMomentBusyId(id);
    setMomentMessage("");
    try {
      const image = await captureReceiptPhoto();
      if (!image) {
        setMomentMessage("No photo captured.");
        return;
      }

      const uploadedUrl = await uploadMomentPhoto(id, image);
      const saved = uploadedUrl ? await savePhoto(id, uploadedUrl) : false;
      if (!saved || !uploadedUrl) {
        setMomentMessage("Could not save photo.");
        return;
      }

      setBreakdowns((prev) => ({
        ...prev,
        [id]: {
          items: prev[id]?.items ?? [],
          receiptImage: prev[id]?.receiptImage ?? null,
          photoUrl: uploadedUrl,
        },
      }));
      setMomentMessage("Photo saved.");
    } finally {
      setMomentBusyId(null);
    }
  }

  async function addItem(id: string) {
    const name = itemDraftName.trim();
    const priceCents = parseAmountCents(itemDraftPrice);
    if (!name || priceCents <= 0) {
      setBreakdownMessage("Enter an item name and price.");
      return;
    }

    const item = await addReceiptItem(id, name, priceCents);
    if (item) {
      setBreakdowns((prev) => ({
        ...prev,
        [id]: {
          receiptImage: prev[id]?.receiptImage ?? null,
          photoUrl: prev[id]?.photoUrl ?? null,
          items: [...(prev[id]?.items ?? []), item],
        },
      }));
      setItemDraftName("");
      setItemDraftPrice("");
      setBreakdownMessage("");
    } else {
      setBreakdownMessage("Could not save item.");
    }
  }

  async function removeItem(id: string, itemId: number) {
    const ok = await removeReceiptItem(itemId);
    if (ok) {
      setBreakdowns((prev) => ({
        ...prev,
        [id]: {
          receiptImage: prev[id]?.receiptImage ?? null,
          photoUrl: prev[id]?.photoUrl ?? null,
          items: (prev[id]?.items ?? []).filter((item) => item.id !== itemId),
        },
      }));
    }
  }

  const maxCategoryAmount = Math.max(0, ...periodTotals.map((item) => item.amountCents));
  const categoryTotals = periodTotals.map((item) => ({
    ...item,
    percent: maxCategoryAmount > 0 ? Math.max(6, Math.round((item.amountCents / maxCategoryAmount) * 100)) : 0,
  }));

  return (
    <main className="app app--scanner">
      <section className="scanner-total">
        <div className="scanner-total__top">
          <p className="scanner-total__label">Spent</p>
          <div className="settings-shell">
            <button
              type="button"
              className="settings-cog"
              aria-expanded={settingsOpen}
              aria-label="Open settings"
              title="Settings"
              onClick={() => setSettingsOpen((open) => !open)}
            >
              <Settings aria-hidden="true" size={22} strokeWidth={2.25} />
            </button>
            {settingsOpen && (
              <div className="settings-menu">
                <button
                  type="button"
                  className="settings-menu__item"
                  disabled={!canUseNotificationAccess()}
                  onClick={() => void openScannerSettings()}
                >
                  Notification scanner settings
                </button>
                <div className="settings-menu__section">
                  <p className="settings-menu__label">Add missed payment</p>
                  <div className="settings-menu__fields">
                    <input
                      value={merchant}
                      onChange={(event) => setMerchant(event.target.value)}
                      placeholder="Merchant"
                      inputMode="text"
                    />
                    <input
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="Amount"
                      inputMode="decimal"
                    />
                    <button type="button" onClick={() => void addPayment()}>
                      Add
                    </button>
                  </div>
                  {formMessage && <p className="manual-entry__message">{formMessage}</p>}
                </div>
                <div className="settings-menu__section">
                  <p className="settings-menu__label">Import payments</p>
                  <label className="file-picker">
                    <input
                      type="file"
                      accept=".csv,.pdf,text/csv,application/pdf"
                      onChange={(event) => void importFile(event.target.files?.[0])}
                    />
                    Upload CSV or PDF
                  </label>
                  {importMessage && <p className="manual-entry__message">{importMessage}</p>}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="period-filter">
          <div className="period-filter__tabs">
            {(["day", "month", "year"] as const).map((range) => (
              <button
                key={range}
                type="button"
                className={
                  periodRange === range
                    ? "period-filter__tab period-filter__tab--active"
                    : "period-filter__tab"
                }
                onClick={() => setPeriodRange(range)}
              >
                {range === "day" ? "Day" : range === "month" ? "Month" : "Year"}
              </button>
            ))}
          </div>
          {periodRange === "day" && (
            <input
              type="date"
              className="period-filter__input"
              value={toDateInputValue(periodDate)}
              onChange={(event) => {
                const parsed = parseDateInputValue(event.target.value);
                if (parsed) setPeriodDate(parsed);
              }}
            />
          )}
          {periodRange === "month" && (
            <input
              type="month"
              className="period-filter__input"
              value={toMonthInputValue(periodDate)}
              onChange={(event) => {
                const parsed = parseMonthInputValue(event.target.value);
                if (parsed) setPeriodDate(parsed);
              }}
            />
          )}
          {periodRange === "year" && (
            <input
              type="number"
              className="period-filter__input"
              value={periodDate.getFullYear()}
              onChange={(event) => {
                const year = Number(event.target.value);
                if (!Number.isFinite(year)) return;
                setPeriodDate((prev) => new Date(year, prev.getMonth(), 1));
              }}
            />
          )}
        </div>

        <p className="scanner-total__amount">{formatGbp(periodTotalCents)}</p>
        <p className="scanner-total__hint">{periodLabel(periodRange, periodDate)}</p>
        <p className={`sync-status sync-status--${syncStatus}`}>
          {syncStatus === "synced"
            ? "Synced to Supabase"
            : syncStatus === "error"
              ? "Supabase sync failed"
              : "Supabase not configured in this build"}
        </p>
      </section>

      <section className="category-chart">
        <div className="category-chart__header">
          <span>{periodPayments.length} payments</span>
        </div>
        {categoryTotals.length > 0 ? (
          <ul className="category-chart__list">
            {categoryTotals.map((item) => (
              <li key={item.category} className="category-chart__row">
                <div className="category-chart__meta">
                  <span>{item.category}</span>
                  <strong>{formatGbp(item.amountCents)}</strong>
                </div>
                <div className="category-chart__track" aria-hidden="true">
                  <div
                    className={`category-chart__bar category-chart__bar--${categoryClassName(item.category)}`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="category-chart__empty">No payments counted yet.</p>
        )}
      </section>

      <NotificationScanner />

      <section className="last-alert">
        <div className="last-alert__header">
          <p className="last-alert__label">Payments</p>
        </div>
        {periodPayments.length > 0 ? (
          <ul className="payment-list">
            {(() => {
              const allCategories = [...CATEGORIES.slice(0, -1), ...customCategories, "Other"];
              return periodPayments.map((payment) => {
              const menuOpen = openPaymentMenuId === payment.id;
              const category = payment.category ?? inferCategory(payment.merchant);
              const rowUrl = getSupabaseRowUrl(payment.id);
              const breakdown = breakdowns[payment.id];
              const items = breakdown?.items ?? [];
              const itemsTotalCents = items.reduce((total, item) => total + item.priceCents, 0);

              return (
                <li key={payment.id} className="last-alert__row">
                  <div className="last-alert__merchant">
                    <span>{payment.merchant}</span>
                    <span className={`payment-category payment-category--${categoryClassName(category)}`}>
                      {category}
                    </span>
                    {orphanedIds.has(payment.id) && (
                      <span className="payment-orphan-flag" title="No matching statement transaction found">
                        No statement match
                      </span>
                    )}
                  </div>
                  <strong>{payment.amount}</strong>
                  <div className="payment-actions">
                    <button
                      type="button"
                      className="payment-actions__menu"
                      aria-expanded={menuOpen}
                      aria-label={`Payment actions for ${payment.merchant} ${payment.amount}`}
                      onClick={() => togglePaymentMenu(payment.id)}
                    >
                      ...
                    </button>
                  </div>
                  {menuOpen && (
                    <div className="payment-menu-overlay">
                      <div
                        className="payment-menu-backdrop"
                        onClick={() => setOpenPaymentMenuId(null)}
                      />
                      <div
                        className="payment-menu"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Payment actions for ${payment.merchant} ${payment.amount}`}
                      >
                        <button
                          type="button"
                          className="payment-menu__handle"
                          aria-label="Close"
                          onClick={() => setOpenPaymentMenuId(null)}
                        />
                        <div className="payment-menu__sheet-header">
                          <div className="payment-menu__sheet-title">
                            <span>{payment.merchant}</span>
                            <strong>{payment.amount}</strong>
                          </div>
                          <button
                            type="button"
                            className="payment-menu__close"
                            aria-label="Close menu"
                            onClick={() => setOpenPaymentMenuId(null)}
                          >
                            ×
                          </button>
                        </div>
                        <div className="payment-menu__body">
                          <p className="payment-menu__label">Category</p>
                          <div className="payment-menu__categories">
                            {allCategories.map((option) => (
                              <button
                                key={option}
                                type="button"
                                className={
                                  option === category
                                    ? "payment-menu__category payment-menu__category--active"
                                    : "payment-menu__category"
                                }
                                onClick={() => void chooseCategory(payment.id, option)}
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                          <div className="payment-menu__add-category">
                            <input
                              value={categoryDraft}
                              onChange={(event) => setCategoryDraft(event.target.value)}
                              placeholder="New category"
                              inputMode="text"
                            />
                            <button type="button" onClick={() => void addCategory(payment.id)}>
                              Add
                            </button>
                          </div>
                          {isSupabaseConfigured() && (
                            <div className="payment-menu__section">
                              <p className="payment-menu__label">Receipt</p>
                              <div className="receipt-scan-row">
                                {breakdown?.receiptImage && (
                                  <button
                                    type="button"
                                    className="receipt-thumb"
                                    aria-label={`View receipt photo for ${payment.merchant}`}
                                    onClick={() =>
                                      window.open(breakdown.receiptImage as string, "_blank", "noopener,noreferrer")
                                    }
                                  >
                                    <img src={breakdown.receiptImage} alt="" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="scan-receipt-btn"
                                  disabled={scanBusyId === payment.id}
                                  onClick={() => void scanReceipt(payment.id)}
                                >
                                  {scanBusyId === payment.id
                                    ? "Scanning..."
                                    : breakdown?.receiptImage
                                      ? "Retake photo"
                                      : "Scan receipt"}
                                </button>
                              </div>

                              <p className="payment-menu__label">
                                Items{items.length > 0 ? ` — ${formatGbp(itemsTotalCents)}` : ""}
                              </p>
                              {items.length > 0 && (
                                <ul className="receipt-items">
                                  {items.map((item) => (
                                    <li key={item.id} className="receipt-items__row">
                                      <span>{item.name}</span>
                                      <strong>{formatGbp(item.priceCents)}</strong>
                                      <button
                                        type="button"
                                        className="receipt-items__remove"
                                        aria-label={`Remove ${item.name}`}
                                        onClick={() => void removeItem(payment.id, item.id)}
                                      >
                                        ×
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <div className="receipt-item-add">
                                <input
                                  value={itemDraftName}
                                  onChange={(event) => setItemDraftName(event.target.value)}
                                  placeholder="Item"
                                  inputMode="text"
                                />
                                <input
                                  value={itemDraftPrice}
                                  onChange={(event) => setItemDraftPrice(event.target.value)}
                                  placeholder="Price"
                                  inputMode="decimal"
                                />
                                <button type="button" onClick={() => void addItem(payment.id)}>
                                  Add
                                </button>
                              </div>
                              {breakdownMessage && <p className="manual-entry__message">{breakdownMessage}</p>}
                            </div>
                          )}
                          {isSupabaseConfigured() && (
                            <div className="payment-menu__section">
                              <p className="payment-menu__label">Photo</p>
                              <div className="receipt-scan-row">
                                {breakdown?.photoUrl && (
                                  <button
                                    type="button"
                                    className="receipt-thumb"
                                    aria-label={`View photo for ${payment.merchant}`}
                                    onClick={() =>
                                      window.open(breakdown.photoUrl as string, "_blank", "noopener,noreferrer")
                                    }
                                  >
                                    <img src={breakdown.photoUrl} alt="" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="scan-receipt-btn"
                                  disabled={momentBusyId === payment.id}
                                  onClick={() => void takePhoto(payment.id)}
                                >
                                  {momentBusyId === payment.id
                                    ? "Saving..."
                                    : breakdown?.photoUrl
                                      ? "Retake photo"
                                      : "Take photo"}
                                </button>
                              </div>
                              {momentMessage && <p className="manual-entry__message">{momentMessage}</p>}
                            </div>
                          )}
                        </div>
                        <div className="payment-menu__footer">
                          {rowUrl && (
                            <button
                              type="button"
                              className="show-in-supabase-btn"
                              aria-label={`Show ${payment.merchant} ${payment.amount} in Supabase`}
                              onClick={() => window.open(rowUrl, "_blank", "noopener,noreferrer")}
                            >
                              Show in Supabase
                            </button>
                          )}
                          <button
                            type="button"
                            className="delete-payment-btn"
                            aria-label={`Delete ${payment.merchant} ${payment.amount}`}
                            onClick={() => void removePayment(payment.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
              });
            })()}
          </ul>
        ) : (
          <p className="last-alert__empty">No payments in this period.</p>
        )}
      </section>

      {unmatchedStatementRows.length > 0 && (
        <section className="unmatched-statement">
          <div className="last-alert__header">
            <p className="last-alert__label">Unmatched statement items</p>
          </div>
          <ul className="payment-list">
            {unmatchedStatementRows.map((row) => (
              <li key={row.id} className="last-alert__row">
                <div className="last-alert__merchant">
                  <span>{row.merchant}</span>
                  <span className="payment-category">{row.source}</span>
                </div>
                <strong>{row.amount}</strong>
                <div className="payment-actions">
                  <button type="button" className="link-statement-btn" onClick={() => void startLinking(row.id, row)}>
                    Link
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {linkingStatementId && (
        <div className="payment-menu-overlay">
          <div className="payment-menu-backdrop" onClick={cancelLinking} />
          <div className="payment-menu" role="dialog" aria-modal="true" aria-label="Link statement transaction">
            <button type="button" className="payment-menu__handle" aria-label="Close" onClick={cancelLinking} />
            <div className="payment-menu__sheet-header">
              <div className="payment-menu__sheet-title">
                <span>Pick the matching transaction</span>
              </div>
              <button type="button" className="payment-menu__close" aria-label="Close menu" onClick={cancelLinking}>
                ×
              </button>
            </div>
            <div className="payment-menu__body">
              {linkCandidates.length > 0 ? (
                <ul className="payment-list">
                  {linkCandidates.map((candidate) => (
                    <li key={candidate.id} className="last-alert__row">
                      <div className="last-alert__merchant">
                        <span>{candidate.merchant}</span>
                        <span className="payment-category">{candidate.paymentDate}</span>
                      </div>
                      <strong>{candidate.amount}</strong>
                      <div className="payment-actions">
                        <button
                          type="button"
                          className="link-statement-btn"
                          onClick={() => void confirmLink(linkingStatementId, candidate.id)}
                        >
                          Select
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="last-alert__empty">No unlinked notification transactions to match.</p>
              )}
              {linkMessage && <p className="manual-entry__message">{linkMessage}</p>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function parseAmountCents(value: string): number {
  const normalised = value.replace(/[£,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return 0;
  const [pounds, pence = ""] = normalised.split(".");
  return Number(pounds) * 100 + Number(pence.padEnd(2, "0"));
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toMonthInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseDateInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function parseMonthInputValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}

function periodLabel(range: CategoryRange, date: Date): string {
  if (range === "day") {
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }
  if (range === "year") {
    return String(date.getFullYear());
  }
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function formatGbp(cents: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(cents / 100);
}
