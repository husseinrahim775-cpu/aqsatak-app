"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { MessageSquare, Lock, LogOut, Loader2 } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";

const ADMIN_WHATSAPP_NUMBER = "9647838338499"; 

export default function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { user, userData } = useAuth() as any;
  const [ownerSubscription, setOwnerSubscription] = useState<any>(null);
  const [loadingSub, setLoadingSub] = useState(true);

  // 🚪 دالة تسجيل الخروج المؤكدة والتحويل لصفحة تسجيل الدخول
  const handleLogout = async () => {
    try {
      sessionStorage.clear();
      localStorage.clear();
      await signOut(auth);
      window.location.replace("/login");
    } catch (error) {
      window.location.replace("/login");
    }
  };

  // 1. تحديد الـ UID الخاص بالمالك الرئيسي للحساب
  const getOwnerUid = () => {
    if (userData?.role === "employee") {
      const activeSession = sessionStorage.getItem("active_session");
      if (activeSession) {
        try {
          const parsed = JSON.parse(activeSession);
          if (parsed.ownerUid) return parsed.ownerUid;
        } catch (e) {}
      }
      return userData?.ownerUid || null;
    }
    return user?.uid || null;
  };

  // 2. جلب اشتراك المالك دائماً لحساب الحظر والتقييم
  useEffect(() => {
    const fetchSubscriptionData = async () => {
      // الأدمن الرئيسي للنظام لا نتحقق من اشتراكه
      if (userData?.role === "admin" || user?.email === "admin@aqsatak.com") {
        setLoadingSub(false);
        return;
      }

      const ownerUid = getOwnerUid();
      if (ownerUid) {
        try {
          const ownerDocRef = doc(db, "users", ownerUid);
          const ownerDocSnap = await getDoc(ownerDocRef);
          if (ownerDocSnap.exists()) {
            setOwnerSubscription(ownerDocSnap.data()?.subscription || null);
          }
        } catch (e) {
          console.error("خطأ في قراءة اشتراك المالك الرئيسي:", e);
        }
      }
      setLoadingSub(false);
    };

    if (user || userData) {
      fetchSubscriptionData();
    }
  }, [user, userData]);

  // إذا كان صاحب الحساب هو الأدمن الرئيسي للسيستم، لا تقفله مطلقاً
  if (userData?.role === "admin" || user?.email === "admin@aqsatak.com") {
    return <>{children}</>;
  }

  // انتهاء تحميل البيانات
  if (loadingSub) {
    return null; // أو شاشة تحميل بسيطة
  }

  // قراءة بيانات وتاريخ الاشتراك الخاص بالمالك الرئيسي
  const sub = ownerSubscription || userData?.subscription;
  const endDate = sub?.endDate ? new Date(sub.endDate) : null;
  const isExpired = endDate ? new Date() > endDate : false;
  const isDisabled = userData?.status === "disabled" || userData?.status === "rejected" || userData?.status === "suspended";

  // 3. 🚨 تفعيل الحظر الكامل إذا كان الحساب الرئيسي موقوفاً أو الاشتراك منتهياً
  if (isDisabled || isExpired || sub?.isActive === false) {
    const whatsappMessage = encodeURIComponent(
      `مرحباً عزيزي الأدمن، أود تجديد اشتراكي في نظام أقساطك الحسابي.\nالبريد الإلكتروني: ${userData?.email || user?.email || "غير محدد"}`
    );

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[999] flex items-center justify-center p-4 font-sans dir-rtl select-none">
        <div className="bg-card border border-border max-w-md w-full p-6 md:p-8 rounded-3xl shadow-2xl text-center space-y-5 animate-in zoom-in-95">
          
          {/* أيقونة القفل المودرن المتجاوبة مع الثيم */}
          <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mx-auto shadow-md">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-foreground">انتهى اشتراك المنظومة!</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              لقد انتهت الفترة المحددة لاشتراك المنظومة الحسابية التابع لها. تم إيقاف إجراء التعديلات والإضافات، يرجى التواصل مع المالك للتجديد.
            </p>
          </div>

          <div className="p-3 bg-secondary/50 rounded-2xl border border-border text-xs font-bold text-muted-foreground">
            الحالة: <span className="text-rose-500 font-black">{isDisabled ? "حساب معطل" : "الاشتراك منتهي"}</span>
          </div>

          {/* أزرار الخروج والتواصل */}
          <div className="space-y-2.5 pt-2">
            <a
              href={`https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-theme-gradient hover:opacity-95 text-white font-black py-3.5 px-5 rounded-2xl text-xs md:text-sm transition-all shadow-lg shadow-primary/20 active:scale-95"
            >
              <MessageSquare className="w-4.5 h-4.5" />
              <span>تجديد الاشتراك عبر الواتساب</span>
            </a>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 bg-secondary hover:bg-border text-foreground font-bold py-3 px-5 rounded-2xl text-xs transition-all border border-border active:scale-95"
            >
              <LogOut className="w-4 h-4 text-rose-500" />
              <span>تسجيل الخروج والانتقال لصفحة الدخول</span>
            </button>
          </div>

        </div>
      </div>
    );
  }

  return <>{children}</>;
}