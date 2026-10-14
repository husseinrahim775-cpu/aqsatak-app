"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../components/AuthProvider";
import { 
  getUserInstallments, 
  getUserPayments,
  InstallmentData,
  PaymentRecord,
  updateInstallment, 
  deleteInstallment,
  addPenaltyRecord 
} from "../../services/firestore";
import Link from "next/link";
import { Plus, Search, Eye, Edit, Trash2, X, Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

interface GroupedCustomer {
  customerName: string;
  phoneNumber: string;
  address: string;
  installments: InstallmentData[];
  totalOriginalDue: number;
  totalPaid: number;
  totalRemaining: number;
  isFullyPaid: boolean;
}

export default function CustomersPage() {
  const { user } = useAuth();
  const [installments, setInstallments] = useState<InstallmentData[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("all");

  const [editingCustomer, setEditingCustomer] = useState<GroupedCustomer | null>(null);
  const [editForm, setEditForm] = useState({ customerName: "", phoneNumber: "", address: "" });
  const [isSaving, setIsSaving] = useState(false);

  const [isFineModalOpen, setIsFineModalOpen] = useState(false);
  const [fineCustomer, setFineCustomer] = useState<GroupedCustomer | null>(null);
  const [fineForm, setFineForm] = useState({ installmentId: "", amount: "", reason: "" });
  const [isSavingFine, setIsSavingFine] = useState(false);

  const fetchData = async () => {
    if (user?.uid) {
      const [instData, payData] = await Promise.all([
        getUserInstallments(user.uid),
        getUserPayments(user.uid),
      ]);
      setInstallments(instData || []);
      setPayments(payData || []);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // 🎯 تجميع بيانات العملاء وحساب السداد المباشر والتصفير التلقائي
  const groupedCustomers = useMemo(() => {
    const map = new Map<string, GroupedCustomer>();

    installments.forEach((item) => {
      const key = item.phoneNumber?.trim() || item.customerName?.trim();
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          customerName: item.customerName,
          phoneNumber: item.phoneNumber,
          address: item.address,
          installments: [],
          totalOriginalDue: 0,
          totalPaid: 0,
          totalRemaining: 0,
          isFullyPaid: false,
        });
      }

      const cust = map.get(key)!;
      cust.installments.push(item);

      // حساب المدفوعات المسجلة لهذا القسط
      const instPayments = payments.filter((p) => p.installmentId === item.id);
      const paidForInst = instPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const originalDue = Number(item.totalDue) || 0;
      cust.totalOriginalDue += originalDue;
      cust.totalPaid += paidForInst;
    });

    // 🎯 حساب المتبقي وحالة التصفير
    const result: GroupedCustomer[] = [];

    map.forEach((cust) => {
      const calcRemaining = Math.max(0, cust.totalOriginalDue - cust.totalPaid);
      cust.totalRemaining = calcRemaining;
      cust.isFullyPaid = calcRemaining <= 0; // يصفر تلقائياً عند اكتمال السداد

      // تطبيق فلترة البحث والحالة
      const matchesSearch =
        cust.customerName?.toLowerCase().includes(search.toLowerCase()) || 
        cust.phoneNumber?.includes(search);

      if (matchesSearch) {
        if (statusFilter === "active" && !cust.isFullyPaid) {
          result.push(cust);
        } else if (statusFilter === "completed" && cust.isFullyPaid) {
          result.push(cust);
        } else if (statusFilter === "all") {
          result.push(cust);
        }
      }
    });

    return result;
  }, [installments, payments, search, statusFilter]);

  const openEditModal = (customer: GroupedCustomer) => {
    setEditForm({
      customerName: customer.customerName,
      phoneNumber: customer.phoneNumber,
      address: customer.address || "",
    });
    setEditingCustomer(customer);
  };

  const handleSaveChanges = async () => {
    if (!editingCustomer) return;
    try {
      setIsSaving(true);
      const updatePromises = editingCustomer.installments.map((inst) => 
        updateInstallment(inst.id!, {
          customerName: editForm.customerName,
          phoneNumber: editForm.phoneNumber,
          address: editForm.address,
        })
      );
      
      await Promise.all(updatePromises);
      await fetchData(); 
      setEditingCustomer(null); 
      toast.success("تم حفظ تعديلات بيانات العميل بنجاح!");
    } catch (error) {
      console.error("خطأ في التعديل:", error);
      toast.error("حدث خطأ أثناء حفظ التعديلات.");
    } finally {
      setIsSaving(false);
    }
  };

  const openFineModal = (customer: GroupedCustomer) => {
    setFineCustomer(customer);
    setFineForm({ 
      installmentId: customer.installments.length === 1 ? customer.installments[0].id! : "", 
      amount: "", 
      reason: "" 
    });
    setIsFineModalOpen(true);
  };

  const handleSaveFine = async () => {
    if (!fineCustomer || !fineForm.installmentId || !fineForm.amount || !user?.uid) return;
    
    const selectedInst = fineCustomer.installments.find(i => i.id === fineForm.installmentId);
    if (!selectedInst) return;

    try {
      setIsSavingFine(true);
      const fineValue = Number(fineForm.amount);
      const reasonNote = fineForm.reason.trim() || "غرامة تأخير"; 

      await addPenaltyRecord(
        selectedInst.id!,
        user.uid,
        fineValue,
        reasonNote
      );

      await fetchData(); 
      setIsFineModalOpen(false);
      setFineCustomer(null);
      toast.success("تمت إضافة الغرامة وحفظ السجل بنجاح!");
    } catch (error) {
      console.error("خطأ في إضافة الغرامة:", error);
      toast.error("حدث خطأ أثناء إضافة الغرامة.");
    } finally {
      setIsSavingFine(false);
    }
  };

  const handleDeleteCustomer = async (customer: GroupedCustomer) => {
    try {
      const deletePromises = customer.installments.map((inst) => 
        deleteInstallment(inst.id!)
      );
      
      await Promise.all(deletePromises);
      await fetchData(); 
      toast.success("تم حذف العميل وإرجاع المواد للمخزن بنجاح!");
    } catch (error) {
      console.error("خطأ في الحذف:", error);
      toast.error("حدث خطأ أثناء حذف العميل.");
    }
  };

  const renderPeriodBadge = (period?: string) => {
    switch (period) {
      case "daily":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">يومي</span>;
      case "weekly":
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">أسبوعي</span>;
      default:
        return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">شهري</span>;
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 relative pb-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">العملاء والأقساط</h1>
          <p className="text-gray-500 text-xs md:text-sm mt-1">إدارة سجلات العملاء ومتابعة الأقساط النشطة والمكتملة.</p>
        </div>
        <Link
          href="/customers/new"
          className="flex items-center justify-center w-full sm:w-auto gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl hover:bg-primary/90 font-bold text-sm md:text-base transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4 md:w-5 md:h-5" />
          <span>إضافة قسط جديد</span>
        </Link>
      </div>

      {/* البحث وفلترة الحالة */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-auto sm:flex-1">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
          <input
            type="text"
            placeholder="ابحث عن اسم العميل أو رقم الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all shadow-sm"
          />
        </div>

        <div className="flex items-center gap-1 bg-card border border-border p-1 rounded-xl w-full sm:w-auto justify-between">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === "all" ? "bg-primary text-primary-foreground shadow-sm" : "text-gray-500 hover:text-foreground"
            }`}
          >
            الكل
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === "active" ? "bg-amber-500 text-white shadow-sm" : "text-gray-500 hover:text-foreground"
            }`}
          >
            عليها ديون
          </button>
          <button
            onClick={() => setStatusFilter("completed")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === "completed" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-500 hover:text-foreground"
            }`}
          >
            مصفّرة بالكامل
          </button>
        </div>
      </div>

      {/* كارتات سجل العملاء */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {groupedCustomers.map((customer) => {
          const totalPeriodic = customer.installments.reduce((acc, curr) => acc + curr.monthlyInstallment, 0);

          return (
            <div key={customer.phoneNumber} className="bg-card border border-border rounded-2xl p-4 md:p-5 space-y-3 md:space-y-4 shadow-sm group hover:border-primary/30 transition-colors">
              <div className="flex justify-between items-start border-b border-border pb-3">
                <div>
                  <h3 className="font-bold text-base md:text-lg text-foreground flex items-center gap-2">
                    {customer.customerName}
                    <div className="flex items-center gap-1">
                      <button onClick={() => openFineModal(customer)} className="p-1.5 text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-md transition-colors" title="إضافة غرامة تأخير">
                        <AlertCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEditModal(customer)} className="p-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors" title="تعديل بيانات العميل">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteCustomer(customer)} className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors" title="حذف العميل بالكامل">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </h3>
                  <p className="text-xs md:text-sm text-gray-500 mt-0.5" dir="ltr">{customer.phoneNumber}</p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {customer.isFullyPaid ? (
                    <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] md:text-xs font-black px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" /> مصفّر بالكامل
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] md:text-xs font-black px-2.5 py-1 rounded-full">
                      <Clock className="w-3.5 h-3.5" /> قيد التسديد ({customer.installments.length} أقساط)
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-xs md:text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>إجمالي المتبقي للتقسيط:</span>
                  {customer.isFullyPaid ? (
                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">0 د.ع (خالي من الديون)</span>
                  ) : (
                    <span className="font-extrabold text-foreground">{Math.round(customer.totalRemaining).toLocaleString()} د.ع</span>
                  )}
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>مجموع القسط المستحق:</span>
                  <span className="font-bold text-primary">{Math.round(totalPeriodic).toLocaleString()} د.ع</span>
                </div>
              </div>

              {/* تفاصيل العقود والمواد */}
              <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border">
                <div className="text-[10px] md:text-xs text-gray-400 space-y-1 w-full sm:w-2/3">
                  {customer.installments.map((inst, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 truncate">
                      {renderPeriodBadge(inst.paymentPeriod)}
                      <span className="font-medium text-foreground/80 truncate">{inst.productName}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href={`/customers/${encodeURIComponent(customer.phoneNumber)}`}
                  className="flex items-center justify-center gap-1.5 text-xs bg-secondary text-secondary-foreground px-3 py-1.5 rounded-lg font-bold hover:bg-secondary/80 transition-colors shrink-0"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>عرض الملف</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* modal إضافة الغرامة */}
      {isFineModalOpen && fineCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 md:p-4 backdrop-blur-sm">
          <div className="bg-card rounded-2xl w-full max-w-md p-4 md:p-6 shadow-2xl border border-border animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 md:mb-5 border-b border-border pb-3">
              <h2 className="text-base md:text-lg font-bold flex items-center gap-2 text-orange-500">
                <AlertCircle className="w-5 h-5" />
                إضافة غرامة تأخير
              </h2>
              <button onClick={() => setIsFineModalOpen(false)} className="p-1 hover:bg-border/50 rounded-lg transition-colors">
                <X className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300 rounded-xl text-xs md:text-sm border border-orange-100 dark:border-orange-900/30">
                سيتم إضافة مبلغ الغرامة إلى <strong>إجمالي المتبقي</strong> للعميل ({fineCustomer.customerName}).
              </div>

              <div>
                <label className="block text-xs md:text-sm font-bold text-gray-500 mb-1">اختر القسط / المنتج المتعثر</label>
                <select
                  value={fineForm.installmentId}
                  onChange={(e) => setFineForm({...fineForm, installmentId: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                >
                  <option value="" disabled>-- يرجى اختيار القسط --</option>
                  {fineCustomer.installments.map(inst => (
                    <option key={inst.id} value={inst.id}>
                      {inst.productName} (متبقي: {Math.round(inst.totalDue).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-bold text-gray-500 mb-1">مبلغ الغرامة (د.ع)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="مثال: 5000"
                  value={fineForm.amount}
                  onChange={(e) => setFineForm({...fineForm, amount: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-orange-500 outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-bold text-gray-500 mb-1">سبب الغرامة (ملاحظة)</label>
                <input
                  type="text"
                  placeholder="مثال: تأخير عن الدفع لشهر 5"
                  value={fineForm.reason}
                  onChange={(e) => setFineForm({...fineForm, reason: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2 md:gap-3">
                <button
                  onClick={() => setIsFineModalOpen(false)}
                  className="flex-1 py-2.5 text-sm font-bold rounded-xl border border-border hover:bg-border/50 transition-colors"
                  disabled={isSavingFine}
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSaveFine}
                  disabled={isSavingFine || !fineForm.installmentId || !fineForm.amount}
                  className="flex-1 py-2.5 text-sm rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {isSavingFine ? <Loader2 className="w-4 h-4 animate-spin" /> : 'إضافة الغرامة'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* modal تعديل بيانات العميل */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 md:p-4 backdrop-blur-sm">
          <div className="bg-card rounded-2xl w-full max-w-md p-4 md:p-6 shadow-2xl border border-border animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 md:mb-5 border-b border-border pb-3">
              <h2 className="text-base md:text-lg font-bold">تعديل بيانات العميل</h2>
              <button onClick={() => setEditingCustomer(null)} className="p-1 hover:bg-border/50 rounded-lg transition-colors">
                <X className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs md:text-sm font-bold text-gray-500 mb-1">اسم العميل</label>
                <input
                  type="text"
                  value={editForm.customerName}
                  onChange={(e) => setEditForm({...editForm, customerName: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-bold text-gray-500 mb-1">رقم الهاتف (الأساس)</label>
                <input
                  type="text"
                  value={editForm.phoneNumber}
                  onChange={(e) => setEditForm({...editForm, phoneNumber: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary outline-none text-left"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-bold text-gray-500 mb-1">العنوان (اختياري)</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2 md:gap-3">
                <button
                  onClick={() => setEditingCustomer(null)}
                  className="flex-1 py-2.5 text-sm font-bold rounded-xl border border-border hover:bg-border/50 transition-colors"
                  disabled={isSaving}
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSaveChanges}
                  disabled={isSaving || !editForm.customerName || !editForm.phoneNumber}
                  className="flex-1 py-2.5 text-sm rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ التعديلات'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}