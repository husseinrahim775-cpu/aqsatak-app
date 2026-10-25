"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { 
  getUserTreasuryTransactions, 
  addTreasuryTransaction, 
  deleteTreasuryTransaction,
  getUserPayments,
  getUserInstallments,
  clearUserTreasuryData,
  TreasuryTransaction 
} from "@/services/firestore";
import { 
  Vault, 
  PlusCircle, 
  MinusCircle, 
  Loader2, 
  Calendar, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Trash2, 
  X,
  Receipt,
  RotateCcw,
  History
} from "lucide-react";
import { toast } from "sonner";

// 🛠️ دالة مساعدة محسّنة جداً لمعالجة وتنسيق كافة أنواع التواريخ الممكنة
const parseDateObj = (dateVal: any): Date | null => {
  if (!dateVal) return null;
  try {
    // 1. إذا كان التاريخ كائن Firebase Timestamp
    if (typeof dateVal === "object" && typeof dateVal.toDate === "function") {
      return dateVal.toDate();
    }
    if (typeof dateVal === "object" && dateVal.seconds) {
      return new Date(dateVal.seconds * 1000);
    }
    // 2. إذا كان كائن Date مباشر
    if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
      return dateVal;
    }
    // 3. إذا كان الملي ثانية (Number)
    if (typeof dateVal === "number") {
      const d = new Date(dateVal);
      return !isNaN(d.getTime()) ? d : null;
    }
    // 4. إذا كان النص ISO String
    const parsedDate = new Date(dateVal);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  } catch (e) {
    return null;
  }
  return null;
};

const formatDateForDisplay = (dateVal: any): string => {
  const parsed = parseDateObj(dateVal);
  if (!parsed) return new Date().toLocaleDateString("ar-IQ");
  return parsed.toLocaleDateString("ar-IQ", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function TreasuryPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // 📅 حالات فلترة التاريخ والتصفير
  const [dateFilterType, setDateFilterType] = useState<"all" | "today" | "month" | "year" | "custom">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [lastResetDate, setLastResetDate] = useState<string | null>(null);
  const [showArchivedBeforeReset, setShowArchivedBeforeReset] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"inflow" | "outflow">("inflow");
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    amount: "",
    category: "capital_deposit" as TreasuryTransaction["category"],
    description: "",
  });

  const getOwnerUid = useCallback(() => {
    const activeSession = sessionStorage.getItem("active_session");
    if (activeSession) {
      try {
        const parsed = JSON.parse(activeSession);
        if (parsed.ownerUid) return parsed.ownerUid;
      } catch (e) {}
    }
    return user?.uid || null;
  }, [user]);

  // جلب تاريخ التصفير المحفوظ محلياً
  useEffect(() => {
    const ownerUid = getOwnerUid();
    if (ownerUid) {
      const savedResetDate = localStorage.getItem(`treasury_last_reset_${ownerUid}`);
      if (savedResetDate) setLastResetDate(savedResetDate);
    }
  }, [getOwnerUid]);

  const fetchData = useCallback(async () => {
    const ownerUid = getOwnerUid();
    if (!ownerUid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const manualTx = await getUserTreasuryTransactions(ownerUid).catch(() => []);
      setTransactions(manualTx || []);
      setLoading(false);

      const [payments, installments] = await Promise.all([
        getUserPayments(ownerUid).catch(() => []),
        getUserInstallments(ownerUid).catch(() => []),
      ]);

      const autoTx: TreasuryTransaction[] = [];

      // 1. أقساط واصلة (+)
      (payments || []).forEach((p: any) => {
        autoTx.push({
          id: `pay_${p.id}`,
          userId: ownerUid,
          type: "inflow",
          category: "installment_payment",
          amount: Number(p.amount) || 0,
          description: `تسديد قسط: ${p.customerName || "عميل"} (${p.productName || "منتج"})`,
          date: p.paidAt || p.createdAt || p.date || new Date().toISOString(),
        });
      });

      // 2. مقبوضات وتكاليف العقود (شراء مباشر ومقدمات)
      (installments || []).forEach((inst: any) => {
        const instDate = inst.createdAt || inst.startDate || inst.date || new Date().toISOString();

        if (inst.downPayment && Number(inst.downPayment) > 0) {
          autoTx.push({
            id: `down_${inst.id}`,
            userId: ownerUid,
            type: "inflow",
            category: "down_payment",
            amount: Number(inst.downPayment) || 0,
            description: `دفعة مقدمة عقد: ${inst.customerName} (${inst.productName})`,
            date: instDate,
          });
        }

        const cost = Number(inst.costPrice || inst.purchasePrice || inst.originalCost || 0);
        if (cost > 0 && (inst.isDirectSale || !inst.fromInventory)) {
          autoTx.push({
            id: `cost_${inst.id}`,
            userId: ownerUid,
            type: "outflow",
            category: "inventory_purchase",
            amount: cost,
            description: `تكلفة شراء وتجهيز مباشر: ${inst.productName || "بضاعة"} للعميل (${inst.customerName})`,
            date: instDate,
          });
        }
      });

      const allTx = [...(manualTx || []), ...autoTx].sort((a, b) => {
        const dateA = parseDateObj(a.date);
        const dateB = parseDateObj(b.date);
        const timeA = dateA ? dateA.getTime() : 0;
        const timeB = dateB ? dateB.getTime() : 0;
        return timeB - timeA;
      });

      setTransactions(allTx);
    } catch (error) {
      console.error("خطأ في جلب بيانات الخزينة:", error);
      setLoading(false);
    }
  }, [getOwnerUid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // إذا كان التصفير مفعلاً والنمط ليس عرض الأرشيف القديم، نتجاهل الحركات الأقدم من تاريخ التصفير
      if (lastResetDate && !showArchivedBeforeReset) {
        const txDate = parseDateObj(tx.date);
        const resetDate = parseDateObj(lastResetDate);
        if (txDate && resetDate && txDate.getTime() < resetDate.getTime()) {
          return false;
        }
      }

      const matchesSearch =
        (tx.description && tx.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tx.category && tx.category.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      const txDate = parseDateObj(tx.date);
      if (!txDate && dateFilterType !== "all") return false;

      const now = new Date();

      if (dateFilterType === "today" && txDate) {
        return (
          txDate.getDate() === now.getDate() &&
          txDate.getMonth() === now.getMonth() &&
          txDate.getFullYear() === now.getFullYear()
        );
      } else if (dateFilterType === "month" && txDate) {
        return (
          txDate.getMonth() === now.getMonth() &&
          txDate.getFullYear() === now.getFullYear()
        );
      } else if (dateFilterType === "year" && txDate) {
        return txDate.getFullYear() === now.getFullYear();
      } else if (dateFilterType === "custom" && txDate) {
        const txIsoStr = txDate.toISOString().slice(0, 10);
        if (startDate && txIsoStr < startDate) return false;
        if (endDate && txIsoStr > endDate) return false;
        return true;
      }

      return true;
    });
  }, [transactions, searchQuery, dateFilterType, startDate, endDate, lastResetDate, showArchivedBeforeReset]);

  const summary = useMemo(() => {
    let totalInflow = 0;
    let totalOutflow = 0;

    filteredTransactions.forEach((tx) => {
      if (tx.type === "inflow") totalInflow += Number(tx.amount) || 0;
      else totalOutflow += Number(tx.amount) || 0;
    });

    return {
      totalInflow,
      totalOutflow,
      netBalance: totalInflow - totalOutflow,
    };
  }, [filteredTransactions]);

  const handleOpenModal = (type: "inflow" | "outflow") => {
    setModalType(type);
    setForm({
      amount: "",
      category: type === "inflow" ? "capital_deposit" : "expense",
      description: "",
    });
    setIsModalOpen(true);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const ownerUid = getOwnerUid();
    if (!ownerUid || !form.amount || Number(form.amount) <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح.");
      return;
    }

    try {
      setSubmitting(true);
      await addTreasuryTransaction({
        userId: ownerUid,
        type: modalType,
        category: form.category,
        amount: Number(form.amount),
        description: form.description.trim() || (modalType === "inflow" ? "إيداع رأس مال/سيولة" : "مصروفات تشغيلية"),
        date: new Date().toISOString(),
      });

      toast.success("تم تسجيل الحركة في الخزينة بنجاح!");
      setIsModalOpen(false);
      await fetchData();
    } catch (error) {
      console.error("خطأ أثناء حفظ الحركة:", error);
      toast.error("حدث خطأ أثناء معالجة العملية.");
    } finally {
      setSubmitting(false);
    }
  };

  // 🛡️ تصفير الصندوق بأمان تام دون مسح بيانات الزبائن أو الأقساط
  const handleClearTreasuryBalance = async () => {
    const confirmClear = window.confirm(
      "تنبيه: هل أنت متأكد من تصفير رصيد الخزينة والصندوق والبدء بصندوق جديد من الآن؟\n\n(ملاحظة هامة جداً: لن يتم مسح أي عقد أو دفعات للعملاء مطلقاً، فقط سيبدأ حساب الصندوق من صفر ابتداءً من هذه اللحظة)."
    );
    if (!confirmClear) return;

    const ownerUid = getOwnerUid();
    if (!ownerUid) return;

    try {
      setLoading(true);
      const nowIso = new Date().toISOString();
      
      // 1. مسح الحركات اليدوية السابقة فقط
      await clearUserTreasuryData(ownerUid).catch(() => {});

      // 2. تعيين نقطة التصفير الحالية
      localStorage.setItem(`treasury_last_reset_${ownerUid}`, nowIso);
      setLastResetDate(nowIso);
      setShowArchivedBeforeReset(false);

      toast.success("تم تصفير الصندوق والبدء بحساب سيولة جديد من الآن بنجاح!");
      await fetchData();
    } catch (err) {
      toast.error("حدث خطأ أثناء تصفير الصندوق.");
    } finally {
      setLoading(false);
    }
  };

  const handleUndoReset = () => {
    const ownerUid = getOwnerUid();
    if (ownerUid) {
      localStorage.removeItem(`treasury_last_reset_${ownerUid}`);
      setLastResetDate(null);
      setShowArchivedBeforeReset(false);
      toast.info("تم إلغاء تصفير الصندوق واسترجاع المجموع التاريخي الكامل.");
    }
  };

  const handleDeleteTx = async (tx: TreasuryTransaction) => {
    if (tx.id?.startsWith("pay_") || tx.id?.startsWith("down_") || tx.id?.startsWith("cost_")) {
      toast.error("لا يمكن حذف الحركات التلقائية من الخزينة. يجب الحذف من قسم الأقساط أو العقود.");
      return;
    }

    try {
      await deleteTreasuryTransaction(tx.id!);
      toast.success("تم حذف الحركة المالية بنجاح.");
      await fetchData();
    } catch (error) {
      console.error("خطأ في الحذف:", error);
      toast.error("تعذر حذف الحركة.");
    }
  };

  const getCategoryLabel = (cat: TreasuryTransaction["category"]) => {
    switch (cat) {
      case "installment_payment": return "تسديد قسط";
      case "down_payment": return "دفعة مقدمة";
      case "capital_deposit": return "إيداع رأس مال";
      case "inventory_purchase": return "شراء بضاعة ومخزن";
      case "expense": return "مصاريف ونثريات";
      case "withdrawal": return "مسحوبات شخصية/أرباح";
      default: return "حركة مالية";
    }
  };

  if (loading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center gap-3 text-orange-500">
        <Loader2 className="w-10 h-10 animate-spin" />
        <span className="text-xs font-black text-muted-foreground animate-pulse">جاري جلب بيانات الخزينة ...</span>
      </div>
    );
  }

  const isNegative = summary.netBalance < 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 font-sans dir-rtl text-right">
      
      {/* 1. الترويسة الرئيسية */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/80 backdrop-blur-xl p-5 md:p-6 rounded-3xl border border-border shadow-sm transition-all duration-300 hover:shadow-md">
        <div>
          <h1 className="text-xl md:text-3xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <Vault className="w-7 h-7 text-orange-500 animate-pulse" />
            <span>خزينة الأموال والصندوق</span>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 font-bold">
            إدارة حركة السيولة النقدية المباشرة (المقبوضات، المصاريف، وتجهيز البضائع).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleClearTreasuryBalance}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-red-700 hover:bg-red-800 text-white border border-red-600 px-4 py-2.5 rounded-2xl font-black text-xs md:text-sm transition-all shadow-md hover:-translate-y-0.5 active:scale-95"
            title="تصفير رصيد الصندوق والبدء بحساب جديد دون مسح الزبائن"
          >
            <RotateCcw className="w-4 h-4 text-white" />
            <span>تصفير الصندوق</span>
          </button>

          <button
            onClick={() => handleOpenModal("inflow")}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-2xl font-black text-xs md:text-sm transition-all shadow-md hover:-translate-y-0.5 active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>إيداع سيولة (+)</span>
          </button>
          
          <button
            onClick={() => handleOpenModal("outflow")}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-2xl font-black text-xs md:text-sm transition-all shadow-md hover:-translate-y-0.5 active:scale-95"
          >
            <MinusCircle className="w-4 h-4" />
            <span>تسجيل مصاريف (-)</span>
          </button>
        </div>
      </div>

      {/* ⚠️ تنبيه تصفير الصندوق في حال تم التصفير سابقاً */}
      {lastResetDate && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
            <History className="w-5 h-5 shrink-0" />
            <span>تم تصفير الصندوق بتاريخ: <strong className="font-mono dir-ltr">{formatDateForDisplay(lastResetDate)}</strong>. يتم احتساب السيولة ابتداءً من هذا التاريخ.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowArchivedBeforeReset(!showArchivedBeforeReset)}
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 rounded-xl font-black transition text-xs"
            >
              {showArchivedBeforeReset ? "إخفاء الحركات القديمة" : "عرض الحركات السابقة للتصفير"}
            </button>

            <button
              onClick={handleUndoReset}
              className="px-3 py-1.5 bg-card hover:bg-secondary border border-border text-foreground rounded-xl font-black transition text-xs"
            >
              إلغاء التصفير
            </button>
          </div>
        </div>
      )}

      {/* 2. البطاقات المالية */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        <div className={`p-5 md:p-6 rounded-3xl shadow-sm flex items-center justify-between transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl border ${
          isNegative 
            ? "bg-red-600 text-white border-red-500 shadow-red-500/20" 
            : "bg-card/90 backdrop-blur-md border-border"
        }`}>
          <div>
            <p className={`text-xs font-bold mb-1 ${isNegative ? "text-red-100" : "text-muted-foreground"}`}>
              صافي السيولة النقدية بالصندوق
            </p>
            <p className={`text-2xl md:text-3xl font-black font-mono ${
              isNegative ? "text-white" : "text-orange-500"
            }`}>
              {summary.netBalance.toLocaleString("en-US")} د.ع
            </p>
            <p className={`text-[11px] mt-1 font-bold ${isNegative ? "text-red-100" : "text-muted-foreground"}`}>
              {isNegative ? "⚠️ يوجد عجز/نقص في الصندوق!" : "الرصيد المتوفر في الفترة المحددة"}
            </p>
          </div>
          <div className={`p-4 rounded-2xl border ${
            isNegative 
              ? "bg-white/20 text-white border-white/30" 
              : "bg-orange-500/10 text-orange-500 border-orange-500/20"
          }`}>
            <Vault className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-card/90 backdrop-blur-md border border-border p-5 md:p-6 rounded-3xl shadow-sm flex items-center justify-between transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl">
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1">إجمالي المقبوضات والداخل</p>
            <p className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              +{summary.totalInflow.toLocaleString("en-US")} د.ع
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 font-bold">أقساط + مقدمات + إيداعات</p>
          </div>
          <div className="p-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-500/20">
            <TrendingUp className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-card/90 backdrop-blur-md border border-border p-5 md:p-6 rounded-3xl shadow-sm flex items-center justify-between transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl">
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1">إجمالي الخروج والمصاريف</p>
            <p className="text-2xl md:text-3xl font-black text-red-600 dark:text-red-400 font-mono">
              -{summary.totalOutflow.toLocaleString("en-US")} د.ع
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 font-bold">تجهيز سلع + نثريات + مسحوبات</p>
          </div>
          <div className="p-4 bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl border border-red-500/20">
            <TrendingDown className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* 3. التصفية والجدول */}
      <div className="bg-card/90 backdrop-blur-md border border-border p-4 md:p-5 rounded-3xl shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="ابحث في سجل كشف الخزينة والمصاريف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-2xl border border-border bg-background text-foreground text-xs md:text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-secondary/40 p-1.5 rounded-2xl border border-border w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => setDateFilterType("all")}
              className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all shrink-0 ${
                dateFilterType === "all" ? "bg-orange-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              الكل ({filteredTransactions.length})
            </button>
            <button
              onClick={() => setDateFilterType("today")}
              className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all shrink-0 ${
                dateFilterType === "today" ? "bg-orange-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              اليوم
            </button>
            <button
              onClick={() => setDateFilterType("month")}
              className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all shrink-0 ${
                dateFilterType === "month" ? "bg-orange-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              هذا الشهر
            </button>
            <button
              onClick={() => setDateFilterType("year")}
              className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all shrink-0 ${
                dateFilterType === "year" ? "bg-orange-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              هذه السنة
            </button>
            <button
              onClick={() => setDateFilterType("custom")}
              className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all shrink-0 flex items-center gap-1.5 ${
                dateFilterType === "custom" ? "bg-orange-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>مخصص</span>
            </button>
          </div>
        </div>

        {dateFilterType === "custom" && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border text-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-bold">من تاريخ:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-background border border-border rounded-xl px-3 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-orange-500 font-mono font-bold"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-bold">إلى تاريخ:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-background border border-border rounded-xl px-3 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-orange-500 font-mono font-bold"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="text-red-500 hover:underline text-xs font-black mr-auto"
              >
                مسح التواريخ
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. كشف حركة الصندوق */}
      <div className="bg-card/90 backdrop-blur-md border border-border rounded-3xl overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md">
        <div className="p-4 md:p-5 border-b border-border bg-secondary/30 flex items-center justify-between">
          <h2 className="font-black text-sm md:text-base flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-orange-500" />
            <span>كشف حركة الصندوق والتصرفات المالية</span>
          </h2>
          <span className="text-xs font-black bg-orange-500/10 text-orange-600 dark:text-orange-400 px-3 py-1 rounded-full border border-orange-500/20">
            {filteredTransactions.length} سجل
          </span>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-xs md:text-sm font-bold">
            لا توجد حركات نقدية مسجلة في هذا النطاق الزمني المحدد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs md:text-sm">
              <thead className="bg-secondary/40 text-muted-foreground border-b border-border text-xs">
                <tr>
                  <th className="p-3.5 font-black">التاريخ والوقت</th>
                  <th className="p-3.5 font-black">التصنيف</th>
                  <th className="p-3.5 font-black">البيان / التفاصيل</th>
                  <th className="p-3.5 font-black">المبلغ</th>
                  <th className="p-3.5 font-black text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTransactions.map((tx, idx) => (
                  <tr key={tx.id || idx} className="hover:bg-secondary/20 transition-colors">
                    <td className="p-3.5 text-muted-foreground font-mono font-bold text-xs">
                      {formatDateForDisplay(tx.date)}
                    </td>

                    <td className="p-3.5">
                      <span className={`px-3 py-1 rounded-full text-[11px] font-black border ${
                        tx.type === "inflow"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : "bg-black text-white dark:bg-slate-800 dark:text-slate-100 border-slate-700"
                      }`}>
                        {getCategoryLabel(tx.category)}
                      </span>
                    </td>

                    <td className="p-3.5 font-black text-foreground max-w-[280px] truncate">
                      {tx.description}
                    </td>

                    <td className={`p-3.5 font-black text-sm md:text-base font-mono ${
                      tx.type === "inflow" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    }`}>
                      {tx.type === "inflow" ? "+" : "-"}{tx.amount.toLocaleString("en-US")} د.ع
                    </td>

                    <td className="p-3.5 text-center">
                      {!tx.id?.startsWith("pay_") && !tx.id?.startsWith("down_") && !tx.id?.startsWith("cost_") ? (
                        <button
                          onClick={() => handleDeleteTx(tx)}
                          className="p-2 text-red-600 hover:bg-red-500/10 rounded-xl transition-colors"
                          title="حذف الحركة اليدوية"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground font-bold italic">آلي من العقود</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. النافذة المنبثقة */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3 md:p-4 backdrop-blur-md">
          <div className="bg-card rounded-3xl w-full max-w-md p-5 md:p-6 shadow-2xl border border-border animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 border-b border-border pb-3.5">
              <h2 className={`text-base md:text-lg font-black flex items-center gap-2 ${
                modalType === "inflow" ? "text-emerald-600" : "text-red-600"
              }`}>
                {modalType === "inflow" ? <PlusCircle className="w-5 h-5" /> : <MinusCircle className="w-5 h-5" />}
                <span>{modalType === "inflow" ? "إيداع سيولة / رأس مال" : "تسجيل مصروف / سحب"}</span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-secondary rounded-xl transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">تصنيف الحركة</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as any })}
                  className="w-full p-3 rounded-2xl border border-border bg-background text-xs md:text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  {modalType === "inflow" ? (
                    <>
                      <option value="capital_deposit">إيداع رأس مال للشركة</option>
                      <option value="expense">سيولة إضافية للصندوق</option>
                    </>
                  ) : (
                    <>
                      <option value="expense">مصاريف ونثريات تشغيلية (كهرباء، إيجار...)</option>
                      <option value="inventory_purchase">شراء بضاعة ومواد للمخزن</option>
                      <option value="withdrawal">مسحوبات شخصية / توزيع أرباح</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">المبلغ (د.ع)</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="أدخل قيمة المبلغ..."
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full p-3 rounded-2xl border border-border bg-background text-sm font-black focus:ring-2 focus:ring-orange-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">البيان / ملاحظة الحركة</label>
                <input
                  type="text"
                  placeholder="مثال: إيجار المحل لشهر 10، أو شراء 5 دراجات..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full p-3 rounded-2xl border border-border bg-background text-xs md:text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 text-xs md:text-sm font-bold rounded-2xl border border-border hover:bg-secondary transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting || !form.amount}
                  className={`flex-1 py-3 text-xs md:text-sm rounded-2xl text-white font-black transition-all flex items-center justify-center gap-2 shadow-md ${
                    modalType === "inflow" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>تأكيد الحفظ</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}