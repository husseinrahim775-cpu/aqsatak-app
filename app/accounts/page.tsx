"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
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
  ArrowRight,
  CreditCard,
  QrCode,
  Layers,
  Filter
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import { useTheme } from "next-themes";

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

export default function AccountsPage() {
  const searchParams = useSearchParams();
  const { user, userData } = useAuth() as any;
  const { theme } = useTheme();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [installments, setInstallments] = useState<InstallmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // 🔒 فحص الصلاحيات الأمنية
  const isEmployee = userData?.role === "employee";
  const canDeleteOrEdit = !isEmployee || !!userData?.permissions?.canDeleteOrEdit;

  // 🎯 الفلترة الزمنية للجدول الرئيسية
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month" | "custom_single" | "custom_range">("all");
  
  // فلترة بتاريخ معين
  const [filterSingleDate, setFilterSingleDate] = useState("");
  const [showFilterSinglePicker, setShowFilterSinglePicker] = useState(false);
  const [filterSingleYear, setFilterSingleYear] = useState(new Date().getFullYear());
  const [filterSingleMonthObj, setFilterSingleMonthObj] = useState<{ num: string; name: string } | null>({
    num: String(new Date().getMonth() + 1).padStart(2, "0"),
    name: `شهر ${new Date().getMonth() + 1}`
  });
  const [filterSingleStep, setFilterSingleStep] = useState<"months" | "days">("months");

  // فلترة بنطاق زمني (من تاريخ - إلى تاريخ)
  const [filterRangeStart, setFilterRangeStart] = useState("");
  const [filterRangeEnd, setFilterRangeEnd] = useState("");
  
  const [showFilterStartPicker, setShowFilterStartPicker] = useState(false);
  const [filterStartYear, setFilterStartYear] = useState(new Date().getFullYear());
  const [filterStartMonthObj, setFilterStartMonthObj] = useState<{ num: string; name: string } | null>({
    num: String(new Date().getMonth() + 1).padStart(2, "0"),
    name: `شهر ${new Date().getMonth() + 1}`
  });
  const [filterStartStep, setFilterStartStep] = useState<"months" | "days">("months");

  const [showFilterEndPicker, setShowFilterEndPicker] = useState(false);
  const [filterEndYear, setFilterEndYear] = useState(new Date().getFullYear());
  const [filterEndMonthObj, setFilterEndMonthObj] = useState<{ num: string; name: string } | null>({
    num: String(new Date().getMonth() + 1).padStart(2, "0"),
    name: `شهر ${new Date().getMonth() + 1}`
  });
  const [filterEndStep, setFilterEndStep] = useState<"months" | "days">("months");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [posStatusText, setPosStatusText] = useState("");
  
  const [selectedInstallmentId, setSelectedInstallmentId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState<number | "">("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [targetMonth, setTargetMonth] = useState(""); 
  
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "pos" | "transfer">("cash");
  const [paymentMode, setPaymentMode] = useState<"single" | "range">("single");
  const [rangeStartDate, setRangeStartDate] = useState("");
  const [rangeEndDate, setRangeEndDate] = useState("");

  // التقويم التفاعلي الموحد (للقسط الواحد)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthObj, setSelectedMonthObj] = useState<{ num: string; name: string } | null>({
    num: String(new Date().getMonth() + 1).padStart(2, "0"),
    name: `شهر ${new Date().getMonth() + 1}`
  });
  const [datePickerStep, setDatePickerStep] = useState<"months" | "days">("months");

  // التقويم التفاعلي الموحد (لتاريخ البداية "من")
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [startMonthObj, setStartMonthObj] = useState<{ num: string; name: string } | null>({
    num: String(new Date().getMonth() + 1).padStart(2, "0"),
    name: `شهر ${new Date().getMonth() + 1}`
  });
  const [startPickerStep, setStartPickerStep] = useState<"months" | "days">("months");

  // التقويم التفاعلي الموحد (لتاريخ النهاية "إلى")
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [endMonthObj, setEndMonthObj] = useState<{ num: string; name: string } | null>({
    num: String(new Date().getMonth() + 1).padStart(2, "0"),
    name: `شهر ${new Date().getMonth() + 1}`
  });
  const [endPickerStep, setEndPickerStep] = useState<"months" | "days">("months");

  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState<number | "">("");

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

  const handleInstallmentSelection = useCallback((id: string, amountOverride?: number, dateOverride?: string) => {
    setSelectedInstallmentId(id);
    const inst = installments.find((i) => i.id === id);
    if (inst) {
      setPaymentAmount(amountOverride !== undefined ? amountOverride : Math.round(inst.monthlyInstallment || 0));
      setCustomerSearchTerm(`${inst.customerName} - ${inst.productName}`);
      if (dateOverride) setTargetMonth(dateOverride);

      const step = (inst.paymentPeriod === "daily" || inst.paymentPeriod === "weekly") ? "days" : "months";
      setDatePickerStep(step);
      setStartPickerStep(step);
      setEndPickerStep(step);
    }
    setShowCustomerDropdown(false);
  }, [installments]);

  // 🚀 التفعيل والفتح التلقائي للمودال عند الانتقال المباشر من زر "تسديد"
  useEffect(() => {
    const autoOpen = searchParams.get("autoOpen");
    const payInstId = searchParams.get("payInstId");
    const targetDate = searchParams.get("targetDate");
    const amountParam = searchParams.get("amount");

    if (autoOpen === "true" && payInstId && !loading) {
      const amountVal = amountParam ? Number(amountParam) : undefined;
      const dateVal = targetDate || "";

      setPaymentNotes("");
      setPaymentMethod("cash");
      setPaymentMode("single");
      setRangeStartDate("");
      setRangeEndDate("");
      setPosStatusText("");
      setShowCustomerDropdown(false);

      if (installments.length > 0) {
        handleInstallmentSelection(payInstId, amountVal, dateVal);
      } else {
        setSelectedInstallmentId(payInstId);
        if (amountVal !== undefined) setPaymentAmount(amountVal);
        if (dateVal) setTargetMonth(dateVal);
      }

      setIsModalOpen(true);
    }
  }, [searchParams, loading, installments, handleInstallmentSelection]);

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    let result = payments.filter((p) => {
      const matchSearch =
        (p.customerName && p.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.productName && p.productName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.installmentId && p.installmentId.includes(searchQuery));

      if (!matchSearch) return false;

      if (!p.paidAt) return dateFilter === "all";
      const pDate = new Date(p.paidAt);

      if (dateFilter === "today") {
        return pDate >= today;
      } else if (dateFilter === "week") {
        return pDate >= startOfWeek;
      } else if (dateFilter === "month") {
        return pDate >= startOfMonth;
      } else if (dateFilter === "custom_single") {
        if (!filterSingleDate) return true;
        const targetStr = pDate.toISOString().split("T")[0];
        return targetStr === filterSingleDate;
      } else if (dateFilter === "custom_range") {
        if (!filterRangeStart && !filterRangeEnd) return true;
        const targetTime = pDate.getTime();
        const startTime = filterRangeStart ? new Date(filterRangeStart).setHours(0, 0, 0, 0) : 0;
        const endTime = filterRangeEnd ? new Date(filterRangeEnd).setHours(23, 59, 59, 999) : Infinity;
        return targetTime >= startTime && targetTime <= endTime;
      }

      return true;
    });

    return result.sort((a, b) => {
      const timeA = a.paidAt ? new Date(a.paidAt).getTime() : 0;
      const timeB = b.paidAt ? new Date(b.paidAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [payments, searchQuery, dateFilter, filterSingleDate, filterRangeStart, filterRangeEnd]);

  const currentFilteredSum = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [filteredPayments]);

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

  const calculateRangePeriods = useCallback((startStr: string, endStr: string) => {
    if (!startStr || !endStr || !selectedInstallment) return [];
    
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (start > end) return [];

    const period = selectedInstallment.paymentPeriod || "monthly";
    const dates: string[] = [];
    const curr = new Date(start);

    while (curr <= end) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');

      if (period === "monthly") {
        dates.push(`${y}-${m}`);
        curr.setMonth(curr.getMonth() + 1);
      } else if (period === "weekly") {
        dates.push(`${y}-${m}-${d}`);
        curr.setDate(curr.getDate() + 7);
      } else {
        dates.push(`${y}-${m}-${d}`);
        curr.setDate(curr.getDate() + 1);
      }
    }
    return dates;
  }, [selectedInstallment]);

  useEffect(() => {
    if (paymentMode === "range" && rangeStartDate && rangeEndDate && selectedInstallment) {
      const periods = calculateRangePeriods(rangeStartDate, rangeEndDate);
      if (periods.length > 0) {
        const totalCalc = Math.round(selectedInstallment.monthlyInstallment * periods.length);
        setPaymentAmount(totalCalc);
      }
    }
  }, [paymentMode, rangeStartDate, rangeEndDate, selectedInstallment, calculateRangePeriods]);

  const handleOpenModal = (installmentId?: string) => {
    setPaymentNotes("");
    setTargetMonth("");
    setCustomerSearchTerm("");
    setShowCustomerDropdown(false);
    setShowDatePicker(false);
    setShowStartPicker(false);
    setShowEndPicker(false);
    
    setDatePickerStep("months");
    setStartPickerStep("months");
    setEndPickerStep("months");

    setSelectedMonthObj({
      num: String(new Date().getMonth() + 1).padStart(2, "0"),
      name: `شهر ${new Date().getMonth() + 1}`
    });
    setStartMonthObj({
      num: String(new Date().getMonth() + 1).padStart(2, "0"),
      name: `شهر ${new Date().getMonth() + 1}`
    });
    setEndMonthObj({
      num: String(new Date().getMonth() + 1).padStart(2, "0"),
      name: `شهر ${new Date().getMonth() + 1}`
    });

    setPaymentMethod("cash");
    setPaymentMode("single");
    setRangeStartDate("");
    setRangeEndDate("");
    setPosStatusText("");

    if (installmentId) {
      handleInstallmentSelection(installmentId);
    } else {
      setSelectedInstallmentId("");
      setPaymentAmount("");
    }
    setIsModalOpen(true);
  };

  const triggerPosPayment = async (amount: number, customerName: string): Promise<{ success: boolean; txnId?: string; error?: string }> => {
    try {
      setPosStatusText(`جاري إرسال الطلب لجهاز POS... المرجو تمرير بطاقة العميل للمبلغ (${amount.toLocaleString()} د.ع)`);
      
      const response = await fetch("/api/pos/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, customerName, userId: user?.uid }),
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, txnId: data.transactionId };
      } else {
        const errData = await response.json().catch(() => ({}));
        return { success: false, error: errData.message || "فشلت عملية الدفع على جهاز POS أو تم الغاؤها." };
      }
    } catch (e) {
      return { 
        success: false, 
        error: "لم يتم العثور على جهاز POS مربوط بالنظام! يرجى الربط من الإعدادات أو اختيار طريقة دفع نقدي." 
      };
    }
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
      let posTxnDetails = "";

      if (paymentMethod === "pos") {
        const posResult = await triggerPosPayment(Number(paymentAmount), inst?.customerName || "عميل");
        
        if (!posResult.success) {
          toast.error(posResult.error || "خطأ في عملية الـ POS.");
          setSubmitting(false);
          setPosStatusText("");
          return;
        }

        posTxnDetails = `[دفع إلكتروني POS - رقم العملية: ${posResult.txnId}]`;
        toast.success(`تم استلام المبلغ بنجاح عبر جهاز POS! (${Number(paymentAmount).toLocaleString()} د.ع)`);
      }

      const methodText = paymentMethod === "pos" ? posTxnDetails : paymentMethod === "transfer" ? "[تحويل مالي/زين كاش]" : "[دفع نقدي]";
      const combinedNotes = paymentNotes ? `${methodText} ${paymentNotes}` : methodText;

      if (paymentMode === "range" && rangeStartDate && rangeEndDate) {
        const periods = calculateRangePeriods(rangeStartDate, rangeEndDate);
        if (periods.length === 0) {
          toast.error("يرجى التأكد من أن تاريخ البداية أقدم من تاريخ النهاية.");
          setSubmitting(false);
          setPosStatusText("");
          return;
        }

        const singlePeriodAmount = Math.round(Number(paymentAmount) / periods.length);

        for (const pDate of periods) {
          await addPaymentRecord({
            userId: user.uid,
            installmentId: selectedInstallmentId,
            customerName: inst?.customerName || "غير محدد",
            productName: inst?.productName || "غير محدد",
            amount: singlePeriodAmount,
            paidAt: new Date().toISOString(),
            targetMonth: pDate,
            notes: `${combinedNotes} (تسديد دفعة فترة ${pDate})`,
          });
        }
        toast.success(`تم تسجيل ${periods.length} دفعات بنجاح من (${rangeStartDate}) إلى (${rangeEndDate})!`);
      } else {
        const amountNum = Number(paymentAmount);
        await addPaymentRecord({
          userId: user.uid,
          installmentId: selectedInstallmentId,
          customerName: inst?.customerName || "غير محدد",
          productName: inst?.productName || "غير محدد",
          amount: amountNum,
          paidAt: new Date().toISOString(),
          targetMonth: targetMonth || undefined,
          notes: combinedNotes,
        });
        if (paymentMethod !== "pos") {
          toast.success("تم تسجيل الدفعة بنجاح!");
        }
      }

      setIsModalOpen(false);
      await fetchData();
    } catch (error) {
      console.error("خطأ أثناء تسجيل الدفعة:", error);
      toast.error("حدث خطأ أثناء حفظ الدفعة، يرجى إعادة المحاولة.");
    } finally {
      setSubmitting(false);
      setPosStatusText("");
    }
  };

  const handleDeletePayment = async (p: PaymentRecord) => {
    if (!canDeleteOrEdit) {
      toast.error("عذراً، لا تملك صلاحية حذف الدفعات. يرجى مراجعة إدارة النظام.");
      return;
    }

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
    if (!canDeleteOrEdit) {
      toast.error("عذراً، لا تملك صلاحية تعديل الدفعات. يرجى مراجعة إدارة النظام.");
      return;
    }

    setEditingPayment(p);
    setEditPaymentAmount(p.amount);
    setIsEditModalOpen(true);
  };

  const handleSaveEditPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDeleteOrEdit) {
      toast.error("عذراً، لا تملك صلاحية تعديل الدفعات.");
      return;
    }

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

  const daysInSingleMonth = useMemo(() => getDaysInMonth(selectedYear, selectedMonthObj?.num), [selectedYear, selectedMonthObj]);
  const daysInStartMonth = useMemo(() => getDaysInMonth(startYear, startMonthObj?.num), [startYear, startMonthObj]);
  const daysInEndMonth = useMemo(() => getDaysInMonth(endYear, endMonthObj?.num), [endYear, endMonthObj]);

  const daysInFilterSingle = useMemo(() => getDaysInMonth(filterSingleYear, filterSingleMonthObj?.num), [filterSingleYear, filterSingleMonthObj]);
  const daysInFilterStart = useMemo(() => getDaysInMonth(filterStartYear, filterStartMonthObj?.num), [filterStartYear, filterStartMonthObj]);
  const daysInFilterEnd = useMemo(() => getDaysInMonth(filterEndYear, filterEndMonthObj?.num), [filterEndYear, filterEndMonthObj]);

  if (loading) {
    return (
      <div className="h-[75vh] flex flex-col items-center justify-center gap-3 text-primary">
        <Loader2 className="w-10 h-10 animate-spin" />
        <span className="text-xs font-bold text-muted-foreground animate-pulse">جاري تحميل سجل الحسابات ...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 font-sans dir-rtl text-right relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">الحسابات والمدفوعات 💳</h1>
          <p className="text-xs text-muted-foreground font-bold mt-1">سجل الدفعات المستلمة والموقف المالي العام للحساب.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
className="flex justify-center w-full sm:w-auto items-center gap-2 bg-theme-gradient text-white font-bold text-xs rounded-2xl py-3 px-5 hover:opacity-95 transition-all shadow-md shadow-primary/20 cursor-pointer"        >
          <Plus className="w-4 h-4 md:w-5 md:h-5" />
          <span>تسجيل دفعة جديدة</span>
        </button>
      </div>

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
          className="bg-card border border-border p-6 rounded-3xl shadow-sm hover:border-primary/50 transition-all flex justify-between items-center"
        >
          <div className="space-y-2">
            <span className="text-xs font-bold text-muted-foreground block">المتبقي للتقسيط في السوق</span>
            <h2 className="text-2xl md:text-3xl font-black text-foreground font-mono tracking-tight dir-ltr text-right">
              <AnimatedNumber value={totalRemainingDue} suffix="د.ع" />
            </h2>
            <span className="inline-block text-[10px] font-extrabold px-2.5 py-1 rounded-xl bg-primary/10 text-primary border border-primary/20">
              إجمالي ذمم الأقساط النشطة
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-sm shrink-0">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </motion.div>
      </div>

      <div className="relative bg-card border border-border rounded-2xl p-2 shadow-sm">
        <div className="flex items-center gap-2 px-3 py-1">
          <Search className="w-5 h-5 text-primary shrink-0" />
          <input
            type="text"
            placeholder="ابحث باسم العميل، المنتج، أو رقم القسط..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs md:text-sm font-bold text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-border/80 pb-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-500" />
            <h3 className="text-sm md:text-base font-black text-foreground">سجل المقبوضات والدفعات المستلمة</h3>
            <span className="text-xs font-bold px-3 py-1 rounded-xl bg-secondary text-foreground border border-border">
              {filteredPayments.length} سجل
            </span>
          </div>

          {/* 🎯 خيارات الفلترة المتقدمة */}
          <div className="flex flex-wrap items-center gap-1.5 bg-secondary/60 p-1.5 rounded-2xl border border-border w-full lg:w-auto">
            <button
              onClick={() => {
                setDateFilter("all");
                setShowFilterSinglePicker(false);
                setShowFilterStartPicker(false);
                setShowFilterEndPicker(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateFilter === "all" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              الكل ({payments.length})
            </button>
            
            <button
              onClick={() => {
                setDateFilter("today");
                setShowFilterSinglePicker(false);
                setShowFilterStartPicker(false);
                setShowFilterEndPicker(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateFilter === "today" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              اليوم 📅
            </button>
            
            <button
              onClick={() => {
                setDateFilter("week");
                setShowFilterSinglePicker(false);
                setShowFilterStartPicker(false);
                setShowFilterEndPicker(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateFilter === "week" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              هذا الأسبوع 🗓️
            </button>
            
            <button
              onClick={() => {
                setDateFilter("month");
                setShowFilterSinglePicker(false);
                setShowFilterStartPicker(false);
                setShowFilterEndPicker(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateFilter === "month" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              هذا الشهر 📊
            </button>

            <button
              onClick={() => {
                setDateFilter("custom_single");
                setFilterSingleStep("months");
                setShowFilterStartPicker(false);
                setShowFilterEndPicker(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                dateFilter === "custom_single" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>تاريخ معين</span>
            </button>

            <button
              onClick={() => {
                setDateFilter("custom_range");
                setFilterStartStep("months");
                setFilterEndStep("months");
                setShowFilterSinglePicker(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                dateFilter === "custom_range" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>من - إلى</span>
            </button>
          </div>
        </div>

        {/* 📅 عناصر اختيار التاريخ للتاريخ المعين */}
        {dateFilter === "custom_single" && (
          <div className="p-3 bg-secondary/40 border border-border rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-primary" />
                <span>اختر تاريخاً محدداً لفلترة مقبوضاته:</span>
              </span>
              {filterSingleDate && (
                <button
                  onClick={() => setFilterSingleDate("")}
                  className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                >
                  إلغاء التحديد
                </button>
              )}
            </div>

            <div className="relative max-w-xs">
              <button
                type="button"
                onClick={() => {
                  setShowFilterSinglePicker(!showFilterSinglePicker);
                  setFilterSingleStep("months");
                }}
                className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground text-xs font-bold flex items-center justify-between hover:border-primary/50 transition-all shadow-sm cursor-pointer"
              >
                <span className={filterSingleDate ? "text-foreground font-mono" : "text-muted-foreground"}>
                  {filterSingleDate ? filterSingleDate : "اضغط لاختيار التاريخ..."}
                </span>
                <Calendar className="w-4 h-4 text-primary" />
              </button>

              <AnimatePresence>
                {showFilterSinglePicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute z-[10002] mt-2 w-72 right-0 bg-card border border-border rounded-3xl p-4 shadow-2xl backdrop-blur-xl space-y-3"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <button
                          type="button"
                          onClick={() => setFilterSingleYear((y) => y - 1)}
                          className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs cursor-pointer"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        
                        <div className="flex items-center gap-1 font-mono font-bold text-xs text-primary">
                          <span>{filterSingleYear}</span>
                          {filterSingleMonthObj && filterSingleStep === "days" && (
                            <span>- {filterSingleMonthObj.num}</span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setFilterSingleYear((y) => y + 1)}
                          className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {filterSingleStep === "days" ? (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center px-1 text-[11px]">
                            <span className="font-bold text-muted-foreground">اختر اليوم:</span>
                            <button
                              type="button"
                              onClick={() => setFilterSingleStep("months")}
                              className="text-primary hover:underline font-bold text-[10px] cursor-pointer"
                            >
                              تغيير الشهر ({filterSingleMonthObj?.name || "اختر"})
                            </button>
                          </div>
                          <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto pt-1">
                            {daysInFilterSingle.map((dayNum) => {
                              const dateString = `${filterSingleYear}-${filterSingleMonthObj?.num || "01"}-${dayNum}`;
                              const isSelected = filterSingleDate === dateString;
                              return (
                                <button
                                  key={dayNum}
                                  type="button"
                                  onClick={() => {
                                    setFilterSingleDate(dateString);
                                    setShowFilterSinglePicker(false);
                                  }}
                                  className={`p-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20"
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
                            return (
                              <button
                                key={m.num}
                                type="button"
                                onClick={() => {
                                  setFilterSingleMonthObj(m);
                                  setFilterSingleStep("days");
                                }}
                                className="p-2 rounded-xl text-xs font-bold transition-all bg-secondary/50 hover:bg-primary/10 text-foreground hover:text-primary cursor-pointer"
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

        {/* 📅 عناصر اختيار نطاق زمني (من تاريخ - إلى تاريخ) */}
        {dateFilter === "custom_range" && (
          <div className="p-3 bg-secondary/40 border border-border rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-primary" />
                <span>اختر النطاق الزمني المطلوبة لفلترة المقبوضات:</span>
              </span>
              {(filterRangeStart || filterRangeEnd) && (
                <button
                  onClick={() => {
                    setFilterRangeStart("");
                    setFilterRangeEnd("");
                  }}
                  className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                >
                  إعادة ضبط النطاق
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* من تاريخ */}
              <div className="relative">
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">من تاريخ</label>
                <button
                  type="button"
                  onClick={() => {
                    setShowFilterStartPicker(!showFilterStartPicker);
                    setFilterStartStep("months");
                    setShowFilterEndPicker(false);
                  }}
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground text-xs font-bold flex items-center justify-between hover:border-primary/50 transition-all shadow-sm cursor-pointer"
                >
                  <span className={filterRangeStart ? "text-foreground font-mono" : "text-muted-foreground"}>
                    {filterRangeStart ? filterRangeStart : "اختر تاريخ البداية..."}
                  </span>
                  <Calendar className="w-4 h-4 text-primary" />
                </button>

                <AnimatePresence>
                  {showFilterStartPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute z-[10002] mt-2 w-72 right-0 bg-card border border-border rounded-3xl p-4 shadow-2xl backdrop-blur-xl space-y-3"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                          <button
                            type="button"
                            onClick={() => setFilterStartYear((y) => y - 1)}
                            className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          
                          <div className="flex items-center gap-1 font-mono font-bold text-xs text-primary">
                            <span>{filterStartYear}</span>
                            {filterStartMonthObj && filterStartStep === "days" && (
                              <span>- {filterStartMonthObj.num}</span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setFilterStartYear((y) => y + 1)}
                            className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {filterStartStep === "days" ? (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center px-1 text-[11px]">
                              <span className="font-bold text-muted-foreground">اختر اليوم:</span>
                              <button
                                type="button"
                                onClick={() => setFilterStartStep("months")}
                                className="text-primary hover:underline font-bold text-[10px] cursor-pointer"
                              >
                                تغيير الشهر ({filterStartMonthObj?.name || "اختر"})
                              </button>
                            </div>
                            <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto pt-1">
                              {daysInFilterStart.map((dayNum) => {
                                const dateString = `${filterStartYear}-${filterStartMonthObj?.num || "01"}-${dayNum}`;
                                const isSelected = filterRangeStart === dateString;
                                return (
                                  <button
                                    key={dayNum}
                                    type="button"
                                    onClick={() => {
                                      setFilterRangeStart(dateString);
                                      setShowFilterStartPicker(false);
                                    }}
                                    className={`p-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                                      isSelected
                                        ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20"
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
                              return (
                                <button
                                  key={m.num}
                                  type="button"
                                  onClick={() => {
                                    setFilterStartMonthObj(m);
                                    setFilterStartStep("days");
                                  }}
                                  className="p-2 rounded-xl text-xs font-bold transition-all bg-secondary/50 hover:bg-primary/10 text-foreground hover:text-primary cursor-pointer"
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
                <label className="block text-[10px] font-bold text-muted-foreground mb-1">إلى تاريخ</label>
                <button
                  type="button"
                  onClick={() => {
                    setShowFilterEndPicker(!showFilterEndPicker);
                    setFilterEndStep("months");
                    setShowFilterStartPicker(false);
                  }}
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground text-xs font-bold flex items-center justify-between hover:border-primary/50 transition-all shadow-sm cursor-pointer"
                >
                  <span className={filterRangeEnd ? "text-foreground font-mono" : "text-muted-foreground"}>
                    {filterRangeEnd ? filterRangeEnd : "اختر تاريخ النهاية..."}
                  </span>
                  <Calendar className="w-4 h-4 text-primary" />
                </button>

                <AnimatePresence>
                  {showFilterEndPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute z-[10002] mt-2 w-72 left-0 bg-card border border-border rounded-3xl p-4 shadow-2xl backdrop-blur-xl space-y-3"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                          <button
                            type="button"
                            onClick={() => setFilterEndYear((y) => y - 1)}
                            className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          
                          <div className="flex items-center gap-1 font-mono font-bold text-xs text-primary">
                            <span>{filterEndYear}</span>
                            {filterEndMonthObj && filterEndStep === "days" && (
                              <span>- {filterEndMonthObj.num}</span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setFilterEndYear((y) => y + 1)}
                            className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {filterEndStep === "days" ? (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center px-1 text-[11px]">
                              <span className="font-bold text-muted-foreground">اختر اليوم:</span>
                              <button
                                type="button"
                                onClick={() => setFilterEndStep("months")}
                                className="text-primary hover:underline font-bold text-[10px] cursor-pointer"
                              >
                                تغيير الشهر ({filterEndMonthObj?.name || "اختر"})
                              </button>
                            </div>
                            <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto pt-1">
                              {daysInFilterEnd.map((dayNum) => {
                                const dateString = `${filterEndYear}-${filterEndMonthObj?.num || "01"}-${dayNum}`;
                                const isSelected = filterRangeEnd === dateString;
                                return (
                                  <button
                                    key={dayNum}
                                    type="button"
                                    onClick={() => {
                                      setFilterRangeEnd(dateString);
                                      setShowFilterEndPicker(false);
                                    }}
                                    className={`p-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                                      isSelected
                                        ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20"
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
                              const monthString = `${filterEndYear}-${m.num}`;
                              const isSelected = filterRangeEnd === monthString;

                              return (
                                <button
                                  key={m.num}
                                  type="button"
                                  onClick={() => {
                                    setFilterEndMonthObj(m);
                                    setFilterEndStep("days");
                                  }}
                                  className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20"
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
          </div>
        )}

        {dateFilter !== "all" && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex justify-between items-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <span>
              مجموع التحصيل {
                dateFilter === "today" ? "لليوم" : 
                dateFilter === "week" ? "لهذا الأسبوع" : 
                dateFilter === "month" ? "لهذا الشهر" : 
                dateFilter === "custom_single" ? `لتاريخ (${filterSingleDate || "غير محدد"})` : 
                `للنطاق من (${filterRangeStart || "..."}) إلى (${filterRangeEnd || "..."})`
              }:
            </span>
            <span className="font-mono text-sm font-black dir-ltr">{currentFilteredSum.toLocaleString()} د.ع</span>
          </div>
        )}

        {filteredPayments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground font-bold space-y-2">
            <p className="text-sm">لا توجد دفعات مستلمة مسجلة في هذا النطاق الزمني</p>
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
                  <th className="p-3">تاريخ التحصيل (من الأحدث للأقدم)</th>
                  {canDeleteOrEdit && <th className="p-3 rounded-l-xl text-center">إجراءات</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-bold">
                {filteredPayments.map((p, idx) => (
                  <tr key={p.id || idx} className="hover:bg-secondary/60 transition-colors group text-foreground">
                    <td className="p-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-primary" />
                          <span className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">{p.customerName || "عميل مسجل"}</span>
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
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        <span className="font-bold text-primary">{p.paidAt ? new Date(p.paidAt).toLocaleDateString("ar-IQ", { year: "numeric", month: "numeric", day: "numeric" }) : "غير محدد"}</span>
                      </div>
                    </td>
                    {canDeleteOrEdit && (
                      <td className="p-3 text-center">
                        <div className="flex justify-center items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleOpenEditModal(p)} className="p-1.5 text-blue-600 hover:bg-blue-500/10 rounded-xl transition-colors cursor-pointer" title="تعديل الدفعة"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDeletePayment(p)} className="p-1.5 text-rose-600 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer" title="حذف الدفعة"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
                  <Coins className="w-5 h-5 text-primary" />
                  <span>تسجيل دفعة قسط جديدة</span>
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-1.5 rounded-xl hover:bg-secondary text-muted-foreground cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddPayment} className="space-y-4">
                <div className="relative">
                  <label className="block text-xs font-bold text-muted-foreground mb-1">ابحث واختر العميل</label>
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
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
                      className="w-full pr-9 pl-3 p-3 rounded-2xl border border-border bg-background text-foreground text-xs md:text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
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
                              <span className="text-[10px] px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-extrabold">
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
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-2xl space-y-1 text-xs">
                    <p className="text-foreground font-bold"><span>اسم العميل:</span> {selectedInstallment.customerName}</p>
                    <p className="text-foreground font-bold"><span>المنتج:</span> {selectedInstallment.productName}</p>
                    <p className="text-primary font-extrabold font-mono">المبلغ المفترض للقسط الواحد: {Math.round(selectedInstallment.monthlyInstallment || 0).toLocaleString()} د.ع</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">طريقة التسديد والدفع</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("cash")}
                      className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        paymentMethod === "cash"
                          ? "bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-sm"
                          : "bg-background border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <Coins className="w-4 h-4" />
                      <span>نقدي 💵</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod("pos")}
                      className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        paymentMethod === "pos"
                          ? "bg-blue-500/15 border-blue-500 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "bg-background border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>جهاز POS 💳</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod("transfer")}
                      className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        paymentMethod === "transfer"
                          ? "bg-purple-500/15 border-purple-500 text-purple-600 dark:text-purple-400 shadow-sm"
                          : "bg-background border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>زين كاش/كارت 📱</span>
                    </button>
                  </div>
                </div>

                {posStatusText && (
                  <div className="p-3 bg-blue-500/10 text-blue-600 rounded-2xl text-xs font-bold border border-blue-500/20 flex items-center gap-2 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>{posStatusText}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">نوع وعمق عملية التسديد</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMode("single");
                        setShowStartPicker(false);
                        setShowEndPicker(false);
                      }}
                      className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        paymentMode === "single"
                          ? "bg-primary/15 border-primary text-primary"
                          : "bg-background border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <Calendar className="w-4 h-4" />
                      <span>تاريخ قسط واحد</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMode("range");
                        setShowDatePicker(false);
                      }}
                      className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        paymentMode === "range"
                          ? "bg-primary/15 border-primary text-primary"
                          : "bg-background border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      <span>تسديد عدة فترات (من - إلى)</span>
                    </button>
                  </div>
                </div>

                {paymentMode === "single" ? (
                  <div className="relative">
                    <label className="block text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      <span>الدفعة تخص أي تاريخ / فترة؟ ({periodLabel})</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setShowDatePicker(!showDatePicker);
                        if (selectedInstallment?.paymentPeriod === "daily" || selectedInstallment?.paymentPeriod === "weekly") {
                          setDatePickerStep("days");
                        } else {
                          setDatePickerStep("months");
                        }
                      }}
                      className="w-full p-3 rounded-2xl border border-border bg-background text-foreground text-xs md:text-sm font-bold flex items-center justify-between hover:border-primary/50 transition-all shadow-sm cursor-pointer"
                    >
                      <span className={targetMonth ? "text-foreground font-mono" : "text-muted-foreground"}>
                        {targetMonth ? targetMonth : `اختر تاريخ الاستحقاق الـ${periodLabel}...`}
                      </span>
                      <Calendar className="w-4 h-4 text-primary" />
                    </button>

                    <AnimatePresence>
                      {showDatePicker && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute z-[10002] mt-2 w-full bg-card border border-border rounded-3xl p-4 shadow-2xl backdrop-blur-xl space-y-3"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between border-b border-border/50 pb-2">
                              <button
                                type="button"
                                onClick={() => setSelectedYear((y) => y - 1)}
                                className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs flex items-center gap-1 cursor-pointer"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                                <span>السابقة</span>
                              </button>
                              
                              <div className="flex items-center gap-1 font-mono font-bold text-sm text-primary">
                                <span>{selectedYear}</span>
                                {selectedMonthObj && datePickerStep === "days" && (
                                  <span>- {selectedMonthObj.num}</span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => setSelectedYear((y) => y + 1)}
                                className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs flex items-center gap-1 cursor-pointer"
                              >
                                <span>التالية</span>
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {(selectedInstallment?.paymentPeriod === "daily" || selectedInstallment?.paymentPeriod === "weekly") && datePickerStep === "days" ? (
                              <div className="space-y-2">
                                <div className="flex justify-between items-center px-1 text-xs">
                                  <span className="font-bold text-muted-foreground">اختر اليوم المطلوب:</span>
                                  <button
                                    type="button"
                                    onClick={() => setDatePickerStep("months")}
                                    className="text-primary hover:underline font-bold text-[11px] cursor-pointer"
                                  >
                                    تغيير الشهر ({selectedMonthObj?.name || "اختر"})
                                  </button>
                                </div>
                                <div className="grid grid-cols-6 gap-1.5 max-h-44 overflow-y-auto pt-1">
                                  {daysInSingleMonth.map((dayNum) => {
                                    const dateString = `${selectedYear}-${selectedMonthObj?.num || "01"}-${dayNum}`;
                                    const isSelected = targetMonth === dateString;
                                    return (
                                      <button
                                        key={dayNum}
                                        type="button"
                                        onClick={() => {
                                          setTargetMonth(dateString);
                                          setShowDatePicker(false);
                                        }}
                                        className={`p-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                                          isSelected
                                            ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20"
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
                                      className={`p-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                                        isSelected
                                          ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20"
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
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {/* 📅 من تاريخ / فترة */}
                    <div className="relative">
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">من تاريخ / فترة</label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowStartPicker(!showStartPicker);
                          setShowEndPicker(false);
                          if (selectedInstallment?.paymentPeriod === "daily" || selectedInstallment?.paymentPeriod === "weekly") {
                            setStartPickerStep("days");
                          } else {
                            setStartPickerStep("months");
                          }
                        }}
                        className="w-full p-3 rounded-2xl border border-border bg-background text-foreground text-xs font-bold flex items-center justify-between hover:border-primary/50 transition-all shadow-sm cursor-pointer"
                      >
                        <span className={rangeStartDate ? "text-foreground font-mono" : "text-muted-foreground"}>
                          {rangeStartDate || "اختر البداية..."}
                        </span>
                        <Calendar className="w-4 h-4 text-primary" />
                      </button>

                      <AnimatePresence>
                        {showStartPicker && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute z-[10002] mt-2 w-72 right-0 bg-card border border-border rounded-3xl p-4 shadow-2xl backdrop-blur-xl space-y-3"
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
                                  {startMonthObj && startPickerStep === "days" && (
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

                              {(selectedInstallment?.paymentPeriod === "daily" || selectedInstallment?.paymentPeriod === "weekly") && startPickerStep === "days" ? (
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center px-1 text-[11px]">
                                    <span className="font-bold text-muted-foreground">اختر اليوم:</span>
                                    <button
                                      type="button"
                                      onClick={() => setStartPickerStep("months")}
                                      className="text-primary hover:underline font-bold text-[10px] cursor-pointer"
                                    >
                                      تغيير الشهر ({startMonthObj?.name || "اختر"})
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto pt-1">
                                    {daysInStartMonth.map((dayNum) => {
                                      const dateString = `${startYear}-${startMonthObj?.num || "01"}-${dayNum}`;
                                      const isSelected = rangeStartDate === dateString;
                                      return (
                                        <button
                                          key={dayNum}
                                          type="button"
                                          onClick={() => {
                                            setRangeStartDate(dateString);
                                            setShowStartPicker(false);
                                          }}
                                          className={`p-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                                            isSelected
                                              ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20"
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
                                    const isSelected = rangeStartDate === monthString;
                                    return (
                                      <button
                                        key={m.num}
                                        type="button"
                                        onClick={() => {
                                          if (selectedInstallment?.paymentPeriod === "daily" || selectedInstallment?.paymentPeriod === "weekly") {
                                            setStartMonthObj(m);
                                            setStartPickerStep("days");
                                          } else {
                                            setRangeStartDate(monthString);
                                            setShowStartPicker(false);
                                          }
                                        }}
                                        className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                          isSelected
                                            ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20"
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

                    {/* 📅 إلى تاريخ / فترة */}
                    <div className="relative">
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">إلى تاريخ / فترة</label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowEndPicker(!showEndPicker);
                          setShowStartPicker(false);
                          if (selectedInstallment?.paymentPeriod === "daily" || selectedInstallment?.paymentPeriod === "weekly") {
                            setEndPickerStep("days");
                          } else {
                            setEndPickerStep("months");
                          }
                        }}
                        className="w-full p-3 rounded-2xl border border-border bg-background text-foreground text-xs font-bold flex items-center justify-between hover:border-primary/50 transition-all shadow-sm cursor-pointer"
                      >
                        <span className={rangeEndDate ? "text-foreground font-mono" : "text-muted-foreground"}>
                          {rangeEndDate || "اختر النهاية..."}
                        </span>
                        <Calendar className="w-4 h-4 text-primary" />
                      </button>

                      <AnimatePresence>
                        {showEndPicker && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute z-[10002] mt-2 w-72 left-0 bg-card border border-border rounded-3xl p-4 shadow-2xl backdrop-blur-xl space-y-3"
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
                                  {endMonthObj && endPickerStep === "days" && (
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

                              {(selectedInstallment?.paymentPeriod === "daily" || selectedInstallment?.paymentPeriod === "weekly") && endPickerStep === "days" ? (
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center px-1 text-[11px]">
                                    <span className="font-bold text-muted-foreground">اختر اليوم:</span>
                                    <button
                                      type="button"
                                      onClick={() => setEndPickerStep("months")}
                                      className="text-primary hover:underline font-bold text-[10px] cursor-pointer"
                                    >
                                      تغيير الشهر ({endMonthObj?.name || "اختر"})
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto pt-1">
                                    {daysInEndMonth.map((dayNum) => {
                                      const dateString = `${endYear}-${endMonthObj?.num || "01"}-${dayNum}`;
                                      const isSelected = rangeEndDate === dateString;
                                      return (
                                        <button
                                          key={dayNum}
                                          type="button"
                                          onClick={() => {
                                            setRangeEndDate(dateString);
                                            setShowEndPicker(false);
                                          }}
                                          className={`p-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                                            isSelected
                                              ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20"
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
                                    const isSelected = rangeEndDate === monthString;

                                    return (
                                      <button
                                        key={m.num}
                                        type="button"
                                        onClick={() => {
                                          if (selectedInstallment?.paymentPeriod === "daily" || selectedInstallment?.paymentPeriod === "weekly") {
                                            setEndMonthObj(m);
                                            setEndPickerStep("days");
                                          } else {
                                            setRangeEndDate(monthString);
                                            setShowEndPicker(false);
                                          }
                                        }}
                                        className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                          isSelected
                                            ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20"
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

                {/* المبلغ الإجمالي المستلم */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-muted-foreground">المبلغ الإجمالي المستلم (د.ع)</label>
                    {paymentAmount !== "" && (
                      <span className="text-[10px] font-black text-emerald-500 animate-pulse">
                        {formatArabicCurrency(paymentAmount)}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="أدخل قيمة الدفعة المستلمة..."
                    value={formatInputDisplay(paymentAmount)}
                    onChange={(e) => setPaymentAmount(parseFormattedNumber(e.target.value))}
                    className="w-full p-3 rounded-2xl border border-border bg-background text-foreground text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-primary dir-ltr text-right"
                  />
                  <div className="flex gap-1 pt-0.5 dir-ltr justify-end">
                    <button 
                      type="button" 
                      onClick={() => addAmount(paymentAmount, (v) => setPaymentAmount(v), 1000, true)}
                      className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all cursor-pointer"
                    >
                      +000 (ألف)
                    </button>
                    <button 
                      type="button" 
                      onClick={() => addAmount(paymentAmount, (v) => setPaymentAmount(v), 25000, false)}
                      className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all cursor-pointer"
                    >
                      +25 ألف
                    </button>
                    <button 
                      type="button" 
                      onClick={() => addAmount(paymentAmount, (v) => setPaymentAmount(v), 1000000, true)}
                      className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all cursor-pointer"
                    >
                      +000000 (مليون)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    <span>ملاحظات الدفعة (اختياري)</span>
                  </label>
                  <textarea
                    placeholder="اكتب أي ملاحظة تخص هذا القسط..."
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    rows={2}
                    className="w-full p-3 rounded-2xl border border-border bg-background text-foreground text-xs outline-none focus:ring-2 focus:ring-primary resize-none font-bold"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 bg-secondary border border-border text-foreground font-bold rounded-2xl hover:bg-secondary/80 transition-colors text-xs cursor-pointer"
                    disabled={submitting}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !selectedInstallmentId}
                    className="flex-1 py-3 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold rounded-2xl hover:opacity-95 transition-opacity flex items-center justify-center gap-2 text-xs shadow-md shadow-primary/20 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>تأكيد التسديد</span>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditModalOpen && editingPayment && canDeleteOrEdit && (
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
                <button onClick={() => setIsEditModalOpen(false)} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEditPayment} className="space-y-4">
                <div className="p-3 bg-secondary/50 rounded-2xl space-y-1 text-xs border border-border/60 font-bold">
                  <p><span className="text-muted-foreground">العميل:</span> {editingPayment.customerName}</p>
                  <p><span className="text-muted-foreground">المنتج:</span> {editingPayment.productName}</p>
                  <p><span className="text-muted-foreground">المبلغ القديم:</span> {editingPayment.amount.toLocaleString()} د.ع</p>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-muted-foreground">المبلغ الجديد الصحيح (د.ع)</label>
                    {editPaymentAmount !== "" && (
                      <span className="text-[10px] font-black text-blue-500 animate-pulse">
                        {formatArabicCurrency(editPaymentAmount)}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    value={formatInputDisplay(editPaymentAmount)}
                    onChange={(e) => setEditPaymentAmount(parseFormattedNumber(e.target.value))}
                    className="w-full p-3 rounded-2xl border border-border bg-background text-foreground text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none font-mono dir-ltr text-right"
                  />
                  <div className="flex gap-1 pt-0.5 dir-ltr justify-end">
                    <button 
                      type="button" 
                      onClick={() => addAmount(editPaymentAmount, (v) => setEditPaymentAmount(v), 1000, true)}
                      className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all cursor-pointer"
                    >
                      +000 (ألف)
                    </button>
                    <button 
                      type="button" 
                      onClick={() => addAmount(editPaymentAmount, (v) => setEditPaymentAmount(v), 1000000, true)}
                      className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all cursor-pointer"
                    >
                      +000000 (مليون)
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-2.5 border border-border bg-secondary font-bold rounded-2xl hover:bg-secondary/80 transition-colors text-xs text-foreground cursor-pointer"
                    disabled={editSubmitting}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={editSubmitting || editPaymentAmount === editingPayment.amount || !editPaymentAmount}
                    className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-xs disabled:opacity-50 shadow-md shadow-blue-500/20 cursor-pointer"
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