"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../components/AuthProvider";
import { 
  getUserInstallments, 
  InstallmentData,
  updateInstallment, 
  deleteInstallment 
} from "../../services/firestore";
import Link from "next/link";
import { Plus, Search, Eye, Edit, Trash2, X, Loader2 } from "lucide-react";

interface GroupedCustomer {
  customerName: string;
  phoneNumber: string;
  address: string;
  installments: InstallmentData[];
}

export default function CustomersPage() {
  const { user } = useAuth();
  const [installments, setInstallments] = useState<InstallmentData[]>([]);
  const [search, setSearch] = useState("");

  const [editingCustomer, setEditingCustomer] = useState<GroupedCustomer | null>(null);
  const [editForm, setEditForm] = useState({ customerName: "", phoneNumber: "", address: "" });
  const [isSaving, setIsSaving] = useState(false);

  const fetchInstallments = async () => {
    if (user?.uid) {
      const data = await getUserInstallments(user.uid);
      setInstallments(data);
    }
  };

  useEffect(() => {
    fetchInstallments();
  }, [user]);

  const groupedCustomers = useMemo(() => {
    const map = new Map<string, GroupedCustomer>();

    installments.forEach((item) => {
      const key = item.phoneNumber.trim();
      if (!map.has(key)) {
        map.set(key, {
          customerName: item.customerName,
          phoneNumber: item.phoneNumber,
          address: item.address,
          installments: [],
        });
      }
      map.get(key)!.installments.push(item);
    });

    return Array.from(map.values()).filter(
      (c) =>
        c.customerName.includes(search) || c.phoneNumber.includes(search)
    );
  }, [installments, search]);

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
      await fetchInstallments(); 
      setEditingCustomer(null); 
    } catch (error) {
      console.error("خطأ في التعديل:", error);
      alert("حدث خطأ أثناء حفظ التعديلات.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustomer = async (customer: GroupedCustomer) => {
    const confirmDelete = window.confirm(
      `هل أنت متأكد من حذف العميل "${customer.customerName}" وجميع أقساطه (${customer.installments.length})؟\n\nتنبيه: لا يمكن التراجع عن هذا الإجراء!`
    );

    if (confirmDelete) {
      try {
        const deletePromises = customer.installments.map((inst) => 
          deleteInstallment(inst.id!)
        );
        
        await Promise.all(deletePromises);
        await fetchInstallments(); 
      } catch (error) {
        console.error("خطأ في الحذف:", error);
        alert("حدث خطأ أثناء حذف العميل.");
      }
    }
  };

  return (
    // تصغير المسافات العامة في الهاتف
    <div className="space-y-4 md:space-y-6 relative pb-8">
      
      {/* 1. رأس الصفحة */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">العملاء والأقساط</h1>
          <p className="text-gray-500 text-xs md:text-sm mt-1">إدارة سجلات العملاء ومتابعة الأقساط النشطة.</p>
        </div>
        {/* زر الإضافة يأخذ العرض بالكامل في الهاتف لسهولة النقر */}
        <Link
          href="/customers/new"
          className="flex items-center justify-center w-full sm:w-auto gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg hover:bg-primary/90 font-medium text-sm md:text-base transition-colors"
        >
          <Plus className="w-4 h-4 md:w-5 md:h-5" />
          <span>إضافة قسط جديد</span>
        </Link>
      </div>

      {/* 2. شريط البحث */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-400" />
        <input
          type="text"
          placeholder="ابحث عن اسم العميل أو رقم الهاتف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pr-9 md:pr-10 pl-4 py-2.5 md:py-3 rounded-xl border border-border bg-card text-sm md:text-base focus:ring-2 focus:ring-primary outline-none transition-all"
        />
      </div>

      {/* 3. شبكة العملاء (كروت) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {groupedCustomers.map((customer) => {
          const totalRemaining = customer.installments.reduce(
            (acc, curr) => acc + curr.totalDue,
            0
          );
          const totalMonthly = customer.installments.reduce(
            (acc, curr) => acc + curr.monthlyInstallment,
            0
          );

          return (
            // تصغير الـ padding الداخلي للكارت في الهاتف
            <div key={customer.phoneNumber} className="bg-card border border-border rounded-xl p-4 md:p-5 space-y-3 md:space-y-4 shadow-sm group">
              <div className="flex justify-between items-start border-b border-border pb-2 md:pb-3">
                <div>
                  <h3 className="font-bold text-base md:text-lg text-foreground flex items-center gap-2">
                    {customer.customerName}
                    {/* تعديل هام: الأزرار تظهر دائماً في الهاتف، وتختفي/تظهر عند الماوس في اللابتوب */}
                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditModal(customer)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors" title="تعديل بيانات العميل">
                        <Edit className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </button>
                      <button onClick={() => handleDeleteCustomer(customer)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors" title="حذف العميل بالكامل">
                        <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </button>
                    </div>
                  </h3>
                  <p className="text-xs md:text-sm text-gray-500 mt-0.5" dir="ltr">{customer.phoneNumber}</p>
                </div>
                <span className="bg-primary/10 text-primary text-[10px] md:text-xs font-bold px-2 py-1 md:px-2.5 rounded-full whitespace-nowrap">
                  {customer.installments.length} أقساط
                </span>
              </div>

              <div className="space-y-1.5 md:space-y-2 text-xs md:text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>إجمالي المتبقي للتقسيط:</span>
                  <span className="font-bold text-foreground">{Math.round(totalRemaining).toLocaleString()} د.ع</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>مجموع الأقساط الشهرية:</span>
                  <span className="font-bold text-primary">{Math.round(totalMonthly).toLocaleString()} د.ع</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-border mt-2">
                <div className="text-[10px] md:text-xs text-gray-400 truncate w-full sm:w-2/3" title={customer.installments.map((i) => i.productName).join("، ")}>
                  المنتجات: {customer.installments.map((i) => i.productName).join("، ")}
                </div>
                <Link
                  href={`/customers/${encodeURIComponent(customer.phoneNumber)}`}
                  className="flex items-center gap-1.5 text-xs text-primary font-bold hover:underline self-end sm:self-auto shrink-0"
                >
                  <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  <span>عرض الملف والأقساط</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* --- نافذة التعديل (Modal) --- */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 md:p-4 backdrop-blur-sm">
          <div className="bg-background rounded-2xl w-full max-w-md p-4 md:p-6 shadow-xl border border-border animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <h2 className="text-lg md:text-xl font-bold">تعديل بيانات العميل</h2>
              <button onClick={() => setEditingCustomer(null)} className="p-1.5 md:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                <X className="w-4 h-4 md:w-5 md:h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-3 md:space-y-4">
              <div>
                <label className="block text-xs md:text-sm font-medium mb-1">اسم العميل</label>
                <input
                  type="text"
                  value={editForm.customerName}
                  onChange={(e) => setEditForm({...editForm, customerName: e.target.value})}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium mb-1">رقم الهاتف (الأساس)</label>
                <input
                  type="text"
                  value={editForm.phoneNumber}
                  onChange={(e) => setEditForm({...editForm, phoneNumber: e.target.value})}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none text-left"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs md:text-sm font-medium mb-1">العنوان (اختياري)</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div className="pt-3 md:pt-4 flex gap-2 md:gap-3">
                <button
                  onClick={() => setEditingCustomer(null)}
                  className="flex-1 py-2 md:py-2.5 text-sm md:text-base rounded-xl border border-border font-medium hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  disabled={isSaving}
                >
                  إلغاء
                </button>
                <button
                  onClick={handleSaveChanges}
                  disabled={isSaving || !editForm.customerName || !editForm.phoneNumber}
                  className="flex-1 py-2 md:py-2.5 text-sm md:text-base rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : 'حفظ التعديلات'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}