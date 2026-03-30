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

  const { recipients, body, companyId } = req.body;
  if (!recipients || !body) {
    return res.status(400).json({ error: 'recipients and body are required' });
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
    return res.status(500).json({ error: 'Twilio not configured. Please add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to your environment variables.' });
  }

  try {
    const client = twilio(accountSid, authToken);
    const results = await Promise.allSettled(
      recipients.map(async (recipient: { phone: string; name: string }) => {
        const personalizedBody = body.replace('{name}', recipient.name.split(' ')[0]);
        const message = await client.messages.create({ body: personalizedBody, from: fromNumber, to: recipient.phone });
        return { phone: recipient.phone, name: recipient.name, success: true, messageSid: message.sid, status: message.status };
      })
    );
    const totalSent = results.filter(r => r.status === 'fulfilled').length;
    const totalFailed = results.filter(r => r.status === 'rejected').length;
    return res.status(200).json({
      success: true, totalSent, totalFailed,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: (r.reason as Error).message }),
    });
  } catch (error: any) {
    console.error('[API] twilio-send-bulk-sms error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send bulk SMS' });
  }
}
