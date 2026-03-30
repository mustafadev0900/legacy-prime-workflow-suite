import type { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function geocodeAddress(address: string, postalCode: string): Promise<{ lat: number; lon: number } | null> {
  const query = encodeURIComponent(`${address} ${postalCode}`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=us`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'LegacyPrimeWorkflowSuite/1.0' },
  });

  if (!response.ok) return null;

  const results = await response.json();
  if (!results.length) return null;

  return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
}

async function findAndBuyTwilioNumber(
  client: twilio.Twilio,
  lat: number,
  lon: number
): Promise<string> {
  const distances = [25, 100, 500];

  for (const distance of distances) {
    try {
      const available = await client.availablePhoneNumbers('US').local.list({
        nearLatLong: `${lat},${lon}`,
        distance,
        limit: 1,
        smsEnabled: true,
        voiceEnabled: true,
      });

      if (available.length > 0) {
        const purchased = await client.incomingPhoneNumbers.create({
          phoneNumber: available[0].phoneNumber,
          voiceUrl: 'https://legacy-prime-workflow-suite.vercel.app/api/voice-webhook',
          voiceMethod: 'POST',
          smsUrl: 'https://legacy-prime-workflow-suite.vercel.app/api/twilio-webhook',
          smsMethod: 'POST',
        });
        console.log(`[provision-twilio] Purchased ${purchased.phoneNumber} (${distance}mi radius)`);
        return purchased.phoneNumber;
      }
    } catch (err: any) {
      console.warn(`[provision-twilio] Search failed at ${distance}mi:`, err.message);
    }
  }

  throw new Error('No available Twilio numbers found near this location');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { companyId, address, postalCode } = req.body;

  if (!companyId || !address || !postalCode) {
    return res.status(400).json({ error: 'companyId, address, and postalCode are required' });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return res.status(500).json({ error: 'Twilio credentials not configured' });
  }

  try {
    console.log(`[provision-twilio] Geocoding address: ${address}, ${postalCode}`);
    const coords = await geocodeAddress(address, postalCode);

    if (!coords) {
      return res.status(400).json({ error: 'Could not geocode the provided address' });
    }

    console.log(`[provision-twilio] Coordinates: ${coords.lat}, ${coords.lon}`);

    const client = twilio(accountSid, authToken);
    const phoneNumber = await findAndBuyTwilioNumber(client, coords.lat, coords.lon);

    // Save to companies table
    const { error: dbError } = await supabase
      .from('companies')
      .update({
        twilio_phone_number: phoneNumber,
        address,
        postal_code: postalCode,
      })
      .eq('id', companyId);

    if (dbError) {
      console.error('[provision-twilio] DB save error:', dbError);
      return res.status(500).json({ error: 'Failed to save phone number to database' });
    }

    console.log(`[provision-twilio] Saved ${phoneNumber} to company ${companyId}`);

    return res.status(200).json({ success: true, phoneNumber });
  } catch (error: any) {
    console.error('[provision-twilio] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to provision Twilio number' });
  }
}
