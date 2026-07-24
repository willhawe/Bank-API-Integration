-- Run this in the Supabase SQL editor (Project > SQL Editor > New query).
-- Guarantees the transaction_items -> transactions link is a real foreign
-- key (the table was created by hand, so the constraint may be missing),
-- and cascades item deletion when a transaction row is hard-deleted.

alter table public.transaction_items
  drop constraint if exists transaction_items_transaction_id_fkey;

alter table public.transaction_items
  add constraint transaction_items_transaction_id_fkey
  foreign key (transaction_id) references public.transactions(id)
  on delete cascade;

create index if not exists transaction_items_transaction_idx
  on public.transaction_items (transaction_id);
