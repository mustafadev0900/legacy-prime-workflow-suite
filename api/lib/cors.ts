import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:3000',
  'https://legacy-prime-workflow-suite.vercel.app',
];

/**
 * Apply CORS headers and handle OPTIONS preflight.
 * Returns true if the request was a preflight (caller should return immediately).
 *
 * Use at the top of every handler that is called from the web frontend with
 * an Authorization header (POST, PUT, DELETE). Simple GET requests without
 * custom headers are covered by vercel.json headers alone.
 */
export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin as string | undefined;
  // Reflect origin if it's in the allowlist, otherwise use the production URL
  // (never use '*' when Authorization header is present — browsers reject it).
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[ALLOWED_ORIGINS.length - 1];

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
