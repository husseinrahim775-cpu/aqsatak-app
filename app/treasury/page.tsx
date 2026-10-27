"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { 
  getUserTreasuryTransactions, 
  addTreasuryTransaction, 
  deleteTreasuryTransaction,
  getUserPayments,
  getUserInstallments,
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
  History,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";

// 🗣️ دالة تفقيط وتسهيل قراءة المبالغ المالية بالعربية
const formatArabicCurrency = (val: number | ""): string => {
  if (val === "" || isNaN(Number(val)) || Number(val) === 0) return "";
  const num = Number(val);

  if (num >= 1000000000) {
    const bil = Math.floor(num / 1000000000);
    const rem = num % 1000000000;
    return `${bil} مليار ${rem > 0 ? "و " + formatArabicCurrency(rem) : "د.ع"}`;
  }
  if (num >= 1000000) {
    const mil = Math.floor(num / 1000000);
    const rem = num % 1000000;
    return `${mil} مليون ${rem > 0 ? "و " + formatArabicCurrency(rem) : "د.ع"}`;
  }
  if (num >= 1000) {
    const th = Math.floor(num / 1000);
    const rem = num % 1000;
    return `${th} ألف ${rem > 0 ? "و " + rem + " د.ع" : "د.ع"}`;
  }
  return `${num.toLocaleString("en-US")} د.ع`;
};

// 🔢 تحويل النص المنسق بالفواصل إلى رقم صافي
const parseFormattedNumber = (val: string): number | "" => {
  const clean = val.replace(/,/g, "").trim();
  if (clean === "" || isNaN(Number(clean))) return "";
  return Number(clean);
};

// 🏷️ تنسيق العرض للمستخدم بالفواصل
const formatInputDisplay = (val: number | ""): string => {
  if (val === "" || isNaN(Number(val))) return "";
  return val.toLocaleString("en-US");
};

// 🛠️ دالة مساعدة معالجة وتنسيق كافة أنواع التواريخ
const parseDateObj = (dateVal: any): Date | null => {
  if (!dateVal) return null;
  try {
    if (typeof dateVal === "object" && typeof dateVal.toDate === "function") {
      return dateVal.toDate();
    }
    if (typeof dateVal === "object" && dateVal.seconds) {
      return new Date(dateVal.seconds * 1000);
    }
    if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
      return dateVal;
    }
    if (typeof dateVal === "number") {
      const d = new Date(dateVal);
      return !isNaN(d.getTime()) ? d : null;
    }
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
  const { theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // 📅 حالات فلترة التاريخ والتصفير
  const [dateFilterType, setDateFilterType] = useState<"all" | "today" | "month" | "year" | "custom">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [lastResetDate, setLastResetDate] = useState<string | null>(null);
  const [showArchivedBeforeReset, setShowArchivedBeforeReset] = useState(false);

  // 📅 حالات التقويم التفاعلي للتاريخ المخصص (سنة - شهر - يوم)
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
    { num: "01", name: "شهر 1" },
    { num: "02", name: "شهر 2" },
    { num: "03", name: "شهر 3" },
    { num: "04", name: "شهر 4" },
    { num: "05", name: "شهر 5" },
    { num: "06", name: "شهر 6" },
    { num: "07", name: "شهر 7" },
    { num: "08", name: "شهر 8" },
    { num: "09", name: "شهر 9" },
    { num: "10", name: "شهر 10" },
    { num: "11", name: "شهر 11" },
    { num: "12", name: "شهر 12" },
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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"inflow" | "outflow">("inflow");
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    amount: "" as number | "",
    category: "capital_deposit" as TreasuryTransaction["category"],
    description: "",
  });

  // ➕ إضافة أصفار أو مبالغ سريعة للمدخلات
  const addAmount = (
    currentVal: number | "", 
    setterFunc: (v: number | "") => void, 
    multiplierOrAdd: number, 
    isMultiplier = false
  ) => {
    const base = Number(currentVal) || 0;
    if (isMultiplier) {
      setterFunc(base === 0 ? multiplierOrAdd : base * multiplierOrAdd);
    } else {
      setterFunc(base + multiplierOrAdd);
    }
  };

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
        const isFromInventory = inst.fromInventory === true || inst.fromInventory === "true";
        
        if (cost > 0 && !isFromInventory) {
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

  // 🎯 التعديل الرئيسي لحماية حركة شراء المخزن: التصفير الزمني دون مسح سجلات قاعدة البيانات
  const handleClearTreasuryBalance = async () => {
    const confirmClear = window.confirm(
      "تنبيه: هل أنت متأكد من تصفير رصيد الخزينة والصندوق والبدء بصندوق جديد من الآن؟\n\n(ملاحظة هامة: لن يتم مسح أي حركة أو بضاعة بالمخزن مطلقاً، فقط سيبدأ حساب الصندوق من صفر ابتداءً من هذه اللحظة)."
    );
    if (!confirmClear) return;

    const ownerUid = getOwnerUid();
    if (!ownerUid) return;

    try {
      const nowIso = new Date().toISOString();
      localStorage.setItem(`treasury_last_reset_${ownerUid}`, nowIso);
      setLastResetDate(nowIso);
      setShowArchivedBeforeReset(false);

      toast.success("تم تصفير الصندوق والبدء بحساب سيولة جديد من الآن بنجاح!");
    } catch (err) {
      toast.error("حدث خطأ أثناء تصفير الصندوق.");
    }
  };

  const handleUndoReset = () => {
    const ownerUid = getOwnerUid();
    if (ownerUid) {
      localStorage.removeItem(`treasury_last_reset_${ownerUid}`);
      setLastResetDate(null);
      setShowArchivedBeforeReset(false);
      toast.info("تم إلغاء تصفير الصندوق واسترجاع حركات شراء المخزن والسجل التاريخي الكامل.");
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
      <div className="h-[80vh] flex flex-col items-center justify-center gap-3 text-primary">
        <Loader2 className="w-10 h-10 animate-spin" />
        <span className="text-xs font-black text-muted-foreground animate-pulse">جاري جلب بيانات الخزينة ...</span>
      </div>
    );
  }

  const isNegative = summary.netBalance < 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 font-sans dir-rtl text-right">
      
      {/* 1. الترويسة الرئيسية المربوطة بالثيم */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/80 backdrop-blur-xl p-5 md:p-6 rounded-3xl border border-border shadow-sm transition-all duration-300 hover:shadow-md">
        <div>
          <h1 className="text-xl md:text-3xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <Vault className="w-7 h-7 text-primary animate-pulse" />
            <span>خزينة الأموال والصندوق</span>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 font-bold">
            إدارة حركة السيولة النقدية المباشرة (المقبوضات، المصاريف، وتجهيز البضائع).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={handleClearTreasuryBalance}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-red-700 hover:bg-red-800 text-white border border-red-600 px-4 py-2.5 rounded-2xl font-black text-xs md:text-sm transition-all shadow-md hover:-translate-y-0.5 active:scale-95 cursor-pointer"
            title="تصفير رصيد الصندوق والبدء بحساب جديد دون مسح الزبائن"
          >
            <RotateCcw className="w-4 h-4 text-white" />
            <span>تصفير الصندوق</span>
          </button>

          <button
            onClick={() => handleOpenModal("inflow")}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-2xl font-black text-xs md:text-sm transition-all shadow-md hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>إيداع سيولة (+)</span>
          </button>
          
          <button
            onClick={() => handleOpenModal("outflow")}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-2xl font-black text-xs md:text-sm transition-all shadow-md hover:-translate-y-0.5 active:scale-95 cursor-pointer"
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
              className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 rounded-xl font-black transition text-xs cursor-pointer"
            >
              {showArchivedBeforeReset ? "إخفاء الحركات القديمة" : "عرض الحركات السابقة للتصفير"}
            </button>

            <button
              onClick={handleUndoReset}
              className="px-3 py-1.5 bg-card hover:bg-secondary border border-border text-foreground rounded-xl font-black transition text-xs cursor-pointer"
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
              isNegative ? "text-white" : "text-primary"
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
              : "bg-primary/10 text-primary border-primary/20"
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

      {/* 3. التصفية والجدول والتقويم التفاعلي المتقدم */}
      <div className="bg-card/90 backdrop-blur-md border border-border p-4 md:p-5 rounded-3xl shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="ابحث في سجل كشف الخزينة والمصاريف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-2xl border border-border bg-background text-foreground text-xs md:text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-secondary/40 p-1.5 rounded-2xl border border-border w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => setDateFilterType("all")}
              className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all shrink-0 cursor-pointer ${
                dateFilterType === "all" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              الكل ({filteredTransactions.length})
            </button>
            <button
              onClick={() => setDateFilterType("today")}
              className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all shrink-0 cursor-pointer ${
                dateFilterType === "today" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              اليوم
            </button>
            <button
              onClick={() => setDateFilterType("month")}
              className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all shrink-0 cursor-pointer ${
                dateFilterType === "month" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              هذا الشهر
            </button>
            <button
              onClick={() => setDateFilterType("year")}
              className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all shrink-0 cursor-pointer ${
                dateFilterType === "year" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              هذه السنة
            </button>
            <button
              onClick={() => setDateFilterType("custom")}
              className={`px-3.5 py-1.5 text-xs font-black rounded-xl transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                dateFilterType === "custom" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>مخصص</span>
            </button>
          </div>
        </div>

        {/* 📅 التاريخ المخصص مع التقويم التفاعلي المنبثق (سنة - شهر - يوم) */}
        {dateFilterType === "custom" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-border text-xs animate-in fade-in duration-200">
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
                <span className={startDate ? "text-foreground font-mono" : "text-muted-foreground"}>
                  {startDate || "اختر بداية الفترة..."}
                </span>
                <div className="flex items-center gap-1">
                  {startDate && (
                    <X 
                      className="w-3.5 h-3.5 text-muted-foreground hover:text-rose-500 cursor-pointer" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setStartDate("");
                      }} 
                    />
                  )}
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
              </button>

              <AnimatePresence>
                {showStartPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute z-[10002] bottom-full mt-2 w-72 right-0 bg-card border border-border rounded-3xl p-4 shadow-2xl backdrop-blur-xl space-y-3"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <button
                          type="button"
                          onClick={() => setStartYear((y) => y - 1)}
                          className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs cursor-pointer"
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
                          className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs cursor-pointer"
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
                              className="text-primary hover:underline font-bold text-[10px] cursor-pointer"
                            >
                              تغيير الشهر ({startMonthObj?.name || "اختر"})
                            </button>
                          </div>
                          <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto pt-1">
                            {daysInStartMonth.map((dayNum) => {
                              const dateString = `${startYear}-${startMonthObj?.num || "01"}-${dayNum}`;
                              const isSelected = startDate === dateString;
                              return (
                                <button
                                  key={dayNum}
                                  type="button"
                                  onClick={() => {
                                    setStartDate(dateString);
                                    setShowStartPicker(false);
                                  }}
                                  className={`p-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
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
                          {monthsList.map((m) => {
                            const monthString = `${startYear}-${m.num}`;
                            const isSelected = startDate === monthString;
                            return (
                              <button
                                key={m.num}
                                type="button"
                                onClick={() => {
                                  setStartMonthObj(m);
                                  setStartStep("days");
                                  setStartDate(monthString);
                                }}
                                className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                    : "bg-secondary/50 hover:bg-primary/10 text-foreground hover:text-primary"
                                }`}
                              >
                                {m.name}
                              </button>
                            );
                          })}
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
                <span className={endDate ? "text-foreground font-mono" : "text-muted-foreground"}>
                  {endDate || "اختر نهاية الفترة..."}
                </span>
                <div className="flex items-center gap-1">
                  {endDate && (
                    <X 
                      className="w-3.5 h-3.5 text-muted-foreground hover:text-rose-500 cursor-pointer" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEndDate("");
                      }} 
                    />
                  )}
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
              </button>

              <AnimatePresence>
                {showEndPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute z-[10002] bottom-full mt-2 w-72 left-0 bg-card border border-border rounded-3xl p-4 shadow-2xl backdrop-blur-xl space-y-3"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <button
                          type="button"
                          onClick={() => setEndYear((y) => y - 1)}
                          className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs cursor-pointer"
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
                          className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs cursor-pointer"
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
                              className="text-primary hover:underline font-bold text-[10px] cursor-pointer"
                            >
                              تغيير الشهر ({endMonthObj?.name || "اختر"})
                            </button>
                          </div>
                          <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto pt-1">
                            {daysInEndMonth.map((dayNum) => {
                              const dateString = `${endYear}-${endMonthObj?.num || "01"}-${dayNum}`;
                              const isSelected = endDate === dateString;
                              return (
                                <button
                                  key={dayNum}
                                  type="button"
                                  onClick={() => {
                                    setEndDate(dateString);
                                    setShowEndPicker(false);
                                  }}
                                  className={`p-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
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
                          {monthsList.map((m) => {
                            const monthString = `${endYear}-${m.num}`;
                            const isSelected = endDate === monthString;
                            return (
                              <button
                                key={m.num}
                                type="button"
                                onClick={() => {
                                  setEndMonthObj(m);
                                  setEndStep("days");
                                  setEndDate(monthString);
                                }}
                                className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                    : "bg-secondary/50 hover:bg-primary/10 text-foreground hover:text-primary"
                                }`}
                              >
                                {m.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* 4. كشف حركة الصندوق */}
      <div className="bg-card/90 backdrop-blur-md border border-border rounded-3xl overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md">
        <div className="p-4 md:p-5 border-b border-border bg-secondary/30 flex items-center justify-between">
          <h2 className="font-black text-sm md:text-base flex items-center gap-2.5">
            <Receipt className="w-5 h-5 text-primary" />
            <span>كشف حركة الصندوق والتصرفات المالية</span>
          </h2>
          <span className="text-xs font-black bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">
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
                          : "bg-secondary text-foreground border-border"
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
                          className="p-2 text-red-600 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
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
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 hover:bg-secondary rounded-xl transition-colors cursor-pointer">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">تصنيف الحركة</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as any })}
                  className="w-full p-3 rounded-2xl border border-border bg-background text-xs md:text-sm font-bold focus:ring-2 focus:ring-primary outline-none cursor-pointer"
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

              {/* المبلغ المستلم / المصروف */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-muted-foreground">المبلغ (د.ع)</label>
                  {form.amount !== "" && (
                    <span className={`text-[10px] font-black animate-pulse ${
                      modalType === "inflow" ? "text-emerald-500" : "text-red-500"
                    }`}>
                      {formatArabicCurrency(form.amount)}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder="أدخل قيمة المبلغ..."
                  value={formatInputDisplay(form.amount)}
                  onChange={(e) => setForm({ ...form, amount: parseFormattedNumber(e.target.value) })}
                  className="w-full p-3 rounded-2xl border border-border bg-background text-sm font-black focus:ring-2 focus:ring-primary outline-none font-mono dir-ltr text-right"
                />
                <div className="flex gap-1 pt-0.5 dir-ltr justify-end">
                  <button 
                    type="button" 
                    onClick={() => addAmount(form.amount, (v) => setForm((prev) => ({ ...prev, amount: v })), 1000, true)}
                    className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all cursor-pointer"
                  >
                    +000 (ألف)
                  </button>
                  <button 
                    type="button" 
                    onClick={() => addAmount(form.amount, (v) => setForm((prev) => ({ ...prev, amount: v })), 100000, false)}
                    className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all cursor-pointer"
                  >
                    +100 ألف
                  </button>
                  <button 
                    type="button" 
                    onClick={() => addAmount(form.amount, (v) => setForm((prev) => ({ ...prev, amount: v })), 1000000, true)}
                    className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all cursor-pointer"
                  >
                    +000000 (مليون)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">البيان / ملاحظة الحركة</label>
                <input
                  type="text"
                  placeholder="مثال: إيجار المحل لشهر 10، أو شراء 5 دراجات..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full p-3 rounded-2xl border border-border bg-background text-xs md:text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 text-xs md:text-sm font-bold rounded-2xl border border-border hover:bg-secondary transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting || !form.amount}
                  className={`flex-1 py-3 text-xs md:text-sm rounded-2xl text-white font-black transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer ${
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