-- Module 3 Extension: Office/Business Operations clock-in support
-- Adds office_role column and makes project_id nullable

-- 1. Add office_role column
ALTER TABLE clock_entries
  ADD COLUMN IF NOT EXISTS office_role TEXT;

-- 2. Make project_id nullable (it was NOT NULL before)
ALTER TABLE clock_entries
  ALTER COLUMN project_id DROP NOT NULL;

-- 3. Add check constraint: must have either project_id or office_role (not both null)
ALTER TABLE clock_entries
  ADD CONSTRAINT clock_entries_project_or_office_check
  CHECK (project_id IS NOT NULL OR office_role IS NOT NULL);

-- 4. Index for fast dashboard "in office" count queries
CREATE INDEX IF NOT EXISTS idx_clock_entries_office_role
  ON clock_entries (company_id, office_role)
  WHERE office_role IS NOT NULL AND clock_out IS NULL;
