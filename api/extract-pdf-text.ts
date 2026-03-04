import type { VercelRequest, VercelResponse } from '@vercel/node';
import { inflateSync } from 'zlib';

// Pure Node.js PDF text extraction — zero external dependencies.
// Handles: FlateDecode-compressed streams, parenthesis strings (Tj/TJ),
// hex-encoded strings <AABB> (common with CID/Type2 fonts), and uses a
// positional stream scanner (not regex) to avoid nested-dict parsing failures.

export const config = {
  maxDuration: 30,
  api: { bodyParser: { sizeLimit: '20mb' } },
};

// ----- string decoders -----

function decodePdfStr(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

function hexToString(hex: string): string {
  const h = hex.replace(/\s/g, '');
  let result = '';
  for (let i = 0; i < h.length - 1; i += 2) {
    const code = parseInt(h.slice(i, i + 2), 16);
    if (code > 31 && code < 128) result += String.fromCharCode(code);
    else if (code > 127) result += String.fromCharCode(code); // keep non-ASCII too
  }
  return result;
}

// ----- text extraction from a single decompressed content stream -----

function extractTextFromStream(stream: string): string {
  const parts: string[] = [];

  // BT...ET blocks contain all text rendering operations
  const btEtRe = /BT[\s\S]*?ET/g;
  let btMatch: RegExpExecArray | null;
  while ((btMatch = btEtRe.exec(stream)) !== null) {
    const block = btMatch[0];
    let m: RegExpExecArray | null;

    // TJ array: [(string) kern <hex>] TJ  — most common in modern PDFs
    const tjArrRe = /\[([\s\S]*?)\]\s*TJ/g;
    while ((m = tjArrRe.exec(block)) !== null) {
      // Match paren strings AND hex strings inside the array
      const items = m[1].match(/(\([^)\\]*(?:\\.[^)\\]*)*\)|<[0-9A-Fa-f\s]+>)/g) ?? [];
      const text = (items as string[]).map(item =>
        item.startsWith('(')
          ? decodePdfStr(item.slice(1, -1))
          : hexToString(item.slice(1, -1))
      ).join('');
      if (text.trim()) parts.push(text);
    }

    // Tj / ' / " operator: (string) Tj  or  <hex> Tj
    const tjRe = /(?:\(([^)\\]*(?:\\.[^)\\]*)*)\)|<([0-9A-Fa-f\s]+)>)\s*(?:Tj|'|")/g;
    while ((m = tjRe.exec(block)) !== null) {
      const text = m[1] !== undefined ? decodePdfStr(m[1]) : hexToString(m[2]);
      if (text.trim()) parts.push(text);
    }

    parts.push(' ');
  }

  return parts.join('');
}

// ----- positional stream scanner (avoids nested-dict regex failures) -----

function extractTextFromPdf(data: Buffer): { text: string; pages: number; streamsFound: number } {
  const raw = data.toString('binary');
  const streamTexts: string[] = [];
  let streamsFound = 0;

  let searchPos = 0;
  while (searchPos < raw.length) {
    // Find the next 'stream' keyword
    const streamKeyPos = raw.indexOf('stream', searchPos);
    if (streamKeyPos === -1) break;

    // 'stream' must be followed by \r\n or \n (PDF spec requirement)
    const afterKeyword = raw[streamKeyPos + 6];
    const afterKeyword2 = raw[streamKeyPos + 7];
    let dataStart: number;
    if (afterKeyword === '\r' && afterKeyword2 === '\n') {
      dataStart = streamKeyPos + 8;
    } else if (afterKeyword === '\n') {
      dataStart = streamKeyPos + 7;
    } else {
      searchPos = streamKeyPos + 6;
      continue;
    }

    // Find the matching endstream
    const endStreamPos = raw.indexOf('\nendstream', dataStart);
    if (endStreamPos === -1) {
      searchPos = dataStart;
      continue;
    }

    streamsFound++;

    // Look back up to 512 bytes before 'stream' to find filter / subtype info
    const lookback = raw.slice(Math.max(0, streamKeyPos - 512), streamKeyPos);
    const isFlateDecode = lookback.includes('FlateDecode');
    const isImage = /\/Subtype\s*\/Image/.test(lookback);

    searchPos = endStreamPos + 10; // advance past endstream

    // Skip image streams — no text there
    if (isImage) continue;

    const streamBytes = Buffer.from(raw.slice(dataStart, endStreamPos), 'binary');

    let streamText: string;
    if (isFlateDecode) {
      try {
        streamText = inflateSync(streamBytes).toString('latin1');
      } catch {
        // Decompression failed — still try raw in case FlateDecode flag is misleading
        streamText = streamBytes.toString('latin1');
      }
    } else {
      streamText = streamBytes.toString('latin1');
    }

    // Try text extraction; also try uncompressed if flat gave nothing
    let text = extractTextFromStream(streamText);
    if (!text.trim() && isFlateDecode) {
      text = extractTextFromStream(streamBytes.toString('latin1'));
    }

    if (text.trim()) streamTexts.push(text);
  }

  // Count page objects for the page number field
  const pageCount = (raw.match(/\/Type\s*\/Page(?:[^s]|$)/g) ?? []).length;

  const fullText = streamTexts
    .join('\n')
    .replace(/[ \t]{3,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text: fullText, pages: Math.max(pageCount, 1), streamsFound };
}

// ----- handler -----

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
      throw new Error(`Failed to fetch PDF: HTTP ${response.status}`);
    }

    const data = Buffer.from(await response.arrayBuffer());
    console.log('[ExtractPdfText] PDF size:', data.length, 'bytes');

    const { text, pages, streamsFound } = extractTextFromPdf(data);
    console.log('[ExtractPdfText] Streams found:', streamsFound, '— extracted chars:', text.length, '— pages:', pages);

    return res.status(200).json({
      success: true,
      text: text || '',
      pages,
      streamsFound, // diagnostic: lets us see what was found
    });
  } catch (err: any) {
    console.error('[ExtractPdfText] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to extract PDF text' });
  }
}
