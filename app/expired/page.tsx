"use client";

import { MessageCircle, LogOut, Clock, ShieldCheck, Sparkles } from "lucide-react";
import { auth } from "@/services/firebase";
import { signOut } from "firebase/auth";
import { motion } from "framer-motion";

export default function ExpiredPage() {
  // 🔴 رقم الواتساب الخاص بالدعم والتجديد
  const whatsappNumber = "9647838338499"; 
  const whatsappMessage = encodeURIComponent("مرحباً، أود تجديد اشتراكي في نظام أقساطك .");

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
    <div className="min-h-screen flex items-center justify-center bg-background/95 backdrop-blur-2xl p-4 fixed inset-0 z-50 dir-rtl text-right font-sans">
      
      {/* خلفية جمالية مودرن Dashboard  */}
      <div className="absolute top-1/4 right-1/2 translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/2 translate-x-1/2 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-md bg-card/90 backdrop-blur-xl border border-border/80 rounded-3xl shadow-2xl p-6 md:p-8 text-center space-y-6 relative overflow-hidden z-10"
      >
        {/* أيقونة الحالة العصرية */}
        <div className="relative mx-auto w-20 h-20">
          <div className="w-20 h-20 bg-amber-500/15 text-amber-500 dark:text-amber-400 rounded-3xl border border-amber-500/20 flex items-center justify-center shadow-inner">
            <Clock className="w-10 h-10 animate-pulse" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500"></span>
          </span>
        </div>

        {/* النص والرسالة */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-black border border-amber-500/20 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>تنبيه الاشتراك</span>
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">انتهت فترة الاشتراك</h1>
          <p className="text-xs text-muted-foreground leading-relaxed font-medium">
            جميع بياناتك، سجلات أقساطك، ومستنداتك محفوظة بأمان تام لدينا. يرجى التجديد للاستمرار في الاستفادة من أدوات المنظومة.
          </p>
        </div>

        {/* شريط الأمان المالي */}
        <div className="flex items-center justify-center gap-2 bg-secondary/50 p-3 rounded-2xl border border-border/60 text-[11px] font-bold text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>سجلات العميل مشفرة ومحفوظة بالكامل</span>
        </div>

        {/* أزرار الإجراءات */}
        <div className="space-y-3 pt-1">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRenewWhatsapp}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3.5 rounded-2xl font-extrabold text-sm transition-all flex justify-center items-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            <MessageCircle className="w-5 h-5" />
            <span>تجديد الاشتراك عبر الواتساب</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleLogout}
            className="w-full bg-secondary/80 hover:bg-secondary text-foreground py-3.5 rounded-2xl font-bold text-xs border border-border/80 transition-all flex justify-center items-center gap-2"
          >
            <LogOut className="w-4 h-4 text-muted-foreground" />
            <span>تسجيل الخروج</span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}