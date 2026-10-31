importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js");

// 🔍 قراءة الإعدادات الممررة عبر رابط التسجيل
const params = new URLSearchParams(location.search);

const apiKey = params.get("apiKey");
const authDomain = params.get("authDomain");
const projectId = params.get("projectId");
const storageBucket = params.get("storageBucket");
const messagingSenderId = params.get("messagingSenderId");
const appId = params.get("appId");

// 🛡️ التأكد من أن القيم موجوة وصحيحة وليست "undefined"
if (apiKey && apiKey !== "undefined" && apiKey !== "null") {
  firebase.initializeApp({
    apiKey: apiKey,
    authDomain: authDomain,
    projectId: projectId,
    storageBucket: storageBucket,
    messagingSenderId: messagingSenderId,
    appId: appId,
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log("[firebase-messaging-sw.js] Received background message ", payload);
    const notificationTitle = payload.notification ? payload.notification.title : "تنبيه جديد 🔔";
    const notificationOptions = {
      body: payload.notification ? payload.notification.body : "",
      icon: "/window.svg",
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} else {
  console.warn("[firebase-messaging-sw.js] تعذر تهيئة Service Worker بسبب نقص مفاتيح التهيئة (apiKey).");
}