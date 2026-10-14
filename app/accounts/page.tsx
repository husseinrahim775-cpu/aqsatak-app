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
  DollarSign, 
  Wallet, 
  ArrowDownLeft, 
  Loader2, 
  Calendar, 
  Plus, 
  Search, 
  TrendingUp, 
  User, 
  X, 
  CheckCircle2,
  Edit,
  Trash2,
  FileText
} from "lucide-react";
import { toast } from "sonner";

export default function AccountsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [installments, setInstallments] = useState<InstallmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // حالات جديدة لإضافة الدفعة
  const [selectedInstallmentId, setSelectedInstallmentId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [targetMonth, setTargetMonth] = useState(""); 
  
  // حالات خاصة للبحث عن العميل داخل النافذة
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

  // تصفية العملاء داخل قائمة البحث
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

  // تسميات الدورة المالية
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

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 animate-in fade-in duration-500 pb-8 md:pb-12 relative">
      {/* الهيدر وزر إضافة دفعة */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">الحسابات والمدفوعات</h1>
          <p className="text-gray-500 text-xs md:text-sm mt-1">سجل الدفعات المستلمة والموقف المالي العام للحساب.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex justify-center w-full sm:w-auto items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-all font-bold shadow-sm text-sm md:text-base"
        >
          <Plus className="w-4 h-4 md:w-5 md:h-5" />
          <span>تسجيل دفعة جديدة</span>
        </button>
      </div>

      {/* البطاقات الإحصائية الرئيسية */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-card border border-border p-4 md:p-6 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] md:text-xs font-medium text-gray-500 mb-1">إجمالي المبالغ المحصلة</p>
            <p className="text-lg md:text-2xl font-extrabold text-green-600 dark:text-green-400">
              {totalCollected.toLocaleString()} د.ع
            </p>
            <p className="text-[10px] md:text-xs text-gray-400 mt-0.5 md:mt-1">{payments.length} دفعة مستلمة</p>
          </div>
          <div className="p-3 md:p-4 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl md:rounded-2xl">
            <Wallet className="w-5 h-5 md:w-7 md:h-7" />
          </div>
        </div>

        <div className="bg-card border border-border p-4 md:p-6 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] md:text-xs font-medium text-gray-500 mb-1">إجمالي الأرباح المتوقعة</p>
            <p className="text-lg md:text-2xl font-extrabold text-primary">
              +{totalExpectedProfit.toLocaleString()} د.ع
            </p>
            <p className="text-[10px] md:text-xs text-gray-400 mt-0.5 md:mt-1">من كافة العقود</p>
          </div>
          <div className="p-3 md:p-4 bg-primary/10 text-primary rounded-xl md:rounded-2xl">
            <TrendingUp className="w-5 h-5 md:w-7 md:h-7" />
          </div>
        </div>

        <div className="bg-card border border-border p-4 md:p-6 rounded-2xl shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] md:text-xs font-medium text-gray-500 mb-1">المتبقي للتقسيط في السوق</p>
            <p className="text-lg md:text-2xl font-extrabold text-foreground">
              {totalRemainingDue.toLocaleString()} د.ع
            </p>
            <p className="text-[10px] md:text-xs text-gray-400 mt-0.5 md:mt-1">إجمالي ذمم الأقساط النشطة</p>
          </div>
          <div className="p-3 md:p-4 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl md:rounded-2xl">
            <ArrowDownLeft className="w-5 h-5 md:w-7 md:h-7" />
          </div>
        </div>
      </div>

      {/* البحث وفلترة المقبوضات */}
      <div className="relative">
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
        <input
          type="text"
          placeholder="ابحث باسم العميل، المنتج، أو رقم القسط..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pr-10 pl-4 py-2.5 md:py-3 text-sm md:text-base bg-card border border-border rounded-xl text-foreground placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* سجل المقبوضات */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 md:p-5 border-b border-border bg-background/50 flex items-center justify-between">
          <h2 className="font-bold text-base md:text-lg flex items-center gap-2">
            <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            <span>سجل المقبوضات والدفعات المستلمة</span>
          </h2>
          <span className="text-[10px] md:text-xs text-gray-500 font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
            {filteredPayments.length} سجل
          </span>
        </div>

        {loading ? (
          <div className="p-8 md:p-12 text-center text-gray-500 flex justify-center items-center gap-2">
            <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin text-primary" />
            <span className="text-sm md:text-base">جاري تحميل سجل المدفوعات...</span>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-8 md:p-12 text-center text-gray-500 space-y-2">
            <p className="font-bold text-sm md:text-base">لا توجد دفعات مستلمة مسجلة</p>
            <p className="text-[10px] md:text-xs">اضغط على زر "تسجيل دفعة جديدة" للبدء في تحصيل الأقساط.</p>
          </div>
        ) : (
          <>
            {/* العرض الخاص بالهاتف */}
            <div className="block md:hidden divide-y divide-border">
              {filteredPayments.map((p, idx) => (
                <div key={p.id || idx} className="p-4 space-y-3 bg-background/30 hover:bg-background/50 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      <span className="font-bold text-sm text-foreground">{p.customerName || "عميل مسجل"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleOpenEditModal(p)} className="p-1.5 text-blue-600 bg-blue-50 dark:bg-blue-900/30 rounded-md">
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeletePayment(p)} className="p-1.5 text-red-600 bg-red-50 dark:bg-red-900/30 rounded-md">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">{p.productName || "قسط"}</span>
                    <span className="font-extrabold text-green-600 dark:text-green-400 text-sm">+{p.amount.toLocaleString()} د.ع</span>
                  </div>
                  {(p as any).targetMonth && (
                    <div className="text-[10px] text-gray-500">فترة الاستحقاق: <span className="font-bold">{(p as any).targetMonth}</span></div>
                  )}
                  {(p as any).notes && (
                    <div className="text-[10px] text-gray-500 bg-gray-50 dark:bg-gray-800 p-1.5 rounded truncate">ملاحظة: {(p as any).notes}</div>
                  )}
                  <div className="flex justify-between items-center text-[10px] text-gray-500 pt-2 border-t border-border">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>
                        {p.paidAt ? new Date(p.paidAt).toLocaleDateString("ar-IQ", { year: "numeric", month: "numeric", day: "numeric" }) : "غير محدد"}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full font-bold">
                      <CheckCircle2 className="w-3 h-3" /> تم القبض
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* العرض الخاص بالديسكتوب */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-sm whitespace-nowrap">
                <thead className="bg-background/50 text-gray-500 border-b border-border">
                  <tr>
                    <th className="p-4 font-medium">اسم العميل</th>
                    <th className="p-4 font-medium">المنتج / القسط</th>
                    <th className="p-4 font-medium">عن فترة/تاريخ</th>
                    <th className="p-4 font-medium">المبلغ المستلم</th>
                    <th className="p-4 font-medium">تاريخ التحصيل</th>
                    <th className="p-4 font-medium text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPayments.map((p, idx) => (
                    <tr key={p.id || idx} className="hover:bg-background/40 transition-colors group">
                      <td className="p-4 font-bold text-foreground">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-primary" />
                            <span>{p.customerName || "عميل مسجل"}</span>
                          </div>
                          {(p as any).notes && (
                            <span className="text-[10px] text-gray-400 mt-1 truncate max-w-[150px]" title={(p as any).notes}>ملاحظة: {(p as any).notes}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-medium text-gray-600 dark:text-gray-300">
                        {p.productName || "قسط"}
                      </td>
                      <td className="p-4 font-bold text-gray-600 dark:text-gray-300">
                        {(p as any).targetMonth || "-"}
                      </td>
                      <td className="p-4 font-extrabold text-green-600 dark:text-green-400 text-base">
                        +{p.amount.toLocaleString()} د.ع
                      </td>
                      <td className="p-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span>
                            {p.paidAt
                              ? new Date(p.paidAt).toLocaleDateString("ar-IQ", {
                                  year: "numeric",
                                  month: "numeric",
                                  day: "numeric",
                                })
                              : "غير محدد"}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleOpenEditModal(p)} 
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                            title="تعديل مبلغ الدفعة"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeletePayment(p)} 
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                            title="حذف الدفعة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* نافذة تسجيل دفعة جديدة (Modal) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl p-4 md:p-6 space-y-4 md:space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base md:text-lg text-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                <span>تسجيل دفعة قسط جديدة</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-border/50 text-gray-400 hover:text-foreground"
              >
                <X className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPayment} className="space-y-3 md:space-y-4">
              {/* حقل البحث واختيار العميل */}
              <div className="relative">
                <label className="block text-[10px] md:text-xs font-bold text-gray-500 mb-1">ابحث واختر العميل</label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                    className="w-full pr-9 pl-3 p-2.5 md:p-3 rounded-xl border border-border bg-background text-foreground text-xs md:text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                    required
                  />
                </div>
                
                {/* القائمة المنسدلة للبحث */}
                {showCustomerDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filteredInstallmentsForSearch.length > 0 ? (
                      filteredInstallmentsForSearch.map((inst) => {
                        const instPeriodLabel = inst.paymentPeriod === "daily" ? "يومي" : inst.paymentPeriod === "weekly" ? "أسبوعي" : "شهري";
                        return (
                          <div
                            key={inst.id}
                            onClick={() => handleInstallmentSelection(inst.id!)}
                            className="p-3 hover:bg-primary/10 cursor-pointer border-b border-border last:border-0 transition-colors"
                          >
                            <div className="font-bold text-sm flex items-center justify-between">
                              <span>{inst.customerName}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{instPeriodLabel}</span>
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {inst.productName} (قسط {instPeriodLabel}: {Math.round(inst.monthlyInstallment || 0).toLocaleString()} د.ع)
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 text-center text-xs text-gray-500">لا يوجد عميل بهذا الاسم</div>
                    )}
                  </div>
                )}
              </div>

              {selectedInstallment && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl space-y-1 text-[10px] md:text-xs">
                  <p className="text-foreground">
                    <span className="font-bold">اسم العميل:</span> {selectedInstallment.customerName}
                  </p>
                  <p className="text-foreground">
                    <span className="font-bold">المنتج:</span> {selectedInstallment.productName}
                  </p>
                  <p className="text-primary font-bold">
                    المبلغ الـ{periodLabel} المفترض: {Math.round(selectedInstallment.monthlyInstallment || 0).toLocaleString()} د.ع
                  </p>
                </div>
              )}

              {/* حقل اختيار تاريخ/فترة الاستحقاق الديناميكية */}
              <div>
                <label className="block text-[10px] md:text-xs font-bold text-gray-500 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>الدفعة تخص أي تاريخ / فترة؟ ({periodLabel})</span>
                </label>
                {selectedInstallment?.paymentPeriod === "daily" || selectedInstallment?.paymentPeriod === "weekly" ? (
                  <input
                    type="date"
                    value={targetMonth}
                    onChange={(e) => setTargetMonth(e.target.value)}
                    className="w-full p-2.5 md:p-3 rounded-xl border border-border bg-background text-foreground text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none"
                  />
                ) : (
                  <input
                    type="month"
                    value={targetMonth}
                    onChange={(e) => setTargetMonth(e.target.value)}
                    className="w-full p-2.5 md:p-3 rounded-xl border border-border bg-background text-foreground text-sm font-bold focus:ring-2 focus:ring-primary/50 outline-none"
                  />
                )}
              </div>

              {/* حقل المبلغ */}
              <div>
                <label className="block text-[10px] md:text-xs font-bold text-gray-500 mb-1">المبلغ المستلم (د.ع)</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="أدخل قيمة الدفعة المستلمة..."
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value ? Number(e.target.value) : "")}
                  className="w-full p-2.5 md:p-3 rounded-xl border border-border bg-background text-foreground text-sm md:text-base font-bold focus:ring-2 focus:ring-primary/50 outline-none"
                />
              </div>

              {/* حقل الملاحظات */}
              <div>
                <label className="block text-[10px] md:text-xs font-bold text-gray-500 mb-1 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  <span>ملاحظات الدفعة (اختياري)</span>
                </label>
                <textarea
                  placeholder="اكتب أي ملاحظة تخص هذا القسط (مثال: تعثر مالي، تم دفع جزء من المبلغ...)"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 md:p-3 rounded-xl border border-border bg-background text-foreground text-xs md:text-sm focus:ring-2 focus:ring-primary/50 outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex gap-2 md:gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 md:py-3 bg-card border border-border text-foreground font-bold rounded-xl hover:bg-border/50 transition-colors text-xs md:text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedInstallmentId}
                  className="flex-1 py-2.5 md:py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 text-xs md:text-sm shadow-md disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />}
                  <span>تأكيد التسديد</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة تعديل دفعة (Edit Modal) */}
      {isEditModalOpen && editingPayment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-4">
          <div className="bg-background border border-border rounded-2xl w-full max-w-sm shadow-2xl p-4 md:p-6 space-y-4 md:space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-base md:text-lg flex items-center gap-2">
                <Edit className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                <span>تعديل الدفعة المستلمة</span>
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg hover:bg-border/50 text-gray-400"
              >
                <X className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditPayment} className="space-y-3 md:space-y-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-xl space-y-1 text-[10px] md:text-xs border border-border">
                <p><span className="font-bold text-gray-500">العميل:</span> {editingPayment.customerName}</p>
                <p><span className="font-bold text-gray-500">المنتج:</span> {editingPayment.productName}</p>
                <p><span className="font-bold text-gray-500">المبلغ القديم:</span> {editingPayment.amount.toLocaleString()} د.ع</p>
              </div>

              <div>
                <label className="block text-[10px] md:text-xs font-bold text-gray-500 mb-1">المبلغ الجديد الصحيح (د.ع)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={editPaymentAmount}
                  onChange={(e) => setEditPaymentAmount(e.target.value ? Number(e.target.value) : "")}
                  className="w-full p-2.5 md:p-3 rounded-xl border border-border bg-background text-foreground text-sm md:text-base font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2 md:gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2 md:py-2.5 border border-border font-bold rounded-xl hover:bg-border/50 transition-colors text-xs md:text-sm"
                  disabled={editSubmitting}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting || editPaymentAmount === editingPayment.amount || !editPaymentAmount}
                  className="flex-1 py-2 md:py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-xs md:text-sm disabled:opacity-50"
                >
                  {editSubmitting ? <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" /> : <span>حفظ التعديل</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}