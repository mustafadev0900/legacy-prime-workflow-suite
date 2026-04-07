-- Add employee and subcontractor assignment columns to scheduled_tasks
-- These store arrays of user/subcontractor UUIDs assigned to each task

ALTER TABLE scheduled_tasks
  ADD COLUMN IF NOT EXISTS assigned_employee_ids uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assigned_subcontractor_ids uuid[] DEFAULT '{}';
