-- Trailer diagram: store one position PER UNIT so a qty>1 packing line
-- (e.g. 6 spring floors) can be dropped as multiple individually-draggable
-- boxes instead of a single "×6" box.
--
-- Shape: [{ "x": 0, "y": 0, "rotated": false }, ...]  (length ≤ qty_needed)
-- The app falls back to the legacy diag_x/diag_y/diag_rotated for any row that
-- doesn't have diag_positions yet, so existing layouts keep working until the
-- next time that item is touched (which migrates it into diag_positions).

ALTER TABLE packing_list
  ADD COLUMN IF NOT EXISTS diag_positions jsonb;
