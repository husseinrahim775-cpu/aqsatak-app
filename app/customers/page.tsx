"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "../../components/AuthProvider";
import { 
  getUserInstallments, 
  getUserPayments,
  InstallmentData,
  PaymentRecord,
  updateInstallment, 
  deleteInstallment,
  addPenaltyRecord,
  calculateCustomerRisk,
  toggleCustomerBlacklist,
  CustomerRiskStatus
} from "../../services/firestore";
import Link from "next/link";
import { 
  Plus, Search, Eye, Edit, Trash2, X, Loader2, AlertCircle, CheckCircle2, Clock, 
  Printer, ShieldAlert, ShieldCheck, Users, Phone, MapPin, ChevronRight, FileText,
  Layers, Filter, CheckSquare, Square, Calendar, DollarSign, Package, ChevronLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { CustomerStatementPrintTemplate } from "../../components/PrintTemplates";

interface GroupedCustomer {
  customerName: string;
  phoneNumber: string;
  address: string;
  installments: InstallmentData[];
  totalOriginalDue: number;
  totalPaid: number;
  totalRemaining: number;
  isFullyPaid: boolean;
  riskStatus: CustomerRiskStatus;
}

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

export default function CustomersPage() {
  const { user, userData } = useAuth() as any;
  const [installments, setInstallments] = useState<InstallmentData[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed" | "blacklist">("all");

  // 📖 حالات نظام فصل الدفاتر المماثلة للداشبورد (تحديد متعدد)
  const [isBookMode, setIsBookMode] = useState(false);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>(["monthly", "weekly", "daily"]);

  // toggle التحديد المتعدد لأنواع الدفاتر
  const togglePeriodFilter = (period: string) => {
    if (selectedPeriods.includes(period)) {
      if (selectedPeriods.length === 1) return; // منع إلغاء تحديد الكل
      setSelectedPeriods(selectedPeriods.filter((p) => p !== period));
    } else {
      setSelectedPeriods([...selectedPeriods, period]);
    }
  };

  // 🔒 فحص الصلاحيات الأمنية
  const isEmployee = userData?.role === "employee";
  const canDeleteOrEdit = !isEmployee || !!userData?.permissions?.canDeleteOrEdit;

  const [editingCustomer, setEditingCustomer] = useState<GroupedCustomer | null>(null);
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<string>("");

  // 📝 نموذج تعديل الشامل لكل تفاصيل العقد والعميل
  const [editForm, setEditForm] = useState({
    customerName: "",
    phoneNumber: "",
    address: "",
    guarantorName: "",
    guarantorPhone: "",
    productName: "",
    purchasePrice: "" as number | "",
    profitMargin: "40" as number | string,
    productPrice: "" as number | "",
    downPayment: "" as number | "",
    monthlyInstallment: "" as number | "",
    paymentPeriod: "monthly" as "daily" | "weekly" | "monthly",
    startDate: "",
  });

  // حالات التقويم المخصص للنموذج
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthObj, setSelectedMonthObj] = useState<{ num: string; name: string } | null>({
    num: String(new Date().getMonth() + 1).padStart(2, "0"),
    name: `شهر ${new Date().getMonth() + 1}`
  });
  const [datePickerStep, setDatePickerStep] = useState<"months" | "days">("months");

  const [isSaving, setIsSaving] = useState(false);

  const [isFineModalOpen, setIsFineModalOpen] = useState(false);
  const [fineCustomer, setFineCustomer] = useState<GroupedCustomer | null>(null);
  const [fineForm, setFineForm] = useState({ installmentId: "", amount: "", reason: "" });
  const [isSavingFine, setIsSavingFine] = useState(false);

  // 🚨 حالة مودال الحظر / القائمة السوداء
  const [blacklistModalCust, setBlacklistModalCust] = useState<GroupedCustomer | null>(null);
  const [blacklistReasonInput, setBlacklistReasonInput] = useState("");
  const [isSavingBlacklist, setIsSavingBlacklist] = useState(false);

  // 🖨️ حالة نافذة اختيار الطباعة والطباعة
  const [printModalCustomer, setPrintModalCustomer] = useState<GroupedCustomer | null>(null);
  const [printType, setPrintType] = useState<"summary" | "full">("full");
  const printRef = useRef<HTMLDivElement>(null);

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

  const daysInSelectedMonth = useMemo(() => {
    if (!selectedMonthObj) return [];
    const monthIndex = parseInt(selectedMonthObj.num, 10) - 1;
    const count = new Date(selectedYear, monthIndex + 1, 0).getDate();
    const daysArr = [];
    for (let i = 1; i <= count; i++) {
      daysArr.push(String(i).padStart(2, "0"));
    }
    return daysArr;
  }, [selectedYear, selectedMonthObj]);

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

  const fetchData = async () => {
    if (user?.uid) {
      const [instData, payData] = await Promise.all([
        getUserInstallments(user.uid),
        getUserPayments(user.uid),
      ]);
      setInstallments(instData || []);
      setPayments(payData || []);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const groupedCustomers = useMemo(() => {
    const map = new Map<string, GroupedCustomer>();

    installments.forEach((item) => {
      const instPeriod = item.paymentPeriod || "monthly";
      if (isBookMode && !selectedPeriods.includes(instPeriod)) {
        return;
      }

      const key = item.phoneNumber?.trim() || item.customerName?.trim();
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          customerName: item.customerName,
          phoneNumber: item.phoneNumber,
          address: item.address,
          installments: [],
          totalOriginalDue: 0,
          totalPaid: 0,
          totalRemaining: 0,
          isFullyPaid: false,
          riskStatus: { level: "excellent", label: "🟢 عميل ممتاز", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold", isBlacklisted: false, maxDaysOverdue: 0 },
        });
      }

      const cust = map.get(key)!;
      cust.installments.push(item);

      const instPayments = payments.filter((p) => p.installmentId === item.id);
      const paidForInst = instPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const originalForInst = (Number(item.productPrice) || 0) - (Number(item.downPayment) || 0);
      const remainingForInst = Number(item.totalDue) || 0;

      cust.totalOriginalDue += originalForInst;
      cust.totalRemaining += remainingForInst;
      cust.totalPaid += paidForInst;
    });

    const result: GroupedCustomer[] = [];

    map.forEach((cust) => {
      cust.isFullyPaid = cust.totalRemaining <= 0;

      cust.riskStatus = calculateCustomerRisk(
        cust.installments,
        payments,
        cust.installments.some((i) => i.isBlacklisted)
      );

      const matchesSearch =
        cust.customerName?.toLowerCase().includes(search.toLowerCase()) || 
        cust.phoneNumber?.includes(search);

      if (matchesSearch) {
        if (statusFilter === "active" && !cust.isFullyPaid) {
          result.push(cust);
        } else if (statusFilter === "completed" && cust.isFullyPaid) {
          result.push(cust);
        } else if (statusFilter === "blacklist" && cust.riskStatus.isBlacklisted) {
          result.push(cust);
        } else if (statusFilter === "all") {
          result.push(cust);
        }
      }
    });

    return result;
  }, [installments, payments, search, statusFilter, isBookMode, selectedPeriods]);

  // 📝 فتح مودال التعديل الشامل مع اختيار العقد المراد تعديله
  const openEditModal = (customer: GroupedCustomer) => {
    if (!canDeleteOrEdit) {
      toast.error("عذراً، لا تملك صلاحية تعديل بيانات العملاء. يرجى مراجعة المالك.");
      return;
    }
    
    const targetInst = customer.installments[0];
    setSelectedInstallmentId(targetInst?.id || "");

    setEditForm({
      customerName: customer.customerName || "",
      phoneNumber: customer.phoneNumber || "",
      address: customer.address || "",
      guarantorName: targetInst?.guarantorName || "",
      guarantorPhone: targetInst?.guarantorPhone || "",
      productName: targetInst?.productName || "",
      purchasePrice: Number(targetInst?.purchasePrice || targetInst?.costPrice) || "",
      profitMargin: Number(targetInst?.profitMargin) || 40,
      productPrice: Number(targetInst?.productPrice) || "",
      downPayment: Number(targetInst?.downPayment) || "",
      monthlyInstallment: Number(targetInst?.monthlyInstallment) || "",
      paymentPeriod: targetInst?.paymentPeriod || "monthly",
      startDate: targetInst?.startDate || "",
    });

    setEditingCustomer(customer);
  };

  // تغيير العقد المحدد للتعديل في حال كان للزبون أكثر من عقد
  const handleSelectInstallmentForEdit = (instId: string) => {
    if (!editingCustomer) return;
    const targetInst = editingCustomer.installments.find(i => i.id === instId);
    if (!targetInst) return;

    setSelectedInstallmentId(instId);
    setEditForm({
      customerName: editingCustomer.customerName || "",
      phoneNumber: editingCustomer.phoneNumber || "",
      address: editingCustomer.address || "",
      guarantorName: targetInst.guarantorName || "",
      guarantorPhone: targetInst.guarantorPhone || "",
      productName: targetInst.productName || "",
      purchasePrice: Number(targetInst.purchasePrice || targetInst.costPrice) || "",
      profitMargin: Number(targetInst.profitMargin) || 40,
      productPrice: Number(targetInst.productPrice) || "",
      downPayment: Number(targetInst.downPayment) || "",
      monthlyInstallment: Number(targetInst.monthlyInstallment) || "",
      paymentPeriod: targetInst.paymentPeriod || "monthly",
      startDate: targetInst.startDate || "",
    });
  };

  // معالجات تغيير الأسعار
  const handlePurchasePriceChange = (val: number | "") => {
    const cost = val;
    let newSellPrice = editForm.productPrice;

    if (cost !== "" && editForm.profitMargin !== "" && Number(cost) > 0) {
      newSellPrice = Number(cost) + Number(cost) * (Number(editForm.profitMargin) / 100);
    }

    setEditForm((prev) => ({
      ...prev,
      purchasePrice: cost,
      productPrice: newSellPrice,
    }));
  };

  const handleProfitMarginChange = (val: number | "") => {
    const margin = val;
    let newSellPrice = editForm.productPrice;

    if (margin !== "" && editForm.purchasePrice !== "" && Number(editForm.purchasePrice) > 0) {
      const cost = Number(editForm.purchasePrice);
      newSellPrice = cost + cost * (Number(margin) / 100);
    }

    setEditForm((prev) => ({
      ...prev,
      profitMargin: margin,
      productPrice: newSellPrice,
    }));
  };

  const handleProductPriceChange = (val: number | "") => {
    const sellPrice = val;
    let newMargin = editForm.profitMargin;

    if (sellPrice !== "" && editForm.purchasePrice !== "" && Number(editForm.purchasePrice) > 0) {
      const cost = Number(editForm.purchasePrice);
      const profitAmount = Number(sellPrice) - cost;
      const rate = (profitAmount / cost) * 100;
      newMargin = Math.round(rate * 100) / 100;
    }

    setEditForm((prev) => ({
      ...prev,
      productPrice: sellPrice,
      profitMargin: newMargin,
    }));
  };

  // 💾 حفظ كل الحقول وتحديث العقد المحدد بالكامل
  const handleSaveChanges = async () => {
    if (!editingCustomer || !canDeleteOrEdit) return;
    try {
      setIsSaving(true);

      const rawPhone = editForm.phoneNumber || "";
      const cleanDigits = rawPhone.replace(/\D/g, "");
      const generatedPhoneE164 = cleanDigits.startsWith("964")
        ? "+" + cleanDigits
        : "+964" + cleanDigits.replace(/^0/, "");

      const calculatedTotalDue = Math.max(0, Number(editForm.productPrice) - Number(editForm.downPayment));
      const calculatedTotalProfit = Math.max(0, Number(editForm.productPrice) - Number(editForm.purchasePrice));

      // 1. تحديث العقد المختار بكل التفاصيل المحدثة
      if (selectedInstallmentId) {
        await updateInstallment(selectedInstallmentId, {
          customerName: editForm.customerName,
          phoneNumber: editForm.phoneNumber,
          phoneE164: generatedPhoneE164,
          address: editForm.address,
          guarantorName: editForm.guarantorName,
          guarantorPhone: editForm.guarantorPhone,
          productName: editForm.productName,
          purchasePrice: Number(editForm.purchasePrice) || 0,
          costPrice: Number(editForm.purchasePrice) || 0,
          profitMargin: Number(editForm.profitMargin) || 0,
          productPrice: Number(editForm.productPrice) || 0,
          downPayment: Number(editForm.downPayment) || 0,
          monthlyInstallment: Number(editForm.monthlyInstallment) || 0,
          paymentPeriod: editForm.paymentPeriod,
          startDate: editForm.startDate,
          totalDue: calculatedTotalDue,
          totalProfit: calculatedTotalProfit,
        });
      }

     // 2. مزامنة الاسم والعنوان والهاتف لكافة عقود الزبون الأخرى
      const otherInstallments = editingCustomer.installments.filter(i => i.id !== selectedInstallmentId);
      if (otherInstallments.length > 0) {
        const updatePromises = otherInstallments.map((inst) => {
          return updateInstallment(inst.id!, {
            customerName: editForm.customerName,
            phoneNumber: editForm.phoneNumber,
            phoneE164: generatedPhoneE164,
            address: editForm.address,
          });
        });
        await Promise.all(updatePromises);
      }
      
      await fetchData(); 
      setEditingCustomer(null); 
      toast.success("تم حفظ كافة تعديلات العقد والعميل بنجاح!");
    } catch (error) {
      console.error("خطأ في التعديل الشامل:", error);
      toast.error("حدث خطأ أثناء حفظ التعديلات.");
    } finally {
      setIsSaving(false);
    }
  };

  const openFineModal = (customer: GroupedCustomer) => {
    if (!canDeleteOrEdit) {
      toast.error("عذراً، لا تملك صلاحية إضافة غرامات مالية. يرجى مراجعة المالك.");
      return;
    }
    setFineCustomer(customer);
    setFineForm({ 
      installmentId: customer.installments.length === 1 ? customer.installments[0].id! : "", 
      amount: "", 
      reason: "" 
    });
    setIsFineModalOpen(true);
  };

  const handleSaveFine = async () => {
    if (!fineCustomer || !fineForm.installmentId || !fineForm.amount || !user?.uid || !canDeleteOrEdit) return;
    
    const selectedInst = fineCustomer.installments.find(i => i.id === fineForm.installmentId);
    if (!selectedInst) return;

    try {
      setIsSavingFine(true);
      const fineValue = Number(fineForm.amount);
      const reasonNote = fineForm.reason.trim() || "غرامة تأخير"; 

      await addPenaltyRecord(
        selectedInst.id!,
        user.uid,
        fineValue,
        reasonNote
      );

      await fetchData(); 
      setIsFineModalOpen(false);
      setFineCustomer(null);
      toast.success("تمت إضافة الغرامة وحفظ السجل بنجاح!");
    } catch (error) {
      console.error("خطأ في إضافة الغرامة:", error);
      toast.error("حدث خطأ أثناء إضافة الغرامة.");
    } finally {
      setIsSavingFine(false);
    }
  };

  const handleToggleBlacklistSubmit = async () => {
    if (!blacklistModalCust || !user?.uid) return;
    if (!canDeleteOrEdit) {
      toast.error("عذراً، لا تملك صلاحية تعديل حالة حظر العملاء.");
      return;
    }
    try {
      setIsSavingBlacklist(true);
      const willBlacklist = !blacklistModalCust.riskStatus.isBlacklisted;
      
      await toggleCustomerBlacklist(
        user.uid,
        blacklistModalCust.phoneNumber,
        willBlacklist,
        blacklistReasonInput
      );

      await fetchData();
      setBlacklistModalCust(null);
      setBlacklistReasonInput("");
      toast.success(willBlacklist ? "تم حظر العميل وإدراجه بالقائمة السوداء!" : "تم رفع الحظر عن العميل بنجاح.");
    } catch (error) {
      console.error("خطأ في تعديل القائمة السوداء:", error);
      toast.error("حدث خطأ أثناء تعديل حالة الحظر.");
    } finally {
      setIsSavingBlacklist(false);
    }
  };

  const handleDeleteCustomer = async (customer: GroupedCustomer) => {
    if (!canDeleteOrEdit) {
      toast.error("عذراً، لا تملك صلاحية حذف العملاء. يرجى مراجعة المالك.");
      return;
    }
    if (!window.confirm(`هل أنت متأكد من حذف العميل (${customer.customerName}) وإرجاع المواد للمخزن؟`)) return;
    try {
      const deletePromises = customer.installments.map((inst) => 
        deleteInstallment(inst.id!)
      );
      
      await Promise.all(deletePromises);
      await fetchData(); 
      toast.success("تم حذف العميل وإرجاع المواد للمخزن بنجاح!");
    } catch (error) {
      console.error("خطأ في الحذف:", error);
      toast.error("حدث خطأ أثناء حذف العميل.");
    }
  };

  const handleExecutePrint = () => {
    if (!printModalCustomer || !printRef.current) return;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1);
    const contentHtml = printRef.current.innerHTML;

    const fullDocumentHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <title>كشف حساب عميل - ${printModalCustomer.customerName}</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page { size: auto; margin: 10mm; }
            html, body { 
              height: auto !important; 
              overflow: visible !important; 
              font-family: system-ui, -apple-system, sans-serif; 
              padding: 15px; 
              background: white; 
              color: black; 
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important; 
            }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            @media print {
              .print-action-bar { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="print-action-bar" style="position: sticky; top: 0; z-index: 9999; background: #1e293b; color: white; padding: 12px; margin-bottom: 20px; text-align: center; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <button onclick="window.print()" style="background: #f97316; color: white; padding: 10px 28px; border: none; border-radius: 8px; font-weight: bold; font-size: 15px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: background 0.2s;">
              🖨️ اضغط هنا لتحديد الطابعة أو الحفظ كـ PDF
            </button>
          </div>

          ${contentHtml}

          <script>
            window.onload = function() {
              setTimeout(function() {
                try {
                  window.print();
                } catch(e) {}
              }, 500);
            };
          </script>
        </body>
      </html>
    `;

    if (isIOS) {
      const printWin = window.open("", "_blank");
      if (printWin) {
        printWin.document.open();
        printWin.document.write(fullDocumentHtml);
        printWin.document.close();
      }
    } else {
      const blob = new Blob([fullDocumentHtml], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const printWin = window.open(url, "_blank", "width=900,height=800");

      if (!printWin) {
        window.print();
      }
    }

    setPrintModalCustomer(null);
  };

  const renderPeriodBadge = (period?: string) => {
    switch (period) {
      case "daily":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">يومي</span>;
      case "weekly":
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">أسبوعي</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary border border-primary/20">شهري</span>;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-5 md:space-y-6 pb-12 max-w-7xl mx-auto font-sans dir-rtl text-right"
    >
      {/* 1. ترويسة الصفحة وزر نظام الفصل بأسلوب الداشبورد */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/80 backdrop-blur-xl p-5 md:p-6 rounded-3xl border border-border shadow-sm print:hidden">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
              <Users className="w-6 h-6 text-primary" />
              إدارة العملاء والأقساط
            </h1>
            <p className="text-xs text-muted-foreground mt-1">سجلات العملاء، التقييم الآلي لالتزام السداد، والقائمة السوداء.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setIsBookMode(!isBookMode)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs md:text-sm border transition-all shadow-sm ${
              isBookMode 
                ? "bg-purple-600 text-white border-purple-500 shadow-purple-500/20" 
                : "bg-secondary text-foreground hover:bg-secondary/80 border-border"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{isBookMode ? "إلغاء نظام الفصل" : "نظام فصل الدفاتر"}</span>
          </button>

          <Link href="/customers/new" className="flex-1 sm:flex-none">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-5 py-3 rounded-2xl font-bold text-xs md:text-sm shadow-md shadow-primary/20 hover:opacity-95 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة قسط جديد</span>
            </motion.button>
          </Link>
        </div>
      </div>

      {/* 📖 2. شريط التحديد المتعدد */}
      <AnimatePresence>
        {isBookMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-card/90 backdrop-blur-md p-4 rounded-3xl border border-border shadow-sm print:hidden flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-black text-purple-400">
                <Filter className="w-4 h-4" />
                <span>حدد أنواع العقود المراد إظهارها (تحديد متعدد):</span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => togglePeriodFilter("daily")}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all border flex items-center gap-2 ${
                    selectedPeriods.includes("daily")
                       ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-background/80 text-muted-foreground border border-border hover:bg-background"
                  }`}
                >
                  {selectedPeriods.includes("daily") ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4 opacity-50" />}
                  <span> عقود يومية</span>
                </button>

                <button
                  type="button"
                  onClick={() => togglePeriodFilter("weekly")}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all border flex items-center gap-2 ${
                    selectedPeriods.includes("weekly")
                      ? "bg-amber-600 text-white shadow-sm"
                      : "bg-background/80 text-muted-foreground border border-border hover:bg-background"
                  }`}
                >
                  {selectedPeriods.includes("weekly") ? <CheckSquare className="w-4 h-4 text-amber-400" /> : <Square className="w-4 h-4 opacity-50" />}
                  <span> عقود أسبوعية</span>
                </button>

                <button
                  type="button"
                  onClick={() => togglePeriodFilter("monthly")}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all border flex items-center gap-2 ${
                    selectedPeriods.includes("monthly")
                   ? "bg-purple-600 text-white shadow-sm"
                      : "bg-background/80 text-muted-foreground border border-border hover:bg-background"
                  }`}
                >
                  {selectedPeriods.includes("monthly") ? <CheckSquare className="w-4 h-4 text-purple-400" /> : <Square className="w-4 h-4 opacity-50" />}
                  <span> عقود شهرية </span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. شريط البحث والفلترة */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between print:hidden">
        <div className="relative w-full sm:flex-1">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="ابحث عن اسم العميل أو رقم الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-11 pl-4 py-3 rounded-2xl border border-border bg-card/80 backdrop-blur-md text-foreground text-xs font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-1 bg-secondary/60 backdrop-blur-md border border-border p-1 rounded-2xl w-full sm:w-auto justify-between overflow-x-auto">
          {[
            { id: "all", label: "الكل" },
            { id: "active", label: "عليها ديون" },
            { id: "completed", label: "مصفّرة بالكامل" },
            { id: "blacklist", label: "القائمة السوداء" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                statusFilter === tab.id
                  ? tab.id === "blacklist" 
                    ? "bg-rose-600 text-white shadow-sm" 
                    : "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. شبكة بطاقات العملاء */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 print:hidden">
        {groupedCustomers.map((customer) => {
          const totalPeriodic = customer.installments.reduce((acc, curr) => acc + curr.monthlyInstallment, 0);

          return (
            <motion.div 
              key={customer.phoneNumber} 
              whileHover={{ y: -4, scale: 1.005 }}
              className="bg-card/90 backdrop-blur-md border border-border rounded-3xl p-5 md:p-6 space-y-4 shadow-sm hover:border-primary/40 transition-all relative group"
            >
              <div className="flex justify-between items-start border-b border-border/60 pb-3.5">
                <div>
                  <h3 className="font-extrabold text-base md:text-lg text-foreground flex items-center gap-2">
                    <span>{customer.customerName}</span>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => setPrintModalCustomer(customer)} 
                        className="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10 rounded-xl transition-colors" 
                        title="طباعة كشف حساب"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      {canDeleteOrEdit && (
                        <>
                          <button 
                            onClick={() => openFineModal(customer)} 
                            className="p-1.5 text-primary hover:bg-primary/10 rounded-xl transition-colors" 
                            title="إضافة غرامة تأخير"
                          >
                            <AlertCircle className="w-4 h-4" />
                          </button>

                          <button 
                            onClick={() => {
                              setBlacklistModalCust(customer);
                              setBlacklistReasonInput(customer.installments.find(i => i.blacklistReason)?.blacklistReason || "");
                            }} 
                            className={`p-1.5 rounded-xl transition-colors ${
                              customer.riskStatus.isBlacklisted 
                                ? "text-emerald-500 hover:bg-emerald-500/10" 
                                : "text-rose-500 hover:bg-rose-500/10"
                            }`} 
                            title={customer.riskStatus.isBlacklisted ? "إلغاء الحظر" : "حظر العميل / القائمة السوداء"}
                          >
                            {customer.riskStatus.isBlacklisted ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                          </button>

                          <button 
                            onClick={() => openEditModal(customer)} 
                            className="p-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 rounded-xl transition-colors" 
                            title="تعديل الشامل لبيانات العميل والعقد"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          <button 
                            onClick={() => handleDeleteCustomer(customer)} 
                            className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl transition-colors" 
                            title="حذف العميل بالكامل"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono flex items-center gap-1" dir="ltr">
                    <Phone className="w-3 h-3 text-primary" /> {customer.phoneNumber}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <span className={`px-3 py-1 rounded-full border text-[10px] font-bold ${customer.riskStatus.color}`}>
                    {customer.riskStatus.label}
                  </span>

                  {customer.isFullyPaid ? (
                    <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> مصفّر بالكامل
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                      <Clock className="w-3 h-3" /> قيد التسديد ({customer.installments.length} أقساط)
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-xs md:text-sm bg-secondary/30 p-3.5 rounded-2xl border border-border/40">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>إجمالي المتبقي للتقسيط:</span>
                  {customer.isFullyPaid ? (
                    <span className="font-black text-emerald-600 dark:text-emerald-400">0 د.ع (خالي من الديون)</span>
                  ) : (
                    <span className="font-black text-foreground text-sm">{Math.round(customer.totalRemaining).toLocaleString("en-US")} د.ع</span>
                  )}
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>مجموع القسط المستحق:</span>
                  <span className="font-bold text-primary">{Math.round(totalPeriodic).toLocaleString("en-US")} د.ع</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-[10px] text-muted-foreground space-y-1.5 w-full sm:w-2/3">
                  {customer.installments.map((inst, idx) => (
                    <div key={idx} className="flex items-center gap-2 truncate">
                      {renderPeriodBadge(inst.paymentPeriod)}
                      <span className="font-bold text-foreground/90 truncate">{inst.productName}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href={`/customers/details?id=${encodeURIComponent(customer.phoneNumber)}`}
                  className="flex items-center justify-center gap-1.5 text-xs bg-secondary hover:bg-primary/10 text-foreground hover:text-primary px-4 py-2 rounded-2xl font-bold border border-border/80 transition-all shrink-0"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>عرض الملف</span>
                </Link>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 🛠️ Modal التعديل الشامل والكامل لبيانات العميل والعقد */}
      <AnimatePresence>
        {editingCustomer && canDeleteOrEdit && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 print:hidden overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-card rounded-3xl w-full max-w-2xl p-6 shadow-2xl border border-border space-y-5 my-8"
            >
              <div className="flex justify-between items-center border-b border-border pb-3">
                <h2 className="text-base font-black text-foreground flex items-center gap-2">
                  <Edit className="w-5 h-5 text-primary" />
                  <span>تعديل شامل لبيانات العميل والعقد</span>
                </h2>
                <button onClick={() => setEditingCustomer(null)} className="p-1 hover:bg-secondary rounded-xl transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              
              {/* اختيار العقد المطلوب تعديله في حال كان للزبون أكثر من عقد */}
              {editingCustomer.installments.length > 1 && (
                <div className="bg-primary/10 p-3.5 rounded-2xl border border-primary/20 space-y-1.5">
                  <label className="block text-xs font-extrabold text-primary">اختر العقد المراد تعديل تفاصيله المالية:</label>
                  <select
                    value={selectedInstallmentId}
                    onChange={(e) => handleSelectInstallmentForEdit(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-primary outline-none"
                  >
                    {editingCustomer.installments.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.productName} - (سعر البيع: {inst.productPrice?.toLocaleString()} د.ع)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
                {/* 1. بيانات العميل والكفيل */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-primary flex items-center gap-1.5 border-b border-border/60 pb-1.5">
                    <Users className="w-4 h-4" /> بيانات العميل والشخصية
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">اسم العميل الرباعي</label>
                      <input
                        type="text"
                        value={editForm.customerName}
                        onChange={(e) => setEditForm({...editForm, customerName: e.target.value})}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">رقم الهاتف (الأساسي)</label>
                      <input
                        type="text"
                        value={editForm.phoneNumber}
                        onChange={(e) => setEditForm({...editForm, phoneNumber: e.target.value})}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-primary outline-none text-left dir-ltr"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">عنوان السكن الدقيق</label>
                      <input
                        type="text"
                        value={editForm.address}
                        onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">اسم الكفيل الضامن</label>
                      <input
                        type="text"
                        value={editForm.guarantorName}
                        onChange={(e) => setEditForm({...editForm, guarantorName: e.target.value})}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">رقم هاتف الكفيل</label>
                      <input
                        type="text"
                        value={editForm.guarantorPhone}
                        onChange={(e) => setEditForm({...editForm, guarantorPhone: e.target.value})}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-primary outline-none text-left dir-ltr"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. تفاصيل العقد والماليات */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-black text-emerald-500 flex items-center gap-1.5 border-b border-border/60 pb-1.5">
                    <Package className="w-4 h-4" /> تفاصيل السلعة والعقد المالي
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">نوع واسم المنتج</label>
                      <input
                        type="text"
                        value={editForm.productName}
                        onChange={(e) => setEditForm({...editForm, productName: e.target.value})}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>

                    {/* سعر الشراء مع الفواصل والتفقيط والمساعد السريع */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="block text-[11px] font-bold text-muted-foreground">سعر الشراء / التكلفة (د.ع)</label>
                        {editForm.purchasePrice !== "" && (
                          <span className="text-[10px] font-black text-amber-500 animate-pulse">
                            {formatArabicCurrency(editForm.purchasePrice)}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="0"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs font-mono font-bold text-right dir-ltr outline-none focus:ring-2 focus:ring-primary"
                        value={formatInputDisplay(editForm.purchasePrice)}
                        onChange={(e) => handlePurchasePriceChange(parseFormattedNumber(e.target.value))}
                      />
                      <div className="flex gap-1 pt-0.5 dir-ltr justify-end">
                        <button 
                          type="button" 
                          onClick={() => addAmount(editForm.purchasePrice, handlePurchasePriceChange, 1000, true)}
                          className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all"
                        >
                          +000 (ألف)
                        </button>
                        <button 
                          type="button" 
                          onClick={() => addAmount(editForm.purchasePrice, handlePurchasePriceChange, 1000000, true)}
                          className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all"
                        >
                          +000000 (مليون)
                        </button>
                      </div>
                    </div>

                    {/* نسبة الربح */}
                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">نسبة الربح المضافة (%)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={editForm.profitMargin}
                        onChange={(e) => handleProfitMarginChange(e.target.value === "" ? "" : Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs font-mono font-bold text-right dir-ltr outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    {/* سعر البيع الكلي مع الفواصل والتفقيط والمساعد السريع */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="block text-[11px] font-bold text-muted-foreground">سعر البيع الكلي (د.ع)</label>
                        {editForm.productPrice !== "" && (
                          <span className="text-[10px] font-black text-emerald-500 animate-pulse">
                            {formatArabicCurrency(editForm.productPrice)}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="0"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs font-mono font-bold text-right dir-ltr outline-none focus:ring-2 focus:ring-primary"
                        value={formatInputDisplay(editForm.productPrice)}
                        onChange={(e) => handleProductPriceChange(parseFormattedNumber(e.target.value))}
                      />
                      <div className="flex gap-1 pt-0.5 dir-ltr justify-end">
                        <button 
                          type="button" 
                          onClick={() => addAmount(editForm.productPrice, handleProductPriceChange, 1000, true)}
                          className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all"
                        >
                          +000 (ألف)
                        </button>
                        <button 
                          type="button" 
                          onClick={() => addAmount(editForm.productPrice, handleProductPriceChange, 1000000, true)}
                          className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all"
                        >
                          +000000 (مليون)
                        </button>
                      </div>
                    </div>

                    {/* الدفعة المقدمة مع الفواصل والتفقيط والمساعد السريع */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="block text-[11px] font-bold text-muted-foreground">الدفعة المقدمة (د.ع)</label>
                        {editForm.downPayment !== "" && (
                          <span className="text-[10px] font-black text-emerald-500 animate-pulse">
                            {formatArabicCurrency(editForm.downPayment)}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="0"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs font-mono font-bold text-right dir-ltr outline-none focus:ring-2 focus:ring-primary"
                        value={formatInputDisplay(editForm.downPayment)}
                        onChange={(e) => setEditForm({ ...editForm, downPayment: parseFormattedNumber(e.target.value) })}
                      />
                      <div className="flex gap-1 pt-0.5 dir-ltr justify-end">
                        <button 
                          type="button" 
                          onClick={() => addAmount(editForm.downPayment, (v) => setEditForm((prev) => ({ ...prev, downPayment: v })), 1000, true)}
                          className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all"
                        >
                          +000 (ألف)
                        </button>
                        <button 
                          type="button" 
                          onClick={() => addAmount(editForm.downPayment, (v) => setEditForm((prev) => ({ ...prev, downPayment: v })), 100000, false)}
                          className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all"
                        >
                          +100 ألف
                        </button>
                      </div>
                    </div>

                    {/* القسط الدوري مع الفواصل والتفقيط والمساعد السريع */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="block text-[11px] font-bold text-primary">مبلغ القسط الدوري (د.ع)</label>
                        {editForm.monthlyInstallment !== "" && (
                          <span className="text-[10px] font-black text-primary animate-pulse">
                            {formatArabicCurrency(editForm.monthlyInstallment)}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="0"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs font-mono font-bold text-right dir-ltr outline-none focus:ring-2 focus:ring-primary text-primary"
                        value={formatInputDisplay(editForm.monthlyInstallment)}
                        onChange={(e) => setEditForm({ ...editForm, monthlyInstallment: parseFormattedNumber(e.target.value) })}
                      />
                      <div className="flex gap-1 pt-0.5 dir-ltr justify-end">
                        <button 
                          type="button" 
                          onClick={() => addAmount(editForm.monthlyInstallment, (v) => setEditForm((prev) => ({ ...prev, monthlyInstallment: v })), 1000, true)}
                          className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all"
                        >
                          +000 (ألف)
                        </button>
                        <button 
                          type="button" 
                          onClick={() => addAmount(editForm.monthlyInstallment, (v) => setEditForm((prev) => ({ ...prev, monthlyInstallment: v })), 25000, false)}
                          className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all"
                        >
                          +25 ألف
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">نوع القسط / السداد</label>
                      <select
                        value={editForm.paymentPeriod}
                        onChange={(e) => setEditForm({...editForm, paymentPeriod: e.target.value as any})}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs font-bold outline-none"
                      >
                        <option value="monthly">شهري</option>
                        <option value="weekly">أسبوعي</option>
                        <option value="daily">يومي</option>
                      </select>
                    </div>

                    {/* التقويم التفاعلي لاختيار تاريخ استحقاق أول قسط */}
                    <div className="md:col-span-2 relative">
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        <span>تاريخ استحقاق أول قسط</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDatePicker(!showDatePicker);
                          setDatePickerStep("months");
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-foreground text-xs font-bold flex items-center justify-between hover:border-primary/50 transition-all shadow-sm cursor-pointer"
                      >
                        <span className={editForm.startDate ? "text-foreground font-mono font-bold" : "text-muted-foreground"}>
                          {editForm.startDate ? editForm.startDate : `اختر تاريخ الاستحقاق...`}
                        </span>
                        <Calendar className="w-4 h-4 text-primary" />
                      </button>

                      <AnimatePresence>
                        {showDatePicker && (
                          <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            className="absolute bottom-full mb-2 right-0 z-[9999] w-full bg-card border border-border rounded-3xl p-4 shadow-2xl backdrop-blur-xl space-y-3"
                          >
                            <div className="space-y-3">
                              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedYear((y) => y - 1)}
                                  className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs flex items-center gap-1"
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
                                  className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs flex items-center gap-1"
                                >
                                  <span>التالية</span>
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {datePickerStep === "days" ? (
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center px-1 text-xs">
                                    <span className="font-bold text-muted-foreground">اختر اليوم المطلوب:</span>
                                    <button
                                      type="button"
                                      onClick={() => setDatePickerStep("months")}
                                      className="text-primary hover:underline font-bold text-[11px]"
                                    >
                                      تغيير الشهر ({selectedMonthObj?.name || "اختر"})
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-6 gap-1.5 max-h-44 overflow-y-auto pt-1">
                                    {daysInSelectedMonth.map((dayNum) => {
                                      const dateString = `${selectedYear}-${selectedMonthObj?.num || "01"}-${dayNum}`;
                                      const isSelected = editForm.startDate === dateString;
                                      return (
                                        <button
                                          key={dayNum}
                                          type="button"
                                          onClick={() => {
                                            setEditForm((prev) => ({ ...prev, startDate: dateString }));
                                            setShowDatePicker(false);
                                          }}
                                          className={`p-2 rounded-xl text-xs font-mono font-bold transition-all ${
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
                                  {monthsList.map((m) => (
                                    <button
                                      key={m.num}
                                      type="button"
                                      onClick={() => {
                                        setSelectedMonthObj(m);
                                        setDatePickerStep("days");
                                      }}
                                      className="p-2.5 rounded-2xl text-xs font-bold transition-all bg-secondary/50 hover:bg-primary/10 text-foreground hover:text-primary"
                                    >
                                      {m.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    onClick={() => setEditingCustomer(null)}
                    className="flex-1 py-3 text-xs font-bold rounded-2xl border border-border hover:bg-secondary transition-colors"
                    disabled={isSaving}
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSaveChanges}
                    disabled={isSaving || !editForm.customerName || !editForm.phoneNumber}
                    className="flex-1 py-3 text-xs rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold hover:opacity-95 transition-opacity flex justify-center items-center gap-2 disabled:opacity-50 shadow-md shadow-primary/20"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ التعديلات الشاملة'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🚨 Modal الحظر وتحديد القائمة السوداء */}
      <AnimatePresence>
        {blacklistModalCust && canDeleteOrEdit && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 print:hidden"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-card rounded-3xl w-full max-w-md p-6 shadow-2xl border border-border space-y-4"
            >
              <div className="flex justify-between items-center border-b border-border pb-3">
                <h3 className="font-extrabold text-base flex items-center gap-2 text-rose-500">
                  <ShieldAlert className="w-5 h-5" />
                  {blacklistModalCust.riskStatus.isBlacklisted ? "رفع الحظر عن العميل" : "إدراج العميل بالقائمة السوداء (حظر)"}
                </h3>
                <button onClick={() => setBlacklistModalCust(null)} className="p-1 hover:bg-secondary rounded-xl transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {blacklistModalCust.riskStatus.isBlacklisted 
                  ? `هل أنت تأكد من رفع الحظر عن العميل (${blacklistModalCust.customerName}) والسماح بالبيع بالآجل له مجدداً؟` 
                  : `عند حظر العميل (${blacklistModalCust.customerName})، سيتم إظهار تحذير أحمر يمنع البائعين من إنشاء أقساط جديدة له.`}
              </p>

              {!blacklistModalCust.riskStatus.isBlacklisted && (
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">سبب الحظر (ملاحظة اختيارية)</label>
                  <input
                    type="text"
                    placeholder="مثال: يتهرب من الدفع أو عليه ديون معدومة"
                    value={blacklistReasonInput}
                    onChange={(e) => setBlacklistReasonInput(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-rose-500 outline-none"
                  />
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setBlacklistModalCust(null)}
                  className="flex-1 py-3 text-xs font-bold rounded-2xl border border-border hover:bg-secondary transition-colors"
                  disabled={isSavingBlacklist}
                >
                  إلغاء
                </button>
                <button
                  onClick={handleToggleBlacklistSubmit}
                  disabled={isSavingBlacklist}
                  className={`flex-1 py-3 text-xs rounded-2xl text-white font-bold transition-all flex justify-center items-center gap-2 shadow-sm ${
                    blacklistModalCust.riskStatus.isBlacklisted ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {isSavingBlacklist ? <Loader2 className="w-4 h-4 animate-spin" /> : blacklistModalCust.riskStatus.isBlacklisted ? 'رفع الحظر' : 'حظر العميل'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🖨️ Modal اختيار نوع الطباعة */}
      <AnimatePresence>
        {printModalCustomer && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 print:hidden"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-card rounded-3xl w-full max-w-md p-6 shadow-2xl border border-border space-y-4"
            >
              <div className="flex justify-between items-center border-b border-border pb-3">
                <h3 className="font-extrabold text-base flex items-center gap-2 text-foreground">
                  <Printer className="w-5 h-5 text-primary" />
                  طباعة كشف حساب العميل
                </h3>
                <button onClick={() => setPrintModalCustomer(null)} className="p-1 hover:bg-secondary rounded-xl transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground">اختر التفاصيل المراد إظهارها في كشف العميل ({printModalCustomer.customerName}):</p>

              <div className="space-y-3">
                <label
                  onClick={() => setPrintType("summary")}
                  className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                    printType === "summary" ? "border-primary bg-primary/10 font-bold" : "border-border hover:border-gray-400"
                  }`}
                >
                  <div>
                    <p className="text-xs font-bold text-foreground">📄 ملخص موقف مالي فقط</p>
                    <p className="text-[10px] text-muted-foreground font-normal mt-0.5">المعلومات العامة، إجمالي الدين والأقساط (بدون سجل الدفعات)</p>
                  </div>
                  <input type="radio" checked={printType === "summary"} readOnly className="accent-primary" />
                </label>

                <label
                  onClick={() => setPrintType("full")}
                  className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                    printType === "full" ? "border-primary bg-primary/10 font-bold" : "border-border hover:border-gray-400"
                  }`}
                >
                  <div>
                    <p className="text-xs font-bold text-foreground">📊 كشف حساب تفصيلي شامل</p>
                    <p className="text-[10px] text-muted-foreground font-normal mt-0.5">المعلومات العامة + جدول جميع الدفعات والمقبوضات</p>
                  </div>
                  <input type="radio" checked={printType === "full"} readOnly className="accent-primary" />
                </label>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setPrintModalCustomer(null)}
                  className="flex-1 py-3 text-xs font-bold rounded-2xl border border-border hover:bg-secondary transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleExecutePrint}
                  className="flex-1 py-3 text-xs rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold hover:opacity-95 transition-opacity flex justify-center items-center gap-2 shadow-md shadow-primary/20"
                >
                  <Printer className="w-4 h-4" />
                  بدء الطباعة
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🖨️ القالب الفعلي للطباعة المخصص */}
      <div className="hidden print:block print:fixed print:inset-0 print:z-[9999] print:bg-white print:p-0">
        {printModalCustomer && (
          <CustomerStatementPrintTemplate
            ref={printRef}
            customer={printModalCustomer}
            payments={payments.filter(p => printModalCustomer.installments.some(i => i.id === p.installmentId))}
            printType={printType}
          />
        )}
      </div>

      {/* modal إضافة الغرامة */}
      <AnimatePresence>
        {isFineModalOpen && fineCustomer && canDeleteOrEdit && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 print:hidden"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-card rounded-3xl w-full max-w-md p-6 shadow-2xl border border-border space-y-4"
            >
              <div className="flex justify-between items-center border-b border-border pb-3">
                <h2 className="text-base font-black flex items-center gap-2 text-primary">
                  <AlertCircle className="w-5 h-5" />
                  إضافة غرامة تأخير
                </h2>
                <button onClick={() => setIsFineModalOpen(false)} className="p-1 hover:bg-secondary rounded-xl transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl text-xs border border-primary/20 font-medium">
                  سيتم إضافة مبلغ الغرامة إلى <strong>إجمالي المتبقي</strong> للعميل ({fineCustomer.customerName}).
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">اختر القسط / المنتج المتعثر</label>
                  <select
                    value={fineForm.installmentId}
                    onChange={(e) => setFineForm({...fineForm, installmentId: e.target.value})}
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-primary outline-none"
                  >
                    <option value="" disabled>-- يرجى اختيار القسط --</option>
                    {fineCustomer.installments.map(inst => (
                      <option key={inst.id} value={inst.id}>
                        {inst.productName} (متبقي: {Math.round(inst.totalDue).toLocaleString("en-US")})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">مبلغ الغرامة (د.ع)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="مثال: 5000"
                    value={fineForm.amount}
                    onChange={(e) => setFineForm({...fineForm, amount: e.target.value})}
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-black focus:ring-2 focus:ring-primary outline-none dir-ltr text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">سبب الغرامة (ملاحظة)</label>
                  <input
                    type="text"
                    placeholder="مثال: تأخير عن الدفع لشهر 5"
                    value={fineForm.reason}
                    onChange={(e) => setFineForm({...fineForm, reason: e.target.value})}
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    onClick={() => setIsFineModalOpen(false)}
                    className="flex-1 py-3 text-xs font-bold rounded-2xl border border-border hover:bg-secondary transition-colors"
                    disabled={isSavingFine}
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSaveFine}
                    disabled={isSavingFine || !fineForm.installmentId || !fineForm.amount}
                    className="flex-1 py-3 text-xs rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-bold hover:opacity-95 transition-opacity flex justify-center items-center gap-2 disabled:opacity-50 shadow-md shadow-primary/20"
                  >
                    {isSavingFine ? <Loader2 className="w-4 h-4 animate-spin" /> : 'إضافة الغرامة'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}