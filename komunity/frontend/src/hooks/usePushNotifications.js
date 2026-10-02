import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { authApi } from '@/api';
import toast from 'react-hot-toast';

export const usePushNotifications = (user) => {
  useEffect(() => {
    if (!user) return;
    
    // Only run this on native mobile platforms (iOS/Android)
    if (!Capacitor.isNativePlatform()) return;

    const registerPush = async () => {
      try {
        // Request permissions
        let permStatus = await PushNotifications.checkPermissions();
        
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.warn('User denied push notification permissions');
          return;
        }

        // Register with Apple / Google to receive token
        await PushNotifications.register();

      } catch (err) {
        console.error('Failed to register push notifications:', err);
      }
    };

    // Listeners for push notifications
    const addListeners = async () => {
      await PushNotifications.addListener('registration', async (token) => {
        console.log('Push registration success, token: ' + token.value);
        try {
          // Send the token to our backend
          await authApi.saveFcmToken(token.value);
        } catch (err) {
          console.error('Failed to save FCM token to backend', err);
        }
      });

      await PushNotifications.addListener('registrationError', (error) => {
        console.error('Error on push registration: ' + JSON.stringify(error));
      });

      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received: ' + JSON.stringify(notification));
        // Show a local toast when a notification comes in while the app is foregrounded
        toast(notification.title + '\n' + notification.body, {
          icon: '🔔',
          duration: 4000
        });
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push action performed: ' + JSON.stringify(notification));
        // Here you could parse notification.notification.data and use React Router to navigate
        // e.g. navigate(`/c/${data.communityId}/posts/${data.referenceId}`)
      });
    };

    addListeners();
    registerPush();

    return () => {
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners();
      }
    };
  }, [user]);
};
