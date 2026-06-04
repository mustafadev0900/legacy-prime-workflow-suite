-- Add 'rate-change' to the notifications type CHECK constraint.
-- Required for push notifications sent to employees on rate change approval/rejection.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'estimate-received',
  'proposal-submitted',
  'payment-received',
  'change-order',
  'general',
  'task-reminder',
  'task-assigned',
  'rate-change'
));
