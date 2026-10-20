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

  // المدخلات الأساسية
  const [costPrice, setCostPrice] = useState<number | "">(""); 
  const [downPayment, setDownPayment] = useState<number | "">(""); 
  const [profitRate, setProfitRate] = useState<number | "">(""); 
  const [totalPriceInput, setTotalPriceInput] = useState<number | "">(""); 

  // تحديد آخر حقل تم تعديله لمنع التعارض أثناء الحساب اللحظي ("rate" | "total")
  const [lastEdited, setLastEdited] = useState<"rate" | "total">("rate");
  
  // مدخلات الأقساط
  const [durationCount, setDurationCount] = useState<number | "">(""); 
  const [customPayment, setCustomPayment] = useState<number | "">(""); 

  // إعادة تصفير الحقول عند فتح النافذة
  useEffect(() => {
    if (isOpen) {
      setCostPrice("");
      setDownPayment("");
      setProfitRate("");
      setTotalPriceInput("");
      setDurationCount("");
      setCustomPayment("");
      setLastEdited("rate");
    }
  }, [isOpen]);

  // 🔄 معالجة تغيير سعر التكلفة (سعر الشراء)
  const handleCostChange = (val: number | "") => {
    setCostPrice(val);
    const cost = Number(val) || 0;

    if (lastEdited === "rate") {
      const rate = Number(profitRate) || 0;
      const computedTotal = cost > 0 ? Math.round(cost + (cost * rate) / 100) : "";
      setTotalPriceInput(computedTotal);
    } else {
      const total = Number(totalPriceInput) || 0;
      if (cost > 0 && total >= cost) {
        const computedRate = ((total - cost) / cost) * 100;
        setProfitRate(Number(computedRate.toFixed(2)));
      }
    }
  };

  // 📈 معالجة أدخال نسبة الفائدة المباشرة
  const handleProfitRateChange = (val: number | "") => {
    setProfitRate(val);
    setLastEdited("rate");
    const cost = Number(costPrice) || 0;
    const rate = Number(val) || 0;

    if (cost > 0) {
      const computedTotal = Math.round(cost + (cost * rate) / 100);
      setTotalPriceInput(computedTotal);
    }
  };

  // 💵 معالجة أدخال سعر البيع الكلي المباشر
  const handleTotalPriceInputChange = (val: number | "") => {
    setTotalPriceInput(val);
    setLastEdited("total");
    const cost = Number(costPrice) || 0;
    const total = Number(val) || 0;

    if (cost > 0 && total >= cost) {
      const computedRate = ((total - cost) / cost) * 100;
      setProfitRate(Number(computedRate.toFixed(2)));
    } else if (cost > 0 && total < cost) {
      setProfitRate(0);
    }
  };

  // النتائج الحسابية
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
    let rate = Number(profitRate) || 0;
    let totalFinalPrice = Number(totalPriceInput) || 0;

    if (lastEdited === "rate") {
      const profitAmount = cost > 0 && rate > 0 ? Math.round((cost * rate) / 100) : 0;
      totalFinalPrice = cost + profitAmount;
    }

    const profitAmount = Math.max(0, totalFinalPrice - cost);
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
  }, [costPrice, downPayment, profitRate, totalPriceInput, durationCount, customPayment, period, calcMode, lastEdited]);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-3 md:p-4 backdrop-blur-md animate-in fade-in duration-200 print:hidden font-sans">
      <div className="bg-card/95 backdrop-blur-2xl border border-border rounded-3xl w-full max-w-lg p-5 md:p-6 shadow-2xl space-y-5 relative overflow-hidden text-right dir-rtl">
        
        {/* هيدر الحاسبة  */}
        <div className="flex justify-between items-center border-b border-border pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-orange-500/10 text-orange-500 rounded-2xl border border-orange-500/20 shadow-sm">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-black text-foreground flex items-center gap-1.5">
                حاسبة الأقساط السريعة 
                
              </h2>
              <p className="text-[11px] text-muted-foreground font-bold mt-0.5">أدخل الأرقام للحساب الفوري المباشر</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* أزرار نمط الحساب */}
        <div className="grid grid-cols-2 gap-2 bg-secondary/50 p-1.5 rounded-2xl border border-border text-xs font-black">
          <button
            type="button"
            onClick={() => setCalcMode("byDuration")}
            className={`py-2.5 rounded-xl transition-all ${
              calcMode === "byDuration" 
                ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-500/20" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            تحديد المدة ➔ حساب القسط
          </button>
          <button
            type="button"
            onClick={() => setCalcMode("byPayment")}
            className={`py-2.5 rounded-xl transition-all ${
              calcMode === "byPayment" 
                ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-500/20" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            تحديد مبلغ القسط ➔ حساب المدة
          </button>
        </div>

        {/* حقول الإدخال المصممة لربط  */}
        <div className="grid grid-cols-2 gap-3 text-xs md:text-sm font-sans">
          <div>
            <label className="block text-foreground font-black mb-1.5">سعر شراء المنتج (التكلفة)</label>
            <input
              type="number"
              placeholder="0"
              value={costPrice}
              onChange={(e) => handleCostChange(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full p-3 bg-background border border-border rounded-2xl font-black outline-none focus:ring-2 focus:ring-orange-500 text-amber-600 dark:text-amber-400 dir-ltr text-right font-mono"
            />
          </div>

          <div>
            <label className="block text-foreground font-black mb-1.5">المقدمة (الدفعة الأولى)</label>
            <input
              type="number"
              placeholder="0"
              value={downPayment}
              onChange={(e) => setDownPayment(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full p-3 bg-background border border-border rounded-2xl font-black outline-none focus:ring-2 focus:ring-orange-500 text-slate-950 dark:text-emerald-400 dir-ltr text-right font-mono"
            />
          </div>

          <div>
            <label className="block text-foreground font-black mb-1.5">نسبة الفائدة / الربح (%)</label>
            <input
              type="number"
              placeholder="0"
              value={profitRate}
              onChange={(e) => handleProfitRateChange(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full p-3 bg-background border border-border rounded-2xl font-black outline-none focus:ring-2 focus:ring-orange-500 text-orange-500 dir-ltr text-right font-mono"
            />
          </div>

          <div>
            <label className="block text-foreground font-black mb-1.5">سعر البيع الكلي بالتقسيط</label>
            <input
              type="number"
              placeholder="0"
              value={totalPriceInput}
              onChange={(e) => handleTotalPriceInputChange(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full p-3 bg-background border border-border rounded-2xl font-black outline-none focus:ring-2 focus:ring-orange-500 text-slate-950 dark:text-emerald-400 dir-ltr text-right font-mono"
            />
          </div>

          <div>
            <label className="block text-foreground font-black mb-1.5">نوع القسط الدوري</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="w-full p-3 bg-background border border-border rounded-2xl font-black outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
            >
              <option value="monthly">شهري</option>
              <option value="weekly">أسبوعي</option>
              <option value="daily">يومي</option>
            </select>
          </div>

          <div>
            {calcMode === "byDuration" ? (
              <div>
                <label className="block text-foreground font-black mb-1.5">
                  مدة التقسيط (بـ {getPeriodUnitText()})
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="0"
                  value={durationCount}
                  onChange={(e) => setDurationCount(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full p-3 bg-background border border-border rounded-2xl font-black outline-none focus:ring-2 focus:ring-orange-500 dir-ltr text-right font-mono"
                />
              </div>
            ) : (
              <div>
                <label className="block text-foreground font-black mb-1.5">
                  مبلغ القسط الـ ({getPeriodSingleText()})
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={customPayment}
                  onChange={(e) => setCustomPayment(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full p-3 bg-background border border-border rounded-2xl font-black outline-none focus:ring-2 focus:ring-orange-500 text-orange-500 dir-ltr text-right font-mono"
                />
              </div>
            )}
          </div>
        </div>

        {/* بطاقة النتائج المباشرة High Contrast  Card */}
        <div className="bg-secondary/40 border border-border p-4.5 rounded-3xl space-y-2.5 text-xs md:text-sm font-sans">
          <div className="flex justify-between items-center border-b border-border pb-2.5">
            <span className="font-black text-foreground">مبلغ القسط الـ ({getPeriodSingleText()}):</span>
            <span className="text-xl md:text-2xl font-black text-orange-500 font-mono">{formatNum(results.periodicPayment)} د.ع</span>
          </div>

          <div className="flex justify-between text-muted-foreground font-bold">
            <span>عدد الأقساط المطلوبة:</span>
            <span className="font-black text-orange-600 dark:text-orange-400 bg-orange-500/10 px-3 py-0.5 rounded-full border border-orange-500/20">
              {results.calculatedInstallmentsCount} {getPeriodUnitText()}
            </span>
          </div>

          <div className="flex justify-between text-muted-foreground font-bold">
            <span>سعر البيع النهائي بالتقسيط:</span>
            <span className="font-black text-slate-950 dark:text-white font-mono">{formatNum(results.totalFinalPrice)} د.ع</span>
          </div>

          <div className="flex justify-between text-muted-foreground font-bold">
            <span>إجمالي المتبقي للتقسيط (بعد خصم المقدمة):</span>
            <span className="font-black text-slate-950 dark:text-white font-mono">{formatNum(results.totalDue)} د.ع</span>
          </div>

          <div className="flex justify-between pt-2.5 border-t border-border items-center">
            <span className="font-black text-slate-950 dark:text-emerald-400 flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              صافي أرباح الفائدة (ثابتة):
            </span>
            <span className="font-black text-slate-950 dark:text-emerald-400 text-sm md:text-base font-mono">{formatNum(results.profitAmount)} د.ع</span>
          </div>
        </div>

        {/* الأزرار النهائية */}
        <div className="flex gap-2.5 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-xs md:text-sm font-black border border-border rounded-2xl hover:bg-secondary transition-colors"
          >
            إلغاء
          </button>

          <button
            onClick={handleCreateContract}
            className="flex-1 py-3 text-xs md:text-sm bg-gradient-to-r from-orange-500 to-red-500 text-white font-black rounded-2xl hover:opacity-95 transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 active:scale-95"
          >
            <span>تحويل إلى عقد جديد</span>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
}