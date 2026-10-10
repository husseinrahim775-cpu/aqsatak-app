"use client";

import { useEffect, useState, useMemo } from "react";
import MetricCard from "@/components/dashboard/MetricCard";
import ProfitSimulator from "@/components/dashboard/ProfitSimulator";
import { 
  Wallet, Users, Percent, BellRing, Coins, Banknote, 
  Loader2, MessageSquare, AlertTriangle, Activity, Target, Landmark, CalendarCheck, CalendarDays, CalendarRange
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getUserInstallments, getUserPayments, PaymentRecord, InstallmentData } from "@/services/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface UpcomingAlert {
  customerName: string;
  phoneNumber: string;
  productName: string;
  amount: number;
  dueDate: Date;
  daysLeft: number; 
}

type TimeRange = "today" | "week" | "month" | "all";

export default function DashboardPage() {
  const { user, userData, loading: authLoading } = useAuth() as any;
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 🔒 حارس الحماية: منع الموظف الذي لا يملك صلاحية الداشبورد وتحويله لصفحته المتاحة فوراً
  useEffect(() => {
    if (!authLoading && userData) {
      const isEmployee = userData.role === "employee";
      const canViewDashboard = userData.permissions?.canViewDashboard;

      if (isEmployee && !canViewDashboard) {
        const perms = userData.permissions || {};
        if (perms.canManageStore) {
          router.replace("/inventory");
        } else if (perms.canManageCustomers) {
          router.replace("/customers");
        } else if (perms.canViewTreasury) {
          router.replace("/treasury");
        } else {
          router.replace("/customers");
        }
      }
    }
  }, [userData, authLoading, router]);

  // حالة فلتر الصندوق الزمني (اليوم / الأسبوع / الشهر / الكل)
  const [timeRange, setTimeRange] = useState<TimeRange>("today");

  const [rawPayments, setRawPayments] = useState<PaymentRecord[]>([]);
  const [rawInstallments, setRawInstallments] = useState<InstallmentData[]>([]);

  const [stats, setStats] = useState({
    totalRemainingCapital: 0, 
    totalRemainingProfits: 0, 
    totalRemainingDebt: 0,    
    activeCustomers: 0,
    avgInterest: 0,
    collectionEfficiency: 100, 
  });

  // 🎯 تفصيل الوارد المتوقع (يومي / أسبوعي / شهري)
  const [expectedIncome, setExpectedIncome] = useState({
    daily: 0,
    weekly: 0,
    monthly: 0,
  });

  const [upcomingAlerts, setUpcomingAlerts] = useState<UpcomingAlert[]>([]);
  const [overdueAlerts, setOverdueAlerts] = useState<UpcomingAlert[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user?.uid) return;

      try {
        setLoading(true);

        const [installments, payments] = await Promise.all([
          getUserInstallments(user.uid),
          getUserPayments(user.uid),
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

          // حساب مجموع ما دفعه العميل لهذا القسط بوضوح
          const totalPaidForInst = payments
            .filter((p) => p.installmentId === inst.id)
            .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

          // حساب الدين المتبقي الدقيق: إجمالي القسط - ما تم دفعه
          const calculatedRemainingDebt = Math.max(0, (Number(inst.totalDue) || 0));

          totalCollectedAllTime += totalPaidForInst;
          profitMarginSum += margin;

          // ====================================================
          // 🟢 حساب رأس المال والأرباح المتبقية
          // ====================================================
          const remainingProfit = Math.min(totalProfit, calculatedRemainingDebt);
          const remainingCapital = Math.max(0, calculatedRemainingDebt - remainingProfit);

          remainingDebtSum += calculatedRemainingDebt;
          remainingCapitalSum += remainingCapital;
          remainingProfitsSum += remainingProfit;

          // الاحتفاظ بالعملاء الذين لديهم دين متبقي فقط
          if (calculatedRemainingDebt > 0 && inst.phoneNumber) {
            uniquePhones.add(inst.phoneNumber.trim());
          }

          // ====================================================
          // 🎯 تفصيل الوارد المتوقع (يستثني تلقائياً الحسابات المصفّرة)
          // ====================================================
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

          // ====================================================
          // 🟢 حساب التنبيهات والأقساط المتأخرة (فقط للعقود غير المصفّرة)
          // ====================================================
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

  // 🎯 حساب التحصيل الفعلي حسب الفلتر المختار
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
      } else {
        return sum + (Number(p.amount) || 0);
      }
      return sum;
    }, 0);
  }, [rawPayments, timeRange]);

  const handleQuickWhatsApp = (alert: UpcomingAlert, isOverdue: boolean) => {
    let cleanPhone = alert.phoneNumber.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "964" + cleanPhone.slice(1);

    const message = isOverdue 
      ? `مرحباً ${alert.customerName}، نود تذكيرك بأن قسطك البالغ ${Math.round(alert.amount).toLocaleString()} د.ع لمنتج (${alert.productName}) قد تجاوز موعد استحقاقه بـ ${alert.daysLeft} يوم. يرجى التسديد بأقرب وقت لتجنب الغرامات.`
      : `مرحباً ${alert.customerName}، نود تذكيرك بحلول موعد قسط مبلغ ${Math.round(alert.amount).toLocaleString()} د.ع الخاص بمنتج (${alert.productName}). يرجى التسديد في أقرب وقت.`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  // شاشة التحميل أو حظر الموظف غير المصرح له
  if (authLoading || loading || (userData?.role === "employee" && !userData?.permissions?.canViewDashboard)) {
    return (
      <div className="h-[75vh] flex items-center justify-center text-primary">
        <Loader2 className="w-8 h-8 md:w-10 md:h-10 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-300 pb-10 md:pb-12 max-w-7xl mx-auto px-1 md:px-0">
      
      {/* 1. الهيدر وكفاءة التحصيل */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card p-3.5 md:p-5 rounded-2xl border border-border/70 shadow-sm">
        <div>
          <h1 className="text-lg md:text-2xl font-bold tracking-tight text-foreground">المركز المالي وتوزيع الواردات</h1>
          <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">تحليل المحصل المالي اليومي، الأسبوعي، والشهري وفق نظام التقسيط الذكي.</p>
        </div>
        
        <div className={`flex items-center gap-2 px-3 py-1.5 md:px-3.5 md:py-2 rounded-xl border transition-colors ${
          stats.collectionEfficiency >= 90 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400" 
            : stats.collectionEfficiency >= 75 
            ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400" 
            : "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400"
        }`}>
          <Activity className="w-4 h-4 shrink-0" />
          <div className="text-right">
            <p className="text-[9px] md:text-[10px] font-medium opacity-80 leading-none">كفاءة التحصيل</p>
            <p className="text-sm md:text-base font-extrabold leading-tight">{stats.collectionEfficiency}%</p>
          </div>
        </div>
      </div>

      {/* 2. قسم الوارد المتوقع التفاعلي */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        
        {/* الوارد اليومي المتوقع */}
        <div className="bg-card border border-amber-500/30 p-4 rounded-2xl shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <CalendarDays className="w-4 h-4" /> الوارد اليومي (المتوقع اليوم)
            </span>
            <span className="text-[10px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full font-bold">أقساط يومية نشطة</span>
          </div>
          <p className="text-2xl font-black text-foreground">
            {expectedIncome.daily.toLocaleString()} <span className="text-xs font-normal text-gray-500">د.ع</span>
          </p>
          <p className="text-[10px] text-muted-foreground">مجموع الأقساط اليومية للعملاء المدينين فقط</p>
        </div>

        {/* الوارد الأسبوعي المتوقع */}
        <div className="bg-card border border-blue-500/30 p-4 rounded-2xl shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <CalendarRange className="w-4 h-4" /> الوارد الأسبوعي (المتوقع)
            </span>
            <span className="text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full font-bold">أقساط أسبوعية نشطة</span>
          </div>
          <p className="text-2xl font-black text-foreground">
            {expectedIncome.weekly.toLocaleString()} <span className="text-xs font-normal text-gray-500">د.ع</span>
          </p>
          <p className="text-[10px] text-muted-foreground">مجموع الدفعات الأسبوعية للعملاء المدينين فقط</p>
        </div>

        {/* الوارد الشهري المتوقع */}
        <div className="bg-card border border-purple-500/30 p-4 rounded-2xl shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
              <Target className="w-4 h-4" /> الوارد الشهري (المتوقع)
            </span>
            <span className="text-[10px] bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded-full font-bold">أقساط شهرية نشطة</span>
          </div>
          <p className="text-2xl font-black text-foreground">
            {expectedIncome.monthly.toLocaleString()} <span className="text-xs font-normal text-gray-500">د.ع</span>
          </p>
          <p className="text-[10px] text-muted-foreground">مجموع الأقساط الشهرية للعملاء المدينين فقط</p>
        </div>

      </div>

      {/* 3. شريط الفلترة وسجل المقبوضات الفعليه */}
      <div className="flex items-center justify-between bg-card p-2 rounded-2xl border border-border shadow-sm flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 px-2">
          <CalendarCheck className="w-4 h-4 text-primary" />
          <span>تصفية مبالغ الصندوق المقبوضة فعلياً:</span>
        </div>
        <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-xl w-full sm:w-auto justify-between sm:justify-start">
          <button
            onClick={() => setTimeRange("today")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              timeRange === "today"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            المحصل اليوم
          </button>
          <button
            onClick={() => setTimeRange("week")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              timeRange === "week"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            هذا الأسبوع
          </button>
          <button
            onClick={() => setTimeRange("month")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              timeRange === "month"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            هذا الشهر
          </button>
          <button
            onClick={() => setTimeRange("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              timeRange === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            الإجمالي العام
          </button>
        </div>
      </div>

      {/* 4. الكارتات المالية المتبقية */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 md:gap-4">
        <MetricCard title="إجمالي الديون بالسوق" value={`${stats.totalRemainingDebt.toLocaleString()} د.ع`} icon={Landmark} />
        <MetricCard title="رأس المال المتبقي" value={`${stats.totalRemainingCapital.toLocaleString()} د.ع`} icon={Wallet} />
        <MetricCard title="الأرباح المتبقية" value={`${stats.totalRemainingProfits.toLocaleString()} د.ع`} icon={Banknote} />
        <MetricCard 
          title={
            timeRange === "today" ? "المحصل اليوم" :
            timeRange === "week" ? "المحصل هذا الأسبوع" :
            timeRange === "month" ? "المحصل هذا الشهر" : "إجمالي المقبوضات"
          } 
          value={`${filteredCollectedAmount.toLocaleString()} د.ع`} 
          icon={Coins} 
        />
        <MetricCard title="العملاء النشطين" value={stats.activeCustomers.toString()} icon={Users} />
        <MetricCard title="متوسط الفائدة" value={`${stats.avgInterest}%`} icon={Percent} />
      </div>

      {/* 5. القسم الأوسط ومتأخرات السداد */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 md:gap-6">
        
        <div className="xl:col-span-2">
          <ProfitSimulator 
            initialCapital={stats.totalRemainingCapital} 
            currentCapital={stats.totalRemainingCapital}
            defaultProfitMargin={stats.avgInterest || 20}
            monthlyCashFlow={expectedIncome.monthly + expectedIncome.daily * 30 + expectedIncome.weekly * 4} 
          />
        </div>

        {/* كارت المتأخرات */}
        <div className="bg-card text-card-foreground rounded-2xl border border-rose-500/20 p-3.5 md:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3 md:mb-4 border-b border-border/60 pb-2.5">
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <h3 className="text-sm md:text-base font-bold text-foreground">دفعات متأخرة (تعثر مالي)</h3>
            </div>
            
            {overdueAlerts.length === 0 ? (
              <div className="text-center py-6 md:py-8 bg-muted/20 rounded-xl border border-dashed border-border/50">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">ممتاز! لا توجد متأخرات مالية 👏</p>
              </div>
            ) : (
              <div className="space-y-2">
                {overdueAlerts.map((alert, index) => (
                  <div key={index} className="flex justify-between items-center p-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border/50 transition-colors">
                    <div className="space-y-0.5 min-w-0 pr-1">
                      <p className="font-bold text-xs truncate text-foreground">{alert.customerName}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{Math.round(alert.amount).toLocaleString()} د.ع - يُستحق في: {alert.dueDate.toISOString().split("T")[0]}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 text-[10px] font-bold">
                        تأخير {alert.daysLeft} يوم
                      </span>
                      <button 
                        onClick={() => handleQuickWhatsApp(alert, true)} 
                        className="p-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg transition-transform" 
                        title="توجيه إنذار واتساب"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6. التنبيهات القادمة */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
        <div className="bg-card text-card-foreground rounded-2xl border border-border/80 p-3.5 md:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3 md:mb-4 border-b border-border/60 pb-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <BellRing className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <h3 className="text-sm md:text-base font-bold text-foreground">تنبيهات الاستحقاق القادمة</h3>
          </div>
          
          {upcomingAlerts.length === 0 ? (
            <div className="text-center py-6 md:py-8 bg-muted/20 rounded-xl border border-dashed border-border/50">
              <p className="text-xs text-muted-foreground">لا توجد دفعات مستحقة قريباً</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingAlerts.map((alert, index) => (
                <div key={index} className="flex justify-between items-center p-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border/50 transition-colors">
                  <div className="space-y-0.5 min-w-0 pr-1">
                    <p className="font-bold text-xs truncate text-foreground">{alert.customerName}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">القسط: {Math.round(alert.amount).toLocaleString()} د.ع - يُستحق في: {alert.dueDate.toISOString().split("T")[0]}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400">
                      {alert.daysLeft === 0 ? "اليوم" : `باقي ${alert.daysLeft} يوم`}
                    </span>
                    <button 
                      onClick={() => handleQuickWhatsApp(alert, false)} 
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg transition-transform" 
                      title="تذكير واتساب"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link href="/customers" className="w-full mt-3 md:mt-4 text-center text-xs text-primary hover:underline font-medium block py-1">
            عرض كافة العملاء والدفعات ←
          </Link>
        </div>
      </div>

    </div>
  );
}