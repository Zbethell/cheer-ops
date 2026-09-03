-- Per-kiosk activation-code toggle, edited from Users → Kiosk devices.
--
-- Until this table exists every kiosk falls back to KIOSK_CODE_DEFAULTS in the
-- app, which are the values seeded below — so the app behaves identically
-- before and after this runs, and a failed lookup can never lock the warehouse
-- out of /pack or silently drop the gate on /clock.
--
-- Run once in the Supabase SQL editor.

create table if not exists public.kiosk_settings (
  path         text primary key,          -- '/checkin' | '/clock' | '/pack'
  require_code boolean not null default true,
  updated_at   timestamptz default now()
);

-- Seed with the behaviour that was hardcoded before the toggle existed.
insert into public.kiosk_settings (path, require_code) values
  ('/checkin', true),
  ('/clock',   true),
  ('/pack',    false)
on conflict (path) do nothing;

-- The kiosks read this anonymously on the anon key, like every other kiosk
-- table, and the admin screen writes it.
alter table public.kiosk_settings enable row level security;

drop policy if exists "kiosk_settings_all" on public.kiosk_settings;
create policy "kiosk_settings_all" on public.kiosk_settings
  for all using (true) with check (true);

-- ─── Also included: the Event Staff permission column ─────────────────────────
-- Repeated from sql/event_checkins.sql because an earlier copy of that file did
-- not have it. Without this column, saving ANY user's permissions fails — the
-- app sends can_view_event_staff on every save. Safe to run either way.
alter table public.user_permissions
  add column if not exists can_view_event_staff boolean default true;
