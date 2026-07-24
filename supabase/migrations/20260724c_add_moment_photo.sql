-- Run this in the Supabase SQL editor (Project > SQL Editor > New query).
-- Adds a "moment" photo per transaction — a just-for-fun picture (e.g. of
-- the beer you just bought) taken from the payment's "..." menu, separate
-- from the receipt photo/items feature. Stored in its own bucket with only
-- a URL link kept on the transactions row.

alter table public.transactions
  add column if not exists photo_url text;

insert into storage.buckets (id, name, public)
values ('moments', 'moments', true)
on conflict (id) do nothing;

drop policy if exists "Public read moments" on storage.objects;
create policy "Public read moments"
  on storage.objects for select
  using (bucket_id = 'moments');

-- Matches the current (no-RLS) permissiveness of `transactions` so the
-- app's anon/publishable key can upload and manage photos. Tighten if you
-- later add auth-scoped access to `transactions`.
drop policy if exists "Anon upload moments" on storage.objects;
create policy "Anon upload moments"
  on storage.objects for insert
  with check (bucket_id = 'moments');

drop policy if exists "Anon update moments" on storage.objects;
create policy "Anon update moments"
  on storage.objects for update
  using (bucket_id = 'moments');

drop policy if exists "Anon delete moments" on storage.objects;
create policy "Anon delete moments"
  on storage.objects for delete
  using (bucket_id = 'moments');
