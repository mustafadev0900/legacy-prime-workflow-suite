import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: 'companyId is required' });

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Database not configured' });

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('company_id', companyId)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    const appointments = (data ?? []).map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      createdBy: row.created_by,
      clientId: row.client_id,
      title: row.title,
      date: row.date,
      time: row.time,
      notes: row.notes,
      createdAt: row.created_at,
    }));

    return res.status(200).json({ success: true, appointments });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to get appointments' });
  }
}
