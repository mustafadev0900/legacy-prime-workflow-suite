-- worker_live_locations: one row per employee, upserted on each GPS push.
-- Unique index on employee_id enables UPSERT without race conditions.
-- Realtime-enabled so project detail screens get instant map updates.
CREATE TABLE IF NOT EXISTS worker_live_locations (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id    uuid NOT NULL,
  company_id     uuid NOT NULL,
  project_id     uuid,
  clock_entry_id uuid,
  latitude       double precision NOT NULL,
  longitude      double precision NOT NULL,
  accuracy       float,
  status         text NOT NULL DEFAULT 'working',
  employee_name  text,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS worker_live_locations_employee_idx
  ON worker_live_locations(employee_id);

ALTER PUBLICATION supabase_realtime ADD TABLE worker_live_locations;
