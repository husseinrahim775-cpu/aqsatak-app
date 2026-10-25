"use client";

import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  getInstallmentsByPhone, 
  getInstallmentById, 
  getUserPayments, 
  updateInstallment,
  deleteInstallment,
  updatePaymentRecord,
  deletePaymentRecord,
  updateContractDocuments,
  compressAndConvertToBase64,
  InstallmentData, 
  PaymentRecord 
} from "../../../services/firestore";
import { useAuth } from "../../../components/AuthProvider";
import { 
  ArrowRight, User, ShieldCheck, Calendar, Loader2, CreditCard, MessageSquare, 
  Edit, Trash2, X, Receipt, Printer, Camera, FileText, Image as ImageIcon, Download, 
  ExternalLink, Eye, EyeOff, ChevronDown, ChevronUp, RefreshCw, Upload, CheckCircle2, AlertCircle, Sparkles,
  Clock, CalendarDays, ChevronRight, ChevronLeft
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ContractPrintTemplate, PaymentReceiptPrintTemplate } from "@/components/PrintTemplates";

// دالة مساعدة لتنظيف النصوص من أي محتوى قد يسبب ثغرات XSS في الطباعة
const sanitizeText = (str: string | undefined | null) => {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

function CustomerDetailsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const getParamId = () => {
    const qId = searchParams.get("id");
    if (qId) return qId;
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get("id") || "";
    }
    return "";
  };

  const rawParam = getParamId();
  const phoneOrId = rawParam ? decodeURIComponent(rawParam) : "";

  const { user } = useAuth();
  
  const [installments, setInstallments] = useState<InstallmentData[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingIndex, setSendingIndex] = useState<string | null>(null);

  // 🔒 حالة إظهار / إخفاء المستندات
  const [showDocs, setShowDocs] = useState(false);
  const [updatingDocType, setUpdatingDocType] = useState<string | null>(null);

  // حالة الصورة المكبرة للعرض
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const [printContractData, setPrintContractData] = useState<InstallmentData | null>(null);
  const [printPaymentData, setPrintPaymentData] = useState<PaymentRecord | null>(null);

  // 🖨️ مرجع حاوية الطباعة
  const printAreaRef = useRef<HTMLDivElement>(null);

  const [editingInstallment, setEditingInstallment] = useState<InstallmentData | null>(null);
  const [editForm, setEditForm] = useState({
    productName: "",
    productPrice: 0,
    downPayment: 0,
    monthlyInstallment: 0,
    months: 0,
  });
  const [isSaving, setIsSaving] = useState(false);

  // 🗓️ حالات تعديل الدفعة والمنقي المخصص للأشهر والتواريخ
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  const [editPaymentForm, setEditPaymentForm] = useState({
    amount: 0,
    targetMonth: "",
    notes: "",
  });
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const fetchData = useCallback(async () => {
    if (!phoneOrId || !user?.uid) return;
    try {
      setLoading(true);
      const userPayments = await getUserPayments(user.uid);
      setPayments(userPayments);

      const data = await getInstallmentsByPhone(user.uid, phoneOrId);
      if (data.length > 0) {
        setInstallments(data);
      } else {
        const single = await getInstallmentById(phoneOrId);
        if (single) {
          setInstallments([single]);
        } else {
          setInstallments([]); 
        }
      }
    } catch (error) {
      console.error("خطأ في جلب بيانات العميل:", error);
    } finally {
      setLoading(false);
    }
  }, [phoneOrId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 📸 دالة تغيير أو إضافة صورة وثيقة جديدة
  const handleUploadOrReplaceDoc = async (inst: InstallmentData, docKey: "idCardUrl" | "contractUrl" | "personalPhotoUrl", file: File) => {
    if (!inst.id) return;
    try {
      setUpdatingDocType(docKey);
      const compressedBase64 = await compressAndConvertToBase64(file);
      
      const currentDocs = inst.documents || {};
      const updatedDocs = {
        ...currentDocs,
        [docKey]: compressedBase64,
      };

      await updateContractDocuments(inst.id, updatedDocs);
      await fetchData();
    } catch (error) {
      console.error("خطأ في تغيير الصورة:", error);
      alert("حدث خطأ أثناء تحميل الصورة الجديدة.");
    } finally {
      setUpdatingDocType(null);
    }
  };

  // 🗑️ دالة حذف صورة وثيقة محددة
  const handleDeleteDoc = async (inst: InstallmentData, docKey: "idCardUrl" | "contractUrl" | "personalPhotoUrl", docName: string) => {
    if (!inst.id) return;
    const confirmDelete = window.confirm(`هل أنت متأكد من حذف صورة (${docName})؟`);
    if (!confirmDelete) return;

    try {
      setUpdatingDocType(docKey);
      const currentDocs = inst.documents || {};
      const updatedDocs = { ...currentDocs };
      delete updatedDocs[docKey];

      await updateContractDocuments(inst.id, updatedDocs);
      await fetchData();
    } catch (error) {
      console.error("خطأ في حذف الصورة:", error);
      alert("حدث خطأ أثناء حذف الصورة.");
    } finally {
      setIsSaving(false);
    }
  };

  // 🖨️ دالة الطباعة
  const triggerPrint = (type: "contract" | "payment", paymentData?: PaymentRecord) => {
    let paperSize = "80mm";
    try {
      const savedHw = localStorage.getItem("app_hardware_settings");
      if (savedHw) {
        const parsed = JSON.parse(savedHw);
        if (parsed.receiptPaperSize) paperSize = parsed.receiptPaperSize;
      }
    } catch (e) {}

    const custName = mainInfo ? sanitizeText(mainInfo.customerName) : "";
    const custPhone = mainInfo ? sanitizeText(mainInfo.phoneNumber) : "";

    if (type === "payment" && paymentData) {
      const receiptWidth = paperSize === "80mm" ? "280px" : "190px";
      const printWin = window.open("", "_blank", "width=400,height=600");
      
      if (printWin) {
        const amountStr = paymentData.amount.toLocaleString("en-US");
        const monthStr = sanitizeText(paymentData.targetMonth || "-");
        const notesStr = sanitizeText(paymentData.notes || "تسديد قسط");
        const dateStr = new Date(paymentData.paidAt || Date.now()).toLocaleDateString("en-GB");
        const timeStr = new Date(paymentData.paidAt || Date.now()).toLocaleTimeString("ar-IQ", { hour: '2-digit', minute: '2-digit' });

        printWin.document.write(`
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
            <head>
              <title>إيصال قبض</title>
              <meta charset="utf-8">
              <style>
                body { 
                  font-family: 'Courier New', Courier, monospace, system-ui; 
                  width: ${receiptWidth}; 
                  margin: 0 auto; 
                  padding: 10px; 
                  font-size: 12px; 
                  color: #000;
                }
                .center { text-align: center; }
                .bold { font-weight: bold; }
                .line { border-bottom: 1px dashed #000; margin: 8px 0; }
                .num-ltr { direction: ltr; display: inline-block; unicode-bidi: embed; }
              </style>
            </head>
            <body>
              <div class="center">
                <h2 style="margin: 0 0 5px 0;">وصل إيصال دفع</h2>
                <p style="margin: 3px 0;">العميل: <span class="bold">${custName}</span></p>
                <p style="margin: 3px 0;">الهاتف: <span class="num-ltr bold">${custPhone}</span></p>
              </div>
              <div class="line"></div>
              
              <div style="font-size: 13px; margin: 8px 0;">
                <span>المبلغ المدفوع: </span>
                <strong class="num-ltr" style="font-size: 15px;">${amountStr}</strong>
                <span> د.ع</span>
              </div>
              
              <div style="margin: 4px 0;">
                <span>عن فترة/شهر: </span>
                <span class="num-ltr bold">${monthStr}</span>
              </div>

              <div style="margin: 4px 0;">
                <span>ملاحظات: </span>
                <span>${notesStr}</span>
              </div>

              <div class="line"></div>
              
              <div class="center" style="font-size: 10px; margin-top: 6px;">
                <span>التاريخ: </span>
                <span class="num-ltr">${dateStr}</span>
                <span class="num-ltr">${timeStr}</span>
              </div>

              <script>
                window.onload = function() { 
                  setTimeout(function() {
                    window.print(); 
                    window.close(); 
                  }, 300);
                }
              </script>
            </body>
          </html>
        `);
        printWin.document.close();
      }
      return;
    }

    setTimeout(() => {
      if (!printAreaRef.current) return;

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const contentHtml = printAreaRef.current.innerHTML;

      const fullDocumentHtml = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
          <head>
            <title>طباعة عقد العميل</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @page { size: auto; margin: 10mm; }
              body { 
                font-family: system-ui, -apple-system, sans-serif; 
                padding: 15px; 
                background: white; 
                color: black; 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
              }
              .font-mono, [dir="ltr"], .num-ltr { 
                direction: ltr !important; 
                display: inline-block !important; 
                unicode-bidi: embed !important; 
              }
              @media print {
                .no-print { display: none !important; }
              }
            </style>
          </head>
          <body>
            <div class="no-print mb-4 text-center">
              <button onclick="window.print()" style="background:#f97316; color:white; font-weight:bold; padding:10px 24px; border-radius:8px; border:none; cursor:pointer;">
                🖨️ اضغط هنا لتحديد الطابعة والبدء بالطباعة
              </button>
            </div>

            ${contentHtml}

            <script>
              window.onload = function() {
                setTimeout(function() {
                  try { window.print(); } catch(e){}
                }, 500);
              };
            </script>
          </body>
        </html>
      `;

      if (isIOS) {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.open();
          printWindow.document.write(fullDocumentHtml);
          printWindow.document.close();
        }
      } else {
        const blob = new Blob([fullDocumentHtml], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "width=900,height=800");
      }
    }, 250);
  };

  const handleDeleteInstallment = async (id: string, productName: string) => {
    const confirmDelete = window.confirm(
      `هل أنت متأكد من حذف قسط "${productName}" بالكامل؟\n\nتنبيه: سيتم إرجاع السلعة المربوطة للمخزن تلقائياً.`
    );
    if (confirmDelete) {
      try {
        await deleteInstallment(id);
        await fetchData();
        if (installments.length === 1) {
          router.push("/customers");
        }
      } catch (error) {
        console.error("خطأ في الحذف:", error);
        alert("حدث خطأ أثناء الحذف.");
      }
    }
  };

  const openEditModal = (inst: InstallmentData) => {
    setEditingInstallment(inst);
    setEditForm({
      productName: inst.productName,
      productPrice: inst.productPrice,
      downPayment: inst.downPayment,
      monthlyInstallment: inst.monthlyInstallment,
      months: inst.months,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingInstallment?.id) return;
    setIsSaving(true);
    try {
      await updateInstallment(editingInstallment.id, {
        productName: editForm.productName,
        productPrice: Number(editForm.productPrice),
        downPayment: Number(editForm.downPayment),
        monthlyInstallment: Number(editForm.monthlyInstallment),
        months: Number(editForm.months),
      });
      await fetchData();
      setEditingInstallment(null);
    } catch (error) {
      console.error("خطأ في التعديل:", error);
      alert("حدث خطأ أثناء حفظ التعديلات.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePayment = async (payment: PaymentRecord) => {
    const confirmDelete = window.confirm(
      `هل أنت متأكد من حذف هذه الدفعة بقيمة ${payment.amount} د.ع؟\nسيتم إرجاع المبلغ إلى ديون العميل وإلغاء حالة الدفع.`
    );
    if (confirmDelete && payment.id) {
      try {
        await deletePaymentRecord(payment.id, payment.installmentId, payment.amount);
        await fetchData();
      } catch (error) {
        console.error("خطأ في حذف الدفعة:", error);
        alert("حدث خطأ أثناء حذف الدفعة.");
      }
    }
  };

  const openEditPaymentModal = (payment: PaymentRecord) => {
    setEditingPayment(payment);
    const target = payment.targetMonth || "";
    setEditPaymentForm({
      amount: payment.amount,
      targetMonth: target,
      notes: payment.notes || "",
    });

    if (target.includes("-")) {
      const yearPart = parseInt(target.split("-")[0]);
      if (!isNaN(yearPart)) setPickerYear(yearPart);
    } else {
      setPickerYear(new Date().getFullYear());
    }
    setShowDatePickerModal(false);
  };

  const handleSavePaymentEdit = async () => {
    if (!editingPayment?.id) return;
    setIsSavingPayment(true);
    try {
      await updatePaymentRecord(
        editingPayment.id,
        editingPayment.installmentId,
        editingPayment.amount,
        Number(editPaymentForm.amount),
        {
          amount: Number(editPaymentForm.amount),
          targetMonth: editPaymentForm.targetMonth,
          notes: editPaymentForm.notes,
        }
      );
      await fetchData();
      setEditingPayment(null);
    } catch (error) {
      console.error("خطأ في التعديل:", error);
      alert("حدث خطأ أثناء حفظ تعديل الدفعة.");
    } finally {
      setIsSavingPayment(false);
    }
  };

  const getDueDate = (startDateStr: string | undefined, index: number, period?: string) => {
    let date: Date;

    if (!startDateStr) {
      date = new Date();
    } else {
      const [year, month, day] = startDateStr.split("-").map(Number);
      date = new Date(year, month - 1, day);
    }

    if (period === "daily") {
      date.setDate(date.getDate() + index);
    } else if (period === "weekly") {
      date.setDate(date.getDate() + (index * 7));
    } else {
      date.setMonth(date.getMonth() + index);
    }

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`; 
  };

  const handleSendWhatsApp = async (
    btnKey: string,
    customerName: string, 
    phoneNumber: string, 
    amount: number, 
    productName: string,
    dueDateStr: string
  ) => {
    let cleanPhone = phoneNumber.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "964" + cleanPhone.slice(1);
    }

    const useApi = localStorage.getItem("app_wa_use_api") === "true";
    const instanceId = localStorage.getItem("app_wa_instance_id") || "";
    const token = localStorage.getItem("app_wa_token") || "";
    const template = localStorage.getItem("app_whatsapp_template") || 
      "مرحباً {name}، نود تذكيرك بحلول موعد قسط مبلغ {amount} د.ع الخاص بمنتج ({product}). يرجى التسديد في أقرب وقت.";

    const message = template
      .replace(/{name}/g, customerName)
      .replace(/{amount}/g, Math.round(amount).toLocaleString())
      .replace(/{product}/g, productName)
      .replace(/{month}/g, dueDateStr);

    if (useApi && instanceId && token) {
      try {
        setSendingIndex(btnKey);
        const response = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            token: token,
            to: cleanPhone,
            body: message,
          }),
        });

        const resData = await response.json();
        if (resData.sent === "true" || resData.id) {
          alert("تم إرسال رسالة التذكير بنجاح عبر API الواتساب!");
          return;
        }
      } catch (error) {
        console.error("خطأ في إرسال API الواتساب:", error);
        alert("تعذر الإرسال عبر API، سيتم فتح الواتساب المباشر بدلاً من ذلك.");
      } finally {
        setSendingIndex(null);
      }
    }
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  if (loading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center gap-3 text-orange-500">
        <Loader2 className="w-10 h-10 animate-spin" />
        <span className="text-sm font-bold text-muted-foreground animate-pulse">جاري جلب ملف العميل ...</span>
      </div>
    );
  }

  if (installments.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-2xl font-black text-foreground">لم يتم العثور على أقساط لهذا العميل</h2>
        <Link href="/customers" className="text-orange-500 hover:underline text-sm font-bold">العودة لقائمة العملاء ←</Link>
      </div>
    );
  }

  const mainInfo = installments[0];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="max-w-5xl mx-auto space-y-6 pb-12 relative font-sans dir-rtl text-right"
    >
      {/* 1. الترويسة الرئيسية */}
      <div className="flex items-center justify-between bg-card/80 backdrop-blur-xl p-5 md:p-6 rounded-3xl border border-border shadow-sm">
        <div className="flex items-center gap-4">
          <Link href="/customers" className="p-3 bg-secondary hover:bg-orange-500/10 hover:text-orange-500 text-foreground rounded-2xl border border-border/80 transition-all">
            <ArrowRight className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-xl md:text-3xl font-black text-foreground tracking-tight flex items-center gap-2">
              <span>ملف العميل: {mainInfo.customerName}</span>
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-1 font-bold">
              يملك العميل ({installments.length}) أقساط مسجلة بالنظام.
            </p>
          </div>
        </div>

        <span className="text-xs md:text-sm font-black px-4 py-2 bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 rounded-2xl">
          حساب نشط
        </span>
      </div>

      {/* 2. بطاقات بيانات العميل والكفيل */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <div className="bg-card/90 backdrop-blur-md border border-border rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 text-orange-500 border-b border-border/60 pb-3.5">
            <User className="w-6 h-6" />
            <h2 className="font-black text-lg">معلومات العميل الشخصية</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center bg-secondary/30 p-3 rounded-2xl">
              <span className="text-muted-foreground font-bold">الاسم الرباعي:</span>
              <span className="font-black text-foreground text-base">{mainInfo.customerName}</span>
            </div>
            <div className="flex justify-between items-center bg-secondary/30 p-3 rounded-2xl">
              <span className="text-muted-foreground font-bold">رقم الهاتف الأساسي:</span>
              <span className="font-black text-foreground font-mono text-base inline-block" dir="ltr" style={{ unicodeBidi: "embed" }}>
                {mainInfo.phoneNumber}
              </span>
            </div>
            <div className="flex justify-between items-center bg-secondary/30 p-3 rounded-2xl">
              <span className="text-muted-foreground font-bold">العنوان السكني:</span>
              <span className="font-bold text-foreground text-sm">{mainInfo.address || "غير محدد"}</span>
            </div>
          </div>
        </div>

        <div className="bg-card/90 backdrop-blur-md border border-border rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 text-purple-500 border-b border-border/60 pb-3.5">
            <ShieldCheck className="w-6 h-6" />
            <h2 className="font-black text-lg">معلومات الكفيل الضامن</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center bg-secondary/30 p-3 rounded-2xl">
              <span className="text-muted-foreground font-bold">اسم الكفيل:</span>
              <span className="font-black text-foreground text-base">{mainInfo.guarantorName || "لا يوجد كفيل"}</span>
            </div>
            <div className="flex justify-between items-center bg-secondary/30 p-3 rounded-2xl">
              <span className="text-muted-foreground font-bold">رقم هاتف الكفيل:</span>
              <span className="font-black text-foreground font-mono text-base inline-block" dir="ltr" style={{ unicodeBidi: "embed" }}>
                {mainInfo.guarantorPhone || "لا يوجد"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 🔒 3. بطاقة المستندات والأوراق الثبوتية */}
      <div className="bg-card/90 backdrop-blur-md border border-border rounded-3xl overflow-hidden shadow-sm transition-all">
        <button
          type="button"
          onClick={() => setShowDocs(!showDocs)}
          className="w-full p-5 flex items-center justify-between bg-secondary/30 hover:bg-secondary/60 transition-colors"
        >
          <div className="flex items-center gap-3 text-orange-500 font-black text-base">
            <Camera className="w-6 h-6" />
            <span>الأوراق والمستندات الثبوتية</span>
            <span className="text-xs bg-orange-500/10 px-3 py-1 rounded-full text-orange-600 dark:text-orange-400 font-extrabold border border-orange-500/20">إدارة وتعديل </span>
          </div>

          <div className="flex items-center gap-2 text-xs md:text-sm font-black text-muted-foreground">
            {showDocs ? (
              <>
                <EyeOff className="w-5 h-5 text-amber-500" />
                <span>إخفاء المستندات</span>
                <ChevronUp className="w-5 h-5" />
              </>
            ) : (
              <>
                <Eye className="w-5 h-5 text-orange-500" />
                <span>عرض المستندات</span>
                <ChevronDown className="w-5 h-5" />
              </>
            )}
          </div>
        </button>

        {showDocs && (
          <div className="p-6 border-t border-border animate-in fade-in duration-200 space-y-6">
            {installments.map((inst, instIdx) => {
              const docs = inst.documents || {};

              return (
                <div key={inst.id || instIdx} className="space-y-4">
                  {installments.length > 1 && (
                    <p className="text-sm font-black text-orange-500 border-b border-border/60 pb-2">
                      مستندات العقد ({inst.productName}):
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {/* 1. الهوية / البطاقة الموحدة */}
                    <div className="bg-secondary/40 border border-border/80 rounded-2xl p-4 text-center space-y-3 group hover:border-orange-500/50 transition relative">
                      <div className="flex items-center justify-between text-xs font-black text-muted-foreground px-1">
                        <span className="flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-orange-500" /> الهوية / الموحدة
                        </span>
                        {docs.idCardUrl && (
                          <button
                            onClick={() => handleDeleteDoc(inst, "idCardUrl", "الهوية/الموحدة")}
                            disabled={updatingDocType === "idCardUrl"}
                            className="text-rose-500 hover:text-rose-700 p-1.5 rounded-xl hover:bg-rose-500/10 transition"
                            title="حذف الصورة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {docs.idCardUrl ? (
                        <div 
                          onClick={() => setPreviewImage({ url: docs.idCardUrl!, title: `هوية العميل - ${inst.customerName}` })}
                          className="relative h-44 w-full rounded-2xl overflow-hidden cursor-pointer border border-border/60 bg-black/10 group-hover:opacity-90 transition shadow-sm"
                        >
                          <img src={docs.idCardUrl} alt="الهوية" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white font-bold text-xs gap-1">
                            <ExternalLink className="w-5 h-5" />
                            <span>تكبير الصورة</span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-44 w-full rounded-2xl border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground gap-2 bg-background/50">
                          <ImageIcon className="w-9 h-9 opacity-50" />
                          <span className="text-xs font-bold">لم ترفع صورة الهوية</span>
                        </div>
                      )}

                      <label className="block w-full">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadOrReplaceDoc(inst, "idCardUrl", file);
                          }}
                        />
                        <span className="w-full py-2.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-2xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition shadow-sm">
                          {updatingDocType === "idCardUrl" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : docs.idCardUrl ? (
                            <>
                              <RefreshCw className="w-4 h-4" />
                              <span>تغيير الصورة</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4" />
                              <span>إضافة صورة</span>
                            </>
                          )}
                        </span>
                      </label>
                    </div>

                    {/* 2. صورة العقد الورقي */}
                    <div className="bg-secondary/40 border border-border/80 rounded-2xl p-4 text-center space-y-3 group hover:border-orange-500/50 transition relative">
                      <div className="flex items-center justify-between text-xs font-black text-muted-foreground px-1">
                        <span className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-orange-500" /> العقد الورقي
                        </span>
                        {docs.contractUrl && (
                          <button
                            onClick={() => handleDeleteDoc(inst, "contractUrl", "العقد الورقي")}
                            disabled={updatingDocType === "contractUrl"}
                            className="text-rose-500 hover:text-rose-700 p-1.5 rounded-xl hover:bg-rose-500/10 transition"
                            title="حذف الصورة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {docs.contractUrl ? (
                        <div 
                          onClick={() => setPreviewImage({ url: docs.contractUrl!, title: `عقد العميل الورقي - ${inst.customerName}` })}
                          className="relative h-44 w-full rounded-2xl overflow-hidden cursor-pointer border border-border/60 bg-black/10 group-hover:opacity-90 transition shadow-sm"
                        >
                          <img src={docs.contractUrl} alt="العقد الورقي" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white font-bold text-xs gap-1">
                            <ExternalLink className="w-5 h-5" />
                            <span>تكبير الصورة</span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-44 w-full rounded-2xl border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground gap-2 bg-background/50">
                          <FileText className="w-9 h-9 opacity-50" />
                          <span className="text-xs font-bold">لم ترفع صورة العقد الورقي</span>
                        </div>
                      )}

                      <label className="block w-full">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadOrReplaceDoc(inst, "contractUrl", file);
                          }}
                        />
                        <span className="w-full py-2.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-2xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition shadow-sm">
                          {updatingDocType === "contractUrl" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : docs.contractUrl ? (
                            <>
                              <RefreshCw className="w-4 h-4" />
                              <span>تغيير الصورة</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4" />
                              <span>إضافة صورة</span>
                            </>
                          )}
                        </span>
                      </label>
                    </div>

                    {/* 3. الصورة الشخصية للزبون */}
                    <div className="bg-secondary/40 border border-border/80 rounded-2xl p-4 text-center space-y-3 group hover:border-orange-500/50 transition relative">
                      <div className="flex items-center justify-between text-xs font-black text-muted-foreground px-1">
                        <span className="flex items-center gap-2">
                          <User className="w-4 h-4 text-orange-500" /> الصورة الشخصية
                        </span>
                        {docs.personalPhotoUrl && (
                          <button
                            onClick={() => handleDeleteDoc(inst, "personalPhotoUrl", "الصورة الشخصية")}
                            disabled={updatingDocType === "personalPhotoUrl"}
                            className="text-rose-500 hover:text-rose-700 p-1.5 rounded-xl hover:bg-rose-500/10 transition"
                            title="حذف الصورة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {docs.personalPhotoUrl ? (
                        <div 
                          onClick={() => setPreviewImage({ url: docs.personalPhotoUrl!, title: `الصورة الشخصية - ${inst.customerName}` })}
                          className="relative h-44 w-full rounded-2xl overflow-hidden cursor-pointer border border-border/60 bg-black/10 group-hover:opacity-90 transition shadow-sm"
                        >
                          <img src={docs.personalPhotoUrl} alt="الصورة الشخصية" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white font-bold text-xs gap-1">
                            <ExternalLink className="w-5 h-5" />
                            <span>تكبير الصورة</span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-44 w-full rounded-2xl border border-dashed border-border flex flex-col items-center justify-center text-muted-foreground gap-2 bg-background/50">
                          <User className="w-9 h-9 opacity-50" />
                          <span className="text-xs font-bold">لم ترفع صورة العميل</span>
                        </div>
                      )}

                      <label className="block w-full">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadOrReplaceDoc(inst, "personalPhotoUrl", file);
                          }}
                        />
                        <span className="w-full py-2.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-2xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition shadow-sm">
                          {updatingDocType === "personalPhotoUrl" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : docs.personalPhotoUrl ? (
                            <>
                              <RefreshCw className="w-4 h-4" />
                              <span>تغيير الصورة</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4" />
                              <span>إضافة صورة</span>
                            </>
                          )}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. تفاصيل الأقساط وجدول الدفعات */}
      {installments.map((item, idx) => {
        const currentInstPayments = payments.filter((p) => p.installmentId === item.id);
        const periodUnitName = item.paymentPeriod === "daily" ? "أيام" : item.paymentPeriod === "weekly" ? "أسابيع" : "أشهر";
        const periodLabel = item.paymentPeriod === "daily" ? "يومي" : item.paymentPeriod === "weekly" ? "أسبوعي" : "شهري";

        return (
          <div key={item.id || idx} className="space-y-5 bg-card/90 backdrop-blur-md border border-border rounded-3xl p-6 md:p-7 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5 group">
              <div className="flex items-center gap-3 text-orange-500 font-black text-xl md:text-2xl flex-wrap">
                <CreditCard className="w-7 h-7 shrink-0" />
                <span className="text-foreground">القسط #{idx + 1}: {item.productName}</span>
                
                <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity mr-2">
                  <button onClick={() => openEditModal(item)} className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-xl transition-colors" title="تعديل بيانات القسط">
                    <Edit className="w-5 h-5" />
                  </button>
                  <button onClick={() => item.id && handleDeleteInstallment(item.id, item.productName)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors" title="حذف القسط بالكامل">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setPrintPaymentData(null);
                    setPrintContractData(item);
                    triggerPrint("contract");
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-95 text-white text-xs md:text-sm font-black rounded-2xl transition-all flex items-center gap-2 shadow-md shadow-orange-500/20"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة العقد</span>
                </button>

                <span className="inline-flex items-center gap-1.5 text-xs md:text-sm font-black px-3.5 py-1.5 rounded-2xl bg-slate-900 text-white border border-slate-700 dark:bg-slate-800 dark:text-slate-100 shadow-sm">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>قسط {periodLabel}</span>
                </span>

                <span className="inline-flex items-center gap-1.5 text-xs md:text-sm font-black px-3.5 py-1.5 rounded-2xl bg-slate-900 text-white border border-slate-700 dark:bg-slate-800 dark:text-slate-100 shadow-sm">
                  <CalendarDays className="w-4 h-4 text-orange-400" />
                  <span>{item.months} {periodUnitName}</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-secondary/30 p-5 rounded-2xl text-xs md:text-sm border border-border/50">
              <div>
                <p className="text-muted-foreground font-bold">سعر المنتج</p>
                <p className="font-black text-foreground text-base md:text-lg mt-1 font-mono inline-block" dir="ltr" style={{ unicodeBidi: "embed" }}>
                  {item.productPrice.toLocaleString("en-US")} د.ع
                </p>
              </div>
              <div>
                <p className="text-muted-foreground font-bold">الدفعة المقدمة</p>
                <p className="font-black text-foreground text-base md:text-lg mt-1 font-mono inline-block" dir="ltr" style={{ unicodeBidi: "embed" }}>
                  {item.downPayment.toLocaleString("en-US")} د.ع
                </p>
              </div>
              <div>
                <p className="text-muted-foreground font-bold">المتبقي للتقسيط</p>
                <p className="font-black text-foreground text-base md:text-lg mt-1 font-mono inline-block" dir="ltr" style={{ unicodeBidi: "embed" }}>
                  {Math.round(item.totalDue).toLocaleString("en-US")} د.ع
                </p>
              </div>
              <div>
                <p className="text-muted-foreground font-bold">القسط الـ{periodLabel}</p>
                <p className="font-black text-orange-500 text-base md:text-lg mt-1 font-mono inline-block" dir="ltr" style={{ unicodeBidi: "embed" }}>
                  {Math.round(item.monthlyInstallment).toLocaleString("en-US")} د.ع
                </p>
              </div>
            </div>

            {/* جدول الاستحقاقات */}
            <div className="border border-border/80 rounded-2xl overflow-hidden mt-5 shadow-sm">
              <div className="p-4 bg-secondary/40 border-b border-border font-black text-sm md:text-base flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-orange-500" />
                <span>جدول دفعات ({item.productName})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs md:text-sm">
                  <thead className="bg-secondary/30 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="p-3.5 font-black">رقم الدفعة</th>
                      <th className="p-3.5 font-black">المبلغ المطلوب</th>
                      <th className="p-3.5 font-black">تاريخ الاستحقاق</th>
                      <th className="p-3.5 font-black text-center">الحالة / الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {Array.from({ length: item.months }).map((_, mIdx) => {
                      const dueDateFormatted = getDueDate(item.startDate, mIdx, item.paymentPeriod);
                      const [year, month] = dueDateFormatted.split("-");
                      const targetMonthString = `${year}-${month}`;
                      
                      const isPaid = currentInstPayments.some((p) => 
                        p.targetMonth === dueDateFormatted || p.targetMonth === targetMonthString
                      ) || item.paidMonths?.includes(dueDateFormatted) || item.paidMonths?.includes(targetMonthString);

                      const btnKey = `${item.id || idx}-${mIdx}`;

                      return (
                        <tr key={mIdx} className="hover:bg-secondary/20 transition-colors">
                          <td className="p-3.5 font-black text-orange-500">الدفعة #{mIdx + 1}</td>
                          <td className="p-3.5 font-black text-foreground font-mono">
                            <span dir="ltr" style={{ unicodeBidi: "embed" }}>
                              {Math.round(item.monthlyInstallment).toLocaleString("en-US")} د.ع
                            </span>
                          </td>
                          <td className="p-3.5 text-muted-foreground font-mono font-black">
                            <span dir="ltr" style={{ unicodeBidi: "embed" }}>{dueDateFormatted}</span>
                          </td>
                          <td className="p-3.5 text-center">
                            {isPaid ? (
                              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-3.5 py-1.5 rounded-full text-xs font-black shadow-sm inline-block">
                                تم الدفع ✓
                              </span>
                            ) : (
                              <div className="flex items-center justify-center gap-2.5">
                                <span className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 px-3.5 py-1.5 rounded-full text-xs font-black shadow-sm">
                                  مستحق
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleSendWhatsApp(
                                    btnKey,
                                    mainInfo.customerName, 
                                    mainInfo.phoneNumber, 
                                    item.monthlyInstallment, 
                                    item.productName,
                                    dueDateFormatted
                                  )}
                                  disabled={sendingIndex === btnKey}
                                  className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all flex items-center gap-1.5 text-xs font-black shadow-sm"
                                  title="إرسال تذكير عبر الواتساب"
                                >
                                  {sendingIndex === btnKey ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <MessageSquare className="w-4 h-4" />
                                  )}
                                  <span>تذكير</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* سجل المقبوضات والغرامات المسددة */}
            <div className="border border-border/80 rounded-2xl overflow-hidden mt-6 shadow-sm">
              <div className="p-4 bg-secondary/40 border-b border-border font-black text-sm md:text-base flex items-center gap-2.5">
                <Receipt className="w-5 h-5 text-orange-500" />
                <span>سجل الدفعات والغرامات المسددة</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs md:text-sm">
                  <thead className="bg-secondary/30 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="p-3.5 font-black">التاريخ</th>
                      <th className="p-3.5 font-black">المبلغ</th>
                      <th className="p-3.5 font-black">عن فترة/شهر</th>
                      <th className="p-3.5 font-black">النوع / الملاحظات</th>
                      <th className="p-3.5 font-black text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {currentInstPayments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-5 text-center text-muted-foreground font-bold text-sm">لا توجد دفعات أو غرامات مسجلة بعد.</td>
                      </tr>
                    ) : (
                      currentInstPayments.map((p) => {
                        const paidDate = p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-GB").split("/").reverse().join("-") : "-";
                        return (
                          <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                            <td className="p-3.5 font-bold">
                              <span dir="ltr" style={{ unicodeBidi: "embed" }}>{paidDate}</span>
                            </td>
                            <td className="p-3.5 font-black text-emerald-600 dark:text-emerald-400 font-mono text-base">
                              <span dir="ltr" style={{ unicodeBidi: "embed" }}>+{p.amount.toLocaleString("en-US")} د.ع</span>
                            </td>
                            <td className="p-3.5 font-black text-muted-foreground font-mono">
                              <span dir="ltr" style={{ unicodeBidi: "embed" }}>{p.targetMonth || "-"}</span>
                            </td>
                            <td className="p-3.5 text-muted-foreground font-bold text-xs max-w-[200px] truncate" title={p.notes}>
                              {p.notes || "دفعة اعتيادية"}
                            </td>
                            <td className="p-3.5 text-center">
                              <div className="flex justify-center items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPrintContractData(null);
                                    setPrintPaymentData(p);
                                    triggerPrint("payment", p);
                                  }}
                                  className="p-2 text-emerald-600 hover:bg-emerald-500/10 rounded-xl transition-colors"
                                  title="طباعة وصل إيصال"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                                <button onClick={() => openEditPaymentModal(p)} className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-xl transition-colors" title="تعديل الدفعة">
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDeletePayment(p)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors" title="حذف الدفعة">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
          </div>
        );
      })}

      {/* 🖼️ نافذة تكبير الصورة والتحميل */}
      <AnimatePresence>
        {previewImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[70] flex items-center justify-center p-4 print:hidden"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-card border border-border rounded-3xl p-5 max-w-3xl w-full space-y-4 relative overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center border-b border-border pb-3">
                <h3 className="font-extrabold text-foreground text-sm">{previewImage.title}</h3>
                <button 
                  onClick={() => setPreviewImage(null)}
                  className="p-1.5 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative max-h-[70vh] flex items-center justify-center overflow-hidden rounded-2xl bg-black/20">
                <img src={previewImage.url} alt="مكبر" className="max-h-[65vh] w-auto object-contain rounded-xl" />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <a 
                  href={previewImage.url} 
                  download="document.jpg"
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 hover:opacity-95 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل الصورة</span>
                </a>
                <button 
                  onClick={() => setPreviewImage(null)}
                  className="px-4 py-2 bg-secondary text-foreground rounded-2xl text-xs font-bold hover:bg-secondary/80 transition"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🖨️ حاوية قوالب الطباعة */}
      <div ref={printAreaRef} className="print-container hidden print:block">
        {printContractData && <ContractPrintTemplate installment={printContractData} />}
        {printPaymentData && <PaymentReceiptPrintTemplate payment={printPaymentData} />}
      </div>

      {/* modal تعديل القسط */}
      <AnimatePresence>
        {editingInstallment && (
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
                <h2 className="text-base font-black text-foreground">تعديل بيانات القسط</h2>
                <button onClick={() => setEditingInstallment(null)} className="p-1 hover:bg-secondary rounded-xl transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              
              <div className="space-y-3.5 max-h-[70vh] overflow-y-auto px-1">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">اسم المنتج</label>
                  <input
                    type="text"
                    value={editForm.productName}
                    onChange={(e) => setEditForm({...editForm, productName: e.target.value})}
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1">سعر المنتج (د.ع)</label>
                    <input
                      type="number"
                      value={editForm.productPrice}
                      onChange={(e) => setEditForm({...editForm, productPrice: Number(e.target.value)})}
                      className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-black focus:ring-2 focus:ring-orange-500 outline-none text-right"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1">الدفعة المقدمة (د.ع)</label>
                    <input
                      type="number"
                      value={editForm.downPayment}
                      onChange={(e) => setEditForm({...editForm, downPayment: Number(e.target.value)})}
                      className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-black focus:ring-2 focus:ring-orange-500 outline-none text-right"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1">القسط المطلوب (د.ع)</label>
                    <input
                      type="number"
                      value={editForm.monthlyInstallment}
                      onChange={(e) => setEditForm({...editForm, monthlyInstallment: Number(e.target.value)})}
                      className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-black focus:ring-2 focus:ring-orange-500 outline-none text-right"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1">عدد الدفعات</label>
                    <input
                      type="number"
                      value={editForm.months}
                      onChange={(e) => setEditForm({...editForm, months: Number(e.target.value)})}
                      className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-black focus:ring-2 focus:ring-orange-500 outline-none text-right"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    onClick={() => setEditingInstallment(null)}
                    className="flex-1 py-3 text-xs font-bold rounded-2xl border border-border hover:bg-secondary transition-colors"
                    disabled={isSaving}
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editForm.productName}
                    className="flex-1 py-3 text-xs rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold hover:opacity-95 transition-opacity flex justify-center items-center gap-2 disabled:opacity-50 shadow-md shadow-orange-500/20"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ التعديلات'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 💳 modal تعديل الدفعة المصمم تماماً بنمط واجهة التسديد والمنقي المخصص */}
      <AnimatePresence>
        {editingPayment && (() => {
          const matchedInst = installments.find(inst => inst.id === editingPayment.installmentId);
          const isMonthly = matchedInst?.paymentPeriod === "monthly" || !matchedInst?.paymentPeriod;

          return (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 print:hidden"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="bg-card rounded-3xl w-full max-w-md p-6 shadow-2xl border border-border space-y-4 relative overflow-hidden"
              >
                <div className="flex justify-between items-center border-b border-border/70 pb-3">
                  <h2 className="text-base font-black text-foreground">تعديل الدفعة / الغرامة</h2>
                  <button onClick={() => setEditingPayment(null)} className="p-1.5 hover:bg-secondary rounded-xl transition-colors">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  {/* المبلغ */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">المبلغ (د.ع)</label>
                    <input
                      type="number"
                      value={editPaymentForm.amount}
                      onChange={(e) => setEditPaymentForm({...editPaymentForm, amount: Number(e.target.value)})}
                      className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-sm font-black focus:ring-2 focus:ring-orange-500 outline-none text-right font-mono"
                      dir="ltr"
                    />
                  </div>

                  {/* اختيارات التاريخ بنمط شبكة التسديد السوداء المخصصة */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-orange-500" />
                      <span>{isMonthly ? "اختر الشهر والسنة المستحقة" : "اختر تاريخ الدفعة المستحقة"}</span>
                    </label>

                    {/* الزر الرئيسي لعرض التاريخ المحدد */}
                    <button
                      type="button"
                      onClick={() => setShowDatePickerModal(!showDatePickerModal)}
                      className="w-full p-3.5 bg-background border border-border hover:border-orange-500 rounded-2xl text-xs font-bold flex items-center justify-between transition shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-orange-500" />
                        <span className="font-mono text-sm font-black dir-ltr text-right">
                          {editPaymentForm.targetMonth || "اختر تاريخ الاستحقاق..."}
                        </span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showDatePickerModal ? "rotate-180" : ""}`} />
                    </button>

                    {/* المنقي السلس المخصص بنفس الشكل المتوفر في التسديد */}
                    {showDatePickerModal && (
                      <motion.div 
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2.5 p-4 bg-secondary/40 border border-border/90 rounded-2xl space-y-3.5 shadow-inner"
                      >
                        {isMonthly ? (
                          <>
                            {/* شريط اختيار السنة */}
                            <div className="flex items-center justify-between border-b border-border/60 pb-2">
                              <button
                                type="button"
                                onClick={() => setPickerYear(pickerYear - 1)}
                                className="p-1.5 bg-background border border-border/80 hover:bg-secondary rounded-xl text-xs font-bold flex items-center gap-1"
                              >
                                <ChevronRight className="w-4 h-4" />
                                <span>السابقة</span>
                              </button>

                              <span className="font-mono text-base font-black text-orange-500">{pickerYear}</span>

                              <button
                                type="button"
                                onClick={() => setPickerYear(pickerYear + 1)}
                                className="p-1.5 bg-background border border-border/80 hover:bg-secondary rounded-xl text-xs font-bold flex items-center gap-1"
                              >
                                <span>التالية</span>
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                            </div>

                            {/* شبكة الأشهر (شهر 1 إلى شهر 12) */}
                            <div className="grid grid-cols-3 gap-2 pt-1">
                              {Array.from({ length: 12 }).map((_, mIdx) => {
                                const mNum = mIdx + 1;
                                const formattedMonth = `${pickerYear}-${String(mNum).padStart(2, '0')}`;
                                const isSelected = editPaymentForm.targetMonth === formattedMonth;

                                return (
                                  <button
                                    key={mNum}
                                    type="button"
                                    onClick={() => {
                                      setEditPaymentForm({ ...editPaymentForm, targetMonth: formattedMonth });
                                      setShowDatePickerModal(false);
                                    }}
                                    className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all ${
                                      isSelected
                                        ? "bg-orange-500 text-white shadow-md shadow-orange-500/30 scale-105"
                                        : "bg-background border border-border/80 hover:border-orange-500 text-foreground"
                                    }`}
                                  >
                                    شهر {mNum}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          /* اختيار يومي / أسبوعي بالرزنامة المباشرة */
                          <div>
                            <input
                              type="date"
                              value={editPaymentForm.targetMonth}
                              onChange={(e) => {
                                setEditPaymentForm({ ...editPaymentForm, targetMonth: e.target.value });
                                setShowDatePickerModal(false);
                              }}
                              className="w-full p-3 bg-background border border-border rounded-xl text-xs font-mono font-bold text-center outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                            />
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>

                  {/* ملاحظات / غرامة */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">ملاحظات / غرامة</label>
                    <textarea
                      value={editPaymentForm.notes}
                      onChange={(e) => setEditPaymentForm({...editPaymentForm, notes: e.target.value})}
                      rows={3}
                      className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                      placeholder="مثال: [دفع نقدي] أو غرامة تأخير..."
                    />
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button
                      onClick={() => setEditingPayment(null)}
                      className="flex-1 py-3 text-xs font-bold rounded-2xl border border-border hover:bg-secondary transition-colors"
                      disabled={isSavingPayment}
                    >
                      إلغاء
                    </button>
                    <button
                      onClick={handleSavePaymentEdit}
                      disabled={isSavingPayment || !editPaymentForm.amount}
                      className="flex-1 py-3 text-xs rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold hover:opacity-95 transition-opacity flex justify-center items-center gap-2 disabled:opacity-50 shadow-md shadow-orange-500/20"
                    >
                      {isSavingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ التعديلات'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </motion.div>
  );
}

export default function CustomerDetailPage() {
  return (
    <Suspense fallback={
      <div className="h-[80vh] flex flex-col items-center justify-center gap-3 text-orange-500">
        <Loader2 className="w-10 h-10 animate-spin" />
        <span className="text-xs font-bold text-muted-foreground animate-pulse">جاري جلب تفاصيل العميل...</span>
      </div>
    }>
      <CustomerDetailsContent />
    </Suspense>
  );
}