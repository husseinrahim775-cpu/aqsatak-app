"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../components/AuthProvider";
import { addDebt, getUserDebts, toggleDebtStatus, deleteDebt, DebtData } from "../../services/firestore";
import { Plus, Search, CheckCircle, Circle, Trash2, X, Loader2, Wallet } from "lucide-react";

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
      const data = await getUserDebts(user.uid);
      setDebts(data);
    }
  };

  useEffect(() => {
    fetchDebts();
  }, [user]);

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !formData.customerName || !formData.amount) return;

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
      
      await fetchDebts();
      setIsModalOpen(false);
      setFormData({ customerName: "", phoneNumber: "", amount: "", reason: "" });
    } catch (error) {
      alert("حدث خطأ أثناء إضافة الدين");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (debt: DebtData) => {
    try {
      await toggleDebtStatus(debt.id!, debt.isPaid);
      await fetchDebts();
    } catch (error) {
      alert("حدث خطأ أثناء تحديث الحالة");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`هل أنت متأكد من حذف دين العميل ${name}؟`)) {
      try {
        await deleteDebt(id);
        await fetchDebts();
      } catch (error) {
        alert("حدث خطأ أثناء الحذف");
      }
    }
  };

  const filteredDebts = debts.filter(
    (d) => d.customerName.includes(search) || d.phoneNumber.includes(search)
  );

  const totalUnpaid = debts.filter(d => !d.isPaid).reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-4 md:space-y-6 relative pb-8 animate-in fade-in duration-500">
      {/* الرأس وإجمالي الديون */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Wallet className="text-primary w-6 h-6" />
            سجل الديون الحرة
          </h1>
          <p className="text-gray-500 text-xs md:text-sm mt-1">
            إجمالي الديون المعلقة بالسوق: <span className="font-bold text-red-500">{totalUnpaid.toLocaleString()} د.ع</span>
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center w-full sm:w-auto gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl hover:bg-primary/90 font-bold text-sm md:text-base transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4 md:w-5 md:h-5" />
          <span>إضافة دين جديد</span>
        </button>
      </div>

      {/* شريط البحث */}
      <div className="relative">
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
        <input
          type="text"
          placeholder="ابحث عن اسم العميل أو رقم الهاتف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pr-10 pl-4 py-2.5 md:py-3 rounded-xl border border-border bg-card text-foreground text-sm md:text-base focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm"
        />
      </div>

      {/* قائمة الديون */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredDebts.map((debt) => (
          <div key={debt.id} className={`bg-card border rounded-2xl p-4 md:p-5 flex flex-col gap-3 shadow-sm transition-all ${debt.isPaid ? 'border-green-500/30 opacity-70' : 'border-border'}`}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className={`font-bold text-base md:text-lg ${debt.isPaid ? 'line-through text-gray-500' : 'text-foreground'}`}>
                  {debt.customerName}
                </h3>
                <p className="text-xs md:text-sm text-gray-500" dir="ltr">{debt.phoneNumber || "بدون رقم"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-black text-lg md:text-xl ${debt.isPaid ? 'text-green-500' : 'text-red-500'}`}>
                  {debt.amount.toLocaleString()} د.ع
                </span>
              </div>
            </div>
            
            <div className="text-sm text-gray-500 bg-secondary/50 p-2.5 rounded-lg border border-border">
              <strong>السبب:</strong> {debt.reason}
            </div>

            <div className="pt-2 flex justify-between items-center border-t border-border mt-1">
              <button
                onClick={() => handleToggleStatus(debt)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                  debt.isPaid 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400' 
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {debt.isPaid ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                {debt.isPaid ? 'تم التسديد' : 'تعيين كمسدد'}
              </button>

              <button
                onClick={() => handleDelete(debt.id!, debt.customerName)}
                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
              >
                <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
          </div>
        ))}
        {filteredDebts.length === 0 && (
          <div className="col-span-1 md:col-span-2 text-center py-10 text-gray-500">
            لا توجد ديون مسجلة حالياً.
          </div>
        )}
      </div>

      {/* نافذة إضافة دين جديد (Modal) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 backdrop-blur-sm">
          <div className="bg-card rounded-2xl w-full max-w-md p-5 shadow-2xl border border-border animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4 border-b border-border pb-3">
              <h2 className="text-lg font-bold">تسجيل دين جديد</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-border/50 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handleAddDebt} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">اسم العميل *</label>
                <input
                  required
                  type="text"
                  value={formData.customerName}
                  onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">المبلغ (د.ع) *</label>
                <input
                  required
                  type="number"
                  min="250"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary outline-none font-bold"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">السبب / التفاصيل</label>
                <input
                  type="text"
                  placeholder="مثال: باقي حساب شاشة، سلفة، الخ..."
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">رقم الهاتف (اختياري)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-left focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 text-sm font-bold rounded-xl border border-border hover:bg-border/50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !formData.customerName || !formData.amount}
                  className="flex-1 py-2.5 text-sm rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ الدين'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}