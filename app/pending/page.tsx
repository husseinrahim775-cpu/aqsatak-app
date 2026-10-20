"use client";

import { Clock, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { motion } from "framer-motion";

export default function PendingPage() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background/95 backdrop-blur-2xl p-4 fixed inset-0 z-50 dir-rtl text-right font-sans">
      
      {/* خلفية الإضاءة الدائرية العصرية \ */}
      <div className="absolute top-1/4 right-1/2 translate-x-1/2 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/2 translate-x-1/2 w-80 h-80 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-md bg-card/90 backdrop-blur-xl border border-border/80 rounded-3xl shadow-2xl p-6 md:p-8 text-center space-y-6 relative overflow-hidden z-10"
      >
        {/* أيقونة حالة الانتظار  */}
        <div className="relative mx-auto w-20 h-20">
          <div className="w-20 h-20 bg-orange-500/15 text-orange-500 dark:text-orange-400 rounded-3xl border border-orange-500/20 flex items-center justify-center shadow-inner">
            <Clock className="w-10 h-10 animate-pulse" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-500"></span>
          </span>
        </div>

        {/* النصوص والرسالة الرئيسية */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-black border border-orange-500/20 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>حالة الطلب</span>
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">حسابك قيد المراجعة والتدقيق</h1>
          <p className="text-xs text-muted-foreground leading-relaxed font-medium">
            تم استلام طلب تسجيل شركة جديد بنجاح. حسابك حالياً قيد التفعيل من قبل قسم الإدارة والدعم الفني، وسيعمل النظام تلقائياً فور الموافقة عليه.
          </p>
        </div>

        {/* شريط معلومات الأمان */}
        <div className="flex items-center justify-center gap-2 bg-secondary/50 p-3 rounded-2xl border border-border/60 text-[11px] font-bold text-muted-foreground">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>تم تشفير وتوثيق طلبك بالنظام المالي</span>
        </div>

        {/* زر تسجيل الخروج */}
        <div className="pt-1">
          <motion.button 
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={logout}
            className="w-full bg-secondary/80 hover:bg-secondary text-foreground py-3.5 rounded-2xl font-bold text-xs border border-border/80 transition-all flex justify-center items-center gap-2 shadow-sm"
          >
            <LogOut className="w-4 h-4 text-muted-foreground" />
            <span>تسجيل الخروج</span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}