-- Programs (gyms) connected to Canadian Cheer as producer on Themis.
--
-- Reference data only — names and locations, a few KB in total. The credential
-- form's submissions and every uploaded document go to SharePoint; this table
-- exists so the form can offer a consistent dropdown instead of free text,
-- which would split one gym across several spellings.
--
-- Run once in the Supabase SQL editor.

create table if not exists public.programs (
  id          uuid primary key default gen_random_uuid(),
  -- Themis' own id ("pid_211"). Stable across renames, so an import updates a
  -- gym that changed its name rather than creating a second row for it.
  themis_id   text,
  name        text not null,
  city        text,
  province    text,
  country     text,
  active      boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Partial: rows added by hand may have no Themis id, and several nulls must not
-- collide with each other.
create unique index if not exists programs_themis_id_unique
  on public.programs (themis_id) where themis_id is not null;

create index if not exists programs_name on public.programs (name);

-- The credential form is public and unauthenticated, so it reads this with the
-- anon key like the other kiosk-facing tables.
alter table public.programs enable row level security;

drop policy if exists "programs_all" on public.programs;
create policy "programs_all" on public.programs
  for all using (true) with check (true);
