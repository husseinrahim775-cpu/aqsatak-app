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
import { ArrowRight, User, ShieldCheck, Calendar, Loader2, CreditCard, MessageSquare, Edit, Trash2, X, Receipt, Printer, Camera, FileText, Image as ImageIcon, Download, ExternalLink, Eye, EyeOff, ChevronDown, ChevronUp, RefreshCw, Upload } from "lucide-react";
import Link from "next/link";
import { ContractPrintTemplate, PaymentReceiptPrintTemplate } from "@/components/PrintTemplates";

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

  // حالة إظهار / إخفاء المستندات
  const [showDocs, setShowDocs] = useState(true);
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

  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  const [editPaymentForm, setEditPaymentForm] = useState({
    amount: 0,
    targetMonth: "",
    notes: "",
  });
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
      setUpdatingDocType(null);
    }
  };

  // 📱💻 دالة الطباعة المتوافقة مع الآيفون والـ EXE
  const triggerPrint = () => {
    setTimeout(() => {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      if (isIOS && printAreaRef.current) {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
              <head>
                <title>طباعة</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                  body { font-family: system-ui, sans-serif; padding: 10px; background: white; color: black; }
                  @media print { body { -webkit-print-color-adjust: exact !important; } }
                </style>
              </head>
              <body>
                ${printAreaRef.current.innerHTML}
                <script>
                  window.onload = () => {
                    setTimeout(() => { window.print(); }, 300);
                  };
                </script>
              </body>
            </html>
          `);
          printWindow.document.close();
        }
      } else {
        window.print();
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
    setEditPaymentForm({
      amount: payment.amount,
      targetMonth: payment.targetMonth || "",
      notes: payment.notes || "",
    });
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
      <div className="h-[80vh] flex items-center justify-center text-primary">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  if (installments.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <h2 className="text-2xl font-bold">لم يتم العثور على أقساط لهذا العميل</h2>
        <Link href="/customers" className="text-primary hover:underline font-medium">العودة لقائمة العملاء</Link>
      </div>
    );
  }

  const mainInfo = installments[0];

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12 relative font-sans text-right dir-rtl">
      <div className="flex items-center gap-4">
        <Link href="/customers" className="p-2 bg-card border border-border rounded-lg hover:bg-border/50 transition-colors">
          <ArrowRight className="w-5 h-5 text-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">ملف العميل: {mainInfo.customerName}</h1>
          <p className="text-gray-500 text-sm mt-1">
            يملك العميل ({installments.length}) أقساط مسجلة.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-primary border-b border-border pb-3">
            <User className="w-5 h-5" />
            <h2 className="font-bold text-lg">معلومات العميل</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-500">الاسم الرباعي</p>
              <p className="font-bold text-foreground">{mainInfo.customerName}</p>
            </div>
            <div>
              <p className="text-gray-500">رقم الهاتف</p>
              <p className="font-bold text-foreground" dir="ltr">{mainInfo.phoneNumber}</p>
            </div>
            <div>
              <p className="text-gray-500">العنوان</p>
              <p className="font-bold text-foreground">{mainInfo.address || "غير محدد"}</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-primary border-b border-border pb-3">
            <ShieldCheck className="w-5 h-5" />
            <h2 className="font-bold text-lg">معلومات الكفيل</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-500">اسم الكفيل</p>
              <p className="font-bold text-foreground">{mainInfo.guarantorName || "لا يوجد"}</p>
            </div>
            <div>
              <p className="text-gray-500">رقم هاتف الكفيل</p>
              <p className="font-bold text-foreground" dir="ltr">{mainInfo.guarantorPhone || "لا يوجد"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 🔒 بطاقة المستندات والأوراق الثبوتية القابلة للتعديل والحذف وتغيير الصور */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm transition-all">
        <button
          type="button"
          onClick={() => setShowDocs(!showDocs)}
          className="w-full p-4 flex items-center justify-between bg-secondary/20 hover:bg-secondary/40 transition-colors"
        >
          <div className="flex items-center gap-2 text-primary font-bold">
            <Camera className="w-5 h-5" />
            <span>الأوراق والمستندات الثبوتية</span>
            <span className="text-xs bg-primary/10 px-2 py-0.5 rounded-full text-primary font-normal">إدارة وتعديل</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
            {showDocs ? (
              <>
                <EyeOff className="w-4 h-4 text-amber-500" />
                <span>إخفاء المستندات</span>
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 text-primary" />
                <span>عرض المستندات</span>
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </div>
        </button>

        {showDocs && (
          <div className="p-6 border-t border-border animate-in fade-in duration-200 space-y-6">
            {installments.map((inst, instIdx) => {
              const docs = inst.documents || {};

              return (
                <div key={inst.id || instIdx} className="space-y-3">
                  {installments.length > 1 && (
                    <p className="text-xs font-bold text-primary border-b border-border/60 pb-1">
                      مستندات العقد ({inst.productName}):
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* 1. الهوية / البطاقة الموحدة */}
                    <div className="bg-secondary/30 border border-border rounded-2xl p-3 text-center space-y-2 group hover:border-primary/50 transition relative">
                      <div className="flex items-center justify-between text-xs font-bold text-gray-500 px-1">
                        <span className="flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5 text-primary" /> الهوية / الموحدة
                        </span>
                        {docs.idCardUrl && (
                          <button
                            onClick={() => handleDeleteDoc(inst, "idCardUrl", "الهوية/الموحدة")}
                            disabled={updatingDocType === "idCardUrl"}
                            className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                            title="حذف الصورة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {docs.idCardUrl ? (
                        <div 
                          onClick={() => setPreviewImage({ url: docs.idCardUrl!, title: `هوية العميل - ${inst.customerName}` })}
                          className="relative h-40 w-full rounded-xl overflow-hidden cursor-pointer border border-border/60 bg-black/10 group-hover:opacity-90 transition"
                        >
                          <img src={docs.idCardUrl} alt="الهوية" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white font-bold text-xs gap-1">
                            <ExternalLink className="w-4 h-4" />
                            <span>تكبير الصورة</span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-40 w-full rounded-xl border border-dashed border-border/80 flex flex-col items-center justify-center text-gray-400 gap-2 bg-background/50">
                          <ImageIcon className="w-8 h-8 text-gray-400 opacity-60" />
                          <span className="text-xs">لم ترفع صورة الهوية</span>
                        </div>
                      )}

                      {/* زر تغيير أو إضافة الصورة */}
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
                        <span className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition shadow-sm">
                          {updatingDocType === "idCardUrl" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : docs.idCardUrl ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>تغيير الصورة</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5" />
                              <span>إضافة صورة</span>
                            </>
                          )}
                        </span>
                      </label>
                    </div>

                    {/* 2. صورة العقد الورقي */}
                    <div className="bg-secondary/30 border border-border rounded-2xl p-3 text-center space-y-2 group hover:border-primary/50 transition relative">
                      <div className="flex items-center justify-between text-xs font-bold text-gray-500 px-1">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-primary" /> العقد الورقي
                        </span>
                        {docs.contractUrl && (
                          <button
                            onClick={() => handleDeleteDoc(inst, "contractUrl", "العقد الورقي")}
                            disabled={updatingDocType === "contractUrl"}
                            className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                            title="حذف الصورة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {docs.contractUrl ? (
                        <div 
                          onClick={() => setPreviewImage({ url: docs.contractUrl!, title: `عقد العميل الورقي - ${inst.customerName}` })}
                          className="relative h-40 w-full rounded-xl overflow-hidden cursor-pointer border border-border/60 bg-black/10 group-hover:opacity-90 transition"
                        >
                          <img src={docs.contractUrl} alt="العقد الورقي" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white font-bold text-xs gap-1">
                            <ExternalLink className="w-4 h-4" />
                            <span>تكبير الصورة</span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-40 w-full rounded-xl border border-dashed border-border/80 flex flex-col items-center justify-center text-gray-400 gap-2 bg-background/50">
                          <FileText className="w-8 h-8 text-gray-400 opacity-60" />
                          <span className="text-xs">لم ترفع صورة العقد الورقي</span>
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
                        <span className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition shadow-sm">
                          {updatingDocType === "contractUrl" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : docs.contractUrl ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>تغيير الصورة</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5" />
                              <span>إضافة صورة</span>
                            </>
                          )}
                        </span>
                      </label>
                    </div>

                    {/* 3. الصورة الشخصية للزبون */}
                    <div className="bg-secondary/30 border border-border rounded-2xl p-3 text-center space-y-2 group hover:border-primary/50 transition relative">
                      <div className="flex items-center justify-between text-xs font-bold text-gray-500 px-1">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-primary" /> الصورة الشخصية
                        </span>
                        {docs.personalPhotoUrl && (
                          <button
                            onClick={() => handleDeleteDoc(inst, "personalPhotoUrl", "الصورة الشخصية")}
                            disabled={updatingDocType === "personalPhotoUrl"}
                            className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                            title="حذف الصورة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {docs.personalPhotoUrl ? (
                        <div 
                          onClick={() => setPreviewImage({ url: docs.personalPhotoUrl!, title: `الصورة الشخصية - ${inst.customerName}` })}
                          className="relative h-40 w-full rounded-xl overflow-hidden cursor-pointer border border-border/60 bg-black/10 group-hover:opacity-90 transition"
                        >
                          <img src={docs.personalPhotoUrl} alt="الصورة الشخصية" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white font-bold text-xs gap-1">
                            <ExternalLink className="w-4 h-4" />
                            <span>تكبير الصورة</span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-40 w-full rounded-xl border border-dashed border-border/80 flex flex-col items-center justify-center text-gray-400 gap-2 bg-background/50">
                          <User className="w-8 h-8 text-gray-400 opacity-60" />
                          <span className="text-xs">لم ترفع صورة العميل</span>
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
                        <span className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition shadow-sm">
                          {updatingDocType === "personalPhotoUrl" ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : docs.personalPhotoUrl ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>تغيير الصورة</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5" />
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

      {installments.map((item, idx) => {
        const currentInstPayments = payments.filter((p) => p.installmentId === item.id);
        const periodUnitName = item.paymentPeriod === "daily" ? "أيام" : item.paymentPeriod === "weekly" ? "أسابيع" : "أشهر";
        const periodLabel = item.paymentPeriod === "daily" ? "يومي" : item.paymentPeriod === "weekly" ? "أسبوعي" : "شهري";

        return (
          <div key={item.id || idx} className="space-y-4 bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 group">
              <div className="flex items-center gap-2 text-primary font-bold text-xl flex-wrap">
                <CreditCard className="w-6 h-6 shrink-0" />
                <span>القسط #{idx + 1}: {item.productName}</span>
                
                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity mr-2">
                  <button onClick={() => openEditModal(item)} className="p-1.5 text-blue-600 sm:text-gray-400 sm:hover:text-blue-600 bg-blue-50 dark:bg-blue-900/30 sm:bg-transparent rounded-md transition-colors" title="تعديل بيانات القسط">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => item.id && handleDeleteInstallment(item.id, item.productName)} className="p-1.5 text-red-600 sm:text-gray-400 sm:hover:text-red-600 bg-red-50 dark:bg-red-900/30 sm:bg-transparent rounded-md transition-colors" title="حذف القسط بالكامل">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPrintPaymentData(null);
                    setPrintContractData(item);
                    triggerPrint();
                  }}
                  className="px-3 py-1 bg-slate-800 hover:bg-black text-white text-xs font-bold rounded-full transition-all flex items-center gap-1 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة العقد</span>
                </button>

                <span className="text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 px-3 py-1 rounded-full font-bold">
                  قسط {periodLabel}
                </span>
                <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-extrabold">
                  {item.months} {periodUnitName}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-secondary/30 p-4 rounded-xl text-sm border border-border">
              <div>
                <p className="text-gray-500 text-xs">سعر المنتج</p>
                <p className="font-bold">{item.productPrice.toLocaleString("en-US")} د.ع</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">الدفعة المقدمة</p>
                <p className="font-bold">{item.downPayment.toLocaleString("en-US")} د.ع</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">المتبقي للتقسيط</p>
                <p className="font-extrabold text-foreground">{Math.round(item.totalDue).toLocaleString("en-US")} د.ع</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">القسط الـ{periodLabel}</p>
                <p className="font-black text-primary">{Math.round(item.monthlyInstallment).toLocaleString("en-US")} د.ع</p>
              </div>
            </div>

            <div className="border border-border rounded-xl overflow-hidden mt-4">
              <div className="p-4 bg-secondary/40 border-b border-border font-bold text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span>جدول دفعات ({item.productName})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-secondary/20 text-gray-500 border-b border-border">
                    <tr>
                      <th className="p-3 font-semibold">رقم الدفعة</th>
                      <th className="p-3 font-semibold">المبلغ المطلوب</th>
                      <th className="p-3 font-semibold">تاريخ الاستحقاق</th>
                      <th className="p-3 font-semibold text-center">الحالة / الإجراء</th>
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
                          <td className="p-3 font-bold text-primary">الدفعة #{mIdx + 1}</td>
                          <td className="p-3 font-extrabold">{Math.round(item.monthlyInstallment).toLocaleString("en-US")} د.ع</td>
                          <td className="p-3 text-gray-500 font-bold" dir="ltr">{dueDateFormatted}</td>
                          <td className="p-3 text-center">
                            {isPaid ? (
                              <span className="px-3 py-1 bg-[#15803d] text-white dark:bg-emerald-600 dark:text-white rounded-full text-xs font-black shadow-sm inline-block">
                                تم الدفع ✓
                              </span>
                            ) : (
                              <div className="flex items-center justify-center gap-2">
                                <span className="px-3 py-1 bg-amber-300 text-amber-950 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-400/50 rounded-full text-xs font-black shadow-sm">
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
                                  className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1 text-xs font-bold shadow-sm"
                                  title="إرسال تذكير عبر الواتساب"
                                >
                                  {sendingIndex === btnKey ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <MessageSquare className="w-3.5 h-3.5" />
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

            <div className="border border-border rounded-xl overflow-hidden mt-6">
              <div className="p-4 bg-secondary/40 border-b border-border font-bold text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4 text-primary" />
                <span>سجل الدفعات والغرامات المسددة</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-secondary/20 text-gray-500 border-b border-border">
                    <tr>
                      <th className="p-3 font-semibold">التاريخ</th>
                      <th className="p-3 font-semibold">المبلغ</th>
                      <th className="p-3 font-semibold">عن فترة/شهر</th>
                      <th className="p-3 font-semibold">النوع / الملاحظات</th>
                      <th className="p-3 font-semibold text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {currentInstPayments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-gray-500">لا توجد دفعات أو غرامات مسجلة بعد.</td>
                      </tr>
                    ) : (
                      currentInstPayments.map((p) => {
                        const paidDate = p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-GB").split("/").reverse().join("-") : "-";
                        return (
                          <tr key={p.id} className="hover:bg-secondary/20 transition-colors">
                            <td className="p-3 font-semibold">{paidDate}</td>
                            <td className="p-3 font-black text-emerald-700 dark:text-emerald-400">+{p.amount.toLocaleString("en-US")} د.ع</td>
                            <td className="p-3 font-bold text-gray-500" dir="ltr">{p.targetMonth || "-"}</td>
                            <td className="p-3 text-gray-500 text-xs max-w-[200px] truncate" title={p.notes}>
                              {p.notes || "دفعة اعتيادية"}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex justify-center items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPrintContractData(null);
                                    setPrintPaymentData(p);
                                    triggerPrint();
                                  }}
                                  className="p-1.5 text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 rounded-md border border-emerald-200 dark:border-emerald-800 transition-colors"
                                  title="طباعة وصل إيصال"
                                >
                                  <Printer className="w-4 h-4" />
                                </button>
                                <button onClick={() => openEditPaymentModal(p)} className="p-1.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-md border border-blue-200 dark:border-blue-800 transition-colors" title="تعديل الدفعة">
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDeletePayment(p)} className="p-1.5 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-md border border-red-200 dark:border-red-800 transition-colors" title="حذف الدفعة">
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
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="bg-card border border-border rounded-3xl p-4 max-w-3xl w-full space-y-4 relative overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-bold text-foreground text-sm">{previewImage.title}</h3>
              <button 
                onClick={() => setPreviewImage(null)}
                className="p-1.5 hover:bg-secondary rounded-full text-gray-400 hover:text-foreground"
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
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-primary/90 transition"
              >
                <Download className="w-4 h-4" />
                <span>تحميل الصورة</span>
              </a>
              <button 
                onClick={() => setPreviewImage(null)}
                className="px-4 py-2 bg-secondary text-foreground rounded-xl text-xs font-bold hover:bg-secondary/80 transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🖨️ حاوية قوالب الطباعة المربوطة بالـ Ref للـ iOS */}
      <div ref={printAreaRef} className="print-container hidden print:block">
        {printContractData && <ContractPrintTemplate installment={printContractData} />}
        {printPaymentData && <PaymentReceiptPrintTemplate payment={printPaymentData} />}
      </div>

      {editingInstallment && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-card rounded-2xl w-full max-w-md p-6 shadow-xl border border-border animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">تعديل بيانات القسط</h2>
              <button onClick={() => setEditingInstallment(null)} className="p-2 hover:bg-secondary rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
              <div>
                <label className="block text-sm font-medium mb-1">اسم المنتج</label>
                <input
                  type="text"
                  value={editForm.productName}
                  onChange={(e) => setEditForm({...editForm, productName: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">سعر المنتج (د.ع)</label>
                  <input
                    type="number"
                    value={editForm.productPrice}
                    onChange={(e) => setEditForm({...editForm, productPrice: Number(e.target.value)})}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none dir-ltr text-right"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">الدفعة المقدمة (د.ع)</label>
                  <input
                    type="number"
                    value={editForm.downPayment}
                    onChange={(e) => setEditForm({...editForm, downPayment: Number(e.target.value)})}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none dir-ltr text-right"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">القسط المطلوب (د.ع)</label>
                  <input
                    type="number"
                    value={editForm.monthlyInstallment}
                    onChange={(e) => setEditForm({...editForm, monthlyInstallment: Number(e.target.value)})}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none dir-ltr text-right"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">عدد الدفعات</label>
                  <input
                    type="number"
                    value={editForm.months}
                    onChange={(e) => setEditForm({...editForm, months: Number(e.target.value)})}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none dir-ltr text-right"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setEditingInstallment(null)}
                  className="flex-1 py-2.5 rounded-xl border border-border font-medium hover:bg-secondary transition-colors"
                  disabled={isSaving}
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving || !editForm.productName}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'حفظ التعديلات'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingPayment && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-card rounded-2xl w-full max-w-md p-6 shadow-xl border border-border animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">تعديل الدفعة / الغرامة</h2>
              <button onClick={() => setEditingPayment(null)} className="p-2 hover:bg-secondary rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">المبلغ (د.ع)</label>
                <input
                  type="number"
                  value={editPaymentForm.amount}
                  onChange={(e) => setEditPaymentForm({...editPaymentForm, amount: Number(e.target.value)})}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none dir-ltr text-right"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">عن فترة (تاريخ YYYY-MM-DD أو شهر YYYY-MM)</label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="YYYY-MM-DD"
                  value={editPaymentForm.targetMonth}
                  onChange={(e) => setEditPaymentForm({...editPaymentForm, targetMonth: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none text-left"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ملاحظات / غرامة</label>
                <textarea
                  value={editPaymentForm.notes}
                  onChange={(e) => setEditPaymentForm({...editPaymentForm, notes: e.target.value})}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none resize-none"
                  placeholder="مثال: غرامة تأخير..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setEditingPayment(null)}
                  className="flex-1 py-2.5 rounded-xl border border-border font-medium hover:bg-secondary transition-colors"
                  disabled={isSavingPayment}
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSavePaymentEdit}
                  disabled={isSavingPayment || !editPaymentForm.amount}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
                >
                  {isSavingPayment ? <Loader2 className="w-5 h-5 animate-spin" /> : 'حفظ التعديلات'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomerDetailPage() {
  return (
    <Suspense fallback={
      <div className="h-[80vh] flex items-center justify-center text-primary">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    }>
      <CustomerDetailsContent />
    </Suspense>
  );
}