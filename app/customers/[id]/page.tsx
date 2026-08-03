"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  getInstallmentsByPhone, 
  getInstallmentById, 
  getUserPayments, 
  updateInstallment,
  deleteInstallment,
  InstallmentData, 
  PaymentRecord 
} from "../../../services/firestore";
import { useAuth } from "../../../components/AuthProvider";
import { ArrowRight, User, ShieldCheck, Calendar, Loader2, CreditCard, MessageSquare, Edit, Trash2, X } from "lucide-react";
import Link from "next/link";

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const phoneOrId = decodeURIComponent(params.id as string);
  const { user } = useAuth();
  
  const [installments, setInstallments] = useState<InstallmentData[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingIndex, setSendingIndex] = useState<string | null>(null);

  // --- حالات التعديل ---
  const [editingInstallment, setEditingInstallment] = useState<InstallmentData | null>(null);
  const [editForm, setEditForm] = useState({
    productName: "",
    productPrice: 0,
    downPayment: 0,
    monthlyInstallment: 0,
    months: 0,
  });
  const [isSaving, setIsSaving] = useState(false);

  // تم فصل دالة جلب البيانات لتسهيل تحديث الصفحة بعد التعديل أو الحذف
  const fetchData = useCallback(async () => {
    if (!phoneOrId || !user?.uid) return;
    try {
      setLoading(true);
      // 1. جلب سجل جميع الدفعات للمستخدم
      const userPayments = await getUserPayments(user.uid);
      setPayments(userPayments);

      // 2. جلب أقساط العميل برقم الهاتف
      const data = await getInstallmentsByPhone(user.uid, phoneOrId);
      if (data.length > 0) {
        setInstallments(data);
      } else {
        // كحل بديل إذا كان المعامل ID قديم
        const single = await getInstallmentById(phoneOrId);
        if (single) {
          setInstallments([single]);
        } else {
          setInstallments([]); // في حال تم حذف كل الأقساط
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

  // --- دوال الحذف والتعديل ---
  const handleDeleteInstallment = async (id: string, productName: string) => {
    const confirmDelete = window.confirm(
      `هل أنت متأكد من حذف قسط "${productName}" بالكامل؟\n\nتنبيه: سيتم حذف هذا القسط فقط ولن يمكن التراجع.`
    );
    if (confirmDelete) {
      try {
        await deleteInstallment(id);
        await fetchData();
        // إذا كان هذا هو القسط الأخير وتم حذفه، نعود لصفحة العملاء
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

  const getDueDate = (startDateStr: string | undefined, monthIndex: number) => {
    if (!startDateStr) {
      const fallback = new Date();
      fallback.setMonth(fallback.getMonth() + monthIndex + 1);
      return fallback.toLocaleDateString("ar-IQ", { year: "numeric", month: "long", day: "numeric" });
    }
    const [year, month, day] = startDateStr.split("-").map(Number);
    const date = new Date(year, month - 1 + monthIndex, day);
    return date.toLocaleDateString("ar-IQ", { year: "numeric", month: "long", day: "numeric" });
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
              <p className="font-semibold text-foreground">{mainInfo.customerName}</p>
            </div>
            <div>
              <p className="text-gray-500">رقم الهاتف</p>
              <p className="font-semibold text-foreground" dir="ltr">{mainInfo.phoneNumber}</p>
            </div>
            <div>
              <p className="text-gray-500">العنوان</p>
              <p className="font-semibold text-foreground">{mainInfo.address || "غير محدد"}</p>
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
              <p className="font-semibold text-foreground">{mainInfo.guarantorName}</p>
            </div>
            <div>
              <p className="text-gray-500">رقم هاتف الكفيل</p>
              <p className="font-semibold text-foreground" dir="ltr">{mainInfo.guarantorPhone}</p>
            </div>
          </div>
        </div>
      </div>

      {/* حلقة تكرار لعرض كل قسط وجدول دفعاته على حدة */}
      {installments.map((item, idx) => {
        const totalPaidForThisInstallment = payments
          .filter((p) => p.installmentId === item.id)
          .reduce((sum, p) => sum + (p.amount || 0), 0);

        return (
          <div key={item.id || idx} className="space-y-4 bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-4 group">
              <div className="flex items-center gap-2 text-primary font-bold text-xl">
                <CreditCard className="w-6 h-6" />
                <span>القسط #{idx + 1}: {item.productName}</span>
                
                {/* أزرار التعديل والحذف تظهر عند مرور الماوس */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mr-2">
                  <button onClick={() => openEditModal(item)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="تعديل بيانات القسط">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => item.id && handleDeleteInstallment(item.id, item.productName)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="حذف القسط بالكامل">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-bold">
                {item.months} أشهر
              </span>
            </div>

            {/* ملخص مالية القسط */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-background/50 p-4 rounded-xl text-sm border border-border">
              <div>
                <p className="text-gray-500">سعر المنتج</p>
                <p className="font-bold">{item.productPrice.toLocaleString()} د.ع</p>
              </div>
              <div>
                <p className="text-gray-500">الدفعة المقدمة</p>
                <p className="font-bold">{item.downPayment.toLocaleString()} د.ع</p>
              </div>
              <div>
                <p className="text-gray-500">المتبقي للتقسيط</p>
                <p className="font-bold text-foreground">{Math.round(item.totalDue).toLocaleString()} د.ع</p>
              </div>
              <div>
                <p className="text-gray-500">القسط الشهري</p>
                <p className="font-extrabold text-primary">{Math.round(item.monthlyInstallment).toLocaleString()} د.ع</p>
              </div>
            </div>

            {/* جدول دفعات القسط */}
            <div className="border border-border rounded-xl overflow-hidden mt-4">
              <div className="p-4 bg-background/80 border-b border-border font-bold text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span>جدول دفعات ({item.productName})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-background/50 text-gray-500">
                    <tr>
                      <th className="p-3 font-medium">رقم الدفعة</th>
                      <th className="p-3 font-medium">المبلغ المطلوب</th>
                      <th className="p-3 font-medium">تاريخ الاستحقاق</th>
                      <th className="p-3 font-medium text-center">الحالة / الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {Array.from({ length: item.months }).map((_, mIdx) => {
                      const requiredAmountForThisStep = item.monthlyInstallment * (mIdx + 1);
                      const isPaid = totalPaidForThisInstallment >= requiredAmountForThisStep - 50;
                      const dueDateFormatted = getDueDate(item.startDate, mIdx);
                      const btnKey = `${item.id || idx}-${mIdx}`;

                      return (
                        <tr key={mIdx} className="hover:bg-background/40 transition-colors">
                          <td className="p-3 font-bold text-primary">الدفعة #{mIdx + 1}</td>
                          <td className="p-3 font-semibold">{Math.round(item.monthlyInstallment).toLocaleString()} د.ع</td>
                          <td className="p-3 text-foreground font-medium">{dueDateFormatted}</td>
                          <td className="p-3 text-center">
                            {isPaid ? (
                              <span className="px-2.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs font-bold inline-block">
                                تم الدفع ✓
                              </span>
                            ) : (
                              <div className="flex items-center justify-center gap-2">
                                <span className="px-2.5 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full text-xs font-bold">
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
                                  className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-1 text-xs font-bold shadow-sm"
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
          </div>
        );
      })}

      {/* --- نافذة تعديل القسط (Modal) --- */}
      {editingInstallment && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-background rounded-2xl w-full max-w-md p-6 shadow-xl border border-border animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">تعديل بيانات القسط</h2>
              <button onClick={() => setEditingInstallment(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
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
                  <label className="block text-sm font-medium mb-1">القسط الشهري (د.ع)</label>
                  <input
                    type="number"
                    value={editForm.monthlyInstallment}
                    onChange={(e) => setEditForm({...editForm, monthlyInstallment: Number(e.target.value)})}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">عدد الأشهر</label>
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
                  className="flex-1 py-2.5 rounded-xl border border-border font-medium hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
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
    </div>
  );
}