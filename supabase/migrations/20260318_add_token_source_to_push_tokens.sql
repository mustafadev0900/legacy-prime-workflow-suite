-- Add token_source column to push_tokens table
-- Differentiates between legacy Expo push tokens and new FCM tokens (iOS/Android/Web)
--
-- token_source values:
--   'expo'    — legacy ExponentPushToken[...] tokens (backward compat, to be phased out)
--   'fcm'     — FCM registration token for iOS or Android
--   'fcm-web' — FCM web push subscription token for browser push

ALTER TABLE push_tokens
ADD COLUMN IF NOT EXISTS token_source TEXT NOT NULL DEFAULT 'expo'
  CHECK (token_source IN ('expo', 'fcm', 'fcm-web'));

-- Backfill: existing tokens are all Expo tokens
UPDATE push_tokens
SET token_source = 'expo'
WHERE token_source IS NULL OR token_source = 'expo';

-- Index for efficient filtering by source (used when deactivating dead tokens)
CREATE INDEX IF NOT EXISTS idx_push_tokens_token_source
  ON push_tokens (token_source)
  WHERE is_active = TRUE;
