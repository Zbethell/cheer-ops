-- Run once in the Supabase SQL editor to enable saving award calculations.
-- The Awards tab works without this table; saving/loading lights up after it exists.

create table if not exists public.award_calculations (
  id              uuid primary key default gen_random_uuid(),
  event_id        text,              -- stored as text; matches events.id regardless of its type
  label           text,
  source_filename text,
  classifications jsonb,             -- { "<division>": "competitive" | "rated" | "participation" | "excluded" }
  splits          jsonb,             -- { "<division>": [{ suffix, teamCount, largest }] } for split divisions
  results         jsonb,             -- full computed snapshot (per-division detail + totals; includes 2-day "days")
  created_at      timestamptz default now()
);

-- If the table already existed before the splitting feature, add the column:
alter table public.award_calculations add column if not exists splits jsonb;

-- The app talks to Supabase with the anon key (plus a user JWT), like every other table here.
alter table public.award_calculations enable row level security;

create policy "award_calculations_all" on public.award_calculations
  for all using (true) with check (true);

-- Optional: add a per-user permission toggle so the Awards tab can be hidden like the others.
-- The UI already reads can_view_awards (defaults to visible when the column is absent).
alter table public.user_permissions add column if not exists can_view_awards boolean default true;
