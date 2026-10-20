"use client";

import { useEffect, useState, useMemo } from "react";
import MetricCard from "@/components/dashboard/MetricCard";
import ProfitSimulator from "@/components/dashboard/ProfitSimulator";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Wallet, Users, Percent, Coins, Banknote, 
  Loader2, MessageSquare, AlertTriangle, Activity, Landmark, 
  CalendarCheck, CalendarDays, CalendarRange, ArrowUpRight, Plus, Calendar, Sun, Moon, Sparkles
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { auth } from "@/services/firebase";
import { getUserInstallments, getUserPayments, PaymentRecord, InstallmentData } from "@/services/firestore";
import Link from "next/link";
import { useTheme } from "next-themes";

interface UpcomingAlert {
  customerName: string;
  phoneNumber: string;
  productName: string;
  amount: number;
  dueDate: Date;
  daysLeft: number; 
}

type TimeRange = "today" | "week" | "month" | "custom" | "all";

// 🧠 دالة توليد الترحيب الذكي والعبارات الملهمة بحسب وقت اليوم
const getSmartGreeting = () => {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    const morningPhrases = [
      "تابع حركة أقساطك وأرباحك وبدء يومك المالي بكل ذكاء وسلاسة.",
      "بداية يوم جديدة وموفقة! تفقّد تدفق المقبوضات وأحدث العقود.",
      "صباح الهمة والنشاط، نتمنى لك يوماً مليئاً بالتحصيلات الناجحة."
    ];
    return {
      title: "صباح الخير",
      subtitle: morningPhrases[Math.floor(Math.random() * morningPhrases.length)],
      icon: "☀️"
    };
  } else if (hour >= 12 && hour < 17) {
    const afternoonPhrases = [
      "تابع حركة أقساطك وأرباحك وإدارة المقبوضات بذكاء وسلاسة.",
      "استمر بالإنجاز! إليك نظرة سريعة على كفاءة التحصيل الحالية.",
      "مساء الإنجاز، واصل متابعة الدفعات المستحقة لليوم."
    ];
    return {
      title: "مساء الخير",
      subtitle: afternoonPhrases[Math.floor(Math.random() * afternoonPhrases.length)],
      icon: "🌤️"
    };
  } else {
    const eveningPhrases = [
      "طاب مساؤك! ملخص نشاطك المالي والأرباح المحققة لهذا اليوم.",
      "مساء النور، تفقّد التقارير المالية والتحصيلات قبل ختام اليوم.",
      "ختام يوم موفق! نظرة شاملة على إجمالي الديون والأقساط المستردة."
    ];
    return {
      title: "مساء الخير",
      subtitle: eveningPhrases[Math.floor(Math.random() * eveningPhrases.length)],
      icon: "🌙"
    };
  }
};

export default function DashboardPage() {
  const { user, userData, loading: authLoading } = useAuth() as any;
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);

  // 🌟 حالة الترحيب الذكي
  const [greeting, setGreeting] = useState({ title: "صباح الخير", subtitle: "", icon: "👋" });

  useEffect(() => {
    // حساب الترحيب الذكي عند فتح الصفحة
    setGreeting(getSmartGreeting());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const localSessionStr = localStorage.getItem("active_session") || sessionStorage.getItem("active_session");
    const activeUser = userData || (localSessionStr ? JSON.parse(localSessionStr) : null);

    if (!authLoading && activeUser) {
      const isEmployee = activeUser.role === "employee";
      const canViewDashboard = activeUser.permissions?.canViewDashboard;

      if (isEmployee && !canViewDashboard) {
        const perms = activeUser.permissions || {};
        let target = "/customers";

        if (perms.canManageStore) target = "/inventory";
        else if (perms.canManageCustomers) target = "/customers";
        else if (perms.canViewTreasury) target = "/treasury";

        window.location.href = target;
      }
    }
  }, [userData, authLoading]);

  const [timeRange, setTimeRange] = useState<TimeRange>("today");
  
  // 📅 حالات التاريخ المخصص (من - إلى)
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const [rawPayments, setRawPayments] = useState<PaymentRecord[]>([]);
  const [rawInstallments, setRawInstallments] = useState<InstallmentData[]>([]);

  // حالة اليوم المحدد بالنقر داخل المخطط البياني
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

  const [upcomingAlerts, setUpcomingAlerts] = useState<UpcomingAlert[]>([]);
  const [overdueAlerts, setOverdueAlerts] = useState<UpcomingAlert[]>([]);

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

        if (!installments || installments.length === 0) {
          setLoading(false);
          return;
        }

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
        const alertsList: UpcomingAlert[] = [];
        const overdueList: UpcomingAlert[] = [];

        const now = new Date();

        installments.forEach((inst) => {
          const installmentAmount = Number(inst.monthlyInstallment) || 0;
          const totalMonths = Number(inst.months) || 1;
          const margin = Number(inst.profitMargin) || 0;
          const totalProfit = Number(inst.totalProfit) || 0;

          const totalPaidForInst = (payments || [])
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
          let hasFoundNextUnpaid = false;

          for (let m = 0; m < totalMonths; m++) {
            let dueDate: Date;
            if (inst.paymentPeriod === "daily") {
              dueDate = new Date(sYear, sMonth - 1, sDay + m);
            } else if (inst.paymentPeriod === "weekly") {
              dueDate = new Date(sYear, sMonth - 1, sDay + (m * 7));
            } else {
              dueDate = new Date(sYear, sMonth - 1 + m, sDay);
            }

            const requiredForStep = installmentAmount * (m + 1);
            const isPaid = totalPaidForInst >= requiredForStep - 50;

            if (dueDate.getTime() <= now.getTime()) {
              totalExpectedToDate += installmentAmount;
            }

            if (!isPaid && calculatedRemainingDebt > 0) {
              const diffTime = dueDate.getTime() - now.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              if (!hasFoundNextUnpaid) {
                if (diffDays < 0) {
                  overdueList.push({
                    customerName: inst.customerName,
                    phoneNumber: inst.phoneNumber,
                    productName: inst.productName,
                    amount: Math.min(installmentAmount, calculatedRemainingDebt), 
                    dueDate: dueDate,
                    daysLeft: Math.abs(diffDays), 
                  });
                } else if (diffDays <= 30) {
                  alertsList.push({
                    customerName: inst.customerName,
                    phoneNumber: inst.phoneNumber,
                    productName: inst.productName,
                    amount: Math.min(installmentAmount, calculatedRemainingDebt), 
                    dueDate: dueDate,
                    daysLeft: diffDays,
                  });
                }
                hasFoundNextUnpaid = true;
              }
            }
          }
        });

        const avgProfitMargin = installments.length > 0 ? Math.round(profitMarginSum / installments.length) : 0;
        
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

        alertsList.sort((a, b) => a.daysLeft - b.daysLeft);
        overdueList.sort((a, b) => b.daysLeft - a.daysLeft);

        setUpcomingAlerts(alertsList.slice(0, 5));
        setOverdueAlerts(overdueList.slice(0, 5));

      } catch (error) {
        console.error("خطأ في جلب بيانات الداشبورد:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [user]);

  // 1. 🔍 تصفية المقبوضات بحسب التبويب المختار (شاملاً النطاق المخصص)
  const filteredCollectedAmount = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const dayOfWeek = now.getDay();
    const distanceToSaturday = (dayOfWeek + 1) % 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToSaturday);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return rawPayments.reduce((sum, p) => {
      const dateStr = p.paidAt || p.createdAt;
      if (!dateStr) return sum;
      const pDate = new Date(dateStr);

      if (timeRange === "today") {
        if (pDate >= startOfToday) return sum + (Number(p.amount) || 0);
      } else if (timeRange === "week") {
        if (pDate >= startOfWeek) return sum + (Number(p.amount) || 0);
      } else if (timeRange === "month") {
        if (pDate >= startOfMonth) return sum + (Number(p.amount) || 0);
      } else if (timeRange === "custom") {
        const start = customStartDate ? new Date(customStartDate) : null;
        const end = customEndDate ? new Date(customEndDate) : null;
        
        if (start) start.setHours(0, 0, 0, 0);
        if (end) end.setHours(23, 59, 59, 999);

        if (start && end) {
          if (pDate >= start && pDate <= end) return sum + (Number(p.amount) || 0);
        } else if (start) {
          if (pDate >= start) return sum + (Number(p.amount) || 0);
        } else if (end) {
          if (pDate <= end) return sum + (Number(p.amount) || 0);
        } else {
          return sum + (Number(p.amount) || 0);
        }
      } else {
        return sum + (Number(p.amount) || 0);
      }
      return sum;
    }, 0);
  }, [rawPayments, timeRange, customStartDate, customEndDate]);

  // 2. 📊 معادلة حساب المقبوضات الحقيقية لكل يوم من أيام الأسبوع الحالي
  const weeklyDailyBreakdown = useMemo(() => {
    const daysName = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
    const now = new Date();
    const currentDayIdxIndex = (now.getDay() + 1) % 7;

    const dayOfWeek = now.getDay();
    const distanceToSaturday = (dayOfWeek + 1) % 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToSaturday);

    const totals = [0, 0, 0, 0, 0, 0, 0];

    rawPayments.forEach((p) => {
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
  }, [rawPayments]);

  const handleQuickWhatsApp = (alert: UpcomingAlert, isOverdue: boolean) => {
    let cleanPhone = alert.phoneNumber.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "964" + cleanPhone.slice(1);

    const message = isOverdue 
      ? `مرحباً ${alert.customerName}، نود تذكيرك بأن قسطك البالغ ${Math.round(alert.amount).toLocaleString()} د.ع لمنتج (${alert.productName}) قد تجاوز موعد استحقاقه بـ ${alert.daysLeft} يوم.`
      : `مرحباً ${alert.customerName}، نود تذكيرك بحلول موعد قسط مبلغ ${Math.round(alert.amount).toLocaleString()} د.ع الخاص بمنتج (${alert.productName}).`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  if (loading) {
    return (
      <div className="h-[75vh] flex flex-col items-center justify-center gap-3 text-orange-500">
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
        
        {/* 🌟 1. الترويسة الرئيسية لـ Dashboard مع الترحيب التفاعلي الذكي */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
              <span>{greeting.title}، {userData?.name || "Code XR"}</span>
              <span className="text-2xl animate-bounce">{greeting.icon}</span>
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1 font-bold">
              {greeting.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-card border border-border shadow-sm">
              <Activity className="w-4 h-4 text-emerald-500" />
              <div className="text-right">
                <span className="text-[10px] text-muted-foreground font-bold block">كفاءة التحصيل</span>
                <span className="text-sm font-black text-foreground"><AnimatedNumber value={stats.collectionEfficiency} suffix="%" /></span>
              </div>
            </div>
          </div>
        </div>

        {/* 💳 2. بطاقة الرصيد الإجمالي ومخطط الأشرطة الملونة */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* البطاقة الرئيسية الكبيرة */}
          <motion.div 
            whileHover={{ y: -3 }}
            className="lg:col-span-5 bg-card/90 backdrop-blur-md border border-border rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden"
          >
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-muted-foreground">إجمالي الديون بالسوق (الرصيد النشط)</span>
                <span className="text-xs font-extrabold px-3 py-1 bg-orange-500/10 text-orange-600 rounded-full">
                  د.ع (IQD)
                </span>
              </div>

              <div className="space-y-1">
                <h2 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">
                  <AnimatedNumber value={stats.totalRemainingDebt} suffix="د.ع" />
                </h2>
                <p className="text-[11px] text-emerald-500 font-bold flex items-center gap-1 pt-1">
                  <ArrowUpRight className="w-3.5 h-3.5" /> +{stats.collectionEfficiency}% معدل الاسترداد المالي
                </p>
              </div>

              {/* أزرار الإجراءات السريعة Actions */}
              <div className="flex items-center gap-3 pt-2">
                <Link 
                  href="/customers/new" 
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 hover:opacity-95 transition-opacity"
                >
                  <Plus className="w-4 h-4" /> إضافة عقد جديد
                </Link>
                <Link 
                  href="/customers" 
                  className="flex-1 py-3 px-4 bg-secondary text-foreground font-bold text-xs rounded-2xl flex items-center justify-center gap-2 border border-border hover:bg-secondary/80 transition-colors"
                >
                  <Coins className="w-4 h-4 text-orange-500" /> استلام دفعة
                </Link>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border/60 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block text-[10px]">رأس المال المسترد</span>
                <span className="font-bold text-foreground text-sm"><AnimatedNumber value={stats.totalRemainingCapital} suffix="د.ع" /></span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">الأرباح المتوقعة</span>
                <span className="font-bold text-orange-500 text-sm"><AnimatedNumber value={stats.totalRemainingProfits} suffix="د.ع" /></span>
              </div>
            </div>
          </motion.div>

          {/* الكروت البرتقالية والرسم البياني المزدوج */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <motion.div 
              whileHover={{ y: -3 }}
              className="bg-gradient-to-br from-orange-500 to-red-500 text-white p-5 rounded-3xl shadow-lg shadow-orange-500/20 flex flex-col justify-between"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold opacity-90">الوارد اليومي المتوقع</span>
                <CalendarDays className="w-5 h-5 opacity-80" />
              </div>
              <div className="my-3">
                <h3 className="text-3xl font-black tracking-tight"><AnimatedNumber value={expectedIncome.daily} suffix="د.ع" /></h3>
              </div>
              <div className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center justify-between">
                <span>أقساط يومية نشطة</span>
                <span>100%</span>
              </div>
            </motion.div>

            <motion.div 
              whileHover={{ y: -3 }}
              className="bg-card/90 backdrop-blur-md border border-border p-5 rounded-3xl shadow-sm flex flex-col justify-between"
            >
              <div className="flex justify-between items-center text-muted-foreground">
                <span className="text-xs font-bold">الوارد الشهري المتوقع</span>
                <CalendarRange className="w-5 h-5 text-purple-500" />
              </div>
              <div className="my-3">
                <h3 className="text-3xl font-black text-foreground tracking-tight"><AnimatedNumber value={expectedIncome.monthly} suffix="د.ع" /></h3>
              </div>
              <div className="bg-secondary/70 border border-border px-3 py-1.5 rounded-xl text-[10px] font-bold text-muted-foreground flex items-center justify-between">
                <span>أقساط شهرية</span>
                <span className="text-emerald-500">+8% هذا الشهر</span>
              </div>
            </motion.div>

            {/* 📊 رسم الأعمدة البيانية التفاعلي بالأرقام الفعلية للأسبوع */}
            <div className="sm:col-span-2 bg-card/90 backdrop-blur-md border border-border p-5 rounded-3xl shadow-sm space-y-3 relative">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-xs font-black text-foreground">تدفق المقبوضات الأسبوعية الحقيقي</h4>
                  <p className="text-[10px] text-muted-foreground">اضغط على أي يوم لعرض مقبوضاته الفعليّة</p>
                </div>
                <span className="text-[10px] font-bold px-3 py-1 bg-secondary rounded-xl text-foreground border border-border">
                  المحصل الأسبوعي: <AnimatedNumber value={weeklyDailyBreakdown.reduce((a, b) => a + b.amount, 0)} suffix="د.ع" />
                </span>
              </div>

              {/* رسم الأعمدة المزود بالتلميح والتفاعل بالحركات */}
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
                          className="absolute -top-2 bg-foreground text-background text-[10px] font-black px-2.5 py-1 rounded-xl shadow-xl z-20 whitespace-nowrap pointer-events-none"
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
                          ? "bg-gradient-to-t from-orange-500 to-red-500 shadow-md shadow-orange-500/30 ring-2 ring-orange-500/50"
                          : item.amount > 0
                          ? "bg-emerald-500/80 hover:bg-emerald-500 shadow-sm"
                          : "bg-secondary/60 hover:bg-orange-500/30 border border-border/50"
                      }`}
                    />
                    
                    <span className={`text-[10px] font-bold ${item.isToday ? "text-orange-500 font-black underline" : "text-muted-foreground"}`}>
                      {item.dayName}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* 📊 3. شريط تصفية المقبوضات مع تحديد الفترات والتواريخ المخصصة */}
        <div className="bg-card/90 backdrop-blur-md p-4 rounded-3xl border border-border shadow-sm space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-xs font-extrabold text-foreground">
              <CalendarCheck className="w-4 h-4 text-orange-500" />
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
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    timeRange === tab.id
                      ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 📅 حقول إدخال التاريخ المخصص في حال اختيار "نطاق مخصص" */}
          <AnimatePresence>
            {timeRange === "custom" && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-2 border-t border-border/50 flex flex-wrap items-center gap-3 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-orange-500" /> من تاريخ:
                  </span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-bold text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-orange-500" /> إلى تاريخ:
                  </span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 🎯 4. شبكة البطاقات المترية المتبقية */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard title="العملاء النشطين" value={stats.activeCustomers.toString()} icon={Users} />
          <MetricCard title="رأس المال المتبقي" value={`${stats.totalRemainingCapital.toLocaleString()} د.ع`} icon={Wallet} />
          <MetricCard title="الأرباح المتبقية" value={`${stats.totalRemainingProfits.toLocaleString()} د.ع`} icon={Banknote} />
          <MetricCard title="المحصل بالفترة" value={`${filteredCollectedAmount.toLocaleString()} د.ع`} icon={Coins} />
          <MetricCard title="متوسط الفائدة" value={`${stats.avgInterest}%`} icon={Percent} />
          <MetricCard title="إجمالي الديون" value={`${stats.totalRemainingDebt.toLocaleString()} د.ع`} icon={Landmark} />
        </div>

        {/* 📈 5. محاكي الأرباح + كارت المتأخرات */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <ProfitSimulator 
              initialCapital={stats.totalRemainingCapital} 
              currentCapital={stats.totalRemainingCapital}
              defaultProfitMargin={stats.avgInterest || 20}
              monthlyCashFlow={expectedIncome.monthly + expectedIncome.daily * 30 + expectedIncome.weekly * 4} 
            />
          </div>

          {/* كارت المتأخرات والتنبيهات Look */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card/90 backdrop-blur-md rounded-3xl border border-rose-500/20 p-5 md:p-6 shadow-sm hover:border-rose-500/40 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 border border-rose-500/20 shadow-sm">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-foreground">دفعات متأخرة (تعثر مالي)</h3>
                    <p className="text-[10px] text-muted-foreground">قائمة العملاء المتأخرين عن التسديد</p>
                  </div>
                </div>

                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                  {overdueAlerts.length} تنبيه
                </span>
              </div>
              
              {overdueAlerts.length === 0 ? (
                <div className="text-center py-8 bg-secondary/30 rounded-2xl border border-dashed border-border/50">
                  <p className="text-xs text-emerald-600 font-bold">ممتاز! لا توجد متأخرات مالية 👏</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {overdueAlerts.map((alert, index) => (
                    <motion.div 
                      key={index} 
                      whileHover={{ x: -4, scale: 1.01 }}
                      transition={{ duration: 0.2 }}
                      className="flex justify-between items-center p-3.5 rounded-2xl bg-secondary/40 hover:bg-secondary/80 border border-border/50 transition-all shadow-sm group"
                    >
                      <div className="space-y-0.5 min-w-0 pr-1">
                        <p className="font-bold text-xs truncate text-foreground group-hover:text-orange-500 transition-colors">
                          {alert.customerName}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono font-bold" dir="ltr">
                          {Math.round(alert.amount).toLocaleString()} د.ع
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-600 text-[10px] font-black border border-rose-500/20">
                          تأخير {alert.daysLeft} يوم
                        </span>

                        <motion.button 
                          whileHover={{ scale: 1.08 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleQuickWhatsApp(alert, true)} 
                          className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-md shadow-emerald-600/20" 
                          title="تذكير عبر الواتساب"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>

      </motion.div>
    </AnimatePresence>
  );
}