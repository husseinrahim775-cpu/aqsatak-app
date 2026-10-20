"use client";

import { useState, useEffect } from "react";
import { Package, Plus, User, ExternalLink, X, Loader2, Edit3, Trash2 } from "lucide-react";
import Link from "next/link";
import { 
  getSoldInventory, 
  getAvailableInventory, 
  addInventoryItem,
  InventoryItem 
} from "../../services/firestore";
import { toast } from "sonner";
import { useAuth } from "../../components/AuthProvider";

export default function StorePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"available" | "sold">("available");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // حالة النافذة المنبثقة والمدخلات
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newItem, setNewItem] = useState({
    title: "",
    category: "دراجات",
    price: "",
    costPrice: "",
    chassisNumber: "",
    color: "",
    modelYear: "",
  });

  // تحميل البيانات السريع حسب التبويب
  const loadData = async () => {
    setLoading(true);
    try {
      const data = activeTab === "available" 
        ? await getAvailableInventory() 
        : await getSoldInventory();
      setItems(data || []);
    } catch (err) {
      console.error("خطأ في جلب بيانات المخزن:", err);
      toast.error("حدث خطأ أثناء تحميل بيانات المخزن.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, user]);

  // دالة حفظ المنتج جديد
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.title || !newItem.price) {
      toast.error("يرجى إدخال اسم المنتج والسعر على الأقل");
      return;
    }

    try {
      setIsSubmitting(true);
      await addInventoryItem({
        title: newItem.title,
        category: newItem.category,
        price: Number(newItem.price),
        costPrice: Number(newItem.costPrice) || 0,
        status: "available",
        specs: {
          chassisNumber: newItem.chassisNumber,
          color: newItem.color,
          modelYear: newItem.modelYear,
        },
      });

      toast.success("تمت إضافة المنتج للمخزن بنجاح!");
      setIsAddOpen(false);
      setNewItem({ title: "", category: "دراجات", price: "", costPrice: "", chassisNumber: "", color: "", modelYear: "" });
      await loadData(); 
    } catch (error) {
      console.error("خطأ في حفظ المنتج:", error);
      toast.error("حدث خطأ أثناء حفظ المنتج");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 font-sans dir-rtl text-right">
      
      {/* 1. الترويسة الرئيسية بستايل V14 Glass Look */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/80 backdrop-blur-xl p-5 md:p-6 rounded-3xl border border-border shadow-sm transition-all duration-300 hover:shadow-md">
        <div>
          <h1 className="text-xl md:text-3xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <Package className="w-7 h-7 text-orange-500 animate-pulse" />
            <span>إدارة المخزن والمنتجات V14</span>
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 font-bold">
            عرض السلع المتوفرة، حركات البيع، والربط بالخزينة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* تبويبات العرض (المتوفر / المباع) */}
          <div className="flex items-center gap-1.5 bg-secondary/40 p-1.5 rounded-2xl border border-border">
            <button
              onClick={() => setActiveTab("available")}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${
                activeTab === "available" ? "bg-orange-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              المتوفر
            </button>
            <button
              onClick={() => setActiveTab("sold")}
              className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${
                activeTab === "sold" ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              المباع
            </button>
          </div>

          {/* زر إضافة منتج جديد */}
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-95 text-white px-5 py-2.5 rounded-2xl text-xs md:text-sm font-black transition-all shadow-md shadow-orange-500/20 active:scale-95 hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة منتج جديد</span>
          </button>
        </div>
      </div>

      {/* 2. عرض شبكة بطاقات المنتجات V14 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full bg-card/80 backdrop-blur-xl border border-border rounded-3xl p-12 text-center text-orange-500 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-9 h-9 animate-spin" />
            <span className="text-xs font-black text-muted-foreground animate-pulse">جاري جلب قائمة المخزن V14...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="col-span-full bg-card/80 backdrop-blur-xl border border-border rounded-3xl p-12 text-center text-muted-foreground font-black text-sm">
            {activeTab === "available" ? "لا توجد منتجات متوفرة حالياً في المخزن." : "لم يتم بيع أي منتجات بعد."}
          </div>
        ) : (
          items.map((item, index) => (
            <div 
              key={item.id || index} 
              className="bg-card/90 backdrop-blur-md border border-border rounded-3xl p-5 md:p-6 space-y-4 flex flex-col justify-between shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 border-t-4 border-t-orange-500"
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                      {item.category}
                    </span>
                  </div>

                  {/* تغيير السعر والتكلفة بالكامل إلى د.ع */}
                  <div className="text-left">
                    <div className="text-base md:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      {Number(item.price).toLocaleString("en-US")} د.ع
                    </div>
                    {item.costPrice ? (
                      <div className="text-[11px] font-bold text-amber-500 font-mono mt-0.5">
                        التكلفة: {Number(item.costPrice).toLocaleString("en-US")} د.ع
                      </div>
                    ) : null}
                  </div>
                </div>

                <h3 className="font-black text-foreground text-lg md:text-xl mt-3.5 tracking-tight">{item.title}</h3>

                {/* المواصفات الفنية للمنتج */}
                <div className="mt-4 space-y-2 text-xs text-muted-foreground bg-secondary/30 p-3.5 rounded-2xl border border-border/80">
                  {item.specs?.chassisNumber && (
                    <div className="flex justify-between items-center">
                      <span className="font-bold">السيريال / الشاصي:</span>
                      <span className="font-mono text-orange-500 font-black text-xs">{item.specs.chassisNumber}</span>
                    </div>
                  )}
                  {item.specs?.color && (
                    <div className="flex justify-between items-center">
                      <span className="font-bold">اللون:</span>
                      <span className="text-foreground font-black">{item.specs.color}</span>
                    </div>
                  )}
                  {item.specs?.modelYear && (
                    <div className="flex justify-between items-center">
                      <span className="font-bold">الموديل / السنة:</span>
                      <span className="text-foreground font-black">{item.specs.modelYear}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* تفاصيل المشتري إن كان المنتج مباعاً */}
              {item.status === "sold" && item.soldToClientId && (
                <div className="pt-3.5 border-t border-border flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground font-bold">
                    <User className="w-4 h-4 text-emerald-500" />
                    <span>المشتري: <strong className="text-foreground font-black">{item.soldToClientName}</strong></span>
                  </div>

                  <Link
                    href={`/customers/details?id=${item.soldToClientId}`}
                    className="flex items-center gap-1 text-orange-500 hover:underline font-black transition"
                  >
                    <span>سجل العميل</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 3. نافذة إضافة منتج جديد V14 Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3.5">
              <h3 className="text-base md:text-lg font-black text-foreground flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-500" />
                <span>إضافة مادة جديدة للمخزن V14</span>
              </h3>
              <button onClick={() => setIsAddOpen(false)} className="p-1.5 hover:bg-secondary rounded-xl text-muted-foreground hover:text-foreground transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">اسم المادة / المنتج</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: دراجة ياماها 2024 أو أيفون 15"
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-xs md:text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">القسم / التصنيف</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full bg-background border border-border rounded-2xl px-3 py-3 text-xs md:text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="دراجات">دراجات</option>
                    <option value="سيارات">سيارات</option>
                    <option value="هواتف">هواتف / أجهزة</option>
                    <option value="كهربائيات">كهربائيات</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">سعر البيع (د.ع)</label>
                  <input
                    type="number"
                    required
                    placeholder="0"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-xs md:text-sm font-black text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">تلفة الشراء / التكلفة (د.ع)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newItem.costPrice}
                    onChange={(e) => setNewItem({ ...newItem, costPrice: e.target.value })}
                    className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-xs md:text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">السيريال / الشاصي</label>
                  <input
                    type="text"
                    placeholder="رقم الشاصي أو Serial Number"
                    value={newItem.chassisNumber}
                    onChange={(e) => setNewItem({ ...newItem, chassisNumber: e.target.value })}
                    className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-xs md:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">اللون</label>
                  <input
                    type="text"
                    placeholder="أسود، أحمر..."
                    value={newItem.color}
                    onChange={(e) => setNewItem({ ...newItem, color: e.target.value })}
                    className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-xs md:text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-muted-foreground block mb-1">الموديل / السنة</label>
                  <input
                    type="text"
                    placeholder="2024"
                    value={newItem.modelYear}
                    onChange={(e) => setNewItem({ ...newItem, modelYear: e.target.value })}
                    className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-xs md:text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="w-1/2 bg-secondary hover:bg-secondary/80 text-foreground py-3 rounded-2xl font-bold text-xs md:text-sm transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-95 text-white py-3 rounded-2xl font-black text-xs md:text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-orange-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>حفظ المنتج</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}