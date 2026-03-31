import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { address, postalCode } = req.body;
  if (!address) return res.status(400).json({ valid: false, error: 'Address is required' });

  const queryStr = postalCode ? `${address} ${postalCode}` : address;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryStr)}&format=json&limit=1&countrycodes=us&addressdetails=1`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'LegacyPrimeWorkflowSuite/1.0' },
    });

    if (!response.ok) {
      return res.status(200).json({ valid: false, error: 'Address lookup service unavailable' });
    }

    const results = await response.json();

    if (!results.length) {
      return res.status(200).json({ valid: false, error: 'Address not found. Please enter a real street address' });
    }

    // Nominatim returns address.road when it matched a real street.
    // If only city/ZIP matched, address.road is absent — meaning the street doesn't exist.
    const details = results[0].address;
    if (!details?.road) {
      return res.status(200).json({ valid: false, error: 'Street not found. Please enter a valid street address' });
    }

    return res.status(200).json({ valid: true });
  } catch (err: any) {
    // Don't hard-block signup if the validation service is down
    console.error('[validate-address] Error:', err.message);
    return res.status(200).json({ valid: true, warning: 'Address could not be verified' });
  }
}
