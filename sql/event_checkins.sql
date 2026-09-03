-- Venue check-in kiosk (/checkin)
--
-- Staff tap their name when they arrive at a venue. Arrival only — there is no
-- check-out, so this is an attendance log, not a timesheet.
--
-- Deliberately NOT stored in time_entries: a row there with no clock_out means
-- an unfinished shift, and is chased by the auto clock-out and "awaiting
-- correction" flows and counted by every payroll total. Every check-in would
-- read as a payroll problem.
--
-- Run once in the Supabase SQL editor.

-- ─── Roster ───────────────────────────────────────────────────────────────────
-- Kept separate from `employees` (payroll, drives /clock) so venue casuals,
-- volunteers and judges can be listed without payroll records, and marking
-- someone inactive here never affects the time clock.
create table if not exists public.event_staff (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text,
  active      boolean default true,
  created_at  timestamptz default now()
);

-- ─── Arrivals ─────────────────────────────────────────────────────────────────
create table if not exists public.event_checkins (
  id             uuid primary key default gen_random_uuid(),
  event_id       text,           -- stored as text; matches events.id regardless of its type
  staff_id       uuid references public.event_staff(id) on delete set null,
  -- Name is snapshotted at check-in so an attendance record still reads
  -- correctly after someone is renamed or removed from the roster.
  staff_name     text,
  -- The venue-local calendar day, YYYY-MM-DD, as computed by the kiosk.
  -- Not derived from checked_in_at at read time on purpose: this app has
  -- already shipped a bug where toISOString() gave the UTC day and pushed an
  -- evening record onto tomorrow (fixed in c48c367). An 8pm arrival in EDT is
  -- already "tomorrow" in UTC, which would split a single event day across two
  -- rows in the report and defeat the once-per-day guard below.
  local_date     text not null,
  checked_in_at  timestamptz default now(),
  created_at     timestamptz default now()
);

-- One arrival per person per event per day. A second tap is rejected by the
-- database rather than quietly logged twice; the kiosk catches the conflict and
-- shows the original arrival time instead.
create unique index if not exists event_checkins_once_per_day
  on public.event_checkins (event_id, staff_id, local_date);

-- The report always reads one event, grouped by day.
create index if not exists event_checkins_by_event
  on public.event_checkins (event_id, local_date);

-- ─── Access ───────────────────────────────────────────────────────────────────
-- The kiosk runs anonymously on the anon key, like /clock and /pack, so both
-- tables need public access. This matches every other table in the project —
-- see the note in scripts/kiosk_trailer_rls.sql about the kiosk silently seeing
-- zero rows when a table was left without one.
alter table public.event_staff    enable row level security;
alter table public.event_checkins enable row level security;

drop policy if exists "event_staff_all" on public.event_staff;
create policy "event_staff_all" on public.event_staff
  for all using (true) with check (true);

drop policy if exists "event_checkins_all" on public.event_checkins;
create policy "event_checkins_all" on public.event_checkins
  for all using (true) with check (true);

-- ─── Permission ───────────────────────────────────────────────────────────────
-- Per-user toggle for the Event Staff tab, matching the other nav permissions.
-- The UI reads it as "visible unless explicitly false", so existing users keep
-- working before this column is added and default to seeing the tab after.
alter table public.user_permissions
  add column if not exists can_view_event_staff boolean default true;
