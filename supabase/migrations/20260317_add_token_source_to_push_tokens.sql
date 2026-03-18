-- Add token_source to push_tokens to distinguish FCM, Expo, and Web push tokens.
-- Existing rows default to 'expo' (backward compatible).

ALTER TABLE push_tokens
  ADD COLUMN IF NOT EXISTS token_source TEXT NOT NULL DEFAULT 'expo'
    CHECK (token_source IN ('expo', 'fcm', 'fcm-web'));

-- Index for filtering by source (e.g. deactivate all fcm-web tokens on logout)
CREATE INDEX IF NOT EXISTS idx_push_tokens_source
  ON push_tokens (user_id, token_source)
  WHERE is_active = TRUE;

COMMENT ON COLUMN push_tokens.token_source IS
  'expo = Expo push proxy | fcm = Firebase native (iOS/Android) | fcm-web = Firebase web push';
