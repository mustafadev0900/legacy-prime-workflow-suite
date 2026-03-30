-- Add twilio_phone_number and postal_code to companies table
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS twilio_phone_number TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT;
