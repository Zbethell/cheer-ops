-- What each person is at an event for, declared once on their first check-in.
--
-- Kept apart from event_checkins on purpose. A check-in is evidence someone
-- arrived; a plan is what they said they would do, and a day ticked here is not
-- an arrival. Merging them would let a declared Sunday look identical to a
-- Sunday someone actually turned up for, which is exactly the distinction the
-- report needs to show a no-show.
--
-- Run once in the Supabase SQL editor.

-- ─── Event span ───────────────────────────────────────────────────────────────
-- `events` only had a single date, so there was no way to know which days an
-- event covers and therefore no set of days to offer. `date` is the first day
-- (set it to the setup day when there is one) and end_date the last; a null
-- end_date means a single-day event.
alter table public.events
  add column if not exists end_date date;

-- ─── Plans ────────────────────────────────────────────────────────────────────
create table if not exists public.event_attendance_plans (
  id           uuid primary key default gen_random_uuid(),
  event_id     text,
  staff_id     uuid references public.event_staff(id) on delete set null,
  -- Snapshotted like check-ins, so the plan still reads correctly after a
  -- roster rename or removal.
  staff_name   text,
  -- 'setup' | 'half_day' | 'full_day' | 'teardown'
  attendance_type text not null,
  -- 'morning' | 'afternoon', only meaningful for half_day
  half         text,
  -- The days they said they would be on site: ["2026-09-04","2026-09-05"]
  days         jsonb not null default '[]'::jsonb,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- One plan per person per event; a second check-in updates it rather than
-- stacking another. The kiosk relies on this to know whether to ask.
create unique index if not exists event_attendance_plans_one_per_event
  on public.event_attendance_plans (event_id, staff_id);

create index if not exists event_attendance_plans_by_event
  on public.event_attendance_plans (event_id);

-- ─── Access ───────────────────────────────────────────────────────────────────
-- Written by the anonymous kiosk, like event_checkins.
alter table public.event_attendance_plans enable row level security;

drop policy if exists "event_attendance_plans_all" on public.event_attendance_plans;
create policy "event_attendance_plans_all" on public.event_attendance_plans
  for all using (true) with check (true);
