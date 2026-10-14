"use client";

import { MessageCircle, LogOut, Clock } from "lucide-react";
import { auth } from "@/services/firebase";
import { signOut } from "firebase/auth";

export default function ExpiredPage() {
  // 🔴 ضع رقم الواتساب الخاص بك هنا (بدون + أو أصفار)
  const whatsappNumber = "9647700000000"; 
  const whatsappMessage = encodeURIComponent("مرحباً، أود تجديد اشتراكي في نظام أقساطك.");

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = "/login";
    } catch (error) {
      console.error("خطأ أثناء تسجيل الخروج:", error);
    }
  };

  const handleRenewWhatsapp = () => {
    const url = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 absolute inset-0 z-50">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8" />
        </div>

        <div>
          <h1 className="text-2xl font-bold mb-2">انتهت فترة الاشتراك</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            بياناتك ومستنداتك محفوظة بأمان. يرجى تجديد اشتراكك للاستمرار في استخدام النظام وأدوات إدارة الأقساط.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <button
            onClick={handleRenewWhatsapp}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all flex justify-center items-center gap-2 shadow-md"
          >
            <MessageCircle className="w-5 h-5" />
            تجديد الاشتراك عبر الواتساب
          </button>

          <button
            onClick={handleLogout}
            className="w-full bg-secondary text-secondary-foreground py-3 rounded-xl font-medium hover:bg-secondary/80 transition-all flex justify-center items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            تسجيل الخروج
          </button>
        </div>
      </div>
    </div>
  );
}