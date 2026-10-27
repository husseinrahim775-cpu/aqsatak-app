"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../components/AuthProvider";
import { addDebt, getUserDebts, toggleDebtStatus, deleteDebt, DebtData } from "../../services/firestore";
import { 
  Plus, Search, CheckCircle, Circle, Trash2, X, Loader2, Wallet, Phone, 
  AlertCircle, CheckCircle2, Sparkles, Calendar, Clock, ToggleLeft, ToggleRight, ChevronRight, ChevronLeft 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useTheme } from "next-themes";

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

// دالة تنسيق التاريخ للعرض
const formatDateForDisplay = (dateVal: any): string => {
  if (!dateVal) return "";
  try {
    let parsed: Date | null = null;
    if (typeof dateVal === "object" && typeof dateVal.toDate === "function") {
      parsed = dateVal.toDate();
    } else if (typeof dateVal === "object" && dateVal.seconds) {
      parsed = new Date(dateVal.seconds * 1000);
    } else {
      parsed = new Date(dateVal);
    }
    if (parsed && !isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("ar-IQ", { year: "numeric", month: "numeric", day: "numeric" });
    }
  } catch (e) {}
  return String(dateVal);
};

export default function DebtsPage() {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [debts, setDebts] = useState<DebtData[]>([]);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 📅 حالات تاريخ السداد (مفتاح التفعيل/الإيقاف + التقويم المنبثق)
  const [hasDueDate, setHasDueDate] = useState(false);
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
    amount: "" as number | "",
    reason: "",
    dueDate: "",
  });

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

  const fetchDebts = async () => {
    if (user?.uid) {
      try {
        const data = await getUserDebts(user.uid);
        setDebts(data || []);
      } catch (error) {
        console.error("خطأ في جلب الديون:", error);
        toast.error("حدث خطأ أثناء تحميل سجل الديون.");
      }
    }
  };

  useEffect(() => {
    fetchDebts();
  }, [user]);

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !formData.customerName || !formData.amount) {
      toast.error("يرجى كتابة اسم العميل والمبلغ المطلوب.");
      return;
    }

    try {
      setIsSaving(true);
      await addDebt({
        userId: user.uid,
        customerName: formData.customerName,
        phoneNumber: formData.phoneNumber,
        amount: Number(formData.amount),
        reason: formData.reason || "دين عام",
        isPaid: false,
        createdAt: new Date().toISOString(),
        dueDate: hasDueDate && formData.dueDate ? formData.dueDate : null,
      } as any);
      
      toast.success("تم تسجيل الدين الجديد بنجاح!");
      await fetchDebts();
      setIsModalOpen(false);
      setFormData({ customerName: "", phoneNumber: "", amount: "", reason: "", dueDate: "" });
      setHasDueDate(false);
    } catch (error) {
      console.error("خطأ في إضافة الدين:", error);
      toast.error("حدث خطأ أثناء إضافة الدين.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (debt: DebtData) => {
    try {
      await toggleDebtStatus(debt.id!, debt.isPaid);
      toast.success(debt.isPaid ? "تم تغيير الحالة إلى غير مسدد" : "تم تعيين الدين كمسدد بنجاح!");
      await fetchDebts();
    } catch (error) {
      console.error("خطأ في تغيير حالة الدين:", error);
      toast.error("حدث خطأ أثناء تحديث حالة الدين.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف دين العميل (${name})؟`)) return;
    try {
      await deleteDebt(id);
      toast.success(`تم حذف دين العميل (${name}) بنجاح.`);
      await fetchDebts();
    } catch (error) {
      console.error("خطأ أثناء حذف الدين:", error);
      toast.error("حدث خطأ أثناء حذف الدين.");
    }
  };

  const filteredDebts = debts.filter(
    (d) => d.customerName.includes(search) || d.phoneNumber.includes(search)
  );

  const totalUnpaid = debts.filter(d => !d.isPaid).reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-5 md:space-y-6 pb-12 max-w-7xl mx-auto font-sans dir-rtl text-right"
    >
      {/* 1. ترويسة الصفحة المربوطة بثيم الإعدادات */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/80 backdrop-blur-xl p-5 md:p-6 rounded-3xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <Wallet className="w-6 h-6 text-primary" />
            سجل الديون الحرة والمعلقة
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-bold">
            إجمالي الديون المعلقة بالسوق:{" "}
            <span className="font-black text-rose-500 text-sm dir-ltr inline-block font-mono">
              {totalUnpaid.toLocaleString()} د.ع
            </span>
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-5 py-3 rounded-2xl font-black text-xs md:text-sm shadow-md shadow-primary/20 hover:opacity-95 transition-opacity cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة دين جديد</span>
        </motion.button>
      </div>

      {/* 2. شريط البحث */}
      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="ابحث عن اسم العميل أو رقم الهاتف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pr-11 pl-4 py-3 rounded-2xl border border-border bg-card/80 backdrop-blur-md text-foreground text-xs font-bold focus:ring-2 focus:ring-primary outline-none transition-all shadow-sm"
        />
      </div>

      {/* 3. قائمة كروت الديون */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        {filteredDebts.map((debt: any) => (
          <motion.div 
            key={debt.id} 
            whileHover={{ y: -3 }}
            className={`bg-card/90 backdrop-blur-md border rounded-3xl p-5 md:p-6 flex flex-col justify-between gap-3 shadow-sm transition-all ${
              debt.isPaid 
                ? 'border-emerald-500/30 opacity-80' 
                : 'border-border hover:border-primary/40'
            }`}
          >
            <div className="flex justify-between items-start border-b border-border/60 pb-3">
              <div>
                <h3 className={`font-black text-base md:text-lg ${debt.isPaid ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {debt.customerName}
                </h3>
                <p className="text-xs text-muted-foreground font-mono flex items-center gap-1 mt-0.5" dir="ltr">
                  <Phone className="w-3 h-3 text-primary" />
                  {debt.phoneNumber || "بدون رقم"}
                </p>
              </div>

              <div className="text-left">
                <span className={`font-black text-lg md:text-xl tracking-tight block font-mono ${debt.isPaid ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {debt.amount.toLocaleString()} <span className="text-xs font-bold text-muted-foreground">د.ع</span>
                </span>
                <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                  debt.isPaid 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                }`}>
                  {debt.isPaid ? 'مسدد بالكامل' : 'غير مسدد'}
                </span>
              </div>
            </div>
            
            {/* التفاصيل والتاريخ */}
            <div className="space-y-1.5 text-xs text-muted-foreground bg-secondary/40 p-3.5 rounded-2xl border border-border/50">
              <div>
                <span className="font-bold text-foreground">السبب / التفاصيل:</span> {debt.reason}
              </div>
              
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-[11px]">
                {debt.createdAt && (
                  <span className="flex items-center gap-1 text-muted-foreground font-mono font-bold">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span>تاريخ الدين: {formatDateForDisplay(debt.createdAt)}</span>
                  </span>
                )}
                {debt.dueDate && (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-mono font-black">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>تاريخ السداد: {formatDateForDisplay(debt.dueDate)}</span>
                  </span>
                )}
              </div>
            </div>

            {/* الإجراءات والتحكم */}
            <div className="pt-2 flex justify-between items-center border-t border-border/60">
              <button
                onClick={() => handleToggleStatus(debt)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  debt.isPaid 
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30' 
                    : 'bg-secondary hover:bg-primary/10 text-foreground hover:text-primary border border-border'
                }`}
              >
                {debt.isPaid ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4" />}
                <span>{debt.isPaid ? 'تم التسديد' : 'تعيين كمسدد'}</span>
              </button>

              <button
                onClick={() => handleDelete(debt.id!, debt.customerName)}
                className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                title="حذف الدين"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}

        {filteredDebts.length === 0 && (
          <div className="col-span-1 md:col-span-2 text-center py-12 text-muted-foreground font-bold text-xs bg-card/40 rounded-3xl border border-dashed border-border">
            لا توجد ديون حرة مسجلة حالياً.
          </div>
        )}
      </div>

      {/* 4. نافذة إضافة دين جديد Modal مع التاريخ المنبثق للأعلى */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-card rounded-3xl w-full max-w-md p-6 shadow-2xl border border-border space-y-4"
            >
              <div className="flex justify-between items-center border-b border-border pb-3">
                <h2 className="text-base font-black text-foreground flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  تسجيل دين جديد
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-secondary rounded-xl transition-colors cursor-pointer">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              
              <form onSubmit={handleAddDebt} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">اسم العميل *</label>
                  <input
                    required
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                {/* مبلغ الدين */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-muted-foreground">المبلغ (د.ع) *</label>
                    {formData.amount !== "" && (
                      <span className="text-[10px] font-black text-rose-500 animate-pulse">
                        {formatArabicCurrency(formData.amount)}
                      </span>
                    )}
                  </div>
                  <input
                    required
                    type="text"
                    value={formatInputDisplay(formData.amount)}
                    onChange={(e) => setFormData({...formData, amount: parseFormattedNumber(e.target.value)})}
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-black dir-ltr text-right focus:ring-2 focus:ring-primary outline-none font-mono"
                  />
                  <div className="flex gap-1 pt-0.5 dir-ltr justify-end">
                    <button 
                      type="button" 
                      onClick={() => addAmount(formData.amount, (v) => setFormData((prev) => ({ ...prev, amount: v })), 1000, true)}
                      className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all cursor-pointer"
                    >
                      +000 (ألف)
                    </button>
                    <button 
                      type="button" 
                      onClick={() => addAmount(formData.amount, (v) => setFormData((prev) => ({ ...prev, amount: v })), 25000, false)}
                      className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all cursor-pointer"
                    >
                      +25 ألف
                    </button>
                    <button 
                      type="button" 
                      onClick={() => addAmount(formData.amount, (v) => setFormData((prev) => ({ ...prev, amount: v })), 1000000, true)}
                      className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all cursor-pointer"
                    >
                      +000000 (مليون)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">السبب / التفاصيل</label>
                  <input
                    type="text"
                    placeholder="مثال: باقي حساب شاشة، سلفة، الخ..."
                    value={formData.reason}
                    onChange={(e) => setFormData({...formData, reason: e.target.value})}
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">رقم الهاتف (اختياري)</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-bold text-left focus:ring-2 focus:ring-primary outline-none font-mono"
                  />
                </div>

                {/* 📅 زر تفعيل/إيقاف تحديد موعد الاستحقاق والسداد */}
                <div className="pt-1">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      تحديد تاريخ استحقاق السداد
                    </span>
                    <button
                      type="button"
                      onClick={() => setHasDueDate(!hasDueDate)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                        hasDueDate
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-secondary text-muted-foreground border-border"
                      }`}
                    >
                      {hasDueDate ? (
                        <>
                          <ToggleRight className="w-5 h-5 text-primary" />
                          <span>مفعل</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                          <span>معطل</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* التقويم المنبثق للأعلى عند التفعيل */}
                  {hasDueDate && (
                    <div className="relative mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowDatePicker(!showDatePicker);
                          setDatePickerStep("months");
                        }}
                        className="w-full p-3 rounded-2xl border border-border bg-background text-foreground text-xs font-bold flex items-center justify-between hover:border-primary/50 transition-all shadow-sm cursor-pointer"
                      >
                        <span className={formData.dueDate ? "text-foreground font-mono font-bold" : "text-muted-foreground"}>
                          {formData.dueDate ? formData.dueDate : `اختر تاريخ استحقاق الدين...`}
                        </span>
                        <Calendar className="w-4 h-4 text-primary" />
                      </button>

                      <AnimatePresence>
                        {showDatePicker && (
                          <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            className="absolute bottom-full mb-2 right-0 z-[99999] w-full bg-card border border-border rounded-3xl p-4 shadow-2xl backdrop-blur-xl space-y-3"
                          >
                            <div className="space-y-3">
                              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedYear((y) => y - 1)}
                                  className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs cursor-pointer"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                                
                                <div className="flex items-center gap-1 font-mono font-bold text-xs text-primary">
                                  <span>{selectedYear}</span>
                                  {selectedMonthObj && datePickerStep === "days" && (
                                    <span>- {selectedMonthObj.num}</span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setSelectedYear((y) => y + 1)}
                                  className="p-1.5 rounded-xl bg-secondary hover:bg-primary/10 text-foreground hover:text-primary font-bold text-xs cursor-pointer"
                                >
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {datePickerStep === "days" ? (
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center px-1 text-[11px]">
                                    <span className="font-bold text-muted-foreground">اختر اليوم:</span>
                                    <button
                                      type="button"
                                      onClick={() => setDatePickerStep("months")}
                                      className="text-primary hover:underline font-bold text-[10px] cursor-pointer"
                                    >
                                      تغيير الشهر ({selectedMonthObj?.name || "اختر"})
                                    </button>
                                  </div>
                                  <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto pt-1">
                                    {daysInSelectedMonth.map((dayNum) => {
                                      const dateString = `${selectedYear}-${selectedMonthObj?.num || "01"}-${dayNum}`;
                                      const isSelected = formData.dueDate === dateString;
                                      return (
                                        <button
                                          key={dayNum}
                                          type="button"
                                          onClick={() => {
                                            setFormData((prev) => ({ ...prev, dueDate: dateString }));
                                            setShowDatePicker(false);
                                          }}
                                          className={`p-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
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
                                        className="p-2 rounded-xl text-xs font-bold transition-all bg-secondary/50 hover:bg-primary/10 text-foreground hover:text-primary cursor-pointer"
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
                  )}
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 text-xs font-black rounded-2xl border border-border hover:bg-secondary transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !formData.customerName || !formData.amount}
                    className="flex-1 py-3 text-xs rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-black hover:opacity-95 transition-opacity flex justify-center items-center gap-2 disabled:opacity-50 shadow-md shadow-primary/20 cursor-pointer"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ الدين'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}