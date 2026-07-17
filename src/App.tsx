import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { NotificationScanner } from "./components/NotificationScanner";
import { parsePaymentFile } from "./importPayments";
import {
  addManualPayment,
  canUseNotificationAccess,
  deletePayment,
  getNotificationSummary,
  openNotificationAccessSettings,
  setPaymentCategory,
  syncCategoryBreakdown,
  type ScannedPayment,
  type NotificationSummary,
} from "./plugins/WidgetBridge";
import {
  syncPayments,
  getSupabaseRowUrl,
  isSupabaseConfigured,
  getTransactionBreakdown,
  getMonthlyCategoryTotals,
  saveReceiptImage,
  addReceiptItem,
  removeReceiptItem,
  type SyncStatus,
  type TransactionBreakdown,
} from "./supabase";
import { captureReceiptPhoto } from "./receipt";
import {
  CATEGORIES,
  categoryClassName,
  inferCategory,
  loadCustomCategories,
  saveCustomCategories,
} from "./categories";

export default function App() {
  const [summary, setSummary] = useState<NotificationSummary>({
    spentToday: "£0.00",
    lastMerchant: "",
    lastAmount: "",
    payments: [],
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("not-configured");
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [openPaymentMenuId, setOpenPaymentMenuId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [breakdowns, setBreakdowns] = useState<Record<string, TransactionBreakdown>>({});
  const [scanBusyId, setScanBusyId] = useState<string | null>(null);
  const [itemDraftName, setItemDraftName] = useState("");
  const [itemDraftPrice, setItemDraftPrice] = useState("");
  const [breakdownMessage, setBreakdownMessage] = useState("");
  const [customCategories, setCustomCategories] = useState<string[]>(() => loadCustomCategories());
  const [categoryDraft, setCategoryDraft] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const next = await getNotificationSummary();
      if (cancelled) return;
      setSummary(next);
      setSyncStatus(await syncPayments(next.payments));
    }

    void refresh();
    const id = window.setInterval(() => void refresh(), 2000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    void syncMonthlyCategoryWidget();
  }, []);

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

  async function refreshSummary() {
    const next = await getNotificationSummary();
    setSummary(next);
    setSyncStatus(await syncPayments(next.payments));
    await syncMonthlyCategoryWidget();
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
      const payments = await parsePaymentFile(file);
      if (payments.length === 0) {
        setImportMessage("No payments found.");
        return;
      }
      const status = await syncPayments(payments);
      setSyncStatus(status);
      await syncMonthlyCategoryWidget();
      setImportMessage(
        status === "synced"
          ? `Imported ${payments.length} payment${payments.length === 1 ? "" : "s"}.`
          : status === "error"
            ? "Import parsed, but Supabase sync failed."
            : "Import parsed, but Supabase is not configured in this build.",
      );
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "Could not import file.");
    }
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
    await deletePayment(id);
    setOpenPaymentMenuId(null);
    await refreshSummary();
  }

  async function chooseCategory(id: string, category: string) {
    try {
      await setPaymentCategory(id, category);
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Could not set category.");
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
      const ok = await saveReceiptImage(id, image);
      setBreakdownMessage(ok ? "Receipt saved." : "Could not save receipt.");
      if (ok) {
        setBreakdowns((prev) => ({
          ...prev,
          [id]: { items: prev[id]?.items ?? [], receiptImage: image },
        }));
      }
    } finally {
      setScanBusyId(null);
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
          items: (prev[id]?.items ?? []).filter((item) => item.id !== itemId),
        },
      }));
    }
  }

  const activePayments = summary.payments.filter((payment) => !payment.deleted);
  const categoryTotals = getCategoryTotals(activePayments);

  return (
    <main className="app app--scanner">
      <section className="scanner-total">
        <div className="scanner-total__top">
          <p className="scanner-total__label">Spent today</p>
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
        <p className="scanner-total__amount">{summary.spentToday}</p>
        <p className="scanner-total__hint">From payment notifications on this phone</p>
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
          <p className="category-chart__label">By category</p>
          <span>{activePayments.length} payments</span>
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

      <section className="manual-entry">
        <p className="manual-entry__label">Add missed payment</p>
        <div className="manual-entry__fields">
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
      </section>

      <section className="last-alert">
        <div className="last-alert__header">
          <p className="last-alert__label">Counted today</p>
        </div>
        {activePayments.length > 0 ? (
          <ul className="payment-list">
            {(() => {
              const allCategories = [...CATEGORIES.slice(0, -1), ...customCategories, "Other"];
              return activePayments.map((payment, index) => {
              const menuOpen = openPaymentMenuId === payment.id;
              const category = payment.category ?? inferCategory(payment.merchant);
              const rowUrl = getSupabaseRowUrl(payment.id);
              const breakdown = breakdowns[payment.id];
              const items = breakdown?.items ?? [];
              const itemsTotalCents = items.reduce((total, item) => total + item.priceCents, 0);

              return (
                <li key={`${payment.merchant}-${payment.amount}-${index}`} className="last-alert__row">
                  <div className="last-alert__merchant">
                    <span>{payment.merchant}</span>
                    <span className={`payment-category payment-category--${categoryClassName(category)}`}>
                      {category}
                    </span>
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
          <p className="last-alert__empty">No payment notifications scanned today.</p>
        )}
      </section>
    </main>
  );
}

function parseAmountCents(value: string): number {
  const normalised = value.replace(/[£,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return 0;
  const [pounds, pence = ""] = normalised.split(".");
  return Number(pounds) * 100 + Number(pence.padEnd(2, "0"));
}

function getCategoryTotals(payments: ScannedPayment[]) {
  const totals = new Map<string, number>();
  for (const payment of payments) {
    const category = payment.category ?? inferCategory(payment.merchant);
    totals.set(category, (totals.get(category) ?? 0) + payment.amountCents);
  }

  const maxAmount = Math.max(0, ...totals.values());
  return [...totals.entries()]
    .map(([category, amountCents]) => ({
      category,
      amountCents,
      percent: maxAmount > 0 ? Math.max(6, Math.round((amountCents / maxAmount) * 100)) : 0,
    }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

function formatGbp(cents: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(cents / 100);
}
