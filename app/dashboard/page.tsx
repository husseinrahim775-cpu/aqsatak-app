"use client";

import { useEffect, useState, useMemo } from "react";
import MetricCard from "@/components/dashboard/MetricCard";
import ProfitSimulator from "@/components/dashboard/ProfitSimulator";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Wallet, Users, Percent, Coins, Banknote, 
  Loader2, Activity,
  CalendarCheck, CalendarDays, CalendarRange, ArrowUpRight, ArrowDownRight, Plus, Calendar,
  ChevronRight, ChevronLeft, X, Layers, Filter, TrendingUp, CheckSquare, Square
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { auth } from "@/services/firebase";
import { getUserInstallments, getUserPayments, PaymentRecord, InstallmentData } from "@/services/firestore";
import Link from "next/link";
import { useTheme } from "next-themes";
import { requestNotificationPermission } from "@/services/notifications";

type TimeRange = "today" | "week" | "month" | "custom" | "all";
type PaymentPeriodType = "daily" | "weekly" | "monthly";

const getSmartGreeting = () => {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return {
      title: "صباح الخير",
      subtitle: "تابع حركة أقساطك وأرباحك وبدء يومك المالي بكل ذكاء وسلاسة.",
      icon: "☀️"
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      title: "مساء الخير",
      subtitle: "تابع حركة أقساطك وأرباحك وإدارة المقبوضات بذكاء وسلاسة.",
      icon: "🌤️"
    };
  } else {
    return {
      title: "مساء الخير",
      subtitle: "طاب مساؤك! ملخص نشاطك المالي والأرباح المحققة لهذا اليوم.",
      icon: "🌙"
    };
  }
};

export default function DashboardPage() {
  const { user, userData, loading: authLoading } = useAuth() as any;
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState({ title: "صباح الخير", subtitle: "", icon: "👋" });

  useEffect(() => {
    setGreeting(getSmartGreeting());
  }, []);

  // 🔔 فحص وتحديث توكن إشعارات FCM صامتاً إذا كان الإذن ممنوحاً سابقاً
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        requestNotificationPermission();
      }
    }
  }, []);

  const [timeRange, setTimeRange] = useState<TimeRange>("today");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // 🗂️ نظام الفصل بين الدفاتر المخصص للتحديد المتعدد الديناميكي
  const [showLedgerFilter, setShowLedgerFilter] = useState(false);
  const [selectedPeriods, setSelectedPeriods] = useState<PaymentPeriodType[]>(["daily", "weekly", "monthly"]);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [startMonthObj, setStartMonthObj] = useState<{ num: string; name: string } | null>({
    num: String(new Date().getMonth() + 1).padStart(2, "0"),
    name: `شهر ${new Date().getMonth() + 1}`
  });
  const [startStep, setStartStep] = useState<"months" | "days">("months");

  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [endMonthObj, setEndMonthObj] = useState<{ num: string; name: string } | null>({
    num: String(new Date().getMonth() + 1).padStart(2, "0"),
    name: `شهر ${new Date().getMonth() + 1}`
  });
  const [endStep, setEndStep] = useState<"months" | "days">("months");

  const monthsList = [
    { num: "01", name: "شهر 1" }, { num: "02", name: "شهر 2" },
    { num: "03", name: "شهر 3" }, { num: "04", name: "شهر 4" },
    { num: "05", name: "شهر 5" }, { num: "06", name: "شهر 6" },
    { num: "07", name: "شهر 7" }, { num: "08", name: "شهر 8" },
    { num: "09", name: "شهر 9" }, { num: "10", name: "شهر 10" },
    { num: "11", name: "شهر 11" }, { num: "12", name: "شهر 12" },
  ];

  const getDaysInMonth = (year: number, monthNumStr?: string) => {
    if (!monthNumStr) return [];
    const monthIndex = parseInt(monthNumStr, 10) - 1;
    const count = new Date(year, monthIndex + 1, 0).getDate();
    const daysArr = [];
    for (let i = 1; i <= count; i++) {
      daysArr.push(String(i).padStart(2, "0"));
    }
    return daysArr;
  };

  const daysInStartMonth = useMemo(() => getDaysInMonth(startYear, startMonthObj?.num), [startYear, startMonthObj]);
  const daysInEndMonth = useMemo(() => getDaysInMonth(endYear, endMonthObj?.num), [endYear, endMonthObj]);

  const [rawPayments, setRawPayments] = useState<PaymentRecord[]>([]);
  const [rawInstallments, setRawInstallments] = useState<InstallmentData[]>([]);
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);

  const [stats, setStats] = useState({
    totalRemainingCapital: 0, 
    totalRemainingProfits: 0, 
    totalRemainingDebt: 0,    
    activeCustomers: 0,
    avgInterest: 0,
    collectionEfficiency: 100, 
  });

  const [expectedIncome, setExpectedIncome] = useState({
    daily: 0,
    weekly: 0,
    monthly: 0,
  });

  // 🎯 تبديل أو تفعيل الخيارات المحددة لنظام الفصل
  const togglePeriodSelection = (period: PaymentPeriodType) => {
    if (selectedPeriods.includes(period)) {
      if (selectedPeriods.length > 1) {
        setSelectedPeriods(selectedPeriods.filter((p) => p !== period));
      }
    } else {
      setSelectedPeriods([...selectedPeriods, period]);
    }
  };

  // 🎯 تصفية العقود بناءً على الفلاتر المختارة بالتحديد المتعدد
  const activeInstallments = useMemo(() => {
    if (!showLedgerFilter) return rawInstallments;
    return rawInstallments.filter((inst) => {
      const p = inst.paymentPeriod || "monthly";
      return selectedPeriods.includes(p as PaymentPeriodType);
    });
  }, [rawInstallments, showLedgerFilter, selectedPeriods]);

  const activeInstallmentIds = useMemo(() => new Set(activeInstallments.map((i) => i.id)), [activeInstallments]);

  // 🎯 تصفية المقبوضات التابعة للعقود الفعالة
  const activePayments = useMemo(() => {
    if (!showLedgerFilter) return rawPayments;
    return rawPayments.filter((p) => activeInstallmentIds.has(p.installmentId));
  }, [rawPayments, activeInstallmentIds, showLedgerFilter]);

  useEffect(() => {
    async function fetchDashboardData() {
      const userId = user?.uid || auth?.currentUser?.uid;
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const [installments, payments] = await Promise.all([
          getUserInstallments(userId),
          getUserPayments(userId),
        ]);

        setRawPayments(payments || []);
        setRawInstallments(installments || []);

      } catch (error) {
        console.error("خطأ في جلب بيانات الداشبورد:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [user]);

  // 🎯 حساب الإحصائيات الشاملة
  useEffect(() => {
    if (!rawInstallments) return;

    let remainingCapitalSum = 0;
    let remainingProfitsSum = 0;
    let remainingDebtSum = 0;
    let profitMarginSum = 0;
    
    let expectedDailySum = 0;
    let expectedWeeklySum = 0;
    let expectedMonthlySum = 0;

    let totalExpectedToDate = 0;
    let totalCollectedAllTime = 0;

    const uniquePhones = new Set<string>();

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    activeInstallments.forEach((inst) => {
      const installmentAmount = Number(inst.monthlyInstallment) || 0;
      const totalMonths = Number(inst.months) || 1;
      const margin = Number(inst.profitMargin) || 0;
      const totalProfit = Number(inst.totalProfit) || 0;

      const totalPaidForInst = activePayments
        .filter((p) => p.installmentId === inst.id)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const calculatedRemainingDebt = Math.max(0, (Number(inst.totalDue) || 0));

      totalCollectedAllTime += totalPaidForInst;
      profitMarginSum += margin;

      const remainingProfit = Math.min(totalProfit, calculatedRemainingDebt);
      const remainingCapital = Math.max(0, calculatedRemainingDebt - remainingProfit);

      remainingDebtSum += calculatedRemainingDebt;
      remainingCapitalSum += remainingCapital;
      remainingProfitsSum += remainingProfit;

      if (calculatedRemainingDebt > 0 && inst.phoneNumber) {
        uniquePhones.add(inst.phoneNumber.trim());
      }

      if (calculatedRemainingDebt > 0) {
        const dueNow = Math.min(installmentAmount, calculatedRemainingDebt);
        if (inst.paymentPeriod === "daily") {
          expectedDailySum += dueNow;
        } else if (inst.paymentPeriod === "weekly") {
          expectedWeeklySum += dueNow;
        } else {
          expectedMonthlySum += dueNow;
        }
      }

      if (!inst.startDate || calculatedRemainingDebt <= 0) return;

      const [sYear, sMonth, sDay] = inst.startDate.split("-").map(Number);

      for (let m = 0; m < totalMonths; m++) {
        let dueDate: Date;
        if (inst.paymentPeriod === "daily") {
          dueDate = new Date(sYear, sMonth - 1, sDay + m);
        } else if (inst.paymentPeriod === "weekly") {
          dueDate = new Date(sYear, sMonth - 1, sDay + (m * 7));
        } else {
          dueDate = new Date(sYear, sMonth - 1 + m, sDay);
        }

        const dueDateMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();

        if (dueDateMidnight <= todayMidnight) {
          totalExpectedToDate += installmentAmount;
        }
      }
    });

    const avgProfitMargin = activeInstallments.length > 0 ? Math.round(profitMarginSum / activeInstallments.length) : 0;
    
    const efficiency = totalExpectedToDate > 0 
      ? Math.min(100, Math.round((totalCollectedAllTime / totalExpectedToDate) * 100)) 
      : 100;

    setStats({
      totalRemainingCapital: remainingCapitalSum,
      totalRemainingProfits: remainingProfitsSum,
      totalRemainingDebt: remainingDebtSum,
      activeCustomers: uniquePhones.size,
      avgInterest: avgProfitMargin,
      collectionEfficiency: efficiency,
    });

    setExpectedIncome({
      daily: expectedDailySum,
      weekly: expectedWeeklySum,
      monthly: expectedMonthlySum,
    });
  }, [activeInstallments, activePayments]);

  // 📊 تصفية المقبوضات وحساب نسبة النمو الحقيقية (Growth Rate %)
  const { filteredCollectedAmount, growthRate, growthLabel } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const dayOfWeek = now.getDay();
    const distanceToSaturday = (dayOfWeek + 1) % 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToSaturday);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let currentSum = 0;
    let previousSum = 0;

    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
    const startOfPrevWeek = new Date(startOfWeek.getTime() - 7 * 86400000);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    activePayments.forEach((p) => {
      const dateStr = p.paidAt || p.createdAt;
      if (!dateStr) return;
      const pDate = new Date(dateStr);
      const amount = Number(p.amount) || 0;

      if (timeRange === "today") {
        if (pDate >= startOfToday) currentSum += amount;
        else if (pDate >= startOfYesterday && pDate < startOfToday) previousSum += amount;
      } else if (timeRange === "week") {
        if (pDate >= startOfWeek) currentSum += amount;
        else if (pDate >= startOfPrevWeek && pDate < startOfWeek) previousSum += amount;
      } else if (timeRange === "month") {
        if (pDate >= startOfMonth) currentSum += amount;
        else if (pDate >= startOfPrevMonth && pDate < startOfMonth) previousSum += amount;
      } else if (timeRange === "custom") {
        const start = customStartDate ? new Date(customStartDate) : null;
        const end = customEndDate ? new Date(customEndDate) : null;
        
        if (start) start.setHours(0, 0, 0, 0);
        if (end) end.setHours(23, 59, 59, 999);

        if (start && end) {
          if (pDate >= start && pDate <= end) currentSum += amount;
        } else if (start) {
          if (pDate >= start) currentSum += amount;
        } else if (end) {
          if (pDate <= end) currentSum += amount;
        } else {
          currentSum += amount;
        }
      } else {
        currentSum += amount;
      }
    });

    let growth = 0;
    let label = "";

    if (timeRange === "all") {
      growth = 0;
      label = "";
    } else if (previousSum === 0 && currentSum === 0) {
      growth = 0;
      label = "0%";
    } else if (previousSum === 0 && currentSum > 0) {
      growth = 100;
      label = "نشاط جديد";
    } else if (currentSum === 0 && previousSum > 0) {
      growth = -100;
      label = "-100% (توقف)";
    } else {
      growth = Math.round(((currentSum - previousSum) / previousSum) * 100);
      label = `${growth > 0 ? "+" : ""}${growth}%`;
    }

    return { filteredCollectedAmount: currentSum, growthRate: growth, growthLabel: label };
  }, [activePayments, timeRange, customStartDate, customEndDate]);

  // رسم الأسبوع الحقيقي
  const weeklyDailyBreakdown = useMemo(() => {
    const daysName = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
    const now = new Date();
    const currentDayIdxIndex = (now.getDay() + 1) % 7;

    const dayOfWeek = now.getDay();
    const distanceToSaturday = (dayOfWeek + 1) % 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToSaturday);

    const totals = [0, 0, 0, 0, 0, 0, 0];

    activePayments.forEach((p) => {
      const dateStr = p.paidAt || p.createdAt;
      if (!dateStr) return;
      const pDate = new Date(dateStr);

      if (pDate >= startOfWeek) {
        const pDayOfWeek = pDate.getDay();
        const pSatIndex = (pDayOfWeek + 1) % 7;
        if (pSatIndex >= 0 && pSatIndex < 7) {
          totals[pSatIndex] += Number(p.amount) || 0;
        }
      }
    });

    const maxVal = Math.max(...totals, 1);

    return totals.map((amount, idx) => ({
      dayName: daysName[idx],
      amount: amount,
      heightPercent: amount > 0 ? Math.max(15, Math.round((amount / maxVal) * 100)) : 8,
      isToday: idx === currentDayIdxIndex,
    }));
  }, [activePayments]);

  if (loading) {
    return (
      <div className="h-[75vh] flex flex-col items-center justify-center gap-3 text-primary">
        <Loader2 className="w-10 h-10 animate-spin" />
        <span className="text-xs font-bold text-muted-foreground animate-pulse">جاري تحضير Dashboard ...</span>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div 
        key={theme || "dashboard-reveal"}
        initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-6 pb-12 max-w-7xl mx-auto font-sans dir-rtl text-right"
      >
        
        {/* 1. الترويسة الرئيسية مع زر تفعيل نظام الفصل الاختياري */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card/80 backdrop-blur-xl p-5 md:p-6 rounded-3xl border border-border shadow-sm">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
              <span>{greeting.title}، {userData?.name || "Code XR"}</span>
              <span className="text-2xl animate-bounce">{greeting.icon}</span>
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1 font-bold">
              {greeting.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* 🎯 زر التحكم في فتح/إغلاق نظام الفصل */}
            <button
              onClick={() => {
                setShowLedgerFilter(!showLedgerFilter);
                if (showLedgerFilter) setSelectedPeriods(["daily", "weekly", "monthly"]);
              }}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                showLedgerFilter
                  ? "bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/20"
                  : "bg-secondary/80 hover:bg-secondary text-foreground border-border"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{showLedgerFilter ? "إلغاء نظام الفصل" : "نظام فصل الدفاتر"}</span>
            </button>

            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-card border border-border shadow-sm">
              <Activity className="w-4 h-4 text-emerald-500" />
              <div className="text-right">
                <span className="text-[10px] text-muted-foreground font-bold block">كفاءة التحصيل</span>
                <span className="text-sm font-black text-foreground"><AnimatedNumber value={stats.collectionEfficiency} suffix="%" /></span>
              </div>
            </div>
          </div>
        </div>

        {/* 🗂️ شريط خيارات التصفية بالتحديد المتعدد */}
        <AnimatePresence>
          {showLedgerFilter && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 text-xs font-black text-purple-600 dark:text-purple-400">
                <Filter className="w-4 h-4" />
                <span>حدد الأنواع المراد إظهارها بـ الإحصائيات (تحديد متعدد):</span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                {/* 1. القسط اليومي */}
                <button
                  onClick={() => togglePeriodSelection("daily")}
                  className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedPeriods.includes("daily")
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-background/80 text-muted-foreground border border-border hover:bg-background"
                  }`}
                >
                  {selectedPeriods.includes("daily") ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  <span> عقود يومية</span>
                </button>

                {/* 2. القسط الأسبوعي */}
                <button
                  onClick={() => togglePeriodSelection("weekly")}
                  className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedPeriods.includes("weekly")
                      ? "bg-amber-600 text-white shadow-sm"
                      : "bg-background/80 text-muted-foreground border border-border hover:bg-background"
                  }`}
                >
                  {selectedPeriods.includes("weekly") ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  <span> عقود أسبوعية</span>
                </button>

                {/* 3. القسط الشهري */}
                <button
                  onClick={() => togglePeriodSelection("monthly")}
                  className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedPeriods.includes("monthly")
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-background/80 text-muted-foreground border border-border hover:bg-background"
                  }`}
                >
                  {selectedPeriods.includes("monthly") ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  <span> عقود شهرية </span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 💳 2. بطاقات الأرصدة الرئيسية */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* البطاقة الرئيسية الكبيرة (إجمالي الديون بالسوق) */}
          <motion.div 
            whileHover={{ y: -3 }}
            className="lg:col-span-5 bg-card/90 backdrop-blur-md border border-border rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden"
          >
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-muted-foreground">
                  إجمالي الديون بالسوق (الرصيد المفلتر)
                </span>
                <span className="text-xs font-black px-3 py-1 bg-primary/10 text-primary rounded-full border border-primary/20">
                  د.ع (IQD)
                </span>
              </div>

              <div className="space-y-1">
                <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight font-mono">
                  <AnimatedNumber value={stats.totalRemainingDebt} suffix="د.ع" />
                </h2>
                <div className="flex items-center gap-3 pt-1">
                  <p className="text-[11px] text-emerald-500 font-bold flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" /> +{stats.collectionEfficiency}% معدل الاسترداد المالي
                  </p>
                  
                  {/* مؤشر نسبة النمو */}
                  {timeRange !== "all" && growthLabel && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 dir-ltr ${
                      growthRate > 0 ? "bg-emerald-500/10 text-emerald-500" : growthRate < 0 ? "bg-rose-500/10 text-rose-500" : "bg-secondary text-muted-foreground"
                    }`}>
                      {growthRate > 0 ? <TrendingUp className="w-3 h-3" /> : growthRate < 0 ? <ArrowDownRight className="w-3 h-3" /> : null}
                      {growthLabel}
                    </span>
                  )}
                </div>
              </div>

              {/* أزرار الإجراءات السريعة */}
              <div className="flex items-center gap-3 pt-2">
                <Link 
                  href="/customers/new" 
                  className="flex-1 py-3 px-4 bg-theme-gradient text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 border border-transparent shadow-md hover:opacity-90 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> إضافة عقد جديد
                </Link>
                <Link 
                  href="/accounts" 
                  className="flex-1 py-3 px-4 bg-primary/10 text-theme-primary border border-theme-primary font-black text-xs rounded-2xl flex items-center justify-center gap-2 hover:bg-primary/20 transition-all cursor-pointer"
                >
                  <Coins className="w-4 h-4 text-primary" /> استلام دفعة
                </Link>
              </div>
            </div>

            {/* 🌟 كارتان متراصان */}
            <div className="mt-6 pt-4 border-t border-border/60 flex flex-col gap-3">
              
              {/* 1. كارت رأس المال المتبقي بالسوق */}
              <motion.div 
                whileHover={{ scale: 1.01 }}
                className="bg-secondary/40 border border-border/60 p-4 rounded-2xl shadow-sm flex flex-col justify-between"
              >
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="text-xs font-black">رأس المال المتبقي بالسوق</span>
                  <Wallet className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="my-1.5">
                  <h3 className="text-xl font-black text-foreground tracking-tight font-mono">
                    <AnimatedNumber value={stats.totalRemainingCapital} suffix="د.ع" />
                  </h3>
                </div>
                <div className="bg-background/50 border border-border/40 px-2.5 py-1 rounded-xl text-[10px] font-bold text-muted-foreground flex items-center justify-between">
                  <span>أصل التكلفة</span>
                  <span className="text-emerald-500 font-mono font-black">نشط</span>
                </div>
              </motion.div>

              {/* 2. كارت الأرباح المتوقعة */}
              <motion.div 
                whileHover={{ scale: 1.01 }}
                className="bg-secondary/40 border border-border/60 p-4 rounded-2xl shadow-sm flex flex-col justify-between"
              >
                <div className="flex justify-between items-center text-muted-foreground">
                  <span className="text-xs font-black">الأرباح المتوقعة</span>
                  <Banknote className="w-4 h-4 text-primary" />
                </div>
                <div className="my-1.5">
                  <h3 className="text-xl font-black text-primary tracking-tight font-mono">
                    <AnimatedNumber value={stats.totalRemainingProfits} suffix="د.ع" />
                  </h3>
                </div>
                <div className="bg-background/50 border border-border/40 px-2.5 py-1 rounded-xl text-[10px] font-bold text-muted-foreground flex items-center justify-between">
                  <span>صافي أرباح العقود القائمة</span>
                  <span className="text-primary font-mono font-black">مستقبلي</span>
                </div>
              </motion.div>

            </div>
          </motion.div>

          {/* الكروت البارزة للمجموعات والرسم البياني */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* 1. الوارد اليومي المتوقع */}
            <motion.div 
              whileHover={{ y: -3 }}
              className="bg-theme-gradient text-white p-5 rounded-3xl shadow-lg shadow-primary/20 flex flex-col justify-between"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-black opacity-90">الوارد اليومي المتوقع</span>
                <CalendarDays className="w-5 h-5 opacity-80" />
              </div>
              <div className="my-3">
                <h3 className="text-3xl font-black tracking-tight font-mono"><AnimatedNumber value={expectedIncome.daily} suffix="د.ع" /></h3>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center justify-between">
                <span>أقساط يومية نشطة</span>
                <span>100%</span>
              </div>
            </motion.div>

            {/* 2. الوارد الأسبوعي المتوقع */}
            <motion.div 
              whileHover={{ y: -3 }}
              className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-5 rounded-3xl shadow-lg shadow-amber-500/20 flex flex-col justify-between"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-black opacity-90">الوارد الأسبوعي المتوقع</span>
                <Calendar className="w-5 h-5 opacity-80" />
              </div>
              <div className="my-3">
                <h3 className="text-3xl font-black tracking-tight font-mono"><AnimatedNumber value={expectedIncome.weekly} suffix="د.ع" /></h3>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center justify-between">
                <span>أقساط أسبوعية نشطة</span>
                <span>أسبوعي</span>
              </div>
            </motion.div>

            {/* 3. الوارد الشهري المتوقع */}
            <motion.div 
              whileHover={{ y: -3 }}
              className="sm:col-span-2 bg-card/90 backdrop-blur-md border border-border p-5 rounded-3xl shadow-sm flex flex-col justify-between"
            >
              <div className="flex justify-between items-center text-muted-foreground">
                <span className="text-xs font-black">الوارد الشهري المتوقع</span>
                <CalendarRange className="w-5 h-5 text-purple-500" />
              </div>
              <div className="my-3">
                <h3 className="text-3xl font-black text-foreground tracking-tight font-mono"><AnimatedNumber value={expectedIncome.monthly} suffix="د.ع" /></h3>
              </div>
              <div className="bg-secondary/70 border border-border px-3 py-1.5 rounded-xl text-[10px] font-black text-muted-foreground flex items-center justify-between">
                <span>أقساط شهرية</span>
                <span className="text-emerald-500 font-bold">+8% هذا الشهر</span>
              </div>
            </motion.div>

            {/* 📊 رسم الأعمدة البيانية */}
            <div className="sm:col-span-2 bg-card/90 backdrop-blur-md border border-border p-5 rounded-3xl shadow-sm space-y-3 relative">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-black text-foreground">تدفق المقبوضات الأسبوعية الحقيقي</h4>
                  <p className="text-[10px] text-muted-foreground font-bold">اضغط على أي يوم لعرض مقبوضاته الفعليّة</p>
                </div>
                <span className="text-[10px] font-black px-3 py-1 bg-secondary rounded-xl text-foreground border border-border font-mono">
                  المحصل الأسبوعي: <AnimatedNumber value={weeklyDailyBreakdown.reduce((a, b) => a + b.amount, 0)} suffix="د.ع" />
                </span>
              </div>

              <div className="h-32 flex items-end justify-between gap-2 pt-6 px-2 border-b border-border/40 pb-2 relative">
                {weeklyDailyBreakdown.map((item, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => setSelectedBarIndex(selectedBarIndex === idx ? null : idx)}
                    className="flex-1 h-full flex flex-col justify-end items-center gap-2 cursor-pointer group relative"
                  >
                    <AnimatePresence>
                      {(selectedBarIndex === idx) && (
                        <motion.div
                          initial={{ opacity: 0, y: 5, scale: 0.9 }}
                          animate={{ opacity: 1, y: -30, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="absolute -top-2 bg-foreground text-background text-[10px] font-black px-2.5 py-1 rounded-xl shadow-xl z-20 whitespace-nowrap pointer-events-none font-mono"
                        >
                          {item.amount.toLocaleString()} د.ع
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.div 
                      initial={{ height: "0%" }}
                      animate={{ height: `${item.heightPercent}%` }}
                      transition={{ duration: 0.7, delay: idx * 0.07, ease: "easeOut" }}
                      className={`w-full max-w-[28px] rounded-t-xl transition-all ${
                        item.isToday
                          ? "bg-gradient-to-t from-primary to-primary/80 shadow-md shadow-primary/30 ring-2 ring-primary/50"
                          : item.amount > 0
                          ? "bg-emerald-500/80 hover:bg-emerald-500 shadow-sm"
                          : "bg-secondary/60 hover:bg-primary/30 border border-border/50"
                      }`}
                    />
                    
                    <span className={`text-[10px] font-bold ${item.isToday ? "text-primary font-black underline" : "text-muted-foreground"}`}>
                      {item.dayName}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* 📊 3. شريط تصفية المقبوضات والتقويم */}
        <div className="bg-card/90 backdrop-blur-md p-4 rounded-3xl border border-border shadow-sm space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-xs font-black text-foreground">
              <CalendarCheck className="w-4 h-4 text-primary" />
              <span>تصفية مبالغ المقبوضات حسب الفترة:</span>
            </div>

            <div className="flex items-center gap-1 bg-secondary/60 p-1 rounded-2xl w-full sm:w-auto justify-between sm:justify-start">
              {[
                { id: "today", label: "اليوم" },
                { id: "week", label: "هذا الأسبوع" },
                { id: "month", label: "هذا الشهر" },
                { id: "custom", label: "نطاق مخصص (من - إلى)" },
                { id: "all", label: "الإجمالي العام" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTimeRange(tab.id as TimeRange)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                    timeRange === tab.id
                      ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {timeRange === "custom" && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-3 border-t border-border/50 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs"
              >
                {/* من تاريخ */}
                <div className="relative">
                  <label className="block text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span>من تاريخ (يوم/شهر/سنة):</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStartPicker(!showStartPicker);
                      setStartStep("months");
                      setShowEndPicker(false);
                    }}
                    className="w-full p-3 rounded-2xl border border-border bg-background text-foreground text-xs font-bold flex items-center justify-between hover:border-primary/50 transition-all shadow-sm cursor-pointer"
                  >
                    <span className={customStartDate ? "text-foreground font-mono font-bold" : "text-muted-foreground"}>
                      {customStartDate || "اختر بداية الفترة..."}
                    </span>
                    <div className="flex items-center gap-1">
                      {customStartDate && (
                        <X 
                          className="w-3.5 h-3.5 text-muted-foreground hover:text-rose-500 cursor-pointer" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomStartDate("");
                          }} 
                        />
                      )}
                      <Calendar className="w-4 h-4 text-primary" />
                    </div>
                  </button>

                  <AnimatePresence>
                    {showStartPicker && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute bottom-full mb-2 right-0 z-[99999] w-72 bg-card border border-border rounded-3xl p-4 shadow-2xl backdrop-blur-xl space-y-3"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-border/50 pb-2">
                            <button
                              type="button"
                              onClick={() => setStartYear((y) => y - 1)}
                              className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                            
                            <div className="flex items-center gap-1 font-mono font-bold text-xs text-primary">
                              <span>{startYear}</span>
                              {startMonthObj && startStep === "days" && (
                                <span>- {startMonthObj.num}</span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => setStartYear((y) => y + 1)}
                              className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {startStep === "days" ? (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center px-1 text-[11px]">
                                <span className="font-bold text-muted-foreground">اختر اليوم:</span>
                                <button
                                  type="button"
                                  onClick={() => setStartStep("months")}
                                  className="text-primary hover:underline font-bold text-[10px]"
                                >
                                  تغيير الشهر ({startMonthObj?.name || "اختر"})
                                </button>
                              </div>
                              <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto pt-1">
                                {daysInStartMonth.map((dayNum) => {
                                  const dateString = `${startYear}-${startMonthObj?.num || "01"}-${dayNum}`;
                                  const isSelected = customStartDate === dateString;
                                  return (
                                    <button
                                      key={dayNum}
                                      type="button"
                                      onClick={() => {
                                        setCustomStartDate(dateString);
                                        setShowStartPicker(false);
                                      }}
                                      className={`p-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                                        isSelected
                                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                          : "bg-secondary/50 hover:bg-primary/10 text-foreground hover:text-primary"
                                      }`}
                                    >
                                      {dayNum}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-2 pt-1">
                              {monthsList.map((m) => (
                                <button
                                  key={m.num}
                                  type="button"
                                  onClick={() => {
                                    setStartMonthObj(m);
                                    setStartStep("days");
                                    setCustomStartDate(`${startYear}-${m.num}`);
                                  }}
                                  className="p-2 rounded-xl text-xs font-bold transition-all bg-secondary/50 hover:bg-primary/10 text-foreground hover:text-primary"
                                >
                                  {m.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* إلى تاريخ */}
                <div className="relative">
                  <label className="block text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span>إلى تاريخ (يوم/شهر/سنة):</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEndPicker(!showEndPicker);
                      setEndStep("months");
                      setShowStartPicker(false);
                    }}
                    className="w-full p-3 rounded-2xl border border-border bg-background text-foreground text-xs font-bold flex items-center justify-between hover:border-primary/50 transition-all shadow-sm cursor-pointer"
                  >
                    <span className={customEndDate ? "text-foreground font-mono font-bold" : "text-muted-foreground"}>
                      {customEndDate || "اختر نهاية الفترة..."}
                    </span>
                    <div className="flex items-center gap-1">
                      {customEndDate && (
                        <X 
                          className="w-3.5 h-3.5 text-muted-foreground hover:text-rose-500 cursor-pointer" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomEndDate("");
                          }} 
                        />
                      )}
                      <Calendar className="w-4 h-4 text-primary" />
                    </div>
                  </button>

                  <AnimatePresence>
                    {showEndPicker && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        className="absolute bottom-full mb-2 left-0 z-[99999] w-72 bg-card border border-border rounded-3xl p-4 shadow-2xl backdrop-blur-xl space-y-3"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-border/50 pb-2">
                            <button
                              type="button"
                              onClick={() => setEndYear((y) => y - 1)}
                              className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                            
                            <div className="flex items-center gap-1 font-mono font-bold text-xs text-primary">
                              <span>{endYear}</span>
                              {endMonthObj && endStep === "days" && (
                                <span>- {endMonthObj.num}</span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => setEndYear((y) => y + 1)}
                              className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {endStep === "days" ? (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center px-1 text-[11px]">
                                <span className="font-bold text-muted-foreground">اختر اليوم:</span>
                                <button
                                  type="button"
                                  onClick={() => setEndStep("months")}
                                  className="text-primary hover:underline font-bold text-[10px]"
                                >
                                  تغيير الشهر ({endMonthObj?.name || "اختر"})
                                </button>
                              </div>
                              <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto pt-1">
                                {daysInEndMonth.map((dayNum) => {
                                  const dateString = `${endYear}-${endMonthObj?.num || "01"}-${dayNum}`;
                                  const isSelected = customEndDate === dateString;
                                  return (
                                    <button
                                      key={dayNum}
                                      type="button"
                                      onClick={() => {
                                        setCustomEndDate(dateString);
                                        setShowEndPicker(false);
                                      }}
                                      className={`p-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                                        isSelected
                                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                          : "bg-secondary/50 hover:bg-primary/10 text-foreground hover:text-primary"
                                      }`}
                                    >
                                      {dayNum}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-2 pt-1">
                              {monthsList.map((m) => (
                                <button
                                  key={m.num}
                                  type="button"
                                  onClick={() => {
                                    setEndMonthObj(m);
                                    setEndStep("days");
                                    setCustomEndDate(`${endYear}-${m.num}`);
                                  }}
                                  className="p-2 rounded-xl text-xs font-bold transition-all bg-secondary/50 hover:bg-primary/10 text-foreground hover:text-primary"
                                >
                                  {m.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 🎯 4. شبكة البطاقات المترية المتبقية (3 كروت سفلية) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard title="العملاء النشطين" value={stats.activeCustomers.toString()} icon={Users} />
          <MetricCard title="المحصل بالفترة" value={`${filteredCollectedAmount.toLocaleString()} د.ع`} icon={Coins} />
          <MetricCard title="متوسط الفائدة" value={`${stats.avgInterest}%`} icon={Percent} />
        </div>

        {/* 📈 5. محاكي الأرباح بالكامل دون كارت التعثرات */}
        <div className="w-full">
          <ProfitSimulator 
            initialCapital={stats.totalRemainingCapital} 
            currentCapital={stats.totalRemainingCapital}
            defaultProfitMargin={stats.avgInterest || 20}
            monthlyCashFlow={expectedIncome.monthly + expectedIncome.daily * 30 + expectedIncome.weekly * 4} 
          />
        </div>

      </motion.div>
    </AnimatePresence>
  );
}