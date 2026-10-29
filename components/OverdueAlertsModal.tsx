"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, Search, MessageSquare } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { auth } from "@/services/firebase";
import { getUserInstallments, getUserPayments } from "@/services/firestore";

interface UpcomingAlert {
  installmentId: string;
  customerName: string;
  phoneNumber: string;
  productName: string;
  totalOverdueAmount: number;
  unpaidCount: number;
  hasTodayDue: boolean;
  maxDaysOverdue: number;
}

type OverdueFilterType = "all" | "today" | "past";

interface OverdueAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OverdueAlertsModal({ isOpen, onClose }: OverdueAlertsModalProps) {
  const { user } = useAuth() as any;
  const [overdueAlerts, setOverdueAlerts] = useState<UpcomingAlert[]>([]);
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<OverdueFilterType>("all");

  useEffect(() => {
    async function fetchOverdues() {
      const userId = user?.uid || auth?.currentUser?.uid;
      if (!userId) return;

      try {
        const [installments, payments] = await Promise.all([
          getUserInstallments(userId),
          getUserPayments(userId),
        ]);

        const now = new Date();
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const list: UpcomingAlert[] = [];

        installments?.forEach((inst) => {
          const installmentAmount = Number(inst.monthlyInstallment) || 0;
          const totalMonths = Number(inst.months) || 1;
          const calculatedRemainingDebt = Math.max(0, Number(inst.totalDue) || 0);

          if (!inst.startDate || calculatedRemainingDebt <= 0) return;

          const instPayments = payments?.filter((p) => p.installmentId === inst.id) || [];
          const [sYear, sMonth, sDay] = inst.startDate.split("-").map(Number);

          let contractOverdueSum = 0;
          let unpaidCount = 0;
          let hasTodayDue = false;
          let maxDaysOverdue = 0;

          for (let m = 0; m < totalMonths; m++) {
            let dueDateOnly: Date;
            if (inst.paymentPeriod === "daily") {
              dueDateOnly = new Date(sYear, sMonth - 1, sDay + m);
            } else if (inst.paymentPeriod === "weekly") {
              dueDateOnly = new Date(sYear, sMonth - 1, sDay + (m * 7));
            } else {
              dueDateOnly = new Date(sYear, sMonth - 1 + m, sDay);
            }

            dueDateOnly.setHours(0, 0, 0, 0);
            const dueDateMidnight = dueDateOnly.getTime();

            const y = dueDateOnly.getFullYear();
            const monthStr = String(dueDateOnly.getMonth() + 1).padStart(2, '0');
            const dayStr = String(dueDateOnly.getDate()).padStart(2, '0');
            const formattedFullDate = `${y}-${monthStr}-${dayStr}`;
            const formattedYearMonth = `${y}-${monthStr}`;

            const isPaid = instPayments.some(
              (p) => p.targetMonth === formattedFullDate || p.targetMonth === formattedYearMonth
            ) || inst.paidMonths?.includes(formattedFullDate) || inst.paidMonths?.includes(formattedYearMonth);

            if (!isPaid && dueDateMidnight <= todayMidnight) {
              const diffDays = Math.floor((todayMidnight - dueDateMidnight) / (1000 * 60 * 60 * 24));
              if (diffDays >= 0) {
                contractOverdueSum += installmentAmount;
                unpaidCount += 1;
                if (diffDays === 0) hasTodayDue = true;
                if (diffDays > maxDaysOverdue) maxDaysOverdue = diffDays;
              }
            }
          }

          if (unpaidCount > 0 && contractOverdueSum > 0) {
            list.push({
              installmentId: inst.id,
              customerName: inst.customerName || "",
              phoneNumber: inst.phoneNumber || "",
              productName: inst.productName || "عقد أجهزة",
              totalOverdueAmount: Math.min(contractOverdueSum, calculatedRemainingDebt),
              unpaidCount: unpaidCount,
              hasTodayDue: hasTodayDue,
              maxDaysOverdue: maxDaysOverdue,
            });
          }
        });

        list.sort((a, b) => b.maxDaysOverdue - a.maxDaysOverdue);
        setOverdueAlerts(list);
      } catch (err) {
        console.error("خطأ في جلب التنبيهات:", err);
      }
    }

    if (isOpen) {
      fetchOverdues();
    }
  }, [user, isOpen]);

  // 🎯 حساب أرقام الإحصائيات للفلاتر الثلاثة
  const countToday = useMemo(() => overdueAlerts.filter(a => a.hasTodayDue).length, [overdueAlerts]);
  const countPast = useMemo(() => overdueAlerts.filter(a => a.maxDaysOverdue > 0).length, [overdueAlerts]);

  // 🎯 تطبيق الفلترة بالنوع والبحث
  const modalFilteredAlerts = useMemo(() => {
    let list = overdueAlerts;

    if (filterType === "today") {
      list = list.filter((a) => a.hasTodayDue);
    } else if (filterType === "past") {
      list = list.filter((a) => a.maxDaysOverdue > 0);
    }

    if (modalSearchQuery.trim()) {
      const q = modalSearchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.customerName.toLowerCase().includes(q) ||
          a.phoneNumber.includes(q) ||
          a.productName.toLowerCase().includes(q)
      );
    }

    return list;
  }, [overdueAlerts, filterType, modalSearchQuery]);

  const handleQuickWhatsApp = (alert: UpcomingAlert) => {
    let cleanPhone = alert.phoneNumber.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) cleanPhone = "964" + cleanPhone.slice(1);
    const message = `مرحباً ${alert.customerName}، نود تذكيرك بأن لديك أقساط متأخرة لعقد (${alert.productName}) بإجمالي مبلغ ${Math.round(alert.totalOverdueAmount).toLocaleString()} د.ع. يرجى المبادرة بالتسديد.`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        onClick={onClose}
        className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md h-[100dvh] w-screen overflow-hidden"
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative mx-auto my-auto bg-card border border-border rounded-3xl w-full sm:max-w-xl md:max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden dir-rtl text-right border-rose-500/20"
        >
          {/* 1. الترويسة */}
          <div className="p-4 border-b border-border/60 flex items-center justify-between bg-secondary/30 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">قائمة المتعثرين والتنبيهات</h3>
                <p className="text-[11px] text-muted-foreground font-bold">إجمالي النتائج المعروضة: {modalFilteredAlerts.length} عقد</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-secondary hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-all cursor-pointer border border-border/60"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 2. شريط التصفية والبحث */}
          <div className="p-3 border-b border-border/40 bg-card shrink-0 space-y-2.5">
            {/* 🎯 أزرار الفلترة السريعة (الكل / اليوم / سابقاً) */}
            <div className="flex items-center gap-1.5 bg-secondary/60 p-1 rounded-2xl text-xs font-black">
              <button
                onClick={() => setFilterType("all")}
                className={`flex-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
                  filterType === "all" 
                    ? "bg-rose-600 text-white shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                🔴 الكل ({overdueAlerts.length})
              </button>

              <button
                onClick={() => setFilterType("today")}
                className={`flex-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
                  filterType === "today" 
                    ? "bg-amber-600 text-white shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ⏰ مستحق اليوم ({countToday})
              </button>

              <button
                onClick={() => setFilterType("past")}
                className={`flex-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
                  filterType === "past" 
                    ? "bg-rose-700 text-white shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                ⚠️ متأخر سابقاً ({countPast})
              </button>
            </div>

            {/* حقل البحث */}
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="ابحث باسم الزبون، اسم المنتج أو رقم الهاتف..."
                value={modalSearchQuery}
                onChange={(e) => setModalSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2 bg-secondary/50 border border-border/60 rounded-2xl text-xs font-bold text-foreground focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          {/* 3. القائمة */}
          <div className="p-4 space-y-2.5 overflow-y-auto flex-1 min-h-0">
            {modalFilteredAlerts.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground font-bold text-xs">لا توجد نتائج مطابقة للتصنيف 🔍</div>
            ) : (
              modalFilteredAlerts.map((alert, index) => (
                <div key={alert.installmentId || index} className="flex justify-between items-center p-3 rounded-2xl bg-secondary/40 border border-border/50 shadow-sm gap-2">
                  <div className="space-y-1 min-w-0 pr-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-black text-xs text-foreground truncate">{alert.customerName}</p>
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/20 truncate">📦 {alert.productName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono font-bold flex-wrap">
                      <span>{alert.phoneNumber}</span>
                      <span>•</span>
                      <span className="text-rose-500 font-black">{Math.round(alert.totalOverdueAmount).toLocaleString()} د.ع</span>
                      <span>•</span>
                      <span>({alert.unpaidCount} أقساط)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border ${alert.hasTodayDue ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-rose-500/10 text-rose-600 border-rose-500/20"}`}>
                      {alert.hasTodayDue ? "مستحق اليوم" : `تأخير ${alert.maxDaysOverdue} أيام`}
                    </span>

                    <button onClick={() => handleQuickWhatsApp(alert)} className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-md cursor-pointer">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 4. زر الإغلاق */}
          <div className="p-3 border-t border-border/60 bg-secondary/30 flex justify-end shrink-0">
            <button onClick={onClose} className="px-5 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground font-black text-xs rounded-xl border border-border cursor-pointer">
              إغلاق
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}