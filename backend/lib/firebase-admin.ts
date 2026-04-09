import { GoogleAuth } from 'google-auth-library';

/**
 * Lightweight FCM v1 messaging client using google-auth-library + direct
 * HTTP calls. Replaces firebase-admin to avoid ncc/webpack bundling issues
 * with firebase-admin's large dependency tree in Vercel serverless functions.
 *
 * Drop-in replacement for firebase-admin's messaging instance:
 *   const messaging = await getFirebaseMessaging();
 *   await messaging.send({ token, notification, data, apns, android });
 *
 * Required env vars:
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

export interface FcmMessage {
  token: string;
  notification?: { title?: string; body?: string };
  data?: Record<string, string>;
  apns?: {
    headers?: Record<string, string>;
    payload?: { aps?: { badge?: number; sound?: string } };
  };
  android?: {
    priority?: string;
    notification?: { sound?: string; channelId?: string };
  };
}

class FcmMessaging {
  private auth: GoogleAuth;
  private projectId: string;

  constructor(projectId: string, clientEmail: string, privateKey: string) {
    this.projectId = projectId;
    this.auth = new GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey },
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
  }

  async send(message: FcmMessage): Promise<string> {
    const client = await this.auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    const body: Record<string, unknown> = {
      message: {
        token: message.token,
        ...(message.notification && { notification: message.notification }),
        ...(message.data && { data: message.data }),
        ...(message.apns && { apns: message.apns }),
        ...(message.android && {
          android: {
            priority: message.android.priority,
            ...(message.android.notification && {
              notification: {
                sound:      message.android.notification.sound,
                channel_id: message.android.notification.channelId,
              },
            }),
          },
        }),
      },
    };

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`,
      {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({})) as any;
      console.error('[fcm] Full error response:', JSON.stringify(errBody));
      // Extract FCM v1 error code (e.g. "UNREGISTERED", "INVALID_ARGUMENT")
      const fcmCode: string =
        errBody?.error?.details?.find((d: any) =>
          d['@type']?.includes('FcmError')
        )?.errorCode ??
        errBody?.error?.status ??
        'UNKNOWN';

      const err: any = new Error(
        `[fcm] send failed (${response.status}): ${fcmCode}`
      );
      // Match the shape sendNotification.ts checks:
      //   err?.errorInfo?.code or err?.code
      err.errorInfo = { code: fcmCode };
      err.code      = fcmCode;
      throw err;
    }

    const result = await response.json() as { name: string };
    return result.name;
  }
}

let _instance: FcmMessaging | null = null;

/**
 * Returns a cached FCM messaging client. Throws if credentials are missing.
 */
export async function getFirebaseMessaging(): Promise<FcmMessaging> {
  if (_instance) return _instance;

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      '[fcm] Missing credentials — set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in Vercel env vars'
    );
  }

  _instance = new FcmMessaging(projectId, clientEmail, privateKey);
  return _instance;
}
