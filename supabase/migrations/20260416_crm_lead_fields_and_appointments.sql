-- Add assigned_rep and job_details to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS assigned_rep text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS job_details text;

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by  uuid        REFERENCES users(id) ON DELETE SET NULL,
  client_id   uuid        REFERENCES clients(id) ON DELETE SET NULL,
  title       text        NOT NULL,
  date        date        NOT NULL,
  time        text,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_company_id ON appointments(company_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id  ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date       ON appointments(date);
