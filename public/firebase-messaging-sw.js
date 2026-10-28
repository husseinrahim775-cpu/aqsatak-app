importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// 🔍 قراءة الإعدادات الممررة عبر رابط التسجيل من ملف .env.local
const params = new URLSearchParams(location.search);

firebase.initializeApp({
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  storageBucket: params.get("storageBucket"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId")
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification ? payload.notification.title : 'إشعار جديد';
  const notificationOptions = {
    body: payload.notification ? payload.notification.body : '',
    icon: '/window.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});