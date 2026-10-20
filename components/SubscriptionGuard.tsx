"use client";

import { useAuth } from "./AuthProvider";
import { MessageSquare, Lock, LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";

const ADMIN_WHATSAPP_NUMBER = "9647838338499"; 

export default function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { user, userData } = useAuth() as any;

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

  // 1. إذا كان صاحب الحساب هو الأدمن الرئيسي للسيستم، لا تقفله
  if (userData?.role === "admin" || user?.email === "admin@aqsatak.com") {
    return <>{children}</>;
  }

  // 2. قراءة بيانات وتاريخ الاشتراك بدقة من Firestore
  const sub = userData?.subscription;
  const endDate = sub?.endDate ? new Date(sub.endDate) : null;
  const isExpired = endDate ? new Date() > endDate : false;
  const isDisabled = userData?.status === "disabled" || userData?.status === "rejected" || userData?.status === "suspended";

  // 3. 🚨 تفعيل الحظر الكامل إذا كان الحساب موقوفاً أو الاشتراك منتهياً
  if (isDisabled || isExpired || sub?.isActive === false) {
    const whatsappMessage = encodeURIComponent(
      `مرحباً عزيزي الأدمن، أود تجديد اشتراكي في نظام أقساطك الحسابي.\nالبريد الإلكتروني: ${userData?.email || user?.email || "غير محدد"}`
    );

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[999] flex items-center justify-center p-4 font-sans dir-rtl select-none">
        <div className="bg-card border border-border max-w-md w-full p-6 md:p-8 rounded-3xl shadow-2xl text-center space-y-5 animate-in zoom-in-95">
          
          {/* أيقونة القفل المودرن */}
          <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mx-auto shadow-md">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-black text-foreground">انتهى اشتراك المنظومة!</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              لقد انتهت الفترة المحددة لاشتراكك الحسابي. تم إيقاف إجراء التعديلات والإضافات لحماية بياناتك، يرجى التجديد للاستمرار.
            </p>
          </div>

          <div className="p-3 bg-secondary/50 rounded-2xl border border-border text-xs font-bold text-muted-foreground">
            الحالة: <span className="text-rose-500 font-black">{isDisabled ? "حساب معطل" : "الاشتراك منتهي"}</span>
          </div>

          {/* الأزرار الخروج والتواصل */}
          <div className="space-y-2.5 pt-2">
            <a
              href={`https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white font-black py-3.5 px-5 rounded-2xl text-xs md:text-sm transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
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