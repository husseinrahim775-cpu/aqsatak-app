"use client";

import { useAuth } from "./AuthProvider";
import { MessageSquare, ShieldAlert, Lock } from "lucide-react";

// 📞 ضع رقم هاتفك للواتساب هنا بدون أصفار إضافية (مثلاً 9647700000000)
const ADMIN_WHATSAPP_NUMBER = "9647700000000"; 

export default function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { userData } = useAuth() as any;

  // 1. إذا كان أدمن النظام، يفتح له النظام بشكل مطلق
  if (userData?.role === "admin") {
    return <>{children}</>;
  }

  // 2. فحص حالة الاشتراك للأجهزة والعملاء
  const sub = userData?.subscription;
  const endDate = sub?.endDate ? new Date(sub.endDate) : null;
  const isExpired = endDate ? new Date() > endDate : false;
  const isDisabled = userData?.status === "disabled" || userData?.status === "rejected";

  // 3. إذا كان الاشتراك منتهياً أو الحساب موقوفاً، تظهر نافذة القفل
  if (isExpired || isDisabled || !sub?.isActive) {
    const whatsappMessage = encodeURIComponent(
      `مرحباً عزيزي الأدمن، أود تجديد اشتراكي في نظام أقساطك الحسابي.\nالبريد: ${userData?.email || "غير محدد"}`
    );

    return (
      <div className="relative min-h-screen">
        {/* خلفية معتمة تمنع التفاعل خلف الشاشة */}
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border max-w-md w-full p-6 md:p-8 rounded-3xl shadow-2xl text-center space-y-5 animate-in zoom-in-95 font-sans dir-rtl">
            
            <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-foreground">عزيزنا العميل، اشتراكك انتهى!</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                لاستكمال العمل واستخدام لوحة التحكم والنظام بدون انقطاع، يرجى التواصل مع الإدارة لتجديد الاشتراك وتفعيله فوراً.
              </p>
            </div>

            <div className="p-4 bg-secondary/40 rounded-2xl border border-border text-xs font-bold text-muted-foreground">
              الحالة الحالية: <span className="text-rose-500 font-extrabold">{isDisabled ? "حساب موقوف" : "اشتراك منتهي"}</span>
            </div>

            {/* 📲 زر التواصل المباشر بالواتساب */}
            <a
              href={`https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 px-5 rounded-2xl text-xs md:text-sm transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
            >
              <MessageSquare className="w-4 h-4" />
              <span>تجديد الاشتراك عبر الواتساب الآن</span>
            </a>
          </div>
        </div>

        {/* إخفاء وتجميد المكونات المتبقية بالخلفية */}
        <div className="pointer-events-none select-none opacity-20 filter blur-sm">
          {children}
        </div>
      </div>
    );
  }

  // 4. إذا كان الاشتراك سارياً، يعرض النظام بشكل طبيعي
  return <>{children}</>;
}