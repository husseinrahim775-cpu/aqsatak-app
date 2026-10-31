
'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth, app } from '@/services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// دالة مساعدة لحفظ/تحديث التوكن في المجموعة الصحيحة (users أو system_users)
async function saveTokenToCorrectCollection(userId: string, token: string) {
  if (!token || token.trim() === '') {
    console.error('❌ إلغاء الحفظ: التوكن فارغ');
    return;
  }

  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      await updateDoc(userRef, {
        fcmToken: token,
        lastTokenUpdate: new Date().toISOString(),
      });
      console.log(`✅ تم ربط FCM Token بالحساب (${userId}) في users`);
      return;
    }

    const systemUserRef = doc(db, 'system_users', userId);
    const systemUserSnap = await getDoc(systemUserRef);

    if (systemUserSnap.exists()) {
      await updateDoc(systemUserRef, {
        fcmToken: token,
        lastTokenUpdate: new Date().toISOString(),
      });
      console.log(`✅ تم ربط FCM Token بالحساب (${userId}) في system_users`);
    }
  } catch (error) {
    console.error('❌ خطأ أثناء حفظ الـ FCM Token في Firestore:', error);
  }
}

export default function NotificationsSetup() {
  useEffect(() => {
    let nativeFcmToken = '';

    // 📱 1. التشغيل على أجهزة المحمول الأصلية (Android / iOS)
    if (Capacitor.isNativePlatform()) {
      // الاستماع لتوليد التوكن وتخزينه محلياً
      const registrationListener = PushNotifications.addListener(
        'registration',
        async (token) => {
          console.log('📱 Native Push Registration Token:', token.value);
          nativeFcmToken = token.value;

          // إذا كان هنالك مستخدم مسجل دخوله حالياً، نحدث حقوله فوراً
          if (auth.currentUser?.uid) {
            await saveTokenToCorrectCollection(auth.currentUser.uid, token.value);
          }
        }
      );

      // طلب الإذن والتسجيل
      PushNotifications.requestPermissions().then((result) => {
        if (result.receive === 'granted') {
          PushNotifications.register();
        }
      });

      // 🔄 الاستماع لكل عملية تسجيل دخول جديدة (تنقل بين الحسابات)
      const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (user?.uid) {
          // إذا كان التوكن متولداً مسبقاً، املأ حقل الحساب الجديد فوراً
          if (nativeFcmToken) {
            await saveTokenToCorrectCollection(user.uid, nativeFcmToken);
          } else {
            // في حال عدم جاهزية التوكن، نطلب التسجيل مجدداً لتمرير التوكن
            PushNotifications.register();
          }
        }
      });

      const notificationListener = PushNotifications.addListener(
        'pushNotificationReceived',
        (notification) => {
          console.log('Notification Received:', notification);
        }
      );

      return () => {
        registrationListener.then((l) => l.remove());
        notificationListener.then((l) => l.remove());
        unsubscribeAuth();
      };
    } 

    // 🖥️ 2. التشغيل على المتصفح، الآيفون (PWA/Web)، وتطبيق سطح المكتب (EXE)
    else {
      const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        // عند تسجيل الخروج، لا نفعل شيئاً
        if (!user) return;

        try {
          if (typeof window === 'undefined' || !('Notification' in window)) return;

          const permission = await Notification.requestPermission();
          if (permission !== 'granted') return;

          const swUrl = `/firebase-messaging-sw.js?apiKey=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}&authDomain=${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}&projectId=${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}&storageBucket=${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}&messagingSenderId=${process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}&appId=${process.env.NEXT_PUBLIC_FIREBASE_APP_ID}`;

          const registration = await navigator.serviceWorker.register(swUrl);
          const messaging = getMessaging(app);

          // طلب التوكن فورياً للحساب الذي قام بتسجيل الدخول للتو
          const token = await getToken(messaging, {
            serviceWorkerRegistration: registration,
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          });

          if (token) {
            await saveTokenToCorrectCollection(user.uid, token);
          }
        } catch (error) {
          console.error('خطأ في إعداد إشعارات المتصفح/الحاسوب:', error);
        }
      });

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