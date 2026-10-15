"use client";

import { useState, useEffect } from "react";
import { Calculator, X, ArrowRight, Sparkles, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InstallmentCalculatorModal({ isOpen, onClose }: CalculatorModalProps) {
  const router = useRouter();

  // نوع القسط والنمط
  const [period, setPeriod] = useState<"monthly" | "weekly" | "daily">("monthly");
  const [calcMode, setCalcMode] = useState<"byDuration" | "byPayment">("byDuration");

  // المدخلات فارغة تماماً عند الفتح
  const [costPrice, setCostPrice] = useState<number | "">(""); 
  const [downPayment, setDownPayment] = useState<number | "">(""); 
  const [profitRate, setProfitRate] = useState<number | "">(""); 
  
  // مدخلات الأقساط
  const [durationCount, setDurationCount] = useState<number | "">(""); 
  const [customPayment, setCustomPayment] = useState<number | "">(""); 

  // إعادة تصفير الحقول عند فتح النافذة
  useEffect(() => {
    if (isOpen) {
      setCostPrice("");
      setDownPayment("");
      setProfitRate("");
      setDurationCount("");
      setCustomPayment("");
    }
  }, [isOpen]);

  // النتائج
  const [results, setResults] = useState({
    profitAmount: 0,
    totalFinalPrice: 0,
    totalDue: 0,
    periodicPayment: 0,
    calculatedInstallmentsCount: 0,
  });

  useEffect(() => {
    const cost = Number(costPrice) || 0;
    const down = Number(downPayment) || 0;
    const rate = Number(profitRate) || 0;

    // 1. حساب ربح الفائدة على التكلفة الكاملة
    const profitAmount = cost > 0 && rate > 0 ? Math.round((cost * rate) / 100) : 0;

    // 2. السعر النهائي الكلي بالتقسيط شامل الربح
    const totalFinalPrice = cost + profitAmount;

    // 3. إجمالي المتبقي للتقسيط بعد خصم المقدمة
    const totalDue = Math.max(0, totalFinalPrice - down);

    let periodicPayment = 0;
    let calculatedInstallmentsCount = 0;

    if (calcMode === "byDuration") {
      const count = Number(durationCount) || 0;
      periodicPayment = count > 0 && totalDue > 0 ? Math.round(totalDue / count) : 0;
      calculatedInstallmentsCount = count;
    } else {
      const payVal = Number(customPayment) || 0;
      periodicPayment = payVal;
      calculatedInstallmentsCount = payVal > 0 && totalDue > 0 ? Math.ceil(totalDue / payVal) : 0;
    }

    setResults({
      profitAmount,
      totalFinalPrice,
      totalDue,
      periodicPayment,
      calculatedInstallmentsCount,
    });
  }, [costPrice, downPayment, profitRate, durationCount, customPayment, period, calcMode]);

  if (!isOpen) return null;

  // دالة تحويل الأرقام للصيغة الإنجليزية مع الفواصل
  const formatNum = (num: number) => {
    return num.toLocaleString('en-US');
  };

  const handleCreateContract = () => {
    let monthsEquivalent = results.calculatedInstallmentsCount;
    if (period === "weekly") monthsEquivalent = Math.ceil(results.calculatedInstallmentsCount / 4);
    if (period === "daily") monthsEquivalent = Math.ceil(results.calculatedInstallmentsCount / 30);

    const query = new URLSearchParams({
      price: String(results.totalFinalPrice),
      down: String(downPayment || 0),
      profit: String(profitRate || 0),
      months: String(monthsEquivalent || 1),
      period: period,
    }).toString();

    onClose();
    router.push(`/customers/new?${query}`);
  };

  const getPeriodUnitText = () => {
    if (period === "daily") return "أيام";
    if (period === "weekly") return "أسابيع";
    return "أشهر";
  };

  const getPeriodSingleText = () => {
    if (period === "daily") return "يومي";
    if (period === "weekly") return "أسبوعي";
    return "شهري";
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-3 md:p-4 backdrop-blur-md animate-in fade-in duration-200 print:hidden font-sans">
      <div className="bg-card border border-border/80 rounded-3xl w-full max-w-lg p-5 md:p-6 shadow-2xl space-y-5 relative overflow-hidden text-right dir-rtl">
        
        {/* هيدر الحاسبة */}
        <div className="flex justify-between items-center border-b border-border/60 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-primary/10 text-primary rounded-2xl border border-primary/20 shadow-sm">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-black text-foreground flex items-center gap-1.5">
                حاسبة الأقساط السريعة
                <Sparkles className="w-4 h-4 text-amber-500" />
              </h2>
              <p className="text-[11px] text-gray-500">أدخل الأرقام للحساب الفوري المباشر</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-secondary rounded-xl text-gray-400 hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* أزرار نمط الحساب */}
        <div className="grid grid-cols-2 gap-2 bg-secondary/40 p-1 rounded-2xl border border-border text-xs font-bold">
          <button
            type="button"
            onClick={() => setCalcMode("byDuration")}
            className={`py-2 rounded-xl transition-all ${
              calcMode === "byDuration" 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-gray-500 hover:text-foreground"
            }`}
          >
            تحديد المدة ➔ حساب القسط
          </button>
          <button
            type="button"
            onClick={() => setCalcMode("byPayment")}
            className={`py-2 rounded-xl transition-all ${
              calcMode === "byPayment" 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-gray-500 hover:text-foreground"
            }`}
          >
            تحديد مبلغ القسط ➔ حساب المدة
          </button>
        </div>

        {/* حقول الإدخال بخط واضح وقراءة واضحة */}
        <div className="grid grid-cols-2 gap-3 text-xs md:text-sm font-sans">
          <div>
            <label className="block text-gray-500 font-bold mb-1">سعر شراء المنتج (التكلفة)</label>
            <input
              type="number"
              placeholder="0"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full p-2.5 bg-background border border-border rounded-xl font-bold outline-none focus:ring-2 focus:ring-primary/50 text-foreground dir-ltr text-right"
            />
          </div>

          <div>
            <label className="block text-gray-500 font-bold mb-1">المقدمة (الدفعة الأولى)</label>
            <input
              type="number"
              placeholder="0"
              value={downPayment}
              onChange={(e) => setDownPayment(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full p-2.5 bg-background border border-border rounded-xl font-bold outline-none focus:ring-2 focus:ring-primary/50 text-emerald-600 dir-ltr text-right"
            />
          </div>

          <div>
            <label className="block text-gray-500 font-bold mb-1">نسبة الفائدة / الربح (%)</label>
            <input
              type="number"
              placeholder="0"
              value={profitRate}
              onChange={(e) => setProfitRate(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full p-2.5 bg-background border border-border rounded-xl font-bold outline-none focus:ring-2 focus:ring-primary/50 text-primary dir-ltr text-right"
            />
          </div>

          <div>
            <label className="block text-gray-500 font-bold mb-1">نوع القسط الدوري</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="w-full p-2.5 bg-background border border-border rounded-xl font-bold outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
            >
              <option value="monthly">شهري</option>
              <option value="weekly">أسبوعي</option>
              <option value="daily">يومي</option>
            </select>
          </div>

          <div className="col-span-2">
            {calcMode === "byDuration" ? (
              <div>
                <label className="block text-gray-500 font-bold mb-1">
                  مدة التقسيط (بـ {getPeriodUnitText()})
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="0"
                  value={durationCount}
                  onChange={(e) => setDurationCount(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full p-2.5 bg-background border border-border rounded-xl font-bold outline-none focus:ring-2 focus:ring-primary/50 dir-ltr text-right"
                />
              </div>
            ) : (
              <div>
                <label className="block text-gray-500 font-bold mb-1">
                  مبلغ القسط الـ ({getPeriodSingleText()}) المطلوب
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={customPayment}
                  onChange={(e) => setCustomPayment(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full p-2.5 bg-background border border-border rounded-xl font-bold outline-none focus:ring-2 focus:ring-primary/50 text-primary dir-ltr text-right"
                />
              </div>
            )}
          </div>
        </div>

        {/* بطاقة النتائج المباشرة بخط ناصع ومريح للعين */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-4 rounded-2xl space-y-2.5 text-xs md:text-sm font-sans">
          <div className="flex justify-between items-center border-b border-primary/20 pb-2">
            <span className="font-bold text-gray-600 dark:text-gray-300">مبلغ القسط الـ ({getPeriodSingleText()}):</span>
            <span className="text-xl font-black text-primary">{formatNum(results.periodicPayment)} د.ع</span>
          </div>

          <div className="flex justify-between text-gray-600 dark:text-gray-300">
            <span>عدد الأقساط المطلوبة:</span>
            <span className="font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/20">
              {results.calculatedInstallmentsCount} {getPeriodUnitText()}
            </span>
          </div>

          <div className="flex justify-between text-gray-500">
            <span>سعر البيع النهائي بالتقسيط:</span>
            <span className="font-bold text-foreground">{formatNum(results.totalFinalPrice)} د.ع</span>
          </div>

          <div className="flex justify-between text-gray-500">
            <span>إجمالي المتبقي للتقسيط (بعدخصم المقدمة):</span>
            <span className="font-bold text-foreground">{formatNum(results.totalDue)} د.ع</span>
          </div>

          <div className="flex justify-between text-gray-600 dark:text-gray-300 pt-2 border-t border-primary/20 items-center">
            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
              صافي أرباح الفائدة (ثابتة):
            </span>
            <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm md:text-base">{formatNum(results.profitAmount)} د.ع</span>
          </div>
        </div>

        {/* الأزرار */}
        <div className="flex gap-2.5 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-xs md:text-sm font-bold border border-border rounded-2xl hover:bg-secondary transition-colors"
          >
            إغلاق
          </button>

          <button
            onClick={handleCreateContract}
            className="flex-1 py-3 text-xs md:text-sm bg-primary text-primary-foreground font-bold rounded-2xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-md active:scale-95"
          >
            <span>تحويل إلى عقد جديد</span>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
}