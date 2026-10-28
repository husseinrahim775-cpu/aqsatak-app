import { getMessaging, getToken } from "firebase/messaging";

export const requestNotificationPermission = async () => {
  try {
    if (typeof window === "undefined" || !("Notification" in window)) return null;

    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      // 1️⃣ بناء رابط الـ Service Worker مع تمرير المفاتيح من ملف .env.local
      const swParams = new URLSearchParams({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
      });

      // 2️⃣ تسجيل الـ Service Worker مع المعاملات
      const registration = await navigator.serviceWorker.register(
        `/firebase-messaging-sw.js?${swParams.toString()}`
      );

      const messaging = getMessaging();
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

      // 3️⃣ استخراج الـ Token مع تمرير الـ Service Worker المُسجل
      const token = await getToken(messaging, {
        vapidKey: vapidKey,
        serviceWorkerRegistration: registration,
      });

      console.log("FCM Token:", token);
      return token;
    } else {
      console.warn("تم رفض إذن الإشعارات من قبل المستخدم");
      return null;
    }
  } catch (error) {
    console.error("فشل تفعيل الإشعارات:", error);
    return null;
  }
};