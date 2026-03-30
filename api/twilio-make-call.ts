import type { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, message, twimlUrl, companyId } = req.body;
  if (!to) {
    return res.status(400).json({ error: 'to is required' });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN;

  // Use company's unique number if available, fall back to global
  let fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER;
  if (companyId) {
    const { data } = await supabase.from('companies').select('twilio_phone_number').eq('id', companyId).single();
    if (data?.twilio_phone_number) fromNumber = data.twilio_phone_number;
  }

  if (!accountSid || !authToken || !fromNumber) {
    return res.status(500).json({ error: 'Twilio not configured.' });
  }

  try {
    const client = twilio(accountSid, authToken);
    const twiml = new twilio.twiml.VoiceResponse();
    if (message) twiml.say({ voice: 'alice' }, message);
    const call = await client.calls.create({
      twiml: twimlUrl ? undefined : twiml.toString(),
      url: twimlUrl,
      to,
      from: fromNumber,
    });
    return res.status(200).json({ success: true, callSid: call.sid, status: call.status });
  } catch (error: any) {
    console.error('[API] twilio-make-call error:', error);
    return res.status(500).json({ error: error.message || 'Failed to make call' });
  }
}
