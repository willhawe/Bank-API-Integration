-- Run this in the Supabase SQL editor (Project > SQL Editor > New query).
-- Adds a separate table for rows parsed from uploaded Chase/Amex statements
-- (CSV or PDF), so they never collide with notification-derived rows in
-- `transactions`. Each statement row is auto-matched to a `transactions`
-- row by amount + nearby date where possible; unmatched rows are left with
-- matched_transaction_id = null so the app can surface them for manual
-- linking.

create table if not exists public.statement_transactions (
  id text primary key,
  source text not null default 'statement',
  merchant text not null,
  amount_cents integer not null,
  amount_display text not null,
  transaction_date date not null,
  file_name text,
  matched_transaction_id text references public.transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists statement_transactions_matched_idx
  on public.statement_transactions (matched_transaction_id);

create index if not exists statement_transactions_date_idx
  on public.statement_transactions (transaction_date);

-- Match this project's existing security model for `transactions`. If that
-- table has RLS enabled with policies for the anon/publishable key, mirror
-- them here (uncomment and adjust), otherwise leave RLS off to match the
-- current (RLS-disabled) `transactions` table.
-- alter table public.statement_transactions enable row level security;
-- create policy "anon full access" on public.statement_transactions
--   for all using (true) with check (true);
