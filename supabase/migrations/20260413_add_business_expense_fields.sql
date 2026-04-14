-- Business/Company expense support
-- Allows expenses not tied to any project (overhead, rent, insurance, etc.)

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS is_company_cost BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_overhead     BOOLEAN NOT NULL DEFAULT FALSE;

-- Make project_id nullable so business expenses don't require a project
ALTER TABLE expenses ALTER COLUMN project_id DROP NOT NULL;

-- Index for dashboard overhead queries (company + month range)
CREATE INDEX IF NOT EXISTS idx_expenses_company_cost
  ON expenses (company_id, is_company_cost, date DESC);
