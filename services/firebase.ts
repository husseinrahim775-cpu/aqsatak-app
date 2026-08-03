import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
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

// تصدير خدمات قاعدة البيانات والمصادقة لاستخدامها في باقي النظام
export const db = getFirestore(app);
export const auth = getAuth(app);