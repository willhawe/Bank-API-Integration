-- Run this in the Supabase SQL editor (Project > SQL Editor > New query).
-- Creates a public storage bucket for receipt photos. The transactions
-- table's `receipt_image` column now stores a public URL into this bucket
-- instead of a base64 data URI.

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

drop policy if exists "Public read receipts" on storage.objects;
create policy "Public read receipts"
  on storage.objects for select
  using (bucket_id = 'receipts');

-- These match the current (no-RLS) permissiveness of the `transactions`
-- table so the app's anon/publishable key can upload and manage photos.
-- Tighten these if you later add auth-scoped access to `transactions`.
drop policy if exists "Anon upload receipts" on storage.objects;
create policy "Anon upload receipts"
  on storage.objects for insert
  with check (bucket_id = 'receipts');

drop policy if exists "Anon update receipts" on storage.objects;
create policy "Anon update receipts"
  on storage.objects for update
  using (bucket_id = 'receipts');

drop policy if exists "Anon delete receipts" on storage.objects;
create policy "Anon delete receipts"
  on storage.objects for delete
  using (bucket_id = 'receipts');
