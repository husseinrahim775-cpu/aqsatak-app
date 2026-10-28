"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { 
  ArrowRight, Save, Calculator, User, ShieldCheck, Box, Loader2, Calendar, 
  Search, Clock, Package, Camera, FileText, Image as ImageIcon, Sparkles,
  ChevronRight, ChevronLeft, ToggleLeft, ToggleRight, ScanText
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
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";
import { useTheme } from "next-themes";

interface ExistingCustomer {
  customerName: string;
  phoneNumber: string;
  address: string;
  guarantorName: string;
  guarantorPhone: string;
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

function NewInstallmentContent() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanningId, setIsScanningId] = useState(false);
  const [existingCustomers, setExistingCustomers] = useState<ExistingCustomer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // 🛡️ زر تفعيل/إيقاف الكفيل الضامن (افتراضياً مفعل)
  const [hasGuarantor, setHasGuarantor] = useState(true);

  // حالات المخزن المالي
  const [availableProducts, setAvailableProducts] = useState<InventoryItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");

  // حالات ملفات الصور
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [personalPhotoFile, setPersonalPhotoFile] = useState<File | null>(null);

  // حالات التقويم التفاعلي المكتمل (سنة - شهر - يوم)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonthObj, setSelectedMonthObj] = useState<{ num: string; name: string } | null>({
    num: String(new Date().getMonth() + 1).padStart(2, "0"),
    name: `شهر ${new Date().getMonth() + 1}`
  });
  const [datePickerStep, setDatePickerStep] = useState<"months" | "days">("months");

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

// 🔍 دالة المسح الضوئي المستهدفة الدقيقة لحقول الهوية العراقية الاربعة
  const handleScanIDCard = async (file: File) => {
    if (!file) return;

    try {
      setIsScanningId(true);
      toast.info("جاري تحضير الصورة وتحليلها بالذكاء الاصطناعي...");

      let base64Image = "";
      try {
        base64Image = await compressAndConvertToBase64(file);
      } catch (imgErr) {
        console.error("خطأ أثناء ضغط وتحويل الصورة:", imgErr);
        toast.error("فشل في معالجة حجم الصورة، حاول اختيار صورة أخرى.");
        setIsScanningId(false);
        return;
      }

      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Image }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "خطأ غير معروف في السيرفر" }));
        console.error("خطأ السيرفر أثناء الـ OCR:", res.status, errorData);
        toast.error(`خطأ (${res.status}): ${errorData.error || "تعذر تحليل الصورة"}`);
        return;
      }

      const data = await res.json();

      if (data.text) {
        const fullText: string = data.text;
        console.log("النص الكامل المستخرج من OCR:\n", fullText);

        const phoneMatch = fullText.match(/(07[3-9]\d{8})/);

        // دالة تنظيف القيمة بعد الشارحة وإزالة الرموز والكردي
        const cleanValue = (raw: string) => {
          if (!raw) return "";
          return raw
            .split("\n")[0]
            .replace(/[^\u0621-\u064A\s]/g, "") // الأحرف العربية والمسافات فقط
            .replace(/\s+/g, " ")
            .trim();
        };

        // دالة مرنة لجلب النص المقابل للعنوان
        const getValue = (pattern: RegExp) => {
          const match = fullText.match(pattern);
          return match && match[1] ? cleanValue(match[1]) : "";
        };

        // 1. الاسم الأول
        const firstName = getValue(/(?:الاسم|ناو)[^\n:]*:\s*([^\n\r]+)/i);

        // 2. اسم الأب (يدعم الأب / الاب / لأب / باوك)
        const fatherName = getValue(/(?:الاب|الأب|لأب|باوك)[^\n:]*:\s*([^\n\r]+)/i);

        // 3. اسم الجد الأول (قبل اللقب أو الأم)
        const grandFatherName = getValue(/(?:الجد|بابير|باپیر)[^\n:]*:\s*([^\n\r]+)/i);

        // 4. اللقب
        const surname = getValue(/(?:اللقب|نازناو)[^\n:]*:\s*([^\n\r]+)/i);

        // تجميع الخانات الأربع
        let assembledFullName = [firstName, fatherName, grandFatherName, surname]
          .filter(Boolean)
          .join(" ");

        // خيار احتياطي لتنظيف وجلب القيم من الأسطر المحتوية على (:)
        if (!fatherName || !assembledFullName.includes(fatherName)) {
          const lines = fullText.split("\n").map((l) => l.trim()).filter(Boolean);
          const extractedValues: string[] = [];

          lines.forEach((line) => {
            if (line.includes(":")) {
              const parts = line.split(":");
              const labelPart = parts[0];
              const valPart = parts[1];

              // استبعاد خطوط الأم والجنس والفصيلة والجد الثاني
              if (labelPart && valPart && !/(?:الأم|الام|دايك|الجنس|فصيلة|خوێن)/i.test(labelPart)) {
                const cleaned = cleanValue(valPart);
                if (cleaned && !["ذكر", "انثى"].includes(cleaned)) {
                  extractedValues.push(cleaned);
                }
              }
            }
          });

          if (extractedValues.length >= 3) {
            // أخذ أول 4 عناصر مستخرجة بعد الشارحة
            assembledFullName = extractedValues.slice(0, 4).join(" ");
          }
        }

        setFormData((prev) => ({
          ...prev,
          customerName: assembledFullName || prev.customerName,
          phoneNumber: phoneMatch ? phoneMatch[0] : prev.phoneNumber,
        }));

        if (assembledFullName) {
          toast.success(`تم استخراج الاسم: ${assembledFullName}`);
        } else {
          toast.warning("تمت قراءة المستند لكن تعذر تجميع الاسم تلقائياً.");
        }
      } else {
        toast.warning("تم رفع الصورة ولكن لم يتم التعرف على نصوص واضحة.");
      }
    } catch (err: any) {
      console.error("خطأ أثناء الاتصال بالمسح الضوئي:", err?.message || err);
      toast.error("حدث خطأ في الاتصال بخدمة التحليل الذكي.");
    } finally {
      setIsScanningId(false);
    }
  };
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

  useEffect(() => {
    getAvailableInventory()
      .then((items) => setAvailableProducts(items || []))
      .catch((err) => console.error("خطأ في جلب بيانات المخزن:", err));
  }, []);

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

  const formatNum = (num: number) => {
    return Math.round(num).toLocaleString("en-US");
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

  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    if (!productId) return;

    const product = availableProducts.find((p) => p.id === productId);
    if (product) {
      const formattedTitle = `${product.title} ${
        product.specs?.chassisNumber ? `(شاصي: ${product.specs.chassisNumber})` : ""
      }`;
      const cost = product.costPrice || product.price;

      setFormData((prev) => ({
        ...prev,
        productName: formattedTitle,
        purchasePrice: cost,
        productPrice: product.price || (cost + cost * (Number(prev.profitMargin) / 100)),
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
      guarantorName: customer.guarantorName || "",
      guarantorPhone: customer.guarantorPhone || "",
    }));
    if (customer.guarantorName) setHasGuarantor(true);
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

      const isDirectSale = !selectedProductId;
      const costPriceNum = Number(formData.purchasePrice) || 0;

      const payload: Omit<InstallmentData, "id" | "createdAt"> & { purchasePrice?: number; costPrice?: number; isDirectSale?: boolean; fromInventory?: boolean } = {
        userId: user.uid,
        customerName: formData.customerName,
        phoneNumber: formData.phoneNumber,
        address: formData.address,
        guarantorName: hasGuarantor ? formData.guarantorName : "بدون كفيل",
        guarantorPhone: hasGuarantor ? formData.guarantorPhone : "بدون كفيل",
        productName: formData.productName,
        productPrice: Number(formData.productPrice) || 0,
        purchasePrice: costPriceNum,
        costPrice: costPriceNum,
        isDirectSale: isDirectSale,
        fromInventory: !isDirectSale,
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

        toast.success("تم حفظ العقد وتوثيقه بنجاح!");
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
      <div className="flex items-center justify-between bg-card/80 backdrop-blur-xl p-5 md:p-6 rounded-3xl border border-border shadow-sm">
        <div className="flex items-center gap-3.5">
          <Link
            href="/customers"
            className="p-2.5 bg-secondary hover:bg-primary/10 hover:text-primary text-foreground rounded-2xl border border-border/80 transition-all"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
              <span>إنشاء عقد وقسط جديد</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">أدخل بيانات العميل، الأوراق الثبوتية، والمنتج لتوثيق وحساب القسط.</p>
          </div>
        </div>

        <span className="hidden sm:inline-flex text-xs font-bold px-3.5 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full">
          عقد ذكي جديد
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          <div className="bg-card/90 backdrop-blur-md border border-border rounded-3xl p-5 md:p-6 shadow-sm space-y-4 relative">
            <div className="flex items-center gap-2 text-primary border-b border-border/60 pb-3">
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
                  className="w-full p-3.5 pl-10 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                  value={formData.customerName}
                  onChange={(e) => {
                    setFormData({ ...formData, customerName: e.target.value });
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />
                <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-4" />
              </div>

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
                        className="w-full text-right p-3 hover:bg-primary/10 transition-colors border-b border-border/40 last:border-0 flex flex-col gap-0.5"
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
                className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-bold text-left dir-ltr focus:ring-2 focus:ring-primary/50 outline-none"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5">عنوان السكن الدقيق</label>
              <input
                type="text"
                required
                className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-primary/50 outline-none"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>

          <div className="bg-card/90 backdrop-blur-md border border-border rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2 text-purple-500">
                <ShieldCheck className="w-5 h-5" />
                <h2 className="font-extrabold text-base">بيانات الكفيل الضامن</h2>
              </div>
              
              <button
                type="button"
                onClick={() => setHasGuarantor(!hasGuarantor)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                  hasGuarantor
                    ? "bg-purple-500/10 text-purple-600 border-purple-500/30"
                    : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                }`}
              >
                {hasGuarantor ? (
                  <>
                    <ToggleRight className="w-5 h-5 text-purple-500" />
                    <span>يوجد كفيل</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-5 h-5 text-gray-400" />
                    <span>بدون كفيل</span>
                  </>
                )}
              </button>
            </div>

            {hasGuarantor ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">اسم الكفيل الثلاثي</label>
                  <input
                    type="text"
                    required={hasGuarantor}
                    className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-primary/50 outline-none"
                    value={formData.guarantorName}
                    onChange={(e) => setFormData({ ...formData, guarantorName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">رقم هاتف الكفيل</label>
                  <input
                    type="tel"
                    required={hasGuarantor}
                    className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-bold text-left dir-ltr focus:ring-2 focus:ring-primary/50 outline-none"
                    value={formData.guarantorPhone}
                    onChange={(e) => setFormData({ ...formData, guarantorPhone: e.target.value })}
                  />
                </div>
              </>
            ) : (
              <div className="p-6 text-center text-xs font-bold text-muted-foreground bg-secondary/30 rounded-2xl border border-dashed border-border/60">
                تم إيقاف خيار الكفيل لهذا العقد، سيتم اعتماد العقد بدون كفيل ضامن.
              </div>
            )}
          </div>

          {/* 📷 كارت المسح الضوئي الذكي بالذكاء الاصطناعي والمستندات الثبوتية */}
          <div className="md:col-span-2 bg-card/90 backdrop-blur-md border border-border rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2 text-primary">
                <Camera className="w-5 h-5" />
                <h2 className="font-extrabold text-base">المستندات، الأوراق الثبوتية، والمسح الذكي</h2>
              </div>
              <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                <ScanText className="w-3.5 h-3.5" /> قراءة بالذكاء الاصطناعي (OCR)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* 1. هوية العميل والمسح الذكي */}
              <div className="border border-dashed border-border/80 rounded-2xl p-4 text-center space-y-2.5 hover:border-primary/50 transition-colors bg-secondary/20 relative">
                <ImageIcon className="w-8 h-8 text-primary mx-auto" />
                <span className="block text-xs font-bold text-foreground">صورة الهوية / البطاقة الموحدة</span>
                
                <input
                  type="file"
                  accept="image/*"
                  id="idCard"
                  className="hidden"
                  onChange={(e) => {
                    const selected = e.target.files?.[0] || null;
                    setIdCardFile(selected);
                    if (selected) handleScanIDCard(selected);
                  }}
                />

                <div className="flex flex-col gap-1.5 items-center">
                  <label
                    htmlFor="idCard"
                    className="w-full bg-primary/10 text-primary hover:bg-primary/20 text-xs px-3.5 py-2.5 rounded-xl font-bold cursor-pointer transition-colors shadow-sm flex items-center justify-center gap-1.5"
                  >
                    {isScanningId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ScanText className="w-4 h-4" />
                    )}
                    <span>{isScanningId ? "جاري مسح الهوية..." : idCardFile ? "تم اختيار الصورة ✓" : "مسح وقراءة الهوية"}</span>
                  </label>
                </div>

                {idCardFile && <p className="text-[10px] text-muted-foreground truncate font-mono">{idCardFile.name}</p>}
              </div>

              {/* 2. صورة العقد الورقي */}
              <div className="border border-dashed border-border/80 rounded-2xl p-4 text-center space-y-2.5 hover:border-primary/50 transition-colors bg-secondary/20">
                <FileText className="w-8 h-8 text-primary mx-auto" />
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
                  className="inline-block bg-primary/10 text-primary text-xs px-3.5 py-2.5 rounded-xl font-bold cursor-pointer hover:bg-primary/20 transition-colors shadow-sm w-full"
                >
                  {contractFile ? "تم اختيار العقد ✓" : "اختر صورة العقد"}
                </label>
                {contractFile && <p className="text-[10px] text-muted-foreground truncate font-mono">{contractFile.name}</p>}
              </div>

              {/* 3. صورة الزبون الشخصية */}
              <div className="border border-dashed border-border/80 rounded-2xl p-4 text-center space-y-2.5 hover:border-primary/50 transition-colors bg-secondary/20">
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
                  className="inline-block bg-primary/10 text-primary text-xs px-3.5 py-2.5 rounded-xl font-bold cursor-pointer hover:bg-primary/20 transition-colors shadow-sm w-full"
                >
                  {personalPhotoFile ? "تم اختيار الصورة ✓" : "اختر صورة العميل"}
                </label>
                {personalPhotoFile && <p className="text-[10px] text-muted-foreground truncate font-mono">{personalPhotoFile.name}</p>}
              </div>

            </div>
          </div>

          <div className="md:col-span-2 bg-card/90 backdrop-blur-md border border-border rounded-3xl p-5 md:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-primary border-b border-border/60 pb-3">
              <Box className="w-5 h-5" />
              <h2 className="font-extrabold text-base">تفاصيل السلعة وخطة التسديد</h2>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-2">
              <label className="text-xs font-bold text-primary flex items-center gap-2">
                <Package className="w-4 h-4" /> اختر مادة متوفرة بالمخزن المالي (تعبئة تلقائية للأسعار)
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => handleSelectProduct(e.target.value)}
                className="w-full p-3.5 rounded-2xl border border-border bg-card text-foreground font-bold text-xs focus:ring-2 focus:ring-primary outline-none cursor-pointer"
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
                  className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-primary outline-none"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                />
              </div>

              {/* 1. سعر الشراء / التكلفة */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-muted-foreground">سعر الشراء / التكلفة (د.ع)</label>
                  {formData.purchasePrice !== "" && (
                    <span className="text-[10px] font-black text-amber-500 animate-pulse">
                      {formatArabicCurrency(formData.purchasePrice)}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="0"
                  className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-black dir-ltr text-right focus:ring-2 focus:ring-primary outline-none font-mono"
                  value={formatInputDisplay(formData.purchasePrice)}
                  onChange={(e) =>
                    handlePurchasePriceChange(parseFormattedNumber(e.target.value))
                  }
                />
                <div className="flex gap-1 pt-0.5 dir-ltr justify-end">
                  <button 
                    type="button" 
                    onClick={() => addAmount(formData.purchasePrice, handlePurchasePriceChange, 1000, true)}
                    className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all"
                  >
                    +000 (ألف)
                  </button>
                  <button 
                    type="button" 
                    onClick={() => addAmount(formData.purchasePrice, handlePurchasePriceChange, 1000000, true)}
                    className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all"
                  >
                    +000000 (مليون)
                  </button>
                </div>
              </div>

              {/* 2. نسبة الربح المضافة */}
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">نسبة الربح المضافة (%)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  placeholder="0"
                  className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-black dir-ltr text-right text-primary focus:ring-2 focus:ring-primary outline-none font-mono"
                  value={formData.profitMargin}
                  onChange={(e) =>
                    handleProfitMarginChange(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </div>

              {/* 3. سعر البيع الكلي */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-muted-foreground">سعر البيع الكلي (د.ع)</label>
                  {formData.productPrice !== "" && (
                    <span className="text-[10px] font-black text-emerald-500 animate-pulse">
                      {formatArabicCurrency(formData.productPrice)}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="0"
                  className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-black text-foreground dir-ltr text-right focus:ring-2 focus:ring-primary outline-none font-mono"
                  value={formatInputDisplay(formData.productPrice)}
                  onChange={(e) =>
                    handleProductPriceChange(parseFormattedNumber(e.target.value))
                  }
                />
                <div className="flex gap-1 pt-0.5 dir-ltr justify-end">
                  <button 
                    type="button" 
                    onClick={() => addAmount(formData.productPrice, handleProductPriceChange, 1000, true)}
                    className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all"
                  >
                    +000 (ألف)
                  </button>
                  <button 
                    type="button" 
                    onClick={() => addAmount(formData.productPrice, handleProductPriceChange, 1000000, true)}
                    className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all"
                  >
                    +000000 (مليون)
                  </button>
                </div>
              </div>

              {/* 4. الدفعة المقدمة */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-muted-foreground">الدفعة المقدمة (د.ع)</label>
                  {formData.downPayment !== "" && (
                    <span className="text-[10px] font-black text-emerald-500 animate-pulse">
                      {formatArabicCurrency(formData.downPayment)}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="0"
                  className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-black text-emerald-600 dark:text-emerald-400 dir-ltr text-right focus:ring-2 focus:ring-primary outline-none font-mono"
                  value={formatInputDisplay(formData.downPayment)}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      downPayment: parseFormattedNumber(e.target.value),
                    })
                  }
                />
                <div className="flex gap-1 pt-0.5 dir-ltr justify-end">
                  <button 
                    type="button" 
                    onClick={() => addAmount(formData.downPayment, (v) => setFormData((prev) => ({ ...prev, downPayment: v })), 1000, true)}
                    className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all"
                  >
                    +000 (ألف)
                  </button>
                  <button 
                    type="button" 
                    onClick={() => addAmount(formData.downPayment, (v) => setFormData((prev) => ({ ...prev, downPayment: v })), 100000, false)}
                    className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all"
                  >
                    +100 ألف
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-primary mb-1.5">فترة التسديد (نوع القسط)</label>
                <select
                  value={formData.paymentPeriod}
                  onChange={(e) => {
                    const newPeriod = e.target.value as "daily" | "weekly" | "monthly";
                    setFormData({ ...formData, paymentPeriod: newPeriod });
                    setDatePickerStep("months");
                  }}
                  className="w-full p-3.5 rounded-2xl border border-primary/40 bg-background text-foreground text-xs font-extrabold focus:ring-2 focus:ring-primary outline-none cursor-pointer"
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
                  className="w-full p-3.5 rounded-2xl border border-border bg-background text-xs font-black dir-ltr text-right focus:ring-2 focus:ring-primary outline-none font-mono"
                  value={formData.months}
                  onChange={(e) =>
                    handleMonthsChange(e.target.value === "" ? "" : Number(e.target.value))
                  }
                />
              </div>

              {/* 5. القسط الدوري */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-primary">
                    أو أدخل القسط الـ{periodLabel} (د.ع)
                  </label>
                  {formData.monthlyInstallment !== "" && (
                    <span className="text-[10px] font-black text-primary animate-pulse">
                      {formatArabicCurrency(formData.monthlyInstallment)}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="0"
                  className="w-full p-3.5 rounded-2xl border border-primary/40 bg-background focus:ring-2 focus:ring-primary outline-none font-black text-xs text-primary dir-ltr text-right font-mono"
                  value={formatInputDisplay(formData.monthlyInstallment)}
                  onChange={(e) =>
                    handleMonthlyInstallmentChange(parseFormattedNumber(e.target.value))
                  }
                />
                <div className="flex gap-1 pt-0.5 dir-ltr justify-end">
                  <button 
                    type="button" 
                    onClick={() => addAmount(formData.monthlyInstallment, handleMonthlyInstallmentChange, 1000, true)}
                    className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all"
                  >
                    +000 (ألف)
                  </button>
                  <button 
                    type="button" 
                    onClick={() => addAmount(formData.monthlyInstallment, handleMonthlyInstallmentChange, 25000, false)}
                    className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all"
                  >
                    +25 ألف
                  </button>
                </div>
              </div>

              <div className="relative">
                <label className="block text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span>تاريخ استحقاق أول قسط</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowDatePicker(!showDatePicker);
                    setDatePickerStep("months");
                  }}
                  className="w-full p-3.5 rounded-2xl border border-border bg-background text-foreground text-xs md:text-sm font-bold flex items-center justify-between hover:border-primary/50 transition-all shadow-sm cursor-pointer"
                >
                  <span className={formData.startDate ? "text-foreground font-mono font-bold" : "text-muted-foreground"}>
                    {formData.startDate ? formData.startDate : `اختر تاريخ الاستحقاق...`}
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
                                const isSelected = formData.startDate === dateString;
                                return (
                                  <button
                                    key={dayNum}
                                    type="button"
                                    onClick={() => {
                                      setFormData((prev) => ({ ...prev, startDate: dateString }));
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
                            {monthsList.map((m) => {
                              return (
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
        </div>

        <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-center text-center md:text-right gap-6 shadow-xl shadow-primary/20 relative overflow-hidden">
          <Calculator className="absolute opacity-10 w-52 h-52 left-[-20px] top-[-20px] pointer-events-none" />

          <div className="z-10 w-full md:w-auto space-y-2">
            <div>
              <p className="text-primary-foreground/80 text-[10px] font-bold">إجمالي سعر البيع بالعقد</p>
              <p className="text-lg font-black tracking-tight font-mono">
                {formatNum(calculation.totalAmountWithProfit)} د.ع
              </p>
            </div>
            <div>
              <p className="text-primary-foreground/80 text-[10px] font-bold">المتبقي للتقسيط (بعد خصم المقدمة)</p>
              <p className="text-2xl font-black tracking-tight font-mono">{formatNum(calculation.totalDue)} د.ع</p>
            </div>
          </div>

          <div className="z-10 w-full md:w-auto border-y md:border-y-0 md:border-x border-primary-foreground/20 py-4 md:py-0 md:px-8 space-y-2">
            <p className="text-primary-foreground/80 text-[10px] font-bold flex items-center justify-center md:justify-start gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>مدة التسديد المحسوبة</span>
            </p>
            <div className="text-2xl font-black text-amber-200">
              {calculation.calculatedMonths} {periodUnitLabel}
              {calculation.calculatedDays > 0 && ` و ${calculation.calculatedDays} يوم`}
            </div>
            <p className="text-xs text-primary-foreground/90 font-bold">
              الربح الصافي: <span className="text-emerald-300 font-extrabold font-mono">+{formatNum(calculation.totalProfit)} د.ع</span>
            </p>
          </div>

          <div className="z-10 bg-card text-foreground px-6 py-4 rounded-2xl shadow-lg w-full md:w-auto text-center border border-border">
            <p className="text-xs font-bold text-muted-foreground mb-1">القسط الـ{periodLabel} المطلوب</p>
            <p className="text-3xl font-black text-primary tracking-tight font-mono">
              {formatNum(calculation.monthlyInstallment)} <span className="text-xs font-bold text-muted-foreground">د.ع</span>
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-8 py-4 rounded-2xl shadow-lg shadow-primary/20 font-extrabold text-base hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
      <div className="h-[80vh] flex flex-col items-center justify-center gap-3 text-primary">
        <Loader2 className="w-10 h-10 animate-spin" />
        <span className="text-xs font-bold text-muted-foreground animate-pulse">جاري تحضير نموذج العقد...</span>
      </div>
    }>
      <NewInstallmentContent />
    </Suspense>
  );
}