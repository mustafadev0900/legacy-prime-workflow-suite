// Firebase Messaging Service Worker
// Handles background push notifications on web (Chrome, Firefox, Edge, Safari 16.4+ PWA)
// This file must be served from the root domain — Vercel serves /public/* from root automatically.

importScripts('https://www.gstatic.com/firebasejs/12.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.10.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyBoRXHAbExE3NrDJaDQ_mCLCpBKgttr644',
  authDomain:        'legacy-prime-workflow-suite.firebaseapp.com',
  projectId:         'legacy-prime-workflow-suite',
  storageBucket:     'legacy-prime-workflow-suite.firebasestorage.app',
  messagingSenderId: '339424875663',
  appId:             '1:339424875663:web:0777be604b532200044cfa',
});

const messaging = firebase.messaging();

// Handle background messages (tab closed or app not focused)
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const title = payload.notification?.title || 'Legacy Prime';
  const body  = payload.notification?.body  || '';
  const data  = payload.data || {};

  self.registration.showNotification(title, {
    body,
    icon:  '/assets/images/app-icon-1024.png',
    badge: '/assets/images/app-icon-1024.png',
    data,
    tag:   data.type || 'general', // collapses duplicate notifications of same type
  });
});

// Route notification taps to the correct screen
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let path = '/';

  switch (data.type) {
    case 'chat':
      path = '/(tabs)/chat';
      break;
    case 'task-reminder':
      path = '/(tabs)/dashboard';
      break;
    case 'estimate-received':
    case 'proposal-submitted':
      path = '/(tabs)/subcontractors';
      break;
    case 'payment-received':
      path = data.projectId ? `/project/${data.projectId}` : '/(tabs)/expenses';
      break;
    case 'change-order':
      path = data.projectId ? `/project/${data.projectId}` : '/(tabs)/dashboard';
      break;
    default:
      path = '/notifications';
  }

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing tab if already open
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) client.navigate(path);
            return;
          }
        }
        // Otherwise open a new tab
        clients.openWindow(path);
      })
  );
});
