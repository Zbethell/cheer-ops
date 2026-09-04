-- Shapes and text labels drawn on a tech setup's floor diagram.
--
-- Separate from tech_devices: a device is a real thing on the network with a
-- type, a network and connections. An annotation is just ink — a box round the
-- warm-up area, a note about where the cable run goes. Putting them in the same
-- table would mean every device query and the connection logic had to filter out
-- rows that aren't really devices.
--
-- Run once in the Supabase SQL editor.

create table if not exists public.tech_annotations (
  id         uuid primary key default gen_random_uuid(),
  -- Stored as text; matches tech_setups.id regardless of its type, the same way
  -- event_id is handled elsewhere in this project.
  setup_id   text not null,
  -- 'rect' | 'ellipse' | 'text'
  kind       text not null,
  -- Position and size as percentages of the canvas, matching tech_devices so
  -- annotations stay put when the diagram is zoomed or the viewport resizes.
  x_pct      double precision not null,
  y_pct      double precision not null,
  w_pct      double precision not null default 20,
  h_pct      double precision not null default 12,
  label      text,
  color      text not null default '#2563eb',
  created_at timestamptz default now()
);

create index if not exists tech_annotations_by_setup
  on public.tech_annotations (setup_id);

alter table public.tech_annotations enable row level security;

drop policy if exists "tech_annotations_all" on public.tech_annotations;
create policy "tech_annotations_all" on public.tech_annotations
  for all using (true) with check (true);
