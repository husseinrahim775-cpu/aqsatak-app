'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/services/firebase';

export default function NotificationsSetup() {
  useEffect(() => {
    // 🛑 التأكد من أن التطبيق يعمل على جهاز أصلي (Android/iOS) وليس متصفح ويب[cite: 14]
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // 1. طلب إذن الإشعارات والتسجيل مباشرة[cite: 14]
    PushNotifications.requestPermissions().then(result => {
      if (result.receive === 'granted') {
        PushNotifications.register(); //[cite: 14]
      }
    });

    // 2. الحصول على FCM Token وحفظه في Firestore بحساب المستخدم الحالي
    const registrationListener = PushNotifications.addListener('registration', async (token) => {
      console.log('Push Registration Token:', token.value); //[cite: 14]
      
      const currentUser = auth.currentUser;
      if (currentUser && token.value) {
        try {
          // تحديث توكن الجهاز في وثيقة المستخدم ليتمكن السيرفر من إرسال الإشعارات
          await updateDoc(doc(db, "users", currentUser.uid), {
            fcmToken: token.value,
            lastTokenUpdate: new Date().toISOString()
          });
        } catch (error) {
          console.error("خطأ في حفظ FCM Token في Firestore:", error);
        }
      }
    });

    // 3. الاستماع للإشعارات الواردة أثناء استخدام التطبيق[cite: 14]
    const notificationListener = PushNotifications.addListener('pushNotificationReceived', notification => {
      console.log('Notification Received:', notification); //[cite: 14]
    });

    return () => {
      registrationListener.then(l => l.remove());
      notificationListener.then(l => l.remove());
    };
  }, []);

  return null;
}