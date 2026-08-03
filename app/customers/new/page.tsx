"use client";

import { useState, useMemo, useEffect } from "react";
import { ArrowRight, Save, Calculator, User, ShieldCheck, Box, Loader2, Calendar, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addInstallmentRecord, getUserInstallments, InstallmentData } from "../../../services/firestore";
import { useAuth } from "../../../components/AuthProvider";

interface ExistingCustomer {
  customerName: string;
  phoneNumber: string;
  address: string;
  guarantorName: string;
  guarantorPhone: string;
}

export default function NewInstallmentPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingCustomers, setExistingCustomers] = useState<ExistingCustomer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // جلب العملاء الحاليين لخاصية الإكمال التلقائي
  useEffect(() => {
    if (user?.uid) {
      getUserInstallments(user.uid).then((list) => {
        const uniqueMap = new Map<string, ExistingCustomer>();
        list.forEach((item) => {
          const key = item.phoneNumber?.trim() || item.customerName?.trim();
          if (key && !uniqueMap.has(key)) {
            uniqueMap.set(key, {
              customerName: item.customerName || "",
              phoneNumber: item.phoneNumber || "",
              address: item.address || "",
              guarantorName: item.guarantorName || "",
              guarantorPhone: item.guarantorPhone || "",
            });
          }
        });
        setExistingCustomers(Array.from(uniqueMap.values()));
      });
    }
  }, [user]);

  // التاريخ التلقائي لأول قسط (بعد شهر من اليوم)
  const defaultStartDate = useMemo(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toISOString().split("T")[0];
  }, []);

  const [formData, setFormData] = useState({
    customerName: "",
    phoneNumber: "",
    address: "",
    guarantorName: "",
    guarantorPhone: "",
    productName: "",
    productPrice: "" as number | "",
    downPayment: "" as number | "",
    profitMargin: "" as number | "",
    months: "" as number | "",
    startDate: defaultStartDate,
  });

  // تصفية اقتراحات العملاء
  const filteredSuggestions = useMemo(() => {
    if (!formData.customerName.trim()) return [];
    return existingCustomers.filter(
      (c) =>
        c.customerName.toLowerCase().includes(formData.customerName.toLowerCase()) ||
        c.phoneNumber.includes(formData.customerName)
    );
  }, [existingCustomers, formData.customerName]);

  // تعبئة البيانات تلقائياً عند اختيار عميل من القائمة
  const selectCustomer = (customer: ExistingCustomer) => {
    setFormData((prev) => ({
      ...prev,
      customerName: customer.customerName,
      phoneNumber: customer.phoneNumber,
      address: customer.address,
      guarantorName: customer.guarantorName,
      guarantorPhone: customer.guarantorPhone,
    }));
    setShowSuggestions(false);
  };

  // الحسابات المالية الدقيقة
  const calculation = useMemo(() => {
    const productPrice = Number(formData.productPrice) || 0;
    const downPayment = Number(formData.downPayment) || 0;
    const profitMargin = Number(formData.profitMargin) || 0;
    const months = Number(formData.months) || 1;

    // الربح يُحسب على سعر المنتج كاملاً
    const totalProfit = productPrice * (profitMargin / 100);
    const totalAmountWithProfit = productPrice + totalProfit;
    
    // المتبقي للتقسيط بعد خصم الدفعة المقدمة
    const totalDue = Math.max(0, totalAmountWithProfit - downPayment);
    const monthlyInstallment = months > 0 ? totalDue / months : 0;

    return {
      totalAmountWithProfit,
      totalProfit,
      totalDue,
      monthlyInstallment,
    };
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.uid) {
      alert("لم يتم التعرف على حسابك، يرجى إعادة تسجيل الدخول.");
      return;
    }

    setIsSubmitting(true);

    const payload: Omit<InstallmentData, "id" | "createdAt"> = {
      userId: user.uid,
      customerName: formData.customerName,
      phoneNumber: formData.phoneNumber,
      address: formData.address,
      guarantorName: formData.guarantorName,
      guarantorPhone: formData.guarantorPhone,
      productName: formData.productName,
      productPrice: Number(formData.productPrice) || 0,
      downPayment: Number(formData.downPayment) || 0,
      profitMargin: Number(formData.profitMargin) || 0,
      months: Number(formData.months) || 1,
      totalDue: calculation.totalDue,
      totalProfit: calculation.totalProfit,
      monthlyInstallment: calculation.monthlyInstallment,
      startDate: formData.startDate,
    };

    const result = await addInstallmentRecord(payload);

    if (result.success && result.id) {
      alert("تم حفظ بيانات العميل والقسط بنجاح!");
      router.push("/customers");
    } else {
      alert("حدث خطأ أثناء الحفظ، يرجى المحاولة مرة أخرى.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center gap-4">
        <Link
          href="/customers"
          className="p-2 bg-card border border-border rounded-lg hover:bg-border/50 transition-colors"
        >
          <ArrowRight className="w-5 h-5 text-foreground" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">إضافة قسط جديد</h1>
          <p className="text-gray-500 text-sm mt-1">أدخل بيانات العميل والمنتج لحساب القسط الشهري وتواريخ الدفع.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* قسم بيانات العميل */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4 relative">
            <div className="flex items-center gap-2 mb-4 text-primary">
              <User className="w-5 h-5" />
              <h2 className="font-bold text-lg">بيانات العميل</h2>
            </div>
            
            {/* حقل الاسم مع قائمة البحث التلقائي */}
            <div className="relative">
              <label className="block text-sm font-medium mb-1">الاسم الرباعي (أو ابحث عن عميل سابق)</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="اكتب الاسم للبحث والتعبئة التلقائية..."
                  className="w-full p-3 pl-10 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/50 outline-none"
                  value={formData.customerName}
                  onChange={(e) => {
                    setFormData({ ...formData, customerName: e.target.value });
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
              </div>

              {/* القائمة المنسدلة للعملاء المتاحين */}
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="absolute z-50 w-full bg-card border border-border rounded-xl shadow-xl mt-1 max-h-52 overflow-y-auto">
                  <div className="p-2 text-xs font-bold text-gray-400 border-b border-border bg-background/50">
                    اختيار عميل مسجل سابقاً:
                  </div>
                  {filteredSuggestions.map((c, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="w-full text-right p-3 hover:bg-primary/10 transition-colors border-b border-border/50 last:border-0 flex flex-col gap-0.5"
                      onClick={() => selectCustomer(c)}
                    >
                      <span className="font-bold text-foreground text-sm">{c.customerName}</span>
                      <span className="text-xs text-gray-500" dir="ltr">{c.phoneNumber}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">رقم الهاتف</label>
              <input
                type="tel"
                required
                className="w-full p-3 rounded-lg border border-border bg-background"
                dir="ltr"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">عنوان السكن الدقيق</label>
              <input
                type="text"
                required
                className="w-full p-3 rounded-lg border border-border bg-background"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>

          {/* قسم بيانات الكفيل */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-4 text-primary">
              <ShieldCheck className="w-5 h-5" />
              <h2 className="font-bold text-lg">بيانات الكفيل</h2>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">اسم الكفيل</label>
              <input
                type="text"
                required
                className="w-full p-3 rounded-lg border border-border bg-background"
                value={formData.guarantorName}
                onChange={(e) => setFormData({ ...formData, guarantorName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">رقم هاتف الكفيل</label>
              <input
                type="tel"
                required
                className="w-full p-3 rounded-lg border border-border bg-background"
                dir="ltr"
                value={formData.guarantorPhone}
                onChange={(e) => setFormData({ ...formData, guarantorPhone: e.target.value })}
              />
            </div>
          </div>

          {/* قسم تفاصيل المنتج والتقسيط وتاريخ الاستحقاق */}
          <div className="md:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-4 text-primary">
              <Box className="w-5 h-5" />
              <h2 className="font-bold text-lg">تفاصيل المنتج وخطة التسديد</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">نوع المنتج</label>
                <input
                  type="text"
                  required
                  className="w-full p-3 rounded-lg border border-border bg-background"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">سعر المنتج (د.ع)</label>
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full p-3 rounded-lg border border-border bg-background"
                  value={formData.productPrice}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      productPrice: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الدفعة المقدمة (د.ع)</label>
                <input
                  type="number"
                  min="0"
                  className="w-full p-3 rounded-lg border border-border bg-background"
                  value={formData.downPayment}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      downPayment: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">نسبة الربح (%)</label>
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full p-3 rounded-lg border border-border bg-background"
                  value={formData.profitMargin}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      profitMargin: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">عدد الأشهر</label>
                <input
                  type="number"
                  required
                  min="1"
                  className="w-full p-3 rounded-lg border border-border bg-background"
                  value={formData.months}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      months: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>تاريخ أول قسط</span>
                </label>
                <input
                  type="date"
                  required
                  className="w-full p-3 rounded-lg border border-border bg-background"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* قسم النتائج الحسابية */}
        <div className="bg-primary text-primary-foreground rounded-xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-center text-center md:text-right gap-6 shadow-lg relative overflow-hidden">
          <Calculator className="absolute opacity-10 w-48 h-48 left-[-20px] top-[-20px] pointer-events-none" />

          <div className="z-10 w-full md:w-auto">
            <p className="text-primary-foreground/80 text-sm mb-1">السعر الكلي (السعر + الربح)</p>
            <p className="text-xl font-bold">
              {Math.round(calculation.totalAmountWithProfit).toLocaleString()} د.ع
            </p>
            <p className="text-primary-foreground/80 text-sm mt-3 mb-1">المتبقي للتقسيط (بعد المقدمة)</p>
            <p className="text-2xl font-black">{Math.round(calculation.totalDue).toLocaleString()} د.ع</p>
          </div>

          <div className="z-10 w-full md:w-auto border-y md:border-y-0 md:border-x border-primary-foreground/20 py-4 md:py-0 md:px-8">
            <p className="text-primary-foreground/80 text-sm mb-1">الربح الصافي</p>
            <p className="text-2xl font-bold text-green-300">
              +{Math.round(calculation.totalProfit).toLocaleString()} د.ع
            </p>
          </div>

          <div className="z-10 bg-background text-foreground px-6 py-4 rounded-xl shadow-inner w-full md:w-auto text-center border-2 border-primary/20">
            <p className="text-sm font-medium text-gray-500 mb-1">القسط الشهري المطلوب</p>
            <p className="text-3xl font-extrabold text-primary">
              {Math.round(calculation.monthlyInstallment).toLocaleString()} د.ع
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 rounded-xl hover:bg-primary/90 transition-all shadow-md font-bold text-lg disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
            <span>{isSubmitting ? "جاري الحفظ..." : "حفظ القسط وإنشاء سجل"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}