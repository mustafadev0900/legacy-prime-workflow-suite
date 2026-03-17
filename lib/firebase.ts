import { getApps, initializeApp } from 'firebase/app';
import { getMessaging, isSupported } from 'firebase/messaging';

// Firebase web config — these values are intentionally public (client-side identifiers).
// Security is enforced via Firebase Security Rules and authorized domain restrictions,
// NOT by keeping these values secret. See: https://firebase.google.com/docs/projects/api-keys
const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID!,
};

const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export { firebaseApp };

/**
 * Returns Firebase Messaging instance for web push.
 * Returns null if the browser does not support push (e.g. Safari iOS, older browsers).
 */
export async function getFirebaseMessagingWeb() {
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(firebaseApp);
}
