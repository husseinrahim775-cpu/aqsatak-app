"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { 
  ArrowRight, Save, Calculator, User, ShieldCheck, Box, Loader2, Calendar, 
  Search, Clock, Package, Camera, FileText, Image as ImageIcon, CheckCircle2, Sparkles 
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  addInstallmentRecord, 
  getUserInstallments, 
  getAvailableInventory, 
  bindProductToContract, 
  compressAndConvertToBase64,
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

function NewInstallmentContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const [formData, setFormData] = useState({
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
    paymentPeriod: "monthly" as "daily" | "weekly" | "monthly",
    months: "" as number | "",
    monthlyInstallment: "" as number | "",
    startDate: new Date().toISOString().split("T")[0],
  });

  // ⚡ استلام البيانات الممرة تلقائياً من الحاسبة السريعة عبر URL
  useEffect(() => {
    const priceParam = searchParams.get("price");
    const downParam = searchParams.get("down");
    const profitParam = searchParams.get("profit");
    const monthsParam = searchParams.get("months");
    const periodParam = searchParams.get("period");

    if (priceParam || downParam || profitParam || monthsParam || periodParam) {
      const parsedPrice = priceParam ? Number(priceParam) : "";
      const parsedDown = downParam !== null ? Number(downParam) : "";
      const parsedProfit = profitParam ? Number(profitParam) : 40;
      const parsedMonths = monthsParam ? Number(monthsParam) : "";
      const parsedPeriod = (periodParam as "daily" | "weekly" | "monthly") || "monthly";

      let calculatedCost: number | "" = "";
      if (typeof parsedPrice === "number" && parsedProfit) {
        calculatedCost = Math.round(parsedPrice / (1 + Number(parsedProfit) / 100));
      }

      setFormData((prev) => ({
        ...prev,
        productPrice: parsedPrice,
        purchasePrice: calculatedCost,
        downPayment: parsedDown,
        profitMargin: parsedProfit,
        months: parsedMonths,
        paymentPeriod: parsedPeriod,
      }));

      toast.success("تم استيراد حسابات العقد من الحاسبة السريعة بنجاح!");
    }
  }, [searchParams]);

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

  const formatNum = (num: number) => {
    return Math.round(num).toLocaleString("en-US");
  };

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
      newMargin = Math.round(rate * 100) / 100;
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

      if (idCardFile) {
        idCardUrl = await compressAndConvertToBase64(idCardFile);
      }
      if (contractFile) {
        contractUrl = await compressAndConvertToBase64(contractFile);
      }
      if (personalPhotoFile) {
        personalPhotoUrl = await compressAndConvertToBase64(personalPhotoFile);
      }

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

        toast.success("تم حفظ بيانات القسط والأوراق الثبوتية بنجاح!");
        router.push("/customers");
      } else {
        toast.error("حدث خطأ أثناء الحفظ، يرجى المحاولة مرة أخرى.");
      }
    } catch (error) {
      console.error("خطأ أثناء معالجة الصور والحفظ:", error);
      toast.error("حدث خطأ أثناء حفظ المستندات.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const periodLabel = formData.paymentPeriod === "daily" ? "يومي" : formData.paymentPeriod === "weekly" ? "أسبوعي" : "شهري";
  const periodUnitLabel = formData.paymentPeriod === "daily" ? "يوم" : formData.paymentPeriod === "weekly" ? "أسبوع" : "شهر";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="max-w-4xl mx-auto space-y-6 pb-12 font-sans dir-rtl text-right"
    >
      {/* 1. ترويسة الصفحة العصرية بأسلوب  Glass Style */}
      <div className="flex items-center justify-between bg-card/80 backdrop-blur-xl p-5 md:p-6 rounded-3xl border border-border shadow-sm">
        <div className="flex items-center gap-3.5">
          <Link
            href="/customers"
            className="p-2.5 bg-secondary hover:bg-orange-500/10 hover:text-orange-500 text-foreground rounded-2xl border border-border/80 transition-all"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
              <span>إنشاء عقد وقسط جديد</span>
              <Sparkles className="w-5 h-5 text-orange-500" />
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">أدخل بيانات العميل، الأوراق الثبوتية، والمنتج لتوثيق وحساب القسط .</p>
          </div>
        </div>

        <span className="hidden sm:inline-flex text-xs font-bold px-3.5 py-1.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 rounded-full">
          عقد ذكي جديد
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* قسم بيانات العميل */}
          <div className="bg-card/90 backdrop-blur-md border border-border rounded-3xl p-5 md:p-6 shadow-sm space-y-4 relative">
            <div className="flex items-center gap-2 text-orange-500 border-b border-border/60 pb-3">
              <User className="w-5 h-5" />
              <h2 className="font-extrabold text-base">بيانات العميل الأساسية</h2>
            </div>
            
            <div className="relative">
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">الاسم الرباعي (أو ابحث عن عميل سابق)</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="اكتب الاسم للبحث والتعبئة التلقائية..."
                  className="w-full p-3.5 pl-10 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-orange-500/50 outline-none transition-all"
                  value={formData.customerName}
                  onChange={(e) => {
                    setFormData({ ...formData, customerName: e.target.value });
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-4" />
              </div>

              {/* اقتراحات العميل  Dropdown */}
              <AnimatePresence>
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute z-50 w-full bg-card border border-border rounded-2xl shadow-2xl mt-1.5 max-h-56 overflow-y-auto"
                  >
                    <div className="p-2.5 text-[10px] font-bold text-muted-foreground border-b border-border/60 bg-secondary/40">
                      عميل مسجل سابقاً (ضغط للتعبئة):
                    </div>
                    {filteredSuggestions.map((c, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="w-full text-right p-3 hover:bg-orange-500/10 transition-colors border-b border-border/40 last:border-0 flex flex-col gap-0.5"
                        onClick={() => selectCustomer(c)}
                      >
                        <span className="font-bold text-foreground text-xs">{c.customerName}</span>
                        <span className="text-[10px] text-muted-foreground font-mono" dir="ltr">{c.phoneNumber}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">رقم الهاتف (الأساسي)</label>
              <input
                type="tel"
                required
                className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-bold text-left dir-ltr focus:ring-2 focus:ring-orange-500/50 outline-none"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">عنوان السكن الدقيق</label>
              <input
                type="text"
                required
                className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-orange-500/50 outline-none"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>

          {/* قسم بيانات الكفيل */}
          <div className="bg-card/90 backdrop-blur-md border border-border rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-purple-500 border-b border-border/60 pb-3">
              <ShieldCheck className="w-5 h-5" />
              <h2 className="font-extrabold text-base">بيانات الكفيل الضامن</h2>
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">اسم الكفيل الثلاثي</label>
              <input
                type="text"
                required
                className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-orange-500/50 outline-none"
                value={formData.guarantorName}
                onChange={(e) => setFormData({ ...formData, guarantorName: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">رقم هاتف الكفيل</label>
              <input
                type="tel"
                required
                className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-bold text-left dir-ltr focus:ring-2 focus:ring-orange-500/50 outline-none"
                value={formData.guarantorPhone}
                onChange={(e) => setFormData({ ...formData, guarantorPhone: e.target.value })}
              />
            </div>
          </div>

          {/* 📸 قسم مرفقات الأوراق الثبوتية والعقد  Cards */}
          <div className="md:col-span-2 bg-card/90 backdrop-blur-md border border-border rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-orange-500 border-b border-border/60 pb-3">
              <Camera className="w-5 h-5" />
              <h2 className="font-extrabold text-base">المستندات والأوراق الثبوتية (اختياري)</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* صورة الهوية */}
              <div className="border border-dashed border-border/80 rounded-2xl p-4 text-center space-y-2.5 hover:border-orange-500/50 transition-colors bg-secondary/20">
                <ImageIcon className="w-8 h-8 text-orange-500 mx-auto" />
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
                  className="inline-block bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs px-3.5 py-2 rounded-xl font-bold cursor-pointer hover:bg-orange-500/20 transition-colors shadow-sm"
                >
                  {idCardFile ? "تم اختيار الصورة ✓" : "اختر صورة الهوية"}
                </label>
                {idCardFile && <p className="text-[10px] text-muted-foreground truncate font-mono">{idCardFile.name}</p>}
              </div>

              {/* العقد الورقي */}
              <div className="border border-dashed border-border/80 rounded-2xl p-4 text-center space-y-2.5 hover:border-orange-500/50 transition-colors bg-secondary/20">
                <FileText className="w-8 h-8 text-orange-500 mx-auto" />
                <span className="block text-xs font-bold text-foreground">صورة العقد الورقي الموقّع</span>
                <input
                  type="file"
                  accept="image/*"
                  id="contractDoc"
                  className="hidden"
                  onChange={(e) => setContractFile(e.target.files?.[0] || null)}
                />
                <label
                  htmlFor="contractDoc"
                  className="inline-block bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs px-3.5 py-2 rounded-xl font-bold cursor-pointer hover:bg-orange-500/20 transition-colors shadow-sm"
                >
                  {contractFile ? "تم اختيار العقد ✓" : "اختر صورة العقد"}
                </label>
                {contractFile && <p className="text-[10px] text-muted-foreground truncate font-mono">{contractFile.name}</p>}
              </div>

              {/* صورة الزبون */}
              <div className="border border-dashed border-border/80 rounded-2xl p-4 text-center space-y-2.5 hover:border-orange-500/50 transition-colors bg-secondary/20">
                <User className="w-8 h-8 text-orange-500 mx-auto" />
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
                  className="inline-block bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs px-3.5 py-2 rounded-xl font-bold cursor-pointer hover:bg-orange-500/20 transition-colors shadow-sm"
                >
                  {personalPhotoFile ? "تم اختيار الصورة ✓" : "اختر صورة العميل"}
                </label>
                {personalPhotoFile && <p className="text-[10px] text-muted-foreground truncate font-mono">{personalPhotoFile.name}</p>}
              </div>

            </div>
          </div>

          {/* قسم تفاصيل المنتج والتقسيط */}
          <div className="md:col-span-2 bg-card/90 backdrop-blur-md border border-border rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-orange-500 border-b border-border/60 pb-3">
              <Box className="w-5 h-5" />
              <h2 className="font-extrabold text-base">تفاصيل السلعة وخطة التسديد</h2>
            </div>

            {/* ربط مادة من المخزن  Select Box */}
            <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-4 space-y-2">
              <label className="text-xs font-bold text-orange-600 dark:text-orange-400 flex items-center gap-2">
                <Package className="w-4 h-4" /> اختر مادة متوفرة بالمخزن المالي (تعبئة تلقائية للأسعار)
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => handleSelectProduct(e.target.value)}
                className="w-full p-3.5 rounded-2xl border border-border bg-card text-foreground font-bold text-xs focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer"
              >
                <option value="">-- اضغط هنا لاختيار مادة من المخزن --</option>
                {availableProducts.map((item) => (
                  <option key={item.id} value={item.id}>
                    [{item.category}] {item.title} - ${formatNum(item.price)} {item.specs?.chassisNumber ? `| شاصي: ${item.specs.chassisNumber}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
              <div className="sm:col-span-2 md:col-span-3">
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">نوع واسم المنتج</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: آيفون 15 برو ماكس"
                  className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">سعر الشراء / التكلفة (د.ع)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-black dir-ltr text-right focus:ring-2 focus:ring-orange-500 outline-none"
                  value={formData.purchasePrice}
                  onChange={(e) =>
                    handlePurchasePriceChange(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">نسبة الربح المضافة (%)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  placeholder="0"
                  className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-black dir-ltr text-right text-orange-500 focus:ring-2 focus:ring-orange-500 outline-none"
                  value={formData.profitMargin}
                  onChange={(e) =>
                    handleProfitMarginChange(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">سعر البيع الكلي (د.ع)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  placeholder="0"
                  className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-black text-foreground dir-ltr text-right focus:ring-2 focus:ring-orange-500 outline-none"
                  value={formData.productPrice}
                  onChange={(e) =>
                    handleProductPriceChange(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">الدفعة المقدمة (د.ع)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-black text-emerald-600 dark:text-emerald-400 dir-ltr text-right focus:ring-2 focus:ring-orange-500 outline-none"
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
                <label className="block text-xs font-bold text-orange-500 mb-1.5">فترة التسديد (نوع القسط)</label>
                <select
                  value={formData.paymentPeriod}
                  onChange={(e) => setFormData({ ...formData, paymentPeriod: e.target.value as "daily" | "weekly" | "monthly" })}
                  className="w-full p-3.5 rounded-2xl border border-orange-500/40 bg-background text-foreground text-xs font-extrabold focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer"
                >
                  <option value="monthly">قسط شهري</option>
                  <option value="weekly">قسط أسبوعي</option>
                  <option value="daily">قسط يومي</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">عدد الدفعات ({periodUnitLabel})</label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="0"
                  className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-black dir-ltr text-right focus:ring-2 focus:ring-orange-500 outline-none"
                  value={formData.months}
                  onChange={(e) =>
                    handleMonthsChange(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-orange-500 mb-1.5">
                  أو أدخل القسط الـ{periodLabel} (د.ع)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  className="w-full p-3.5 rounded-2xl border border-orange-500/40 bg-background focus:ring-2 focus:ring-orange-500 outline-none font-black text-xs text-orange-500 dir-ltr text-right"
                  value={formData.monthlyInstallment}
                  onChange={(e) =>
                    handleMonthlyInstallmentChange(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-orange-500" />
                  <span>تاريخ استحقاق أول قسط</span>
                </label>
                <input
                  type="date"
                  required
                  className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 5. كارت النتائج الحسابية البارز  Hero Calculation Box */}
        <div className="bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-center text-center md:text-right gap-6 shadow-xl shadow-orange-500/20 relative overflow-hidden">
          <Calculator className="absolute opacity-10 w-52 h-52 left-[-20px] top-[-20px] pointer-events-none" />

          <div className="z-10 w-full md:w-auto space-y-2">
            <div>
              <p className="text-white/80 text-[10px] font-bold">إجمالي سعر البيع بالعقد</p>
              <p className="text-lg font-black tracking-tight">
                {formatNum(calculation.totalAmountWithProfit)} د.ع
              </p>
            </div>
            <div>
              <p className="text-white/80 text-[10px] font-bold">المتبقي للتقسيط (بعد خصم المقدمة)</p>
              <p className="text-2xl font-black tracking-tight">{formatNum(calculation.totalDue)} د.ع</p>
            </div>
          </div>

          <div className="z-10 w-full md:w-auto border-y md:border-y-0 md:border-x border-white/20 py-4 md:py-0 md:px-8 space-y-2">
            <p className="text-white/80 text-[10px] font-bold flex items-center justify-center md:justify-start gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>مدة التسديد المحسوبة</span>
            </p>
            <div className="text-2xl font-black text-amber-200">
              {calculation.calculatedMonths} {periodUnitLabel}
              {calculation.calculatedDays > 0 && ` و ${calculation.calculatedDays} يوم`}
            </div>
            <p className="text-xs text-white/90 font-bold">
              الربح الصافي: <span className="text-emerald-300 font-extrabold">+{formatNum(calculation.totalProfit)} د.ع</span>
            </p>
          </div>

          <div className="z-10 bg-card text-foreground px-6 py-4 rounded-2xl shadow-lg w-full md:w-auto text-center border border-border">
            <p className="text-xs font-bold text-muted-foreground mb-1">القسط الـ{periodLabel} المطلوب</p>
            <p className="text-3xl font-black text-orange-500 tracking-tight">
              {formatNum(calculation.monthlyInstallment)} <span className="text-xs font-bold text-muted-foreground">د.ع</span>
            </p>
          </div>
        </div>

        {/* 6. زر الحفظ الرئيسي */}
        <div className="flex justify-end pt-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-4 rounded-2xl shadow-lg shadow-orange-500/20 font-extrabold text-base hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            <span>{isSubmitting ? "جاري الحفظ والتوثيق..." : "حفظ القسط وإنشاء سجل العقد"}</span>
          </motion.button>
        </div>
      </form>
    </motion.div>
  );
}

export default function NewInstallmentPage() {
  return (
    <Suspense fallback={
      <div className="h-[80vh] flex flex-col items-center justify-center gap-3 text-orange-500">
        <Loader2 className="w-10 h-10 animate-spin" />
        <span className="text-xs font-bold text-muted-foreground animate-pulse">جاري تحضير نموذج العقد...</span>
      </div>
    }>
      <NewInstallmentContent />
    </Suspense>
  );
}