-- Run once in the Supabase SQL editor to enable Presets (item groupings).
-- A "kit" is a named bundle of inventory items + quantities (e.g. "Full Sprung Floor").
-- The packing-list multi-add checklist works without this; the Presets feature
-- (create a preset, then add all its items to an event in one click) lights up after it exists.

create table if not exists public.kits (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz default now()
);

create table if not exists public.kit_items (
  id       uuid primary key default gen_random_uuid(),
  kit_id   uuid references public.kits(id) on delete cascade,
  item_id  text,                 -- stored as text; matches items.id regardless of its type
  qty      integer not null default 1
);

-- The app talks to Supabase with the anon key (plus a user JWT), like every other table here.
alter table public.kits enable row level security;
alter table public.kit_items enable row level security;

create policy "kits_all" on public.kits
  for all using (true) with check (true);

create policy "kit_items_all" on public.kit_items
  for all using (true) with check (true);
