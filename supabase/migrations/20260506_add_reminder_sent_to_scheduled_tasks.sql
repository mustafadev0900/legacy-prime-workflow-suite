-- Add reminder_sent flag to scheduled_tasks so the day-before reminder
-- fires exactly once per task regardless of how many times the cron runs.
ALTER TABLE scheduled_tasks
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for the cron query: tasks starting tomorrow that haven't been reminded yet
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_reminder
  ON scheduled_tasks (start_date, reminder_sent)
  WHERE reminder_sent = FALSE;
