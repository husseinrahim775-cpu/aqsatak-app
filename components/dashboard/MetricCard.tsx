"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
}

export default function MetricCard({ title, value, icon: Icon, trend }: MetricCardProps) {
  // تفريغ النص من كلمة "د.ع" ليبقى الرقم فقط صافياً وبأقصى وضوح
  const hasCurrency = value.includes("د.ع");
  const cleanValue = value.replace("د.ع", "").trim();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="bg-card/90 backdrop-blur-md border border-border/80 rounded-3xl p-4 md:p-5 shadow-sm hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5 transition-all flex flex-col justify-between min-h-[130px] text-right relative overflow-hidden group select-none"
    >
      {/* 1. الترويسة: العنوان (تم إلغاء truncate ليتكيف النص كاملاً) + شارة د.ع الخضراء التفاعلية + أيقونة الكارت */}
      <div className="flex items-start justify-between gap-1.5">
        <span className="text-xs font-black text-muted-foreground leading-tight min-w-0">
          {title}
        </span>
        
        <div className="flex items-center gap-2 shrink-0">
          {hasCurrency && (
            <motion.div 
              whileHover={{ scale: 1.08 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm transition-all group-hover:bg-emerald-500 group-hover:text-white"
            >
              {/* نقطة مضيئة ناعمة */}
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 group-hover:bg-white animate-pulse" />
              <span className="text-[10px] font-sans font-black tracking-tight">
                د.ع
              </span>
            </motion.div>
          )}

          <div className="p-2 rounded-2xl bg-orange-500/10 text-orange-500 border border-orange-500/20 group-hover:bg-gradient-to-tr group-hover:from-orange-500 group-hover:to-red-500 group-hover:text-white transition-all shadow-sm">
            <Icon className="w-4 h-4 md:w-5 md:h-5" />
          </div>
        </div>
      </div>

      {/* 2. الرقم الصافي البارز بدون أي شائبات */}
      <div className="space-y-1 pt-2">
        <p className="text-lg sm:text-xl lg:text-2xl font-black text-foreground font-mono tracking-tight dir-ltr text-right truncate">
          {cleanValue}
        </p>

        {trend && (
          <p className="text-[10px] text-emerald-500 font-extrabold flex items-center gap-1 pt-0.5">
            {trend}
          </p>
        )}
      </div>
    </motion.div>
  );
}