-- Add missing columns to scheduled_tasks table
ALTER TABLE scheduled_tasks
  ADD COLUMN IF NOT EXISTS company_id TEXT,
  ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Index for company scoping queries
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_company_id ON scheduled_tasks(company_id);
