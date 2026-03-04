import type { VercelRequest, VercelResponse } from '@vercel/node';
// pdf-parse is a CommonJS module — use require() style import to avoid
// "has no default export" TypeScript error with ESM-style imports.
// It is a pure Node.js library (no browser APIs, no web workers) and works
// reliably in Vercel/Lambda serverless environments unlike pdfjs-dist.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse: (buffer: Buffer) => Promise<{ text: string; numpages: number }> = require('pdf-parse');

export const config = {
  maxDuration: 30,
  api: {
    bodyParser: {
      sizeLimit: '20mb', // support base64 fallback if needed
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pdfUrl, fileName } = req.body;
  if (!pdfUrl) {
    return res.status(400).json({ error: 'pdfUrl is required' });
  }

  try {
    console.log('[ExtractPdfText] Fetching PDF:', fileName, pdfUrl.substring(0, 80));

    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF from S3: HTTP ${response.status} — URL may not be publicly accessible`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('[ExtractPdfText] PDF size:', buffer.length, 'bytes');

    const data = await pdfParse(buffer);

    // pdf-parse returns all text in data.text; clean up excessive whitespace
    const extractedText = data.text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[^\S\n]{2,}/g, ' ')
      .trim();

    console.log('[ExtractPdfText] Extracted chars:', extractedText.length, '— pages:', data.numpages);

    return res.status(200).json({
      success: true,
      text: extractedText,
      pages: data.numpages,
    });
  } catch (err: any) {
    console.error('[ExtractPdfText] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to extract PDF text' });
  }
}
