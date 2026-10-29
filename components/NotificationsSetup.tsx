'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export default function NotificationsSetup() {
  useEffect(() => {
    // 🛑 التأكد من أن التطبيق يعمل على جهاز أصلي (Android/iOS) وليس متصفح ويب
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // 1. طلب إذن الإشعارات من المستخدم
    PushNotifications.requestPermissions().then(result => {
      if (result.receive === 'granted') {
        // 2. التسجيل في الخدمة لتلقي الـ Token
        PushNotifications.register();
      }
    });

    // 3. الحصول على FCM Token الخاص بالجهاز لتخزينه في السيرفر
    PushNotifications.addListener('registration', token => {
      console.log('Push Registration Token:', token.value);
    });

    // 4. الاستماع للإشعارات القادمة أثناء فتح التطبيق
    PushNotifications.addListener('pushNotificationReceived', notification => {
      console.log('Notification Received:', notification);
    });
  }, []);

  return null;
}