import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getFirebaseMessaging } from '../lib/firebase-admin.js';

export const config = {
  maxDuration: 30,
};

/**
 * Send Message API
 * Sends a message to a team conversation
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { conversationId, senderId, type, content, fileName, fileUrl, duration, replyTo } = req.body;

    // Validation
    if (!conversationId || !senderId || !type) {
      return res.status(400).json({
        error: 'conversationId, senderId, and type are required'
      });
    }

    if (type === 'text' && !content) {
      return res.status(400).json({ error: 'content is required for text messages' });
    }

    // Initialize Supabase
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is participant in conversation
    const { data: participant, error: participantError } = await supabase
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', senderId)
      .single();

    if (participantError || !participant) {
      return res.status(403).json({
        error: 'User is not a participant in this conversation'
      });
    }

    // Insert message
    const messageData: any = {
      conversation_id: conversationId,
      sender_id: senderId,
      type,
    };

    if (content) messageData.content = content;
    if (fileName) messageData.file_name = fileName;
    if (fileUrl) messageData.file_url = fileUrl;
    if (duration) messageData.duration = duration;
    if (replyTo?.id) messageData.reply_to = replyTo.id;

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert(messageData)
      .select('*')
      .single();

    if (messageError) {
      console.error('[Send Message] Database error:', messageError);
      throw new Error(messageError.message);
    }

    console.log('[Send Message] Message sent successfully:', message.id);

    // Run all post-insert work in parallel:
    //   • stamp conversations.last_message_at (keeps polls + Realtime accurate)
    //   • fetch sender info for the response payload
    //   • fetch other participants for push targeting
    const [senderResult, participantsResult] = await Promise.all([
      supabase.from('users').select('name, avatar').eq('id', senderId).single(),
      supabase.from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .neq('user_id', senderId),
      supabase.from('conversations')
        .update({ last_message_at: message.created_at })
        .eq('id', conversationId),
    ]);

    const sender         = senderResult.data;
    const otherParticipants = participantsResult.data ?? [];

    // ── Push notifications ────────────────────────────────────────────────────
    // NOTE: Push is sent BEFORE the HTTP response. Vercel Lambda freezes the
    // process the moment res.end() is called — any async work queued after that
    // is silently dropped. A 4 s timeout caps worst-case latency (OAuth2 cold
    // start + FCM HTTP v1); warm instances typically complete in < 300 ms because
    // the OAuth2 token is cached in firebase-admin.ts.
    const pushWork = async () => {
      try {
        if (!otherParticipants.length) return;

        const otherUserIds = otherParticipants.map((p: any) => p.user_id);
        const { data: tokenRows } = await supabase
          .from('push_tokens')
          .select('token, token_source, platform')
          .in('user_id', otherUserIds)
          .eq('is_active', true);

        if (!tokenRows?.length) {
          console.log('[Send Message] No active push tokens for recipients — userIds:', otherUserIds);
          return;
        }
        console.log('[Send Message] Push targets:', tokenRows.length, 'token(s) for', otherUserIds.length, 'recipient(s)');

        const senderName = sender?.name || 'Someone';
        const msgPreview =
          type === 'text'  ? (content || '')
          : type === 'image' ? '📷 Photo'
          : type === 'voice' ? '🎤 Voice message'
          : type === 'video' ? '🎬 Video'
          : '📎 File';

        const expoTokens = tokenRows.filter((r: any) =>  r.token.startsWith('ExponentPushToken['));
        const fcmTokens  = tokenRows.filter((r: any) => !r.token.startsWith('ExponentPushToken['));

        console.log(`[Send Message] Pushing to ${fcmTokens.length} FCM + ${expoTokens.length} Expo token(s)`);

        // ── FCM tokens (iOS, Android, Web) ────────────────────────────────────
        if (fcmTokens.length > 0) {
          try {
            const messaging = await getFirebaseMessaging();
            const deadFcmTokens: string[] = [];

            await Promise.allSettled(
              fcmTokens.map(async (row: any) => {
                try {
                  const fcmName = await messaging.send({
                    token: row.token,
                    notification: { title: senderName, body: msgPreview },
                    data: { type: 'chat', conversationId },
                    apns: {
                      headers: { 'apns-push-type': 'alert', 'apns-priority': '10' },
                      payload: { aps: { badge: 1, sound: 'default' } },
                    },
                    android: { priority: 'high', notification: { sound: 'default', channelId: 'default' } },
                  });
                  console.log('[Send Message] ✅ FCM sent — platform:', row.platform, 'source:', row.token_source, 'name:', fcmName);
                } catch (err: any) {
                  const code = err?.errorInfo?.code || err?.code || '';
                  const rawBody = err?.rawBody ? JSON.stringify(err.rawBody).slice(0, 300) : 'n/a';
                  console.error('[Send Message] ❌ FCM error — code:', code, 'platform:', row.platform, 'token ending:', row.token.slice(-8), 'raw:', rawBody);
                  // Only deactivate on definitive "token no longer valid" codes.
                  // INVALID_ARGUMENT is too broad — it fires for APNs config issues on
                  // Mac Catalyst without invalidating the token itself.
                  if (
                    code === 'UNREGISTERED' ||
                    code.includes('registration-token-not-registered') ||
                    code.includes('invalid-registration-token')
                  ) {
                    deadFcmTokens.push(row.token);
                  }
                }
              })
            );

            if (deadFcmTokens.length > 0) {
              await supabase.from('push_tokens').update({ is_active: false }).in('token', deadFcmTokens);
              console.log('[Send Message] Deactivated', deadFcmTokens.length, 'dead FCM token(s)');
            }
          } catch (fcmErr: any) {
            console.error('[Send Message] ❌ FCM init failed:', fcmErr?.message);
          }
        }

        // ── Legacy Expo tokens ─────────────────────────────────────────────────
        if (expoTokens.length > 0) {
          try {
            const pushMessages = expoTokens.map((row: any) => ({
              to: row.token,
              title: senderName,
              body: msgPreview,
              data: { type: 'chat', conversationId },
              sound: 'default',
              badge: 1,
            }));
            const expRes = await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
              body: JSON.stringify(pushMessages),
            });
            if (expRes.ok) {
              const expResult = await expRes.json() as { data?: Array<{ details?: { error?: string } }> };
              const deadExpoTokens = expoTokens
                .filter((_: any, i: number) => expResult.data?.[i]?.details?.error === 'DeviceNotRegistered')
                .map((r: any) => r.token);
              if (deadExpoTokens.length > 0) {
                await supabase.from('push_tokens').update({ is_active: false }).in('token', deadExpoTokens);
              }
            }
          } catch (expoErr: any) {
            console.warn('[Send Message] Expo push error:', expoErr?.message);
          }
        }
      } catch (pushErr: any) {
        console.warn('[Send Message] Push failed (non-fatal):', pushErr?.message);
      }
    };

    // Race push work against a 8 s timeout (covers FCM OAuth2 cold-start ~2-3s
    // + actual send). This route has maxDuration: 30 so 8s is safe.
    await Promise.race([
      pushWork(),
      new Promise<void>(resolve => setTimeout(resolve, 8000)),
    ]);

    return res.status(200).json({
      success: true,
      message: {
        ...message,
        sender: sender || { name: 'Unknown', avatar: null },
      },
    });
  } catch (error: any) {
    console.error('[Send Message] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send message',
    });
  }
}
