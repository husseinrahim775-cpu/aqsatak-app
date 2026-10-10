"use client";

import { useState, useEffect } from "react";
import { Package, Plus, User, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { 
  getSoldInventory, 
  getAvailableInventory, 
  addInventoryItem,
  InventoryItem 
} from "../../services/firestore";

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<"available" | "sold">("available");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // حالة النافذة المنبثقة لإضافة مادة جديدة
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    title: "",
    category: "دراجات",
    price: "",
    chassisNumber: "",
    color: "",
    modelYear: "",
  });

  // تحميل البيانات حسب التبويب المختار
  const loadData = async () => {
    setLoading(true);
    try {
      const data = activeTab === "available" ? await getAvailableInventory() : await getSoldInventory();
      setItems(data || []);
    } catch (err) {
      console.error("خطأ في جلب بيانات المخزن:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  // دالة حفظ المادة الجديدة في Firestore
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.title || !newItem.price) {
      alert("يرجى إدخال اسم المنتج والسعر على الأقل");
      return;
    }

    try {
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

      setIsAddOpen(false);
      setNewItem({ title: "", category: "دراجات", price: "", chassisNumber: "", color: "", modelYear: "" });
      loadData(); // إعادة تحميل القائمة تلقائياً بعد الحفظ
    } catch (error) {
      console.error("خطأ في حفظ المنتج:", error);
      alert("حدث خطأ أثناء حفظ المنتج في المخزن.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* الهيدر والأزرار */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-7 h-7 text-blue-500" /> إدارة المخزن والمنتجات
          </h1>
          <p className="text-slate-400 text-sm mt-1">عرض السلع المتوفرة، حركات البيع، وربطها بالعملاء</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition active:scale-95 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة منتج جديد</span>
          </button>

          <div className="flex items-center gap-1 bg-[#1e293b] p-1 rounded-xl border border-[#334155]">
            <button
              type="button"
              onClick={() => setActiveTab("available")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === "available" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              المتوفر بالمخزن
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("sold")}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === "sold" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              سجل المبيعات والحركات
            </button>
          </div>
        </div>
      </div>

      {/* قائمة المواد المعروضة */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full card-glass p-8 text-center text-slate-400">جاري تحميل مواد المخزن...</div>
        ) : items.length === 0 ? (
          <div className="col-span-full card-glass p-8 text-center text-slate-400">
            {activeTab === "available" ? "لا توجد منتجات متوفرة حالياً في المخزن." : "لم يتم بيع أي منتجات بعد."}
          </div>
        ) : (
          items.map((item, index) => (
            <div key={item.id || index} className="card-glass p-5 space-y-4 flex flex-col justify-between border-t-2 border-t-blue-500 rounded-2xl bg-card border border-border">
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {item.category}
                  </span>
                  <span className="text-lg font-bold text-emerald-400">${item.price}</span>
                </div>

                <h3 className="font-bold text-slate-100 text-lg mt-3">{item.title}</h3>

                {/* المواصفات التفصيلية */}
                <div className="mt-3 space-y-1.5 text-xs text-slate-300 bg-[#0f172a]/60 p-3 rounded-lg border border-slate-800">
                  {item.specs?.chassisNumber && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">رقم الشاصي / السيريال:</span>
                      <span className="font-mono text-amber-400">{item.specs.chassisNumber}</span>
                    </div>
                  )}
                  {item.specs?.color && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">اللون:</span>
                      <span>{item.specs.color}</span>
                    </div>
                  )}
                  {item.specs?.modelYear && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">الموديل:</span>
                      <span>{item.specs.modelYear}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* إذا كانت المادة مباعة */}
              {item.status === "sold" && item.soldToClientId && (
                <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <User className="w-4 h-4 text-emerald-400" />
                    <span>المشتري: <strong className="text-white">{item.soldToClientName}</strong></span>
                  </div>

                  <Link
                    href={`/customers?id=${item.soldToClientId}`}
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-semibold transition"
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

      {/* النافذة المنبثقة لإضافة مادة جديدة */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-700 pb-3">
              <h3 className="text-lg font-bold text-white">إضافة مادة جديدة للمخزن</h3>
              <button type="button" onClick={() => setIsAddOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 block mb-1">اسم المادة / المنتج</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: دراجة ياماها 2024 أو أيفون 15"
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">القسم / التصنيف</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="دراجات">دراجات</option>
                    <option value="سيارات">سيارات</option>
                    <option value="هواتف">هواتف / أجهزة</option>
                    <option value="كهربائيات">كهربائيات</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">السعر (USD)</label>
                  <input
                    type="number"
                    required
                    placeholder="0"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">رقم الشاصي / السيريال (اختياري)</label>
                <input
                  type="text"
                  placeholder="رقم الشاصي أو Serial Number"
                  value={newItem.chassisNumber}
                  onChange={(e) => setNewItem({ ...newItem, chassisNumber: e.target.value })}
                  className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">اللون</label>
                  <input
                    type="text"
                    placeholder="أسود، أحمر..."
                    value={newItem.color}
                    onChange={(e) => setNewItem({ ...newItem, color: e.target.value })}
                    className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">الموديل / السنة</label>
                  <input
                    type="text"
                    placeholder="2024"
                    value={newItem.modelYear}
                    onChange={(e) => setNewItem({ ...newItem, modelYear: e.target.value })}
                    className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl font-medium transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-medium transition"
                >
                  حفظ المنتج
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}