import { useEffect } from 'react';
import { requestFirebaseNotificationPermission, onMessageListener } from '@/lib/firebase';
import { authApi } from '@/api';
import { useAuthStore } from '@/contexts/authStore';
import toast from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export default function PushNotificationManager() {
  const { user } = useAuthStore();

  useEffect(() => {
    // Only ask for permissions if they are logged in
    if (!user) return;

    const setupPush = async () => {
      if (Capacitor.isNativePlatform()) {
        // Native App via Capacitor
        try {
          let permStatus = await PushNotifications.checkPermissions();
          if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
          }
          if (permStatus.receive === 'granted') {
            await PushNotifications.register();

            PushNotifications.addListener('registration', async (token) => {
              console.log('Native Push registration success, token: ' + token.value);
              try {
                await authApi.saveFcmToken(token.value);
              } catch (err) {
                console.error('Failed to save Native FCM token', err);
              }
            });

            PushNotifications.addListener('pushNotificationReceived', (notification) => {
              toast(notification.title + '\n' + notification.body, { icon: '🔔' });
            });
          }
        } catch (err) {
          console.error('Failed Native Push Setup:', err);
        }
      } else {
        // Web Push via Firebase JS SDK
        if (!('Notification' in window)) {
          console.log('This browser does not support desktop notification');
          return;
        }

        if (Notification.permission !== 'denied') {
          const token = await requestFirebaseNotificationPermission();
          if (token) {
            try {
              await authApi.saveFcmToken(token);
              console.log('Web FCM Token synced with backend');
            } catch (err) {
              console.error('Failed to save Web FCM token:', err);
            }
          }
        }

        onMessageListener().then((payload) => {
          if (payload) {
            toast(payload.notification.title, {
              icon: '🔔',
              style: { borderRadius: '10px', background: '#333', color: '#fff' },
            });
          }
        }).catch(err => console.log('failed: ', err));
      }
    };

    setupPush();

    return () => {
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners();
      }
    };
  }, [user]);

  return null;
}
