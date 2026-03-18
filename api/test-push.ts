import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getFirebaseMessaging } from './lib/firebase-admin.js';

export const config = { maxDuration: 15 };

/**
 * Diagnostic endpoint — sends a test FCM push to a specific user and returns
 * the full result (success name or error code) so we can confirm FCM is working.
 *
 * GET /api/test-push?userId=<uuid>
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const userId = (req.query.userId as string) || '';
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'DB not configured' });

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch all active tokens for this user
  const { data: tokens, error: tokErr } = await supabase
    .from('push_tokens')
    .select('token, token_source, platform, created_at, updated_at')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (tokErr) return res.status(500).json({ error: tokErr.message });
  if (!tokens?.length) return res.status(200).json({ message: 'No active push tokens for this user', tokens: [] });

  const fcmTokens = tokens.filter(t => !t.token.startsWith('ExponentPushToken['));
  const results: any[] = [];

  if (fcmTokens.length > 0) {
    try {
      const messaging = await getFirebaseMessaging();
      for (const row of fcmTokens) {
        try {
          const name = await messaging.send({
            token: row.token,
            notification: { title: '🧪 Test Push', body: 'FCM is reaching your device!' },
            data: { type: 'test' },
            apns: {
              headers: { 'apns-push-type': 'alert', 'apns-priority': '10' },
              payload: { aps: { badge: 0, sound: 'default' } },
            },
            android: { priority: 'high', notification: { sound: 'default', channelId: 'default' } },
          });
          results.push({ token: row.token.slice(-10), platform: row.platform, source: row.token_source, status: 'sent', fcmName: name });
        } catch (err: any) {
          const code = err?.code || err?.errorInfo?.code || err?.message || 'UNKNOWN';
          results.push({ token: row.token.slice(-10), platform: row.platform, source: row.token_source, status: 'error', error: code, rawFcmError: err?.rawBody ?? null });
        }
      }
    } catch (initErr: any) {
      results.push({ status: 'fcm_init_error', error: initErr?.message });
    }
  }

  return res.status(200).json({ tokenCount: tokens.length, fcmTokenCount: fcmTokens.length, results });
}
