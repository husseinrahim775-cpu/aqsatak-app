"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  getInstallmentsByPhone, 
  getInstallmentById, 
  getUserPayments, 
  updateInstallment,
  deleteInstallment,
  updatePaymentRecord,
  deletePaymentRecord,
  InstallmentData, 
  PaymentRecord 
} from "../../../services/firestore";
import { useAuth } from "../../../components/AuthProvider";
import { ArrowRight, User, ShieldCheck, Calendar, Loader2, CreditCard, MessageSquare, Edit, Trash2, X, Receipt, Printer } from "lucide-react";
import Link from "next/link";
import { ContractPrintTemplate, PaymentReceiptPrintTemplate } from "@/components/PrintTemplates";

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const phoneOrId = decodeURIComponent(params.id as string);
  const { user } = useAuth();
  
  const [installments, setInstallments] = useState<InstallmentData[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingIndex, setSendingIndex] = useState<string | null>(null);

  // --- حالات الطباعة ---
  const [printContractData, setPrintContractData] = useState<InstallmentData | null>(null);
  const [printPaymentData, setPrintPaymentData] = useState<PaymentRecord | null>(null);

  // --- حالات تعديل القسط ---
  const [editingInstallment, setEditingInstallment] = useState<InstallmentData | null>(null);
  const [editForm, setEditForm] = useState({
    productName: "",
    productPrice: 0,
    downPayment: 0,
    monthlyInstallment: 0,
    months: 0,
  });
  const [isSaving, setIsSaving] = useState(false);

  // --- حالات تعديل الدفعة/الغرامة ---
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  const [editPaymentForm, setEditPaymentForm] = useState({
    amount: 0,
    targetMonth: "",
    notes: "",
  });
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // جلب البيانات
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

  // دالة إطلاق أمر الطباعة المباشرة
  const triggerPrint = () => {
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // --- دوال القسط (حذف وتعديل) ---
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

  // --- دوال الدفعة/الغرامة (حذف وتعديل) ---
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

  // 🎯 دالة التاريخ الرقمي YYYY-MM-DD المعدلة لتأخذ نوع القسط بعين الاعتبار (يومي/أسبوعي/شهري)
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
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12 relative">
      {/* الهيدر */}
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

      {/* معلومات العميل والكفيل */}
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

      {/* الأقساط والدفعات */}
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
                {/* 🖨️ زر طباعة العقد */}
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

            {/* ملخص مالية القسط */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-secondary/30 p-4 rounded-xl text-sm border border-border">
              <div>
                <p className="text-gray-500 text-xs">سعر المنتج</p>
                <p className="font-bold">{item.productPrice.toLocaleString()} د.ع</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">الدفعة المقدمة</p>
                <p className="font-bold">{item.downPayment.toLocaleString()} د.ع</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">المتبقي للتقسيط</p>
                <p className="font-extrabold text-foreground">{Math.round(item.totalDue).toLocaleString()} د.ع</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">القسط الـ{periodLabel}</p>
                <p className="font-black text-primary">{Math.round(item.monthlyInstallment).toLocaleString()} د.ع</p>
              </div>
            </div>

            {/* جدول دفعات القسط */}
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
                      
                      // 🎯 فحص ديناميكي يدعم التواريخ الكاملة والأشهر في التسديد
                      const isPaid = currentInstPayments.some((p) => 
                        p.targetMonth === dueDateFormatted || p.targetMonth === targetMonthString
                      ) || item.paidMonths?.includes(dueDateFormatted) || item.paidMonths?.includes(targetMonthString);

                      const btnKey = `${item.id || idx}-${mIdx}`;

                      return (
                        <tr key={mIdx} className="hover:bg-secondary/20 transition-colors">
                          <td className="p-3 font-bold text-primary">الدفعة #{mIdx + 1}</td>
                          <td className="p-3 font-extrabold">{Math.round(item.monthlyInstallment).toLocaleString()} د.ع</td>
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

            {/* سجل المقبوضات والغرامات */}
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
                            <td className="p-3 font-black text-emerald-700 dark:text-emerald-400">+{p.amount.toLocaleString()} د.ع</td>
                            <td className="p-3 font-bold text-gray-500" dir="ltr">{p.targetMonth || "-"}</td>
                            <td className="p-3 text-gray-500 text-xs max-w-[200px] truncate" title={p.notes}>
                              {p.notes || "دفعة اعتيادية"}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex justify-center items-center gap-2">
                                {/* 🖨️ زر طباعة الوصل */}
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

      {/* 🖨️ منطقة الطباعة الخفية */}
      <div className="print-container">
        {printContractData && <ContractPrintTemplate installment={printContractData} />}
        {printPaymentData && <PaymentReceiptPrintTemplate payment={printPaymentData} />}
      </div>

      {/* نافذة تعديل القسط (Modal) */}
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
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">الدفعة المقدمة (د.ع)</label>
                  <input
                    type="number"
                    value={editForm.downPayment}
                    onChange={(e) => setEditForm({...editForm, downPayment: Number(e.target.value)})}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
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
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">عدد الدفعات</label>
                  <input
                    type="number"
                    value={editForm.months}
                    onChange={(e) => setEditForm({...editForm, months: Number(e.target.value)})}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
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

      {/* نافذة تعديل الدفعة / الغرامة (Modal) */}
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
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
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