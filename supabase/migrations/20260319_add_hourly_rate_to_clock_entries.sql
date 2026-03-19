-- Snapshot the employee's hourly rate at the time of clock-in.
-- This ensures historical entries always reflect the rate in effect when
-- the work was performed, regardless of any future rate changes.
--
-- NULL means the entry predates this migration (legacy entry); those fall
-- back to the employee's current hourly_rate at display time.

ALTER TABLE clock_entries
  ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10,2) DEFAULT NULL;
