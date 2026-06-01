/**
 * Send a Supabase Realtime Broadcast from the server via REST.
 *
 * supabase.channel().send() without .subscribe() has no open WebSocket in
 * serverless environments and silently fails. The REST endpoint works without
 * a WebSocket connection and is the correct approach for server-side sends.
 */
export async function realtimeBroadcast(
  supabaseUrl: string,
  serviceKey: string,
  channelName: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      messages: [
        {
          topic: `realtime:${channelName}`,
          event,
          payload,
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Realtime broadcast failed: ${res.status} ${text}`);
  }
}
