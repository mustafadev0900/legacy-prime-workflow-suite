-- Add reply_to column to messages table for threaded replies
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS reply_to UUID REFERENCES messages(id) ON DELETE SET NULL;

-- Add index for efficient reply_to lookups
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to) WHERE reply_to IS NOT NULL;
