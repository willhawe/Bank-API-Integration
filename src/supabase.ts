import { createClient } from "@supabase/supabase-js";
import type { ScannedPayment } from "./plugins/WidgetBridge";
import { inferCategory } from "./categories";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const supabaseProjectRef = supabaseUrl?.match(/^https:\/\/([^.]+)\.supabase\.co/)?.[1];
const supabaseTransactionsTableId = import.meta.env.VITE_SUPABASE_TRANSACTIONS_TABLE_ID as string | undefined;

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export type SyncStatus = "not-configured" | "synced" | "error";

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

export function getSupabaseRowUrl(id: string): string | null {
  if (!supabaseProjectRef) return null;

  if (supabaseTransactionsTableId) {
    const filter = encodeURIComponent(`id:eq:${id}`);
    return `https://supabase.com/dashboard/project/${supabaseProjectRef}/editor/${supabaseTransactionsTableId}?schema=public&filter=${filter}`;
  }

  const escaped = id.replace(/'/g, "''");
  const query = `select * from public.transactions where id = '${escaped}';`;
  return `https://supabase.com/dashboard/project/${supabaseProjectRef}/sql/new?content=${encodeURIComponent(query)}`;
}

export async function syncPayments(payments: ScannedPayment[]): Promise<SyncStatus> {
  if (!supabase) return "not-configured";
  if (payments.length === 0) return "synced";

  const rows = payments.map((payment) => ({
    id: payment.id,
    merchant: payment.merchant,
    amount_cents: payment.amountCents,
    amount_display: payment.amount,
    payment_date: payment.paymentDate,
    source: payment.source,
    category: payment.category,
    deleted: payment.deleted,
    deleted_at: payment.deletedAt,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("transactions")
    .upsert(rows, { onConflict: "id" });

  return error ? "error" : "synced";
}

export interface CategoryTotal {
  category: string;
  amountCents: number;
}

export type CategoryRange = "day" | "month" | "year";

export function periodBounds(range: CategoryRange, ref: Date): { start: Date; end: Date } {
  if (range === "day") {
    const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }
  if (range === "year") {
    const start = new Date(ref.getFullYear(), 0, 1);
    const end = new Date(ref.getFullYear() + 1, 0, 1);
    return { start, end };
  }
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
  return { start, end };
}

export interface PeriodPaymentsResult {
  payments: ScannedPayment[];
  totals: CategoryTotal[];
  totalCents: number;
}

export async function getPaymentsForPeriod(
  range: CategoryRange,
  referenceDate: Date,
): Promise<PeriodPaymentsResult> {
  if (!supabase) return { payments: [], totals: [], totalCents: 0 };

  const { start, end } = periodBounds(range, referenceDate);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("transactions")
    .select("id, merchant, amount_display, amount_cents, payment_date, source, category, deleted, deleted_at")
    .eq("deleted", false)
    .gte("payment_date", startStr)
    .lt("payment_date", endStr)
    .order("payment_date", { ascending: false });

  if (error || !data) return { payments: [], totals: [], totalCents: 0 };

  const payments: ScannedPayment[] = data.map((row) => ({
    id: row.id,
    merchant: row.merchant ?? "",
    amount: row.amount_display ?? formatGbpCents(row.amount_cents ?? 0),
    amountCents: row.amount_cents ?? 0,
    paymentDate: row.payment_date ?? "",
    source: row.source ?? "notification",
    category: typeof row.category === "string" && row.category.trim() ? row.category : null,
    deleted: row.deleted === true,
    deletedAt: row.deleted_at ?? null,
  }));

  const totals = new Map<string, number>();
  let totalCents = 0;
  for (const payment of payments) {
    const category = payment.category ?? inferCategory(payment.merchant);
    totals.set(category, (totals.get(category) ?? 0) + payment.amountCents);
    totalCents += payment.amountCents;
  }

  return {
    payments,
    totals: [...totals.entries()]
      .map(([category, amountCents]) => ({ category, amountCents }))
      .sort((a, b) => b.amountCents - a.amountCents),
    totalCents,
  };
}

function formatGbpCents(cents: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(cents / 100);
}

export async function getMonthlyCategoryTotals(): Promise<CategoryTotal[]> {
  const { totals } = await getPaymentsForPeriod("month", new Date());
  return totals;
}

export interface ReceiptItem {
  id: number;
  name: string;
  priceCents: number;
}

export interface TransactionBreakdown {
  receiptImage: string | null;
  items: ReceiptItem[];
}

export async function getTransactionBreakdown(id: string): Promise<TransactionBreakdown | null> {
  if (!supabase) return null;

  const [transactionResult, itemsResult] = await Promise.all([
    supabase.from("transactions").select("receipt_image").eq("id", id).maybeSingle(),
    supabase
      .from("transaction_items")
      .select("id, name, price_cents")
      .eq("transaction_id", id)
      .order("created_at"),
  ]);

  if (transactionResult.error) return null;

  return {
    receiptImage:
      typeof transactionResult.data?.receipt_image === "string" ? transactionResult.data.receipt_image : null,
    items: parseItems(itemsResult.data),
  };
}

export async function saveReceiptImage(id: string, image: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("transactions").update({ receipt_image: image }).eq("id", id);
  return !error;
}

export async function addReceiptItem(
  transactionId: string,
  name: string,
  priceCents: number,
): Promise<ReceiptItem | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("transaction_items")
    .insert({ transaction_id: transactionId, name, price_cents: priceCents })
    .select("id, name, price_cents")
    .single();

  if (error || !data) return null;
  return { id: data.id, name: data.name, priceCents: data.price_cents };
}

export async function removeReceiptItem(itemId: number): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("transaction_items").delete().eq("id", itemId);
  return !error;
}

function parseItems(raw: unknown): ReceiptItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => ({
      id: typeof row?.id === "number" ? row.id : Number(row?.id),
      name: typeof row?.name === "string" ? row.name : "",
      priceCents: typeof row?.price_cents === "number" ? row.price_cents : 0,
    }))
    .filter((item) => Number.isFinite(item.id) && item.name && item.priceCents > 0);
}
