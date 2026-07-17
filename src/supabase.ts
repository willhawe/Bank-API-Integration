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

export async function getMonthlyCategoryTotals(): Promise<CategoryTotal[]> {
  if (!supabase) return [];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("transactions")
    .select("category, amount_cents, merchant")
    .eq("deleted", false)
    .gte("payment_date", monthStart);

  if (error || !data) return [];

  const totals = new Map<string, number>();
  for (const row of data) {
    const category = row.category ?? inferCategory(row.merchant ?? "");
    totals.set(category, (totals.get(category) ?? 0) + row.amount_cents);
  }

  return [...totals.entries()]
    .map(([category, amountCents]) => ({ category, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents);
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
