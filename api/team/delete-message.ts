import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 10,
};

/**
 * Delete Message API
 * Soft-deletes a message by setting is_deleted=true
 * Only the original sender can delete for everyone
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messageId, userId } = req.body;

    if (!messageId || !userId) {
      return res.status(400).json({ error: 'messageId and userId are required' });
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user is the sender of the message
    const { data: message, error: fetchError } = await supabase
      .from('messages')
      .select('id, sender_id')
      .eq('id', messageId)
      .single();

    if (fetchError || !message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.sender_id !== userId) {
      return res.status(403).json({ error: 'Only the sender can delete this message' });
    }

    // Soft delete: set is_deleted = true
    const { error: deleteError } = await supabase
      .from('messages')
      .update({ is_deleted: true })
      .eq('id', messageId);

    if (deleteError) {
      console.error('[Delete Message] Error:', deleteError);
      throw new Error(deleteError.message);
    }

    console.log('[Delete Message] Message soft-deleted:', messageId);

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[Delete Message] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete message',
    });
  }
}
