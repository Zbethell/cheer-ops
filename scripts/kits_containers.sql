-- Run once in the Supabase SQL editor to let presets include whole containers
-- (e.g. the "Full Sprung Floor" preset can add the H-Clips Travel Case, not just loose H-Clips).
-- A kit_items row is now EITHER an item (item_id set) OR a container (container_id set).

alter table public.kit_items add column if not exists container_id text;
