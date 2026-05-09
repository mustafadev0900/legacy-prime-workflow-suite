import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors } from './lib/cors.js';

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('[ai-estimate] OPENAI_API_KEY not configured');
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    console.log('[ai-estimate] Calling GPT-4o, messages count:', messages.length);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        max_tokens: 4096,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[ai-estimate] OpenAI error:', err);
      return res.status(500).json({ error: `OpenAI error: ${response.status}` });
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';

    console.log('[ai-estimate] Response length:', content.length);

    return res.status(200).json({ success: true, content });
  } catch (error: any) {
    console.error('[ai-estimate] Unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Unknown error' });
  }
}
