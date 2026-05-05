-- Add clock_out_location column to store GPS coords captured at the moment of clock-out.
-- Separate from the existing `location` column (which stores clock-in coords) so both
-- are independently queryable and legacy entries without clock-out location are preserved.
ALTER TABLE clock_entries
  ADD COLUMN IF NOT EXISTS clock_out_location JSONB;
