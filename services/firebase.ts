import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// جلب المفاتيح من إعدادات Firebase الخاص بك
const firebaseConfig = {
  apiKey: "AIzaSyC23GI1JxW_tc-7iCB3wNqGHaB_ePVY5fY",
  authDomain: "aqsatak-team.firebaseapp.com",
  projectId: "aqsatak-team",
  storageBucket: "aqsatak-team.firebasestorage.app",
  messagingSenderId: "752420244346",
  appId: "1:752420244346:web:ea49be5b4d461203bc64c3",
  measurementId: "G-SQJ0VB9399"
};

// تهيئة تطبيق Firebase الأساسي
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// تفعيل الكاش والتخزين المحلي غير المحدود لسرعة استجابة فائقة
let firestoreDb;

if (typeof window !== "undefined") {
  try {
    firestoreDb = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
        cacheSizeBytes: CACHE_SIZE_UNLIMITED // 👈 يمنع حظر البيانات القديمة ويجعل العرض فورياً
      })
    });
  } catch (e) {
    // في حال تم التهيئة مسبقاً يتم جلب النسخة القائمة مباشرة
    firestoreDb = getFirestore(app);
  }
} else {
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
export const auth = getAuth(app);
export const storage = getStorage(app);