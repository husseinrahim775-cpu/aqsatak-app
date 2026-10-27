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
  Printer, ShieldAlert, ShieldCheck, Users, Phone, MapPin, ChevronRight, FileText
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

export default function CustomersPage() {
  const { user, userData } = useAuth() as any;
  const [installments, setInstallments] = useState<InstallmentData[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed" | "blacklist">("all");

  // 🔒 فحص الصلاحيات الأمنية: هل المستخدم مالك أو لديه صلاحية التعديل والحذف؟
  const isEmployee = userData?.role === "employee";
  const canDeleteOrEdit = !isEmployee || !!userData?.permissions?.canDeleteOrEdit;

  const [editingCustomer, setEditingCustomer] = useState<GroupedCustomer | null>(null);
  const [editForm, setEditForm] = useState({ customerName: "", phoneNumber: "", address: "" });
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
  }, [installments, payments, search, statusFilter]);

  const openEditModal = (customer: GroupedCustomer) => {
    if (!canDeleteOrEdit) {
      toast.error("عذراً، لا تملك صلاحية تعديل بيانات العملاء. يرجى مراجعة المالك.");
      return;
    }
    setEditForm({
      customerName: customer.customerName,
      phoneNumber: customer.phoneNumber,
      address: customer.address || "",
    });
    setEditingCustomer(customer);
  };

  const handleSaveChanges = async () => {
    if (!editingCustomer || !canDeleteOrEdit) return;
    try {
      setIsSaving(true);
      const updatePromises = editingCustomer.installments.map((inst) => 
        updateInstallment(inst.id!, {
          customerName: editForm.customerName,
          phoneNumber: editForm.phoneNumber,
          address: editForm.address,
        })
      );
      
      await Promise.all(updatePromises);
      await fetchData(); 
      setEditingCustomer(null); 
      toast.success("تم حفظ تعديلات بيانات العميل بنجاح!");
    } catch (error) {
      console.error("خطأ في التعديل:", error);
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
      {/* 1. ترويسة الصفحة */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/80 backdrop-blur-xl p-5 md:p-6 rounded-3xl border border-border shadow-sm print:hidden">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-primary" />
            إدارة العملاء والأقساط
          </h1>
          <p className="text-xs text-muted-foreground mt-1">سجلات العملاء، التقييم الآلي لالتزام السداد، والقائمة السوداء.</p>
        </div>
        
        <Link href="/customers/new">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-5 py-3 rounded-2xl font-bold text-sm shadow-md shadow-primary/20 hover:opacity-95 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة قسط جديد</span>
          </motion.button>
        </Link>
      </div>

      {/* 2. شريط البحث والفلترة */}
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

      {/* 3. شبكة بطاقات العملاء */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 print:hidden">
        {groupedCustomers.map((customer) => {
          const totalPeriodic = customer.installments.reduce((acc, curr) => acc + curr.monthlyInstallment, 0);

          return (
            <motion.div 
              key={customer.phoneNumber} 
              whileHover={{ y: -4, scale: 1.005 }}
              className="bg-card/90 backdrop-blur-md border border-border rounded-3xl p-5 md:p-6 space-y-4 shadow-sm hover:border-primary/40 transition-all relative group"
            >
              {/* الترويسة وأدوات التحكم السريعة */}
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
                            title="تعديل بيانات العميل"
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

              {/* الأرقام والمالية */}
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

              {/* تفاصيل المنتجات المربوطة */}
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

      {/* modal تعديل بيانات العميل */}
      <AnimatePresence>
        {editingCustomer && canDeleteOrEdit && (
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
                <h2 className="text-base font-black text-foreground">تعديل بيانات العميل</h2>
                <button onClick={() => setEditingCustomer(null)} className="p-1 hover:bg-secondary rounded-xl transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">اسم العميل</label>
                  <input
                    type="text"
                    value={editForm.customerName}
                    onChange={(e) => setEditForm({...editForm, customerName: e.target.value})}
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">رقم الهاتف (الأساس)</label>
                  <input
                    type="text"
                    value={editForm.phoneNumber}
                    onChange={(e) => setEditForm({...editForm, phoneNumber: e.target.value})}
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-primary outline-none text-left"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">العنوان (اختياري)</label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div className="pt-2 flex gap-3">
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
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ التعديلات'}
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