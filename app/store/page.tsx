"use client";

import { useState, useEffect } from "react";
import { Package, Plus, User, ExternalLink, X, Loader2 } from "lucide-react";
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
      setLoading(false); // 👈 ينتهي التحميل فوراً دون التعليق في البحث
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
        status: "available",
        specs: {
          chassisNumber: newItem.chassisNumber,
          color: newItem.color,
          modelYear: newItem.modelYear,
        },
      });

      toast.success("تمت إضافة المنتج للمخزن بنجاح!");
      setIsAddOpen(false);
      setNewItem({ title: "", category: "دراجات", price: "", chassisNumber: "", color: "", modelYear: "" });
      await loadData(); 
    } catch (error) {
      console.error("خطأ في حفظ المنتج:", error);
      toast.error("حدث خطأ أثناء حفظ المنتج");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* الهيدر والأزرار */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <Package className="w-7 h-7 text-blue-500" /> إدارة المخزن والمنتجات
          </h1>
          <p className="text-gray-400 text-sm mt-1">عرض السلع المتوفرة، حركات البيع، وربطها بالعملاء</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة منتج جديد</span>
          </button>

          <div className="flex items-center gap-1 bg-card p-1 rounded-xl border border-border">
            <button
              onClick={() => setActiveTab("available")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === "available" ? "bg-blue-600 text-white" : "text-gray-400 hover:text-foreground"
              }`}
            >
              المتوفر
            </button>
            <button
              onClick={() => setActiveTab("sold")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === "sold" ? "bg-emerald-600 text-white" : "text-gray-400 hover:text-foreground"
              }`}
            >
              المباع
            </button>
          </div>
        </div>
      </div>

      {/* عرض قائمة المنتجات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full bg-card border border-border rounded-2xl p-8 text-center text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span>جاري تحميل المخزن...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="col-span-full bg-card border border-border rounded-2xl p-8 text-center text-gray-400">
            {activeTab === "available" ? "لا توجد منتجات متوفرة حالياً في المخزن." : "لم يتم بيع أي منتجات بعد."}
          </div>
        ) : (
          items.map((item, index) => (
            <div key={item.id || index} className="bg-card border border-border rounded-2xl p-5 space-y-4 flex flex-col justify-between border-t-2 border-t-blue-500 shadow-sm">
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    {item.category}
                  </span>
                  <span className="text-lg font-bold text-emerald-500">${item.price}</span>
                </div>

                <h3 className="font-bold text-foreground text-lg mt-3">{item.title}</h3>

                <div className="mt-3 space-y-1.5 text-xs text-gray-400 bg-secondary/30 p-3 rounded-lg border border-border">
                  {item.specs?.chassisNumber && (
                    <div className="flex justify-between">
                      <span>رقم الشاصي / السيريال:</span>
                      <span className="font-mono text-amber-500 font-bold">{item.specs.chassisNumber}</span>
                    </div>
                  )}
                  {item.specs?.color && (
                    <div className="flex justify-between">
                      <span>اللون:</span>
                      <span className="text-foreground">{item.specs.color}</span>
                    </div>
                  )}
                  {item.specs?.modelYear && (
                    <div className="flex justify-between">
                      <span>الموديل:</span>
                      <span className="text-foreground">{item.specs.modelYear}</span>
                    </div>
                  )}
                </div>
              </div>

              {item.status === "sold" && item.soldToClientId && (
                <div className="pt-3 border-t border-border flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <User className="w-4 h-4 text-emerald-500" />
                    <span>المشتري: <strong className="text-foreground">{item.soldToClientName}</strong></span>
                  </div>

                  <Link
                    href={`/customers?id=${item.soldToClientId}`}
                    className="flex items-center gap-1 text-blue-500 hover:text-blue-400 font-semibold transition"
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

      {/* Modal نافذة إضافة منتج جديد */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground">إضافة مادة جديدة للمخزن</h3>
              <button onClick={() => setIsAddOpen(false)} className="text-gray-400 hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">اسم المادة / المنتج</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: دراجة ياماها 2024 أو أيفون 15"
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">القسم / التصنيف</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="دراجات">دراجات</option>
                    <option value="سيارات">سيارات</option>
                    <option value="هواتف">هواتف / أجهزة</option>
                    <option value="كهربائيات">كهربائيات</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">السعر (USD)</label>
                  <input
                    type="number"
                    required
                    placeholder="0"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">رقم الشاصي / السيريال (اختياري)</label>
                <input
                  type="text"
                  placeholder="رقم الشاصي أو Serial Number"
                  value={newItem.chassisNumber}
                  onChange={(e) => setNewItem({ ...newItem, chassisNumber: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">اللون</label>
                  <input
                    type="text"
                    placeholder="أسود، أحمر..."
                    value={newItem.color}
                    onChange={(e) => setNewItem({ ...newItem, color: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">الموديل / السنة</label>
                  <input
                    type="text"
                    placeholder="2024"
                    value={newItem.modelYear}
                    onChange={(e) => setNewItem({ ...newItem, modelYear: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="w-1/2 bg-secondary hover:bg-secondary/80 text-foreground py-2.5 rounded-xl font-medium transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-1/2 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
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