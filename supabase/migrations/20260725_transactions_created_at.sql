-- Run this in the Supabase SQL editor (Project > SQL Editor > New query).
-- Rows within the same day had no stable secondary sort key, so the list
-- order shuffled between refreshes (Postgres doesn't guarantee row order
-- without an explicit ORDER BY, and ties on payment_date alone are
-- unspecified). The app now orders by payment_date desc, created_at desc.
--
-- Note: existing rows will all get the same created_at (this migration's
-- run time), since true insert time was never recorded — going forward,
-- new rows get created_at set once on insert and never touched again.

alter table public.transactions
  add column if not exists created_at timestamptz not null default now();

create index if not exists transactions_payment_date_created_at_idx
  on public.transactions (payment_date desc, created_at desc);
