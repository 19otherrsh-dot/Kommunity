importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

// This requires URL query params if we wanted to make it fully dynamic, but
// typically for a service worker, it's easier to inject the config during build
// or use a placeholder that the user must fill in.
// For the scaffold, we will use a self-contained config object.

const firebaseConfig = {
  // TODO: Replace these with your actual Firebase config from environment variables in production
  // Service workers cannot directly access Vite's import.meta.env by default without a plugin.
  apiKey: "REPLACE_WITH_YOUR_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_AUTH_DOMAIN",
  projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket: "REPLACE_WITH_YOUR_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_YOUR_SENDER_ID",
  appId: "REPLACE_WITH_YOUR_APP_ID"
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
      body: payload.notification.body,
      icon: '/vite.svg'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (error) {
  console.warn('Firebase Service Worker init failed (keys probably not set).');
}
