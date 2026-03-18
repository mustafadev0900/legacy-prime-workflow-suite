// Use the default firebase-admin entry point to avoid subpath import issues
// across CommonJS/ESM boundaries in Vercel serverless functions.
import admin from 'firebase-admin';

/**
 * Lazily initializes Firebase Admin SDK using service account credentials
 * from environment variables. Safe to call multiple times — only initializes once.
 *
 * Required env vars (Vercel secrets):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY  (newlines stored as \n — we unescape here)
 */
function initFirebaseAdmin() {
  if (admin.apps.length > 0) return;

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      '[firebase-admin] Missing credentials — set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in Vercel env vars'
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

export function getFirebaseMessaging() {
  initFirebaseAdmin();
  return admin.messaging();
}
