"use client";

import { useState, useMemo, useEffect } from "react";
import { ArrowRight, Save, Calculator, User, ShieldCheck, Box, Loader2, Calendar, Search, Clock, Package, Camera, FileText, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { 
  addInstallmentRecord, 
  getUserInstallments, 
  getAvailableInventory, 
  bindProductToContract, 
  uploadCustomerDocument,
  InstallmentData, 
  InventoryItem 
} from "@/services/firestore";
import { useAuth } from "../../../components/AuthProvider";
import { toast } from "sonner";

interface ExistingCustomer {
  customerName: string;
  phoneNumber: string;
  address: string;
  guarantorName: string;
  guarantorPhone: string;
}

export default function NewInstallmentPage() {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingCustomers, setExistingCustomers] = useState<ExistingCustomer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // حالات المخزن المالي
  const [availableProducts, setAvailableProducts] = useState<InventoryItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  // حالات ملفات الصور
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [personalPhotoFile, setPersonalPhotoFile] = useState<File | null>(null);

  // جلب السلع المتوفرة بالمخزن
  useEffect(() => {
    getAvailableInventory()
      .then((items) => setAvailableProducts(items || []))
      .catch((err) => console.error("خطأ في جلب بيانات المخزن:", err));
  }, []);

  // جلب العملاء الحاليين لخاصية الإكمال التلقائي
  useEffect(() => {
    if (user?.uid) {
      getUserInstallments(user.uid).then((list) => {
        const uniqueMap = new Map<string, ExistingCustomer>();
        (list || []).forEach((item) => {
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

  const [formData, setFormData] = useState({
    customerName: "",
    phoneNumber: "",
    address: "",
    guarantorName: "",
    guarantorPhone: "",
    productName: "",
    purchasePrice: "" as number | "",
    profitMargin: "50" as number | string,
    productPrice: "" as number | "",
    downPayment: "" as number | "",
    paymentPeriod: "monthly" as "daily" | "weekly" | "monthly",
    months: "" as number | "",
    monthlyInstallment: "" as number | "",
    startDate: new Date().toISOString().split("T")[0],
  });

  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    if (!productId) return;

    const product = availableProducts.find((p) => p.id === productId);
    if (product) {
      const formattedTitle = `${product.title} ${
        product.specs?.chassisNumber ? `(شاصي: ${product.specs.chassisNumber})` : ""
      }`;
      const cost = product.price;

      setFormData((prev) => ({
        ...prev,
        productName: formattedTitle,
        purchasePrice: cost,
        productPrice: prev.profitMargin !== "" && cost > 0 
          ? cost + cost * (Number(prev.profitMargin) / 100) 
          : cost,
      }));
    }
  };

  const handlePurchasePriceChange = (val: number | "") => {
    const cost = val;
    let newSellPrice = formData.productPrice;

    if (cost !== "" && formData.profitMargin !== "" && cost > 0) {
      newSellPrice = cost + cost * (Number(formData.profitMargin) / 100);
    }

    setFormData((prev) => ({
      ...prev,
      purchasePrice: cost,
      productPrice: newSellPrice,
    }));
  };

  const handleProfitMarginChange = (val: number | "") => {
    const margin = val;
    let newSellPrice = formData.productPrice;

    if (margin !== "" && formData.purchasePrice !== "" && Number(formData.purchasePrice) > 0) {
      const cost = Number(formData.purchasePrice);
      newSellPrice = cost + cost * (Number(margin) / 100);
    }

    setFormData((prev) => ({
      ...prev,
      profitMargin: margin,
      productPrice: newSellPrice,
    }));
  };

  const handleProductPriceChange = (val: number | "") => {
    const sellPrice = val;
    let newMargin = formData.profitMargin;

    if (sellPrice !== "" && formData.purchasePrice !== "" && Number(formData.purchasePrice) > 0) {
      const cost = Number(formData.purchasePrice);
      const profitAmount = Number(sellPrice) - cost;
      const rate = (profitAmount / cost) * 100;
      newMargin = Number(rate.toFixed(2));
    }

    setFormData((prev) => ({
      ...prev,
      productPrice: sellPrice,
      profitMargin: newMargin,
    }));
  };

  const handleMonthsChange = (val: number | "") => {
    setFormData((prev) => ({
      ...prev,
      months: val,
      monthlyInstallment: "", 
    }));
  };

  const handleMonthlyInstallmentChange = (val: number | "") => {
    setFormData((prev) => ({
      ...prev,
      monthlyInstallment: val,
      months: "", 
    }));
  };

  const calculation = useMemo(() => {
    const productPrice = Number(formData.productPrice) || 0;
    const purchasePrice = Number(formData.purchasePrice) || 0;
    const downPayment = Number(formData.downPayment) || 0;

    const totalProfit = purchasePrice > 0 
      ? Math.max(0, productPrice - purchasePrice) 
      : productPrice * ((Number(formData.profitMargin) || 0) / 100);

    const totalDue = Math.max(0, productPrice - downPayment);

    let calculatedMonths = 0;
    let calculatedDays = 0;
    let finalMonthlyInstallment = 0;

    if (formData.monthlyInstallment !== "" && Number(formData.monthlyInstallment) > 0) {
      finalMonthlyInstallment = Number(formData.monthlyInstallment);
      if (totalDue > 0) {
        const exactMonths = totalDue / finalMonthlyInstallment;
        calculatedMonths = Math.floor(exactMonths);
        const remainingFraction = exactMonths - calculatedMonths;
        calculatedDays = Math.round(remainingFraction * (formData.paymentPeriod === "daily" ? 1 : formData.paymentPeriod === "weekly" ? 7 : 30));
      }
    } 
    else {
      calculatedMonths = Number(formData.months) || 1;
      calculatedDays = 0;
      finalMonthlyInstallment = calculatedMonths > 0 ? totalDue / calculatedMonths : 0;
    }

    return {
      totalAmountWithProfit: productPrice,
      totalProfit,
      totalDue,
      monthlyInstallment: finalMonthlyInstallment,
      calculatedMonths,
      calculatedDays,
    };
  }, [formData]);

  const filteredSuggestions = useMemo(() => {
    if (!formData.customerName.trim()) return [];
    return existingCustomers.filter(
      (c) =>
        c.customerName.toLowerCase().includes(formData.customerName.toLowerCase()) ||
        c.phoneNumber.includes(formData.customerName)
    );
  }, [existingCustomers, formData.customerName]);

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

  // ⚡ الحفظ الآمن والمستقر مع/بدون إنترنت
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.uid) {
      toast.error("لم يتم التعرف على حسابك، يرجى إعادة تسجيل الدخول.");
      return;
    }

    setIsSubmitting(true);

    try {
      let idCardUrl = "";
      let contractUrl = "";
      let personalPhotoUrl = "";

      // 🌐 فحص الاتصال بالإنترنت قبل البدء برفع الصور
      if (navigator.onLine) {
        const uploadPromises = [
          idCardFile ? uploadCustomerDocument(idCardFile, "id_cards") : Promise.resolve(""),
          contractFile ? uploadCustomerDocument(contractFile, "contracts") : Promise.resolve(""),
          personalPhotoFile ? uploadCustomerDocument(personalPhotoFile, "photos") : Promise.resolve(""),
        ];
        [idCardUrl, contractUrl, personalPhotoUrl] = await Promise.all(uploadPromises);
      } else {
        toast.info("أنت تعمل بدون إنترنت حالياً، سيتم حفظ العقد بدون رفع الصور.");
      }

      // إعداد بيانات القسط والعقد
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
        months: calculation.calculatedMonths || 1,
        paymentPeriod: formData.paymentPeriod,
        totalDue: calculation.totalDue,
        totalProfit: calculation.totalProfit,
        monthlyInstallment: calculation.monthlyInstallment,
        startDate: formData.startDate,
        documents: {
          idCardUrl,
          contractUrl,
          personalPhotoUrl,
        },
      };

      const result = await addInstallmentRecord(payload);

      if (result.success && result.id) {
        if (selectedProductId) {
          await bindProductToContract(
            selectedProductId,
            result.id,
            formData.customerName,
            result.id
          );
        }

        toast.success("تم حفظ بيانات العميل والقسط بنجاح!");
        window.location.href = "/customers";
      } else {
        toast.error("حدث خطأ أثناء الحفظ، يرجى المحاولة مرة أخرى.");
      }
    } catch (error) {
      console.error("خطأ أثناء الرفع والحفظ:", error);
      toast.error("حدث خطأ أثناء حفظ البيانات.");
    } finally {
      setIsSubmitting(false); // 👈 ينتهي التحميل ولا يظل معلقاً
    }
  };

  const periodLabel = formData.paymentPeriod === "daily" ? "يومي" : formData.paymentPeriod === "weekly" ? "أسبوعي" : "شهري";
  const periodUnitLabel = formData.paymentPeriod === "daily" ? "يوم" : formData.paymentPeriod === "weekly" ? "أسبوع" : "شهر";

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
          <h1 className="text-2xl font-bold text-foreground">إضافة قسط وعقد جديد</h1>
          <p className="text-gray-500 text-sm mt-1">أدخل بيانات العميل، الأوراق الثبوتية، والمنتج لحساب وتوثيق القسط.</p>
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

          {/* 📸 قسم مرفقات الأوراق الثبوتية والعقد */}
          <div className="md:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-2 text-primary">
              <Camera className="w-5 h-5" />
              <h2 className="font-bold text-lg">المستندات والأوراق الثبوتية (اختياري)</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. صورة الهوية / البطاقة الموحدة */}
              <div className="border border-dashed border-border rounded-xl p-4 text-center space-y-2 hover:border-primary/50 transition">
                <ImageIcon className="w-8 h-8 text-primary mx-auto" />
                <span className="block text-xs font-bold text-foreground">صورة الهوية / البطاقة الموحدة</span>
                <input
                  type="file"
                  accept="image/*"
                  id="idCard"
                  className="hidden"
                  onChange={(e) => setIdCardFile(e.target.files?.[0] || null)}
                />
                <label
                  htmlFor="idCard"
                  className="inline-block bg-primary/10 text-primary text-xs px-3 py-2 rounded-lg font-semibold cursor-pointer hover:bg-primary/20 transition"
                >
                  {idCardFile ? "تم اختيار الملف ✓" : "اختر صورة الهوية"}
                </label>
                {idCardFile && <p className="text-[10px] text-gray-400 truncate">{idCardFile.name}</p>}
              </div>

              {/* 2. صورة العقد المكتوب */}
              <div className="border border-dashed border-border rounded-xl p-4 text-center space-y-2 hover:border-primary/50 transition">
                <FileText className="w-8 h-8 text-primary mx-auto" />
                <span className="block text-xs font-bold text-foreground">صورة العقد الورقي</span>
                <input
                  type="file"
                  accept="image/*"
                  id="contractDoc"
                  className="hidden"
                  onChange={(e) => setContractFile(e.target.files?.[0] || null)}
                />
                <label
                  htmlFor="contractDoc"
                  className="inline-block bg-primary/10 text-primary text-xs px-3 py-2 rounded-lg font-semibold cursor-pointer hover:bg-primary/20 transition"
                >
                  {contractFile ? "تم اختيار الملف ✓" : "اختر صورة العقد"}
                </label>
                {contractFile && <p className="text-[10px] text-gray-400 truncate">{contractFile.name}</p>}
              </div>

              {/* 3. صورة العميل الشخصية */}
              <div className="border border-dashed border-border rounded-xl p-4 text-center space-y-2 hover:border-primary/50 transition">
                <User className="w-8 h-8 text-primary mx-auto" />
                <span className="block text-xs font-bold text-foreground">صورة الزبون الشخصية</span>
                <input
                  type="file"
                  accept="image/*"
                  id="personalPhoto"
                  className="hidden"
                  onChange={(e) => setPersonalPhotoFile(e.target.files?.[0] || null)}
                />
                <label
                  htmlFor="personalPhoto"
                  className="inline-block bg-primary/10 text-primary text-xs px-3 py-2 rounded-lg font-semibold cursor-pointer hover:bg-primary/20 transition"
                >
                  {personalPhotoFile ? "تم اختيار الملف ✓" : "اختر صورة العميل"}
                </label>
                {personalPhotoFile && <p className="text-[10px] text-gray-400 truncate">{personalPhotoFile.name}</p>}
              </div>
            </div>
          </div>

          {/* قسم تفاصيل المنتج والتقسيط */}
          <div className="md:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-4 text-primary">
              <Box className="w-5 h-5" />
              <h2 className="font-bold text-lg">تفاصيل المنتج وخطة التسديد</h2>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-2 space-y-2">
              <label className="text-sm font-bold text-primary flex items-center gap-2">
                <Package className="w-4 h-4" /> اختر مادة متوفرة بالمخزن المالي (تعبئة تلقائية للأسعار)
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => handleSelectProduct(e.target.value)}
                className="w-full p-3 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/50 outline-none text-sm"
              >
                <option value="">-- اضغط هنا لاختيار مادة من المخزن --</option>
                {availableProducts.map((item) => (
                  <option key={item.id} value={item.id}>
                    [{item.category}] {item.title} - ${item.price} {item.specs?.chassisNumber ? `| شاصي: ${item.specs.chassisNumber}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="sm:col-span-2 md:col-span-3">
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
                <label className="block text-sm font-medium mb-1">سعر الشراء (التكلفة)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="أدخل سعر الشراء"
                  className="w-full p-3 rounded-lg border border-border bg-background"
                  value={formData.purchasePrice}
                  onChange={(e) =>
                    handlePurchasePriceChange(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">نسبة الربح (%)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  placeholder="0"
                  className="w-full p-3 rounded-lg border border-border bg-background"
                  value={formData.profitMargin}
                  onChange={(e) =>
                    handleProfitMarginChange(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">سعر البيع الكلي (د.ع)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  placeholder="السعر الكلي للبيع"
                  className="w-full p-3 rounded-lg border border-border bg-background"
                  value={formData.productPrice}
                  onChange={(e) =>
                    handleProductPriceChange(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">الدفعة المقدمة (د.ع)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
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

              {/* 🔄 اختيار نظام فترة التسديد */}
              <div>
                <label className="block text-sm font-medium mb-1 text-primary font-bold">فترة التسديد (نوع القسط)</label>
                <select
                  value={formData.paymentPeriod}
                  onChange={(e) => setFormData({ ...formData, paymentPeriod: e.target.value as "daily" | "weekly" | "monthly" })}
                  className="w-full p-3 rounded-lg border border-primary/50 bg-background text-foreground focus:ring-2 focus:ring-primary font-bold outline-none"
                >
                  <option value="monthly">قسط شهري</option>
                  <option value="weekly">قسط أسبوعي</option>
                  <option value="daily">قسط يومي</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">عدد الدفعات ({periodUnitLabel})</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder={`مثال: ${formData.paymentPeriod === "daily" ? "30" : formData.paymentPeriod === "weekly" ? "12" : "12"}`}
                  className="w-full p-3 rounded-lg border border-border bg-background"
                  value={formData.months}
                  onChange={(e) =>
                    handleMonthsChange(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-primary font-bold">
                  أو أدخل القسط الـ{periodLabel} (د.ع)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="مثال: 50000"
                  className="w-full p-3 rounded-lg border border-primary/40 bg-background focus:ring-2 focus:ring-primary outline-none"
                  value={formData.monthlyInstallment}
                  onChange={(e) =>
                    handleMonthlyInstallmentChange(e.target.value === "" ? "" : Number(e.target.value))
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

        {/* قسم النتائج الحسابية الفوري */}
        <div className="bg-primary text-primary-foreground rounded-xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-center text-center md:text-right gap-6 shadow-lg relative overflow-hidden">
          <Calculator className="absolute opacity-10 w-48 h-48 left-[-20px] top-[-20px] pointer-events-none" />

          <div className="z-10 w-full md:w-auto space-y-2">
            <div>
              <p className="text-primary-foreground/80 text-xs">سعر البيع الكلي</p>
              <p className="text-lg font-bold">
                {Math.round(calculation.totalAmountWithProfit).toLocaleString()} د.ع
              </p>
            </div>
            <div>
              <p className="text-primary-foreground/80 text-xs">المتبقي للتقسيط (بعد المقدمة)</p>
              <p className="text-xl font-black">{Math.round(calculation.totalDue).toLocaleString()} د.ع</p>
            </div>
          </div>

          <div className="z-10 w-full md:w-auto border-y md:border-y-0 md:border-x border-primary-foreground/20 py-4 md:py-0 md:px-8 space-y-2">
            <p className="text-primary-foreground/80 text-xs flex items-center justify-center md:justify-start gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>مدة التسديد المحسوبة</span>
            </p>
            <div className="text-xl font-extrabold text-amber-300">
              {calculation.calculatedMonths} {periodUnitLabel}
              {calculation.calculatedDays > 0 && ` و ${calculation.calculatedDays} يوم`}
            </div>
            <p className="text-xs text-primary-foreground/70">
              الربح الصافي: <span className="text-green-300 font-bold">+{Math.round(calculation.totalProfit).toLocaleString()} د.ع</span>
            </p>
          </div>

          <div className="z-10 bg-background text-foreground px-6 py-4 rounded-xl shadow-inner w-full md:w-auto text-center border-2 border-primary/20">
            <p className="text-sm font-medium text-gray-500 mb-1">القسط الـ{periodLabel} المطلوب</p>
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