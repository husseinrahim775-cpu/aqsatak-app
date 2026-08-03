"use client";

import { useEffect, useState } from "react";
import MetricCard from "@/components/dashboard/MetricCard";
import ProfitSimulator from "@/components/dashboard/ProfitSimulator";
import { 
  Wallet, Users, Percent, BellRing, Coins, Banknote, 
  Loader2, MessageSquare, AlertTriangle, Activity, Target
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { getUserInstallments, getUserPayments } from "@/services/firestore";
import Link from "next/link";

interface UpcomingAlert {
  customerName: string;
  phoneNumber: string;
  productName: string;
  amount: number;
  dueDate: Date;
  daysLeft: number; 
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalCapital: 0,
    totalProfits: 0,
    collectedThisMonth: 0,
    activeMonthlyIncome: 0,
    activeCustomers: 0,
    avgInterest: 0,
    collectionEfficiency: 100, 
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

        if (!installments || installments.length === 0) {
          setLoading(false);
          return;
        }

        let capitalSum = 0;
        let profitsSum = 0;
        let profitMarginSum = 0;
        
        let activeMonthlyIncomeSum = 0;

        let totalExpectedToDate = 0;
        let totalCollectedAllTime = 0;

        const uniquePhones = new Set<string>();
        const alertsList: UpcomingAlert[] = [];
        const overdueList: UpcomingAlert[] = [];

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const collectedThisMonthSum = payments
          .filter((p) => {
            const dateStr = p.paidAt || p.createdAt;
            if (!dateStr) return false;
            const pDate = new Date(dateStr);
            return pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear;
          })
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        installments.forEach((inst) => {
          const price = Number(inst.productPrice) || 0;
          const profit = Number(inst.totalProfit) || (Number(inst.totalDue) - price) || 0;
          const monthlyAmount = Number(inst.monthlyInstallment) || 0;
          const totalDue = Number(inst.totalDue) || (price + profit);
          const margin = Number(inst.profitMargin) || 0;
          const totalMonths = Number(inst.months) || 1;

          capitalSum += price;
          profitsSum += profit;
          profitMarginSum += margin;

          if (inst.phoneNumber) uniquePhones.add(inst.phoneNumber.trim());

          const totalPaidForInst = payments
            .filter((p) => p.installmentId === inst.id)
            .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

          totalCollectedAllTime += totalPaidForInst;

          if (totalPaidForInst < totalDue - 50) {
            activeMonthlyIncomeSum += monthlyAmount;
          }

          if (!inst.startDate) return;
          const [sYear, sMonth, sDay] = inst.startDate.split("-").map(Number);

          let hasFoundNextUnpaid = false;

          for (let m = 0; m < totalMonths; m++) {
            const dueDate = new Date(sYear, sMonth - 1 + m, sDay);
            const requiredForStep = monthlyAmount * (m + 1);
            const isPaid = totalPaidForInst >= requiredForStep - 50;

            if (dueDate.getTime() <= now.getTime()) {
              totalExpectedToDate += monthlyAmount;
            }

            if (!isPaid) {
              const diffTime = dueDate.getTime() - now.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              if (!hasFoundNextUnpaid) {
                if (diffDays < 0) {
                  overdueList.push({
                    customerName: inst.customerName,
                    phoneNumber: inst.phoneNumber,
                    productName: inst.productName,
                    amount: monthlyAmount,
                    dueDate: dueDate,
                    daysLeft: Math.abs(diffDays), 
                  });
                } else if (diffDays <= 30) {
                  alertsList.push({
                    customerName: inst.customerName,
                    phoneNumber: inst.phoneNumber,
                    productName: inst.productName,
                    amount: monthlyAmount,
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
          totalCapital: capitalSum,
          totalProfits: profitsSum,
          collectedThisMonth: collectedThisMonthSum,
          activeMonthlyIncome: activeMonthlyIncomeSum,
          activeCustomers: uniquePhones.size,
          avgInterest: avgProfitMargin,
          collectionEfficiency: efficiency,
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

  const handleQuickWhatsApp = (alert: UpcomingAlert, isOverdue: boolean) => {
    let cleanPhone = alert.phoneNumber.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "964" + cleanPhone.slice(1);

    const message = isOverdue 
      ? `مرحباً ${alert.customerName}، نود تذكيرك بأن قسطك البالغ ${Math.round(alert.amount).toLocaleString()} د.ع لمنتج (${alert.productName}) قد تجاوز موعد استحقاقه بـ ${alert.daysLeft} يوم. يرجى التسديد بأقرب وقت لتجنب الغرامات.`
      : `مرحباً ${alert.customerName}، نود تذكيرك بحلول موعد قسط مبلغ ${Math.round(alert.amount).toLocaleString()} د.ع الخاص بمنتج (${alert.productName}). يرجى التسديد في أقرب وقت.`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  if (loading) {
    return (
      <div className="h-[75vh] flex items-center justify-center text-primary">
        <Loader2 className="w-8 h-8 md:w-10 md:h-10 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-300 pb-10 md:pb-12 max-w-7xl mx-auto px-1 md:px-0">
      
      {/* 1. رأس الصفحة */}
      <div className="flex flex-row justify-between items-center gap-3 bg-card p-3.5 md:p-5 rounded-2xl border border-border/70 shadow-sm">
        <div>
          <h1 className="text-lg md:text-2xl font-bold tracking-tight text-foreground">المركز المالي</h1>
          <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">نظرة تحليلية شاملة لأداء محفظة الأقساط.</p>
        </div>
        
        <div className={`flex items-center gap-2 px-3 py-1.5 md:px-3.5 md:py-2 rounded-xl border transition-colors ${
          stats.collectionEfficiency >= 90 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400' 
            : stats.collectionEfficiency >= 75 
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400'
        }`}>
          <Activity className="w-4 h-4 shrink-0" />
          <div className="text-right">
            <p className="text-[9px] md:text-[10px] font-medium opacity-80 leading-none">كفاءة التحصيل</p>
            <p className="text-sm md:text-base font-extrabold leading-tight">{stats.collectionEfficiency}%</p>
          </div>
        </div>
      </div>

      {/* 2. الكارتات الأساسية */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 md:gap-4">
        <MetricCard title="رأس المال الكلي" value={`${stats.totalCapital.toLocaleString()} د.ع`} icon={Wallet} />
        <MetricCard title="الأرباح المتوقعة" value={`${stats.totalProfits.toLocaleString()} د.ع`} icon={Banknote} />
        <MetricCard title="الوارد الشهري (النشط)" value={`${stats.activeMonthlyIncome.toLocaleString()} د.ع`} icon={Target} />
        <MetricCard title="المحصل هذا الشهر" value={`${stats.collectedThisMonth.toLocaleString()} د.ع`} icon={Coins} />
        <MetricCard title="العملاء النشطين" value={stats.activeCustomers.toString()} icon={Users} />
        <MetricCard title="متوسط الفائدة" value={`${stats.avgInterest}%`} icon={Percent} />
      </div>

      {/* 3. القسم الأوسط */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 md:gap-6">
        
        <div className="xl:col-span-2">
          <ProfitSimulator 
            initialCapital={stats.totalCapital} 
            currentCapital={stats.totalCapital}
            defaultProfitMargin={stats.avgInterest || 20}
            monthlyCashFlow={stats.activeMonthlyIncome} 
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
                      <p className="text-[10px] text-muted-foreground font-mono">{Math.round(alert.amount).toLocaleString()} د.ع</p>
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

      {/* 4. التنبيهات القادمة */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
        <div className="bg-card text-card-foreground rounded-2xl border border-border/80 p-3.5 md:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3 md:mb-4 border-b border-border/60 pb-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <BellRing className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <h3 className="text-sm md:text-base font-bold text-foreground">تنبيهات الاستحقاق (أقل من 30 يوم)</h3>
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
                    <p className="text-[10px] text-muted-foreground font-mono">القسط: {Math.round(alert.amount).toLocaleString()} د.ع</p>
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