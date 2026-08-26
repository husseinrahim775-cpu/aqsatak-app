import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// جلب المفاتيح من ملف .env.local
const firebaseConfig = {
  apiKey: "AIzaSyC23GI1JxW_tc-7iCB3wNqGHaB_ePVY5fY",
  authDomain: "aqsatak-team.firebaseapp.com",
  projectId: "aqsatak-team",
  storageBucket: "aqsatak-team.firebasestorage.app",
  messagingSenderId: "752420244346",
  appId: "1:752420244346:web:ea49be5b4d461203bc64c3",
  measurementId: "G-SQJ0VB9399"
};

// تهيئة Firebase (التأكد من عدم تهيئته أكثر من مرة في Next.js)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// تفعيل التخزين المؤقت لدعم العمل بدون إنترنت وسرعة جلب البيانات
export const db = typeof window !== "undefined"
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager() // يدعم فتح أكثر من تبويب في المتصفح بنفس الوقت
      })
    })
  : getFirestore(app);

export const auth = getAuth(app);