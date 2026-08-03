"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";

interface ProfitSimulatorProps {
  initialCapital?: number;
  currentCapital?: number;
  defaultProfitMargin?: number;
  monthlyCashFlow?: number;
}

export default function ProfitSimulator({ 
  initialCapital, 
  currentCapital, 
  defaultProfitMargin = 20,
  monthlyCashFlow = 0 
}: ProfitSimulatorProps) {
  // الاعتماد على رأس المال القادم مهما كان مسمى الـ Prop
  const baseCapital = Number(initialCapital ?? currentCapital) || 0;

  const [profitMargin, setProfitMargin] = useState<number>(defaultProfitMargin || 20);
  const [installmentMonths, setInstallmentMonths] = useState<number>(10);
  const [simulationMonths, setSimulationMonths] = useState<number>(12);

  // خوارزمية تدوير الأقساط شهرياً دون أخطاء NaN
  const calculateRecycledGrowth = () => {
    if (baseCapital <= 0) {
      return { totalEstimatedProfit: 0, totalProjectedPortfolio: 0, growthRate: "0" };
    }

    const cashInflowPerMonth = monthlyCashFlow > 0 ? monthlyCashFlow : (baseCapital / (installmentMonths || 10));
    const monthlyInflows = new Array(simulationMonths + installmentMonths + 12).fill(0);

    for (let m = 0; m < installmentMonths; m++) {
      monthlyInflows[m] += cashInflowPerMonth;
    }

    let accumulatedProfit = 0;

    for (let month = 0; month < simulationMonths; month++) {
      const availableCashToReinvest = monthlyInflows[month];

      if (availableCashToReinvest > 0) {
        const profit = availableCashToReinvest * ((profitMargin || 0) / 100);
        accumulatedProfit += profit;

        const totalNewContractValue = availableCashToReinvest + profit;
        const newMonthlyInstallment = totalNewContractValue / (installmentMonths || 1);

        for (let i = 1; i <= installmentMonths; i++) {
          if (month + i < monthlyInflows.length) {
            monthlyInflows[month + i] += newMonthlyInstallment;
          }
        }
      }
    }

    const initialProfit = baseCapital * ((profitMargin || 0) / 100);
    const totalEstimatedProfit = initialProfit + accumulatedProfit;
    const totalProjectedPortfolio = baseCapital + totalEstimatedProfit;

    return {
      totalEstimatedProfit,
      totalProjectedPortfolio,
      growthRate: ((totalEstimatedProfit / baseCapital) * 100).toFixed(1),
    };
  };

  const { totalEstimatedProfit, totalProjectedPortfolio, growthRate } = calculateRecycledGrowth();

  return (
    <div className="bg-card text-card-foreground rounded-2xl border border-border p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl text-primary">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold">محاكي الأرباح المستقبليّة (التراكمي)</h3>
            <p className="text-xs text-gray-500">حساب تضاعف رأس المال عند إعادة ضخ أقساط العملاء شهرياً</p>
          </div>
        </div>
      </div>

      {/* عناصر التحكم */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-background/50 p-4 rounded-xl border border-border">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2">
            نسبة الفائدة المقترحة (%)
          </label>
          <input
            type="number"
            value={profitMargin}
            onChange={(e) => setProfitMargin(Math.max(1, Number(e.target.value)))}
            className="w-full bg-card border border-border rounded-lg p-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2">
            مدة تقسيط العقود (بالأشهر)
          </label>
          <input
            type="number"
            value={installmentMonths}
            onChange={(e) => setInstallmentMonths(Math.max(1, Number(e.target.value)))}
            className="w-full bg-card border border-border rounded-lg p-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-2">
            فترة المحاكاة (بالأشهر)
          </label>
          <select
            value={simulationMonths}
            onChange={(e) => setSimulationMonths(Number(e.target.value))}
            className="w-full bg-card border border-border rounded-lg p-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value={6}>6 أشهر</option>
            <option value={12}>12 شهر (سنة)</option>
            <option value={24}>24 شهر (سنتين)</option>
            <option value={36}>36 شهر (3 سنوات)</option>
          </select>
        </div>
      </div>

      {/* الأرقام المحسوبة */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 space-y-1">
          <p className="text-xs text-gray-500 font-medium">رأس المال المشغّل الحالي</p>
          <p className="text-lg font-bold text-foreground">
            {Math.round(baseCapital).toLocaleString()} د.ع
          </p>
        </div>

        <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20 space-y-1">
          <p className="text-xs text-green-600 dark:text-green-400 font-medium">صافي الأرباح المتوقعة</p>
          <p className="text-xl font-extrabold text-green-600 dark:text-green-400">
            +{Math.round(totalEstimatedProfit).toLocaleString()} د.ع
          </p>
          <p className="text-[10px] text-gray-500">نسبة النمو: +{growthRate}%</p>
        </div>

        <div className="p-4 bg-card border border-border rounded-xl space-y-1 shadow-inner">
          <p className="text-xs text-gray-500 font-medium">إجمالي رأس المال المتوقع</p>
          <p className="text-lg font-bold text-primary">
            {Math.round(totalProjectedPortfolio).toLocaleString()} د.ع
          </p>
        </div>
      </div>
    </div>
  );
}