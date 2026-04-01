-- Add custom_questions JSONB array to call_assistant_config
-- Replaces fixed project_question / budget_question with a flexible ordered list.
-- Legacy columns are kept for backwards compatibility but the app now uses custom_questions.

ALTER TABLE call_assistant_config
  ADD COLUMN IF NOT EXISTS custom_questions jsonb DEFAULT '["What type of project do you need help with?","What is your budget for this project?","When are you looking to start?"]'::jsonb;
