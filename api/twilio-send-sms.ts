import type { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, body } = req.body;
  if (!to || !body) {
    return res.status(400).json({ error: 'to and body are required' });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER;

  // Diagnostic log — shows which vars are present without exposing secrets
  console.log('[twilio-send-sms] env check:', {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? `set (${process.env.TWILIO_ACCOUNT_SID.slice(0, 6)}...)` : 'missing',
    EXPO_PUBLIC_TWILIO_ACCOUNT_SID: process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID ? `set (${process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID.slice(0, 6)}...)` : 'missing',
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ? `set (len=${process.env.TWILIO_AUTH_TOKEN.length})` : 'missing',
    EXPO_PUBLIC_TWILIO_AUTH_TOKEN: process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN ? `set (len=${process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN.length})` : 'missing',
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER || 'missing',
    resolved_sid_prefix: accountSid ? accountSid.slice(0, 6) : 'none',
    to,
  });

  if (!accountSid || !authToken || !fromNumber) {
    return res.status(500).json({ error: 'Twilio not configured. Please add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER to your environment variables.' });
  }

  try {
    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({ body, from: fromNumber, to });
    return res.status(200).json({ success: true, messageSid: message.sid, status: message.status });
  } catch (error: any) {
    console.error('[twilio-send-sms] Twilio error:', {
      message: error.message,
      code: error.code,
      status: error.status,
      moreInfo: error.moreInfo,
    });
    return res.status(500).json({ error: error.message || 'Failed to send SMS' });
  }
}
