import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { applyCors } from './lib/cors.js';

export const config = {
  maxDuration: 10,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { employeeId, companyId, projectId, clockEntryId, latitude, longitude, accuracy, status, employeeName } = req.body;

    if (!employeeId || !companyId || latitude == null || longitude == null) {
      return res.status(400).json({ error: 'Missing required fields: employeeId, companyId, latitude, longitude' });
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
      .from('worker_live_locations')
      .upsert({
        employee_id:    employeeId,
        company_id:     companyId,
        project_id:     projectId  || null,
        clock_entry_id: clockEntryId || null,
        latitude,
        longitude,
        accuracy:       accuracy   || null,
        status:         status     || 'working',
        employee_name:  employeeName || null,
        updated_at:     new Date().toISOString(),
      }, { onConflict: 'employee_id' });

    if (error) {
      console.error('[WorkerLocation] Upsert error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[WorkerLocation] Unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Unknown error' });
  }
}
