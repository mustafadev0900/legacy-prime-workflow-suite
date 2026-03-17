import { getApps, initializeApp } from 'firebase/app';
import { getMessaging, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey:            'AIzaSyBoRXHAbExE3NrDJaDQ_mCLCpBKgttr644',
  authDomain:        'legacy-prime-workflow-suite.firebaseapp.com',
  projectId:         'legacy-prime-workflow-suite',
  storageBucket:     'legacy-prime-workflow-suite.firebasestorage.app',
  messagingSenderId: '339424875663',
  appId:             '1:339424875663:web:0777be604b532200044cfa',
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
