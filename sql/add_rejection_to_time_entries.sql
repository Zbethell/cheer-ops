-- Admin rejection support: an admin can decline a submitted shift, manual entry
-- or stat-pay request instead of only approving it. Rejected rows are kept for
-- the audit trail but are excluded from every hours total, so they are never paid.
-- Run once in the Supabase SQL editor.

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS is_rejected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rejection_reason text;
