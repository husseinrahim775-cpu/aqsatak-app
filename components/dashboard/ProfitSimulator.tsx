"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Calculator, TrendingUp, Sparkles, DollarSign, Calendar, RefreshCw } from "lucide-react";
import AnimatedNumber from "./AnimatedNumber";

interface ProfitSimulatorProps {
  initialCapital: number;
  currentCapital: number;
  defaultProfitMargin: number;
  monthlyCashFlow: number;
}

export default function ProfitSimulator({
  initialCapital = 1000000,
  defaultProfitMargin = 30,
  monthlyCashFlow = 200000,
}: ProfitSimulatorProps) {
  const [investment, setInvestment] = useState<number>(initialCapital || 1000000);
  const [profitMargin, setProfitMargin] = useState<number>(defaultProfitMargin || 30);
  const [reinvestRate, setReinvestRate] = useState<number>(100); // نسبة إعادة الاستثمار

  const projections = useMemo(() => {
    const marginRatio = profitMargin / 100;
    const reinvestRatio = reinvestRate / 100;

    // نمو تراكمي على مدى 6، 12، 24 شهراً
    const calcCapital = (months: number) => {
      let current = investment;
      for (let i = 0; i < months; i++) {
        const monthlyProfit = current * (marginRatio / 12);
        current += monthlyProfit * reinvestRatio;
      }
      return Math.round(current);
    };

    const capital6M = calcCapital(6);
    const capital12M = calcCapital(12);
    const capital24M = calcCapital(24);

    return {
      months6: capital6M,
      months12: capital12M,
      months24: capital24M,
      profit12M: capital12M - investment,
    };
  }, [investment, profitMargin, reinvestRate]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card/90 backdrop-blur-md border border-border rounded-3xl p-5 md:p-6 shadow-sm space-y-5 relative overflow-hidden"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-orange-500/10 text-orange-500 rounded-2xl border border-orange-500/20">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base md:text-lg text-foreground flex items-center gap-2">
              <span>محاكي الأرباح التراكمية المستقبلي</span>
              <Sparkles className="w-4 h-4 text-orange-500 animate-pulse" />
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">توقع نمو رأس المال المستثمر بناءً على إعادة الاستثمار ونسبة الربح.</p>
          </div>
        </div>

        <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-black flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4" />
          <span>عائد متوقع: +<AnimatedNumber value={projections.profit12M} suffix="د.ع" /></span>
        </div>
      </div>

      {/* أشرطة التحكم التفاعلية (Sliders) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-secondary/30 p-4 rounded-2xl border border-border/50">
        <div>
          <div className="flex justify-between items-center text-xs font-bold mb-1.5">
            <span className="text-muted-foreground">رأس المال الأول بالتقسيط:</span>
            <span className="text-orange-500 dir-ltr"><AnimatedNumber value={investment} suffix="د.ع" /></span>
          </div>
          <input
            type="range"
            min={100000}
            max={50000000}
            step={100000}
            value={investment}
            onChange={(e) => setInvestment(Number(e.target.value))}
            className="w-full accent-orange-500 cursor-pointer h-1.5 bg-secondary rounded-lg"
          />
        </div>

        <div>
          <div className="flex justify-between items-center text-xs font-bold mb-1.5">
            <span className="text-muted-foreground">هامش الربح السنوي:</span>
            <span className="text-purple-500">{profitMargin}%</span>
          </div>
          <input
            type="range"
            min={5}
            max={100}
            step={1}
            value={profitMargin}
            onChange={(e) => setProfitMargin(Number(e.target.value))}
            className="w-full accent-purple-500 cursor-pointer h-1.5 bg-secondary rounded-lg"
          />
        </div>

        <div>
          <div className="flex justify-between items-center text-xs font-bold mb-1.5">
            <span className="text-muted-foreground">نسبة إعادة تدوير الأرباح:</span>
            <span className="text-emerald-500">{reinvestRate}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={reinvestRate}
            onChange={(e) => setReinvestRate(Number(e.target.value))}
            className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-secondary rounded-lg"
          />
        </div>
      </div>

      {/* كروت نتائج النمو التراكمي المتحركة */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-card border border-border rounded-2xl space-y-1 shadow-sm text-right"
        >
          <span className="text-[10px] font-bold text-muted-foreground block">بعد 6 أشهر</span>
          <p className="text-lg font-black text-foreground">
            <AnimatedNumber value={projections.months6} suffix="د.ع" />
          </p>
          <span className="text-[10px] font-bold text-emerald-500 block">
            +<AnimatedNumber value={projections.months6 - investment} suffix="د.ع" /> أرباح
          </span>
        </motion.div>

        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-2xl space-y-1 shadow-sm text-right"
        >
          <span className="text-[10px] font-bold text-orange-500 block">بعد 12 شهراً (سنة)</span>
          <p className="text-xl font-black text-orange-600 dark:text-orange-400">
            <AnimatedNumber value={projections.months12} suffix="د.ع" />
          </p>
          <span className="text-[10px] font-bold text-emerald-500 block">
            +<AnimatedNumber value={projections.profit12M} suffix="د.ع" /> أرباح صافية
          </span>
        </motion.div>

        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="p-4 bg-card border border-border rounded-2xl space-y-1 shadow-sm text-right"
        >
          <span className="text-[10px] font-bold text-muted-foreground block">بعد 24 شهراً (سنتين)</span>
          <p className="text-lg font-black text-foreground">
            <AnimatedNumber value={projections.months24} suffix="د.ع" />
          </p>
          <span className="text-[10px] font-bold text-emerald-500 block">
            +<AnimatedNumber value={projections.months24 - investment} suffix="د.ع" /> أرباح
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}