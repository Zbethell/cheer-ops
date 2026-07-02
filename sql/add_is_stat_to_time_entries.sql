-- Stat pay support: flag time_entries rows that represent statutory-holiday pay
-- rather than actual worked shifts. Kept out of future stat calculations and
-- labelled for the admin. Run once in the Supabase SQL editor.

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS is_stat boolean DEFAULT false;
