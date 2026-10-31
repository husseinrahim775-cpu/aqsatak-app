'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth, app } from '@/services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

export default function NotificationsSetup() {
  useEffect(() => {
    // 📱 1. التشغيل على أجهزة المحمول الأصلية (Android / iOS)
    if (Capacitor.isNativePlatform()) {
      PushNotifications.requestPermissions().then((result) => {
        if (result.receive === 'granted') {
          PushNotifications.register();
        }
      });

      const registrationListener = PushNotifications.addListener(
        'registration',
        async (token) => {
          console.log('Push Registration Token:', token.value);
          const currentUser = auth.currentUser;
          if (currentUser && token.value) {
            try {
              await updateDoc(doc(db, 'users', currentUser.uid), {
                fcmToken: token.value,
                lastTokenUpdate: new Date().toISOString(),
              });
            } catch (error) {
              console.error('خطأ في حفظ FCM Token في Firestore:', error);
            }
          }
        }
      );

      const notificationListener = PushNotifications.addListener(
        'pushNotificationReceived',
        (notification) => {
          console.log('Notification Received:', notification);
        }
      );

      return () => {
        registrationListener.then((l) => l.remove());
        notificationListener.then((l) => l.remove());
      };
    } 
    
    // 🖥️ 2. التشغيل على المتصفح وتطبيق سطح المكتب (Web / EXE)
    else {
      // الاستماع لتغير حالة تسجيل الدخول لضمان وجود currentUser
      const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!user) return;

        try {
          if (typeof window === 'undefined' || !('Notification' in window)) return;

          // طلب إذن التنبيهات
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') return;

          // رابط الـ Service Worker مع المتغيرات البيئية
          const swUrl = `/firebase-messaging-sw.js?apiKey=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}&authDomain=${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}&projectId=${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}&storageBucket=${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}&messagingSenderId=${process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}&appId=${process.env.NEXT_PUBLIC_FIREBASE_APP_ID}`;

          const registration = await navigator.serviceWorker.register(swUrl);
          const messaging = getMessaging(app);

          const token = await getToken(messaging, {
            serviceWorkerRegistration: registration,
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          });

          if (token) {
            await updateDoc(doc(db, 'users', user.uid), {
              fcmToken: token,
              lastTokenUpdate: new Date().toISOString(),
            });
            console.log('تم حفظ FCM Token للمتصفح/الحاسوب بنجاح:', token);
          }
        } catch (error) {
          console.error('خطأ في إعداد إشعارات المتصفح/الحاسوب:', error);
        }
      });

      // الاستماع للإشعارات في الواجهة أثناء فتح المنظومة
      let unsubscribeMessaging: (() => void) | null = null;
      try {
        if (typeof window !== 'undefined' && 'Notification' in window) {
          const messaging = getMessaging(app);
          unsubscribeMessaging = onMessage(messaging, (payload) => {
            if (payload.notification) {
              new Notification(payload.notification.title || 'تنبيه', {
                body: payload.notification.body,
                icon: '/window.svg',
              });
            }
          });
        }
      } catch (err) {
        console.error('خطأ الاستماع للإشعارات:', err);
      }

      return () => {
        unsubscribeAuth();
        if (unsubscribeMessaging) unsubscribeMessaging();
      };
    }
  }, []);

  return null;
}