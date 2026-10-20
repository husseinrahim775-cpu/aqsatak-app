"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "../../components/AuthProvider";
import { 
  getUserPayments, 
  getUserInstallments, 
  addPaymentRecord,
  updatePaymentRecord,
  deletePaymentRecord,
  PaymentRecord, 
  InstallmentData 
} from "../../services/firestore";
import { 
  Coins, 
  Wallet, 
  ArrowDownLeft, 
  Loader2, 
  Calendar, 
  Plus, 
  Search, 
  TrendingUp, 
  User, 
  X, 
  Edit,
  Trash2,
  FileText,
  ChevronRight,
  ChevronLeft,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import { useTheme } from "next-themes";

export default function AccountsPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [installments, setInstallments] = useState<InstallmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [selectedInstallmentId, setSelectedInstallmentId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [targetMonth, setTargetMonth] = useState(""); 
  
  // 📅 حالات التقويم المخصص 
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthObj, setSelectedMonthObj] = useState<{ num: string; name: string } | null>(null);
  const [datePickerStep, setDatePickerStep] = useState<"months" | "days">("months");

  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState<number | "">("");

  const fetchData = useCallback(async () => {
    if (user?.uid) {
      try {
        setLoading(true);
        const [paymentsData, installmentsData] = await Promise.all([
          getUserPayments(user.uid),
          getUserInstallments(user.uid),
        ]);
        setPayments(paymentsData || []);
        setInstallments(installmentsData || []);
      } catch (error) {
        console.error("خطأ في جلب البيانات المالية:", error);
        toast.error("حدث خطأ أثناء تحميل الحسابات والمدفوعات.");
      } finally {
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalCollected = useMemo(() => {
    return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [payments]);

  const totalExpectedProfit = useMemo(() => {
    return installments.reduce((sum, i) => sum + (i.totalProfit || 0), 0);
  }, [installments]);

  const totalRemainingDue = useMemo(() => {
    return installments.reduce((sum, i) => sum + (i.totalDue || 0), 0);
  }, [installments]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchSearch =
        (p.customerName && p.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.productName && p.productName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.installmentId && p.installmentId.includes(searchQuery));
      return matchSearch;
    });
  }, [payments, searchQuery]);

  const filteredInstallmentsForSearch = useMemo(() => {
    if (!customerSearchTerm) return installments;
    return installments.filter(inst => 
      inst.customerName?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
      inst.productName?.toLowerCase().includes(customerSearchTerm.toLowerCase())
    );
  }, [installments, customerSearchTerm]);

  const selectedInstallment = useMemo(() => {
    return installments.find((i) => i.id === selectedInstallmentId);
  }, [installments, selectedInstallmentId]);

  const periodLabel = useMemo(() => {
    if (!selectedInstallment) return "شهري";
    return selectedInstallment.paymentPeriod === "daily" 
      ? "يومي" 
      : selectedInstallment.paymentPeriod === "weekly" 
      ? "أسبوعي" 
      : "شهري";
  }, [selectedInstallment]);

  const handleOpenModal = (installmentId?: string) => {
    setPaymentNotes("");
    setTargetMonth("");
    setCustomerSearchTerm("");
    setShowCustomerDropdown(false);
    setShowDatePicker(false);
    setDatePickerStep("months");
    setSelectedMonthObj(null);

    if (installmentId) {
      handleInstallmentSelection(installmentId);
    } else {
      setSelectedInstallmentId("");
      setPaymentAmount("");
    }
    setIsModalOpen(true);
  };

  const handleInstallmentSelection = (id: string) => {
    setSelectedInstallmentId(id);
    const inst = installments.find((i) => i.id === id);
    if (inst) {
      setPaymentAmount(Math.round(inst.monthlyInstallment || 0));
      setCustomerSearchTerm(`${inst.customerName} - ${inst.productName}`);
    }
    setShowCustomerDropdown(false);
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !selectedInstallmentId || !paymentAmount) {
      toast.error("يرجى اختيار العميل وتحديد المبلغ.");
      return;
    }

    try {
      setSubmitting(true);
      const inst = selectedInstallment;
      const amountNum = Number(paymentAmount);

      await addPaymentRecord({
        userId: user.uid,
        installmentId: selectedInstallmentId,
        customerName: inst?.customerName || "غير محدد",
        productName: inst?.productName || "غير محدد",
        amount: amountNum,
        paidAt: new Date().toISOString(),
        targetMonth: targetMonth || undefined,
        notes: paymentNotes || "",
      });

      toast.success("تم تسجيل الدفعة بنجاح!");
      setIsModalOpen(false);
      await fetchData();
    } catch (error) {
      console.error("خطأ أثناء تسجيل الدفعة:", error);
      toast.error("حدث خطأ أثناء حفظ الدفعة، يرجى إعادة المحاولة.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async (p: PaymentRecord) => {
    if (!p.id || !p.installmentId) return;
    
    try {
      await deletePaymentRecord(p.id, p.installmentId, p.amount);
      toast.success(`تم حذف الدفعة البالغة (${p.amount.toLocaleString()} د.ع) وإعادة إدراجها في الذمة.`);
      await fetchData(); 
    } catch (error) {
      console.error("خطأ في الحذف:", error);
      toast.error("حدث خطأ أثناء محاولة حذف الدفعة.");
    }
  };

  const handleOpenEditModal = (p: PaymentRecord) => {
    setEditingPayment(p);
    setEditPaymentAmount(p.amount);
    setIsEditModalOpen(true);
  };

  const handleSaveEditPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment?.id || !editingPayment.installmentId || !editPaymentAmount) return;

    try {
      setEditSubmitting(true);
      const newAmount = Number(editPaymentAmount);
      
      await updatePaymentRecord(
        editingPayment.id,
        editingPayment.installmentId,
        editingPayment.amount, 
        newAmount,             
        { amount: newAmount }
      );

      toast.success("تم تعديل الدفعة بنجاح!");
      setIsEditModalOpen(false);
      setEditingPayment(null);
      await fetchData(); 
    } catch (error) {
      console.error("خطأ في التعديل:", error);
      toast.error("حدث خطأ أثناء حفظ التعديلات.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const daysInSelectedMonth = useMemo(() => {
    if (!selectedMonthObj) return 30;
    const monthNum = parseInt(selectedMonthObj.num, 10);
    return new Date(selectedYear, monthNum, 0).getDate();
  }, [selectedYear, selectedMonthObj]);

  if (loading) {
    return (
      <div className="h-[75vh] flex flex-col items-center justify-center gap-3 text-orange-500">
        <Loader2 className="w-10 h-10 animate-spin" />
        <span className="text-xs font-bold text-muted-foreground animate-pulse">جاري تحميل سجل الحسابات ...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 font-sans dir-rtl text-right relative">
      {/* الهيدر وزر إضافة دفعة */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">الحسابات والمدفوعات 💳</h1>
          <p className="text-xs text-muted-foreground font-bold mt-1">سجل الدفعات المستلمة والموقف المالي العام للحساب.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex justify-center w-full sm:w-auto items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-xs rounded-2xl py-3 px-5 hover:opacity-95 transition-all shadow-md shadow-orange-500/20"
        >
          <Plus className="w-4 h-4 md:w-5 md:h-5" />
          <span>تسجيل دفعة جديدة</span>
        </button>
      </div>

      {/* البطاقات الإحصائية الرئيسية */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          className="bg-card border border-border p-6 rounded-3xl shadow-sm hover:border-emerald-500/50 transition-all flex justify-between items-center"
        >
          <div className="space-y-2">
            <span className="text-xs font-bold text-muted-foreground block">إجمالي المبالغ المحصلة</span>
            <h2 className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight dir-ltr text-right">
              <AnimatedNumber value={totalCollected} suffix="د.ع" />
            </h2>
            <span className="inline-block text-[10px] font-extrabold px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              {payments.length} دفعة مستلمة
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-sm shrink-0">
            <Coins className="w-6 h-6" />
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          className="bg-card border border-border p-6 rounded-3xl shadow-sm hover:border-blue-500/50 transition-all flex justify-between items-center"
        >
          <div className="space-y-2">
            <span className="text-xs font-bold text-muted-foreground block">إجمالي الأرباح المتوقعة</span>
            <h2 className="text-2xl md:text-3xl font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight dir-ltr text-right">
              +<AnimatedNumber value={totalExpectedProfit} suffix="د.ع" />
            </h2>
            <span className="inline-block text-[10px] font-extrabold px-2.5 py-1 rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20">
              من كافة العقود
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-blue-500/10 text-blue-600 border border-blue-500/20 shadow-sm shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          className="bg-card border border-border p-6 rounded-3xl shadow-sm hover:border-orange-500/50 transition-all flex justify-between items-center"
        >
          <div className="space-y-2">
            <span className="text-xs font-bold text-muted-foreground block">المتبقي للتقسيط في السوق</span>
            <h2 className="text-2xl md:text-3xl font-black text-foreground font-mono tracking-tight dir-ltr text-right">
              <AnimatedNumber value={totalRemainingDue} suffix="د.ع" />
            </h2>
            <span className="inline-block text-[10px] font-extrabold px-2.5 py-1 rounded-xl bg-orange-500/10 text-orange-600 border border-orange-500/20">
              إجمالي ذمم الأقساط النشطة
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-orange-500/10 text-orange-600 border border-orange-500/20 shadow-sm shrink-0">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </motion.div>
      </div>

      {/* البحث وفلترة المقبوضات */}
      <div className="relative bg-card border border-border rounded-2xl p-2 shadow-sm">
        <div className="flex items-center gap-2 px-3 py-1">
          <Search className="w-5 h-5 text-orange-500 shrink-0" />
          <input
            type="text"
            placeholder="ابحث باسم العميل، المنتج، أو رقم القسط..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs md:text-sm font-bold text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* سجل المقبوضات */}
      <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-500" />
            <h3 className="text-sm md:text-base font-black text-foreground">سجل المقبوضات والدفعات المستلمة</h3>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-xl bg-secondary text-foreground border border-border">
            {filteredPayments.length} سجل
          </span>
        </div>

        {filteredPayments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground font-bold space-y-2">
            <p className="text-sm">لا توجد دفعات مستلمة مسجلة</p>
            <p className="text-xs">اضغط على زر "تسجيل دفعة جديدة" للبدء في تحصيل الأقساط.</p>
          </div>
        ) : (
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right text-xs whitespace-nowrap border-collapse">
              <thead>
                <tr className="border-b border-border/60 text-foreground font-bold text-[11px] bg-secondary/40">
                  <th className="p-3 rounded-r-xl">اسم العميل</th>
                  <th className="p-3">المنتج / القسط</th>
                  <th className="p-3">عن فترة/تاريخ</th>
                  <th className="p-3">المبلغ المستلم</th>
                  <th className="p-3">تاريخ التحصيل</th>
                  <th className="p-3 rounded-l-xl text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-bold">
                {filteredPayments.map((p, idx) => (
                  <tr key={p.id || idx} className="hover:bg-secondary/60 transition-colors group text-foreground">
                    <td className="p-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-orange-500" />
                          <span className="font-bold text-xs text-foreground group-hover:text-orange-500 transition-colors">{p.customerName || "عميل مسجل"}</span>
                        </div>
                        {(p as any).notes && (
                          <span className="text-[10px] text-muted-foreground mt-1 truncate max-w-[200px]" title={(p as any).notes}>ملاحظة: {(p as any).notes}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-bold text-foreground">{p.productName || "قسط"}</td>
                    <td className="p-3 text-foreground font-mono">{(p as any).targetMonth || "-"}</td>
                    <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm dir-ltr text-right">+{p.amount.toLocaleString()} د.ع</td>
                    <td className="p-3 text-foreground font-mono">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-orange-500" />
                        <span>{p.paidAt ? new Date(p.paidAt).toLocaleDateString("ar-IQ", { year: "numeric", month: "numeric", day: "numeric" }) : "غير محدد"}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenEditModal(p)} className="p-1.5 text-blue-600 hover:bg-blue-500/10 rounded-xl transition-colors"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeletePayment(p)} className="p-1.5 text-rose-600 hover:bg-rose-500/10 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🌟 نافذة تسجيل دفعة جديدة */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 md:p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-card border border-border rounded-3xl w-full max-w-lg shadow-2xl p-5 md:p-6 space-y-4 max-h-[90vh] overflow-y-auto relative z-[10000]"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="font-bold text-base md:text-lg text-foreground flex items-center gap-2">
                  <Coins className="w-5 h-5 text-orange-500" />
                  <span>تسجيل دفعة قسط جديدة</span>
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddPayment} className="space-y-4">
                <div className="relative">
                  <label className="block text-xs font-bold text-muted-foreground mb-1">ابحث واختر العميل</label>
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500" />
                    <input
                      type="text"
                      placeholder="اكتب اسم العميل للبحث..."
                      value={customerSearchTerm}
                      onChange={(e) => {
                        setCustomerSearchTerm(e.target.value);
                        setShowCustomerDropdown(true);
                        setSelectedInstallmentId("");
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      className="w-full pr-9 pl-3 p-3 rounded-2xl border border-border bg-background text-foreground text-xs md:text-sm font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                      required
                    />
                  </div>
                  
                  {showCustomerDropdown && (
                    <div className="absolute z-[10001] w-full mt-1 bg-card border border-border rounded-2xl shadow-2xl max-h-48 overflow-y-auto">
                      {filteredInstallmentsForSearch.length > 0 ? (
                        filteredInstallmentsForSearch.map((inst) => (
                          <div
                            key={inst.id}
                            onClick={() => handleInstallmentSelection(inst.id!)}
                            className="p-3 hover:bg-secondary/80 cursor-pointer border-b border-border/40 last:border-0 transition-colors"
                          >
                            <div className="font-bold text-xs flex items-center justify-between text-foreground">
                              <span>{inst.customerName}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-lg bg-orange-500/10 text-orange-500 font-extrabold">
                                {inst.paymentPeriod === "daily" ? "يومي" : inst.paymentPeriod === "weekly" ? "أسبوعي" : "شهري"}
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 font-bold">
                              {inst.productName} (قسط: {Math.round(inst.monthlyInstallment || 0).toLocaleString()} د.ع)
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-center text-xs text-muted-foreground font-bold">لا يوجد عميل بهذا الاسم</div>
                      )}
                    </div>
                  )}
                </div>

                {selectedInstallment && (
                  <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-2xl space-y-1 text-xs">
                    <p className="text-foreground font-bold"><span>اسم العميل:</span> {selectedInstallment.customerName}</p>
                    <p className="text-foreground font-bold"><span>المنتج:</span> {selectedInstallment.productName}</p>
                    <p className="text-orange-500 font-extrabold">المبلغ المفترض: {Math.round(selectedInstallment.monthlyInstallment || 0).toLocaleString()} د.ع</p>
                  </div>
                )}

                <div className="relative">
                  <label className="block text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-orange-500" />
                    <span>الدفعة تخص أي تاريخ / فترة؟ ({periodLabel})</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setShowDatePicker(!showDatePicker);
                      setDatePickerStep("months");
                    }}
                    className="w-full p-3 rounded-2xl border border-border bg-background text-foreground text-xs md:text-sm font-bold flex items-center justify-between hover:border-orange-500/50 transition-all shadow-sm cursor-pointer"
                  >
                    <span className={targetMonth ? "text-foreground font-mono" : "text-muted-foreground"}>
                      {targetMonth ? targetMonth : `اختر تاريخ الاستحقاق الـ${periodLabel}...`}
                    </span>
                    <Calendar className="w-4 h-4 text-orange-500" />
                  </button>

                  <AnimatePresence>
                    {showDatePicker && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute z-[10002] mt-2 w-full bg-card border border-border rounded-3xl p-4 shadow-2xl backdrop-blur-xl space-y-3"
                      >
                        {datePickerStep === "months" && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between border-b border-border/50 pb-2">
                              <button
                                type="button"
                                onClick={() => setSelectedYear((y) => y - 1)}
                                className="p-1.5 rounded-xl bg-secondary hover:bg-orange-500/10 text-foreground hover:text-orange-500 font-bold text-xs flex items-center gap-1"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                                <span>السابقة</span>
                              </button>
                              <span className="font-mono font-bold text-sm text-orange-500">{selectedYear}</span>
                              <button
                                type="button"
                                onClick={() => setSelectedYear((y) => y + 1)}
                                className="p-1.5 rounded-xl bg-secondary hover:bg-orange-500/10 text-foreground hover:text-orange-500 font-bold text-xs flex items-center gap-1"
                              >
                                <span>التالية</span>
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-3 gap-2 pt-1">
                              {[
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
                              ].map((m) => {
                                const monthString = `${selectedYear}-${m.num}`;
                                const isSelected = targetMonth === monthString;
                                return (
                                  <button
                                    key={m.num}
                                    type="button"
                                    onClick={() => {
                                      if (selectedInstallment?.paymentPeriod === "daily" || selectedInstallment?.paymentPeriod === "weekly") {
                                        setSelectedMonthObj(m);
                                        setDatePickerStep("days");
                                      } else {
                                        setTargetMonth(monthString);
                                        setShowDatePicker(false);
                                      }
                                    }}
                                    className={`p-2.5 rounded-2xl text-xs font-bold transition-all ${
                                      isSelected
                                        ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-500/20"
                                        : "bg-secondary/50 hover:bg-orange-500/10 text-foreground hover:text-orange-500"
                                    }`}
                                  >
                                    {m.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {datePickerStep === "days" && selectedMonthObj && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between border-b border-border/50 pb-2">
                              <button
                                type="button"
                                onClick={() => setDatePickerStep("months")}
                                className="p-1 rounded-xl bg-secondary text-foreground hover:text-orange-500 font-bold text-xs flex items-center gap-1"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                                <span>رجوع للأشهر</span>
                              </button>
                              <span className="font-mono font-bold text-xs text-orange-500">
                                {selectedYear} - {selectedMonthObj.name}
                              </span>
                            </div>

                            <p className="text-[10px] text-muted-foreground font-bold text-center">اضغط على اليوم المطلوب للتحديد مباشرة:</p>

                            <div className="grid grid-cols-7 gap-1.5 max-h-48 overflow-y-auto p-1">
                              {Array.from({ length: daysInSelectedMonth }, (_, i) => {
                                const dayNumStr = String(i + 1).padStart(2, "0");
                                const fullDateStr = `${selectedYear}-${selectedMonthObj.num}-${dayNumStr}`;
                                const isSelected = targetMonth === fullDateStr;

                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => {
                                      setTargetMonth(fullDateStr);
                                      setShowDatePicker(false);
                                    }}
                                    className={`p-2 rounded-xl text-xs font-mono font-bold transition-all ${
                                      isSelected
                                        ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-500/20"
                                        : "bg-secondary/60 hover:bg-orange-500/10 text-foreground hover:text-orange-500"
                                    }`}
                                  >
                                    {i + 1}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">المبلغ المستلم (د.ع)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="أدخل قيمة الدفعة المستلمة..."
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value ? Number(e.target.value) : "")}
                    className="w-full p-3 rounded-2xl border border-border bg-background text-foreground text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-orange-500" />
                    <span>ملاحظات الدفعة (اختياري)</span>
                  </label>
                  <textarea
                    placeholder="اكتب أي ملاحظة تخص هذا القسط (مثال: تعثر مالي، تم دفع جزء من المبلغ...)"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    rows={2}
                    className="w-full p-3 rounded-2xl border border-border bg-background text-foreground text-xs outline-none focus:ring-2 focus:ring-orange-500 resize-none font-bold"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 bg-secondary border border-border text-foreground font-bold rounded-2xl hover:bg-secondary/80 transition-colors text-xs"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !selectedInstallmentId}
                    className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl hover:opacity-95 transition-opacity flex items-center justify-center gap-2 text-xs shadow-md shadow-orange-500/20 disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>تأكيد التسديد</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* نافذة تعديل دفعة */}
      <AnimatePresence>
        {isEditModalOpen && editingPayment && (
          <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-3 md:p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-card border border-border rounded-3xl w-full max-w-sm shadow-2xl p-5 md:p-6 space-y-4 relative z-[10000]"
            >
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="font-bold text-base md:text-lg flex items-center gap-2 text-foreground">
                  <Edit className="w-4 h-4 text-blue-500" />
                  <span>تعديل الدفعة المستلمة</span>
                </h3>
                <button onClick={() => setIsEditModalOpen(false)} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEditPayment} className="space-y-4">
                <div className="p-3 bg-secondary/50 rounded-2xl space-y-1 text-xs border border-border/60 font-bold">
                  <p><span className="text-muted-foreground">العميل:</span> {editingPayment.customerName}</p>
                  <p><span className="text-muted-foreground">المنتج:</span> {editingPayment.productName}</p>
                  <p><span className="text-muted-foreground">المبلغ القديم:</span> {editingPayment.amount.toLocaleString()} د.ع</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">المبلغ الجديد الصحيح (د.ع)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={editPaymentAmount}
                    onChange={(e) => setEditPaymentAmount(e.target.value ? Number(e.target.value) : "")}
                    className="w-full p-3 rounded-2xl border border-border bg-background text-foreground text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-2.5 border border-border bg-secondary font-bold rounded-2xl hover:bg-secondary/80 transition-colors text-xs text-foreground"
                    disabled={editSubmitting}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting || editPaymentAmount === editingPayment.amount || !editPaymentAmount}
                    className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-xs disabled:opacity-50 shadow-md shadow-blue-500/20"
                  >
                    {editSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>حفظ التعديل</span>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}