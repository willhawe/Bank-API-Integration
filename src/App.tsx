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
  type ScannedPayment,
  type NotificationSummary,
} from "./plugins/WidgetBridge";
import { syncPayments, getSupabaseRowUrl, type SyncStatus } from "./supabase";

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

  async function refreshSummary() {
    const next = await getNotificationSummary();
    setSummary(next);
    setSyncStatus(await syncPayments(next.payments));
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
            {activePayments.map((payment, index) => {
              const menuOpen = openPaymentMenuId === payment.id;
              const category = payment.category ?? inferCategory(payment.merchant);
              const rowUrl = getSupabaseRowUrl(payment.id);

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
                      onClick={() => setOpenPaymentMenuId(menuOpen ? null : payment.id)}
                    >
                      ...
                    </button>
                    {menuOpen && (
                      <div className="payment-menu" role="menu">
                        <p className="payment-menu__label">Category</p>
                        <div className="payment-menu__categories">
                          {CATEGORIES.map((option) => (
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
                    )}
                  </div>
                </li>
              );
            })}
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

const CATEGORIES = [
  "Transport",
  "Groceries",
  "Food",
  "Shopping",
  "Entertainment",
  "Bills",
  "Travel",
  "Other",
] as const;

function inferCategory(merchant: string): string {
  const value = merchant.toLowerCase();
  if (/(tfl|rail|railway|train|uber|bolt|taxi|bus|tube|parking|petrol|shell|bp\b)/.test(value)) {
    return "Transport";
  }
  if (/(sainsbury|tesco|waitrose|aldi|lidl|morrisons|ocado|co-op|coop|marks and spencer|m&s)/.test(value)) {
    return "Groceries";
  }
  if (/(pret|caffe|coffee|starbucks|costa|nero|greggs|leon|itsu|mcdonald|restaurant|kitchen|pizza|deliveroo|uber eats)/.test(value)) {
    return "Food";
  }
  if (/(amazon|argos|ikea|john lewis|apple|currys|boots|zara|uniqlo|h&m)/.test(value)) {
    return "Shopping";
  }
  if (/(netflix|spotify|cinema|odeon|vue|theatre|ticketmaster|games|playstation|xbox)/.test(value)) {
    return "Entertainment";
  }
  if (/(octopus|british gas|thames water|ee\b|o2\b|vodafone|three|council tax|insurance|rent|mortgage)/.test(value)) {
    return "Bills";
  }
  if (/(hotel|airline|airways|easyjet|ryanair|ba\.com|booking\.com|airbnb)/.test(value)) {
    return "Travel";
  }
  return "Other";
}

function formatGbp(cents: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(cents / 100);
}

function categoryClassName(category: string): string {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
