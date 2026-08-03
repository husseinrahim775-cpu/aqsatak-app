"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore"; // 👈 تم إضافة getDoc
import { auth, db } from "../../services/firebase";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const sendTelegramNotification = async (newUserEmail: string, userId: string) => {
    try {
      await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newUserEmail, userId: userId }),
      });
    } catch (err) {
      console.error("خطأ في إرسال طلب التلغرام:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        // 1. تسجيل الدخول في Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. 🛡️ فحص حالة الحساب وتاريخ انتهاء الاشتراك في Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();

          // التحقق إذا كان الحساب موقوفاً أو مرفوضاً
          if (userData.status === "suspended" || userData.status === "rejected" || userData.status === "pending") {
            await signOut(auth); // طرده فوراً
            setError(
              userData.status === "pending"
                ? "حسابك قيد الانتظار ولم يتم تفعيله بعد."
                : "حسابك موقوف أو معطل. يرجى التواصل مع الإدارة لتجديد الاشتراك."
            );
            return;
          }

          // التحقق من تاريخ انتهاء الاشتراك (إذا كان محدداً)
          if (userData.expiresAt) {
            const expiryDate = userData.expiresAt.toDate ? userData.expiresAt.toDate() : new Date(userData.expiresAt);
            if (new Date() > expiryDate) {
              await signOut(auth); // طرده إذا انتهى تاريخ الاشتراك
              setError("انتهت مدة اشتراكك. يرجى تجديد الاشتراك للتمكن من الدخول.");
              return;
            }
          }
        }

        router.push("/dashboard");
      } else {
        // إنشاء حساب جديد
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          status: "pending",
          role: "user",
          createdAt: serverTimestamp(),
        });

        await sendTelegramNotification(user.email || email, user.uid);
        router.push("/pending");
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setError("البريد الإلكتروني مستخدم بالفعل.");
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        setError("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
      } else if (err.code === "auth/weak-password") {
        setError("كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل.");
      } else {
        setError("حدث خطأ أثناء العملية، يرجى المحاولة لاحقاً.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 absolute inset-0 z-50">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-primary mb-2">أقساطك</h1>
          <p className="text-gray-500">
            {isLogin ? "سجل دخولك لإدارة حساباتك المالية" : "أنشئ حساباً جديداً لبدء عملك"}
          </p>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 p-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">البريد الإلكتروني</label>
            <div className="relative">
              <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                required
                className="w-full pr-10 pl-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">كلمة المرور</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                required
                className="w-full pr-10 pl-4 py-3 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold hover:bg-primary/90 transition-all flex justify-center items-center gap-2 shadow-md mt-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? "دخول" : "إنشاء حساب")}
          </button>
        </form>

        <div className="text-center text-sm">
          <span className="text-gray-500">
            {isLogin ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}
          </span>
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
            className="text-primary font-bold mr-2 hover:underline"
          >
            {isLogin ? "أنشئ حساباً جديداً" : "سجل دخولك"}
          </button>
        </div>
      </div>
    </div>
  );
}