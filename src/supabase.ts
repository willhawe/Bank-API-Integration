import { createClient } from "@supabase/supabase-js";
import type { ScannedPayment } from "./plugins/WidgetBridge";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const supabaseProjectRef = supabaseUrl?.match(/^https:\/\/([^.]+)\.supabase\.co/)?.[1];

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export type SyncStatus = "not-configured" | "synced" | "error";

export function getSupabaseRowUrl(id: string): string | null {
  if (!supabaseProjectRef) return null;
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
