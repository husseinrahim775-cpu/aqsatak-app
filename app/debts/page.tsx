"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../components/AuthProvider";
import { addDebt, getUserDebts, toggleDebtStatus, deleteDebt, DebtData } from "../../services/firestore";
import { Plus, Search, CheckCircle, Circle, Trash2, X, Loader2, Wallet, Phone, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function DebtsPage() {
  const { user } = useAuth();
  const [debts, setDebts] = useState<DebtData[]>([]);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    customerName: "",
    phoneNumber: "",
    amount: "",
    reason: "",
  });

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
      });
      
      toast.success("تم تسجيل الدين الجديد بنجاح!");
      await fetchDebts();
      setIsModalOpen(false);
      setFormData({ customerName: "", phoneNumber: "", amount: "", reason: "" });
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
      {/* 1. ترويسة الصفحة وإجمالي الديون بأسلوب  Glass Look */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/80 backdrop-blur-xl p-5 md:p-6 rounded-3xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <Wallet className="w-6 h-6 text-orange-500" />
            سجل الديون الحرة والمعلقة
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            إجمالي الديون المعلقة بالسوق:{" "}
            <span className="font-black text-rose-500 text-sm dir-ltr inline-block">
              {totalUnpaid.toLocaleString()} د.ع
            </span>
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-5 py-3 rounded-2xl font-bold text-sm shadow-md shadow-orange-500/20 hover:opacity-95 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة دين جديد</span>
        </motion.button>
      </div>

      {/* 2. شريط البحث  Look */}
      <div className="relative">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="ابحث عن اسم العميل أو رقم الهاتف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pr-11 pl-4 py-3 rounded-2xl border border-border bg-card/80 backdrop-blur-md text-foreground text-xs font-bold focus:ring-2 focus:ring-orange-500/50 outline-none transition-all shadow-sm"
        />
      </div>

      {/* 3. قائمة كروت الديون  Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        {filteredDebts.map((debt) => (
          <motion.div 
            key={debt.id} 
            whileHover={{ y: -3 }}
            className={`bg-card/90 backdrop-blur-md border rounded-3xl p-5 md:p-6 flex flex-col justify-between gap-3 shadow-sm transition-all ${
              debt.isPaid 
                ? 'border-emerald-500/30 opacity-75' 
                : 'border-border hover:border-orange-500/40'
            }`}
          >
            <div className="flex justify-between items-start border-b border-border/60 pb-3">
              <div>
                <h3 className={`font-extrabold text-base md:text-lg ${debt.isPaid ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {debt.customerName}
                </h3>
                <p className="text-xs text-muted-foreground font-mono flex items-center gap-1 mt-0.5" dir="ltr">
                  <Phone className="w-3 h-3 text-orange-500" />
                  {debt.phoneNumber || "بدون رقم"}
                </p>
              </div>

              <div className="text-left">
                <span className={`font-black text-lg md:text-xl tracking-tight block ${debt.isPaid ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {debt.amount.toLocaleString()} <span className="text-xs font-bold text-muted-foreground">د.ع</span>
                </span>
                <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  debt.isPaid 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                }`}>
                  {debt.isPaid ? 'مسدد بالكامل' : 'غير مسدد'}
                </span>
              </div>
            </div>
            
            {/* السبب والمعلومات الإضافية */}
            <div className="text-xs text-muted-foreground bg-secondary/40 p-3 rounded-2xl border border-border/50">
              <span className="font-bold text-foreground">السبب / التفاصيل:</span> {debt.reason}
            </div>

            {/* الإجراءات والتحكم */}
            <div className="pt-2 flex justify-between items-center border-t border-border/60">
              <button
                onClick={() => handleToggleStatus(debt)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  debt.isPaid 
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30' 
                    : 'bg-secondary hover:bg-orange-500/10 text-foreground hover:text-orange-500 border border-border'
                }`}
              >
                {debt.isPaid ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4" />}
                <span>{debt.isPaid ? 'تم التسديد' : 'تعيين كمسدد'}</span>
              </button>

              <button
                onClick={() => handleDelete(debt.id!, debt.customerName)}
                className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                title="حذف الدين"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}

        {filteredDebts.length === 0 && (
          <div className="col-span-1 md:col-span-2 text-center py-12 text-muted-foreground font-medium text-xs bg-card/40 rounded-3xl border border-dashed border-border">
            لا توجد ديون حرة مسجلة حالياً.
          </div>
        )}
      </div>

      {/* 4. نافذة إضافة دين جديد  Modal */}
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
                  <Sparkles className="w-5 h-5 text-orange-500" />
                  تسجيل دين جديد
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-secondary rounded-xl transition-colors">
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
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">المبلغ (د.ع) *</label>
                  <input
                    required
                    type="number"
                    min="250"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-black dir-ltr text-right focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">السبب / التفاصيل</label>
                  <input
                    type="text"
                    placeholder="مثال: باقي حساب شاشة، سلفة، الخ..."
                    value={formData.reason}
                    onChange={(e) => setFormData({...formData, reason: e.target.value})}
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">رقم الهاتف (اختياري)</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                    className="w-full px-4 py-3 rounded-2xl border border-border bg-background text-xs font-bold text-left focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 text-xs font-bold rounded-2xl border border-border hover:bg-secondary transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !formData.customerName || !formData.amount}
                    className="flex-1 py-3 text-xs rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold hover:opacity-95 transition-opacity flex justify-center items-center gap-2 disabled:opacity-50 shadow-md shadow-orange-500/20"
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