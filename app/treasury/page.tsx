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
  Receipt
} from "lucide-react";
import { toast } from "sonner";

// 🛠️ دالة مساعدة معالجة وحسب نوع التاريخ بأمان بدون أخطاء
const parseDateString = (dateVal: any): string => {
  if (!dateVal) return "";
  try {
    if (typeof dateVal === "object" && typeof dateVal.toDate === "function") {
      return dateVal.toDate().toISOString().slice(0, 10);
    }
    if (dateVal instanceof Date) {
      return dateVal.toISOString().slice(0, 10);
    }
    const parsedDate = new Date(dateVal);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().slice(0, 10);
    }
    return String(dateVal).slice(0, 10);
  } catch (e) {
    return "";
  }
};

export default function TreasuryPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // 📅 حالات فلترة التاريخ
  const [dateFilterType, setDateFilterType] = useState<"all" | "today" | "month" | "year" | "custom">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // حالات نافذة إضافة حركة إيداع / مصاريف يدوية
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

 // ⚡ جلب بيانات الخزينة السريع بدون تعليق الواجهة
  const fetchData = useCallback(async () => {
    const ownerUid = getOwnerUid();
    if (!ownerUid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. جلب حركات الخزينة اليدوية فوراً من الكاش
      const manualTx = await getUserTreasuryTransactions(ownerUid).catch(() => []);
      
      // 🚀 إظهار البيانات وإغلاق التحميل فوراً في جزء من الثانية
      setTransactions(manualTx || []);
      setLoading(false);

      // 2. جلب الدفعات والأقساط في الخلفية لتجميع المقبوضات التلقائية بدون إعاقة الشاشة
      const [payments, installments] = await Promise.all([
        getUserPayments(ownerUid).catch(() => []),
        getUserInstallments(ownerUid).catch(() => []),
      ]);

      const autoInflows: TreasuryTransaction[] = [];

      (payments || []).forEach((p) => {
        autoInflows.push({
          id: `pay_${p.id}`,
          userId: ownerUid,
          type: "inflow",
          category: "installment_payment",
          amount: Number(p.amount) || 0,
          description: `تسديد قسط: ${p.customerName || "عميل"} (${p.productName || "منتج"})`,
          date: p.paidAt || p.createdAt || new Date().toISOString(),
        });
      });

      (installments || []).forEach((inst) => {
        if (inst.downPayment && inst.downPayment > 0) {
          autoInflows.push({
            id: `down_${inst.id}`,
            userId: ownerUid,
            type: "inflow",
            category: "down_payment",
            amount: Number(inst.downPayment) || 0,
            description: `دفعة مقدمة عقد: ${inst.customerName} (${inst.productName})`,
            date: inst.createdAt || new Date().toISOString(),
          });
        }
      });

      const allTx = [...(manualTx || []), ...autoInflows].sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        return timeB - timeA;
      });

      // تحديث القائمة الشاملة فور اكتمالها
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
      const matchesSearch =
        (tx.description && tx.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tx.category && tx.category.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      const txDateStr = parseDateString(tx.date);
      const now = new Date();

      if (dateFilterType === "today") {
        const todayStr = now.toISOString().slice(0, 10);
        return txDateStr === todayStr;
      } else if (dateFilterType === "month") {
        const monthStr = now.toISOString().slice(0, 7);
        return txDateStr.startsWith(monthStr);
      } else if (dateFilterType === "year") {
        const yearStr = now.getFullYear().toString();
        return txDateStr.startsWith(yearStr);
      } else if (dateFilterType === "custom") {
        if (startDate && txDateStr < startDate) return false;
        if (endDate && txDateStr > endDate) return false;
        return true;
      }

      return true;
    });
  }, [transactions, searchQuery, dateFilterType, startDate, endDate]);

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

  const handleClearAllData = async () => {
    const ownerUid = getOwnerUid();
    if (!ownerUid) return;

    try {
      setLoading(true);
      await clearUserTreasuryData(ownerUid);
      toast.success("تم مسح وتنظيف كافة حركات الخزينة والصندوق بنجاح!");
      await fetchData();
    } catch (err) {
      toast.error("حدث خطأ أثناء محاولة مسح البيانات.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTx = async (tx: TreasuryTransaction) => {
    if (tx.id?.startsWith("pay_") || tx.id?.startsWith("down_")) {
      toast.error("لا يمكن حذف الدفعات التلقائية من الخزينة. يجب حذفها من قسم الحسابات.");
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
      <div className="h-[75vh] flex items-center justify-center text-primary">
        <Loader2 className="w-9 h-9 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-12">
      
      {/* 1. الهيدر وأزرار العمليات السريعة */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 md:p-6 rounded-2xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <Vault className="w-6 h-6 text-primary" />
            <span>خزينة الأموال والصندوق</span>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            إدارة حركة السيولة النقدية المباشرة (المقبوضات، المصاريف، وشراء البضائع).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleClearAllData}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-300 px-3 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 shadow-sm"
            title="مسح وتنظيف كافة سجلات حركات الحساب"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>تصفير الصندوق</span>
          </button>

          <button
            onClick={() => handleOpenModal("inflow")}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>إيداع سيولة (+)</span>
          </button>
          
          <button
            onClick={() => handleOpenModal("outflow")}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-colors shadow-sm"
          >
            <MinusCircle className="w-4 h-4" />
            <span>تسجيل مصاريف (-)</span>
          </button>
        </div>
      </div>

      {/* 2. البطاقات المالية الرئيسية للسيولة */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-primary/30 p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1">صافي السيولة النقدية بالصندوق</p>
            <p className={`text-2xl md:text-3xl font-black ${summary.netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}>
              {summary.netBalance.toLocaleString()} د.ع
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">الرصيد المتوفر في الفترة المحددة</p>
          </div>
          <div className="p-3.5 bg-primary/10 text-primary rounded-2xl">
            <Vault className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1">إجمالي المقبوضات والداخل</p>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              +{summary.totalInflow.toLocaleString()} د.ع
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">أقساط + مقدمات + إيداعات</p>
          </div>
          <div className="p-3.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
            <TrendingUp className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1">إجمالي الخروج والمصاريف</p>
            <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
              -{summary.totalOutflow.toLocaleString()} د.ع
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">شراء سلع + نثريات + مسحوبات</p>
          </div>
          <div className="p-3.5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl">
            <TrendingDown className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* 3. شريط البحث والتصفية بالتاريخ */}
      <div className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="ابحث في سجل كشف الخزينة والمصاريف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 rounded-xl border border-border bg-background text-foreground text-xs md:text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-secondary/30 p-1 rounded-xl border border-border w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => setDateFilterType("all")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors shrink-0 ${
                dateFilterType === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              الكل ({transactions.length})
            </button>
            <button
              onClick={() => setDateFilterType("today")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors shrink-0 ${
                dateFilterType === "today" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              اليوم
            </button>
            <button
              onClick={() => setDateFilterType("month")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors shrink-0 ${
                dateFilterType === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              هذا الشهر
            </button>
            <button
              onClick={() => setDateFilterType("year")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors shrink-0 ${
                dateFilterType === "year" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              هذه السنة
            </button>
            <button
              onClick={() => setDateFilterType("custom")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-1 ${
                dateFilterType === "custom" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>مخصص</span>
            </button>
          </div>
        </div>

        {dateFilterType === "custom" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border text-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">من تاريخ:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">إلى تاريخ:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-1.5 text-foreground outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(""); setEndDate(""); }}
                className="text-rose-500 hover:underline text-xs font-bold mr-auto"
              >
                مسح التواريخ
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. كشف حساب حركة الصندوق الخزينة */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border bg-secondary/20 flex items-center justify-between">
          <h2 className="font-bold text-sm md:text-base flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            <span>كشف حركة الصندوق والتصرفات المالية</span>
          </h2>
          <span className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
            {filteredTransactions.length} سجل
          </span>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-xs font-bold">
            لا توجد حركات نقدية مسجلة في هذا النطاق الزمني المحدد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs md:text-sm">
              <thead className="bg-secondary/40 text-muted-foreground border-b border-border text-xs">
                <tr>
                  <th className="p-3.5">التاريخ والوقت</th>
                  <th className="p-3.5">التصنيف</th>
                  <th className="p-3.5">البيان / التفاصيل</th>
                  <th className="p-3.5">المبلغ</th>
                  <th className="p-3.5 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTransactions.map((tx, idx) => (
                  <tr key={tx.id || idx} className="hover:bg-secondary/20 transition-colors">
                    <td className="p-3.5 text-muted-foreground font-mono text-xs">
                      {tx.date ? new Date(tx.date).toLocaleDateString("ar-IQ", {
                        year: "numeric",
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }) : "---"}
                    </td>

                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        tx.type === "inflow"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                      }`}>
                        {getCategoryLabel(tx.category)}
                      </span>
                    </td>

                    <td className="p-3.5 font-bold text-foreground max-w-[280px] truncate">
                      {tx.description}
                    </td>

                    <td className={`p-3.5 font-black text-sm ${
                      tx.type === "inflow" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }`}>
                      {tx.type === "inflow" ? "+" : "-"}{tx.amount.toLocaleString()} د.ع
                    </td>

                    <td className="p-3.5 text-center">
                      {!tx.id?.startsWith("pay_") && !tx.id?.startsWith("down_") ? (
                        <button
                          onClick={() => handleDeleteTx(tx)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                          title="حذف الحركة اليدوية"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">آلي من الأقساط</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. نافذة تسجيل الإيداع / المصروف اليدوي */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 md:p-4 backdrop-blur-sm">
          <div className="bg-card rounded-2xl w-full max-w-md p-4 md:p-6 shadow-2xl border border-border animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 border-b border-border pb-3">
              <h2 className={`text-base md:text-lg font-bold flex items-center gap-2 ${
                modalType === "inflow" ? "text-emerald-600" : "text-rose-600"
              }`}>
                {modalType === "inflow" ? <PlusCircle className="w-5 h-5" /> : <MinusCircle className="w-5 h-5" />}
                <span>{modalType === "inflow" ? "إيداع سيولة / رأس مال" : "تسجيل مصروف / سحب"}</span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-secondary rounded-lg">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">تصنيف الحركة</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as any })}
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-xs md:text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
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
                <label className="block text-xs font-bold text-muted-foreground mb-1">المبلغ (د.ع)</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="أدخل قيمة المبلغ..."
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-sm font-black focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">البيان / ملاحظة الحركة</label>
                <input
                  type="text"
                  placeholder="مثال: إيجار المحل لشهر 10، أو شراء 5 دراجات..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-xs md:text-sm focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 text-xs md:text-sm font-bold rounded-xl border border-border hover:bg-secondary transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting || !form.amount}
                  className={`flex-1 py-2.5 text-xs md:text-sm rounded-xl text-white font-bold transition-colors flex items-center justify-center gap-2 ${
                    modalType === "inflow" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
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