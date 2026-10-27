"use client";

import { useState, useEffect } from "react";
import { Package, Plus, User, ExternalLink, X, Edit3, Trash2, Tag, Calendar, Sparkles } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../components/AuthProvider";
import { 
  getSoldInventory, 
  getAvailableInventory, 
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  addTreasuryTransaction,
  InventoryItem 
} from "../../services/firestore";
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

export default function InventoryPage() {
  const { user } = useAuth();
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState<"available" | "sold">("available");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // حالة نافذة الإضافة والتعديل
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    category: "هواتف",
    costPrice: "" as number | "", // سعر الشراء (التكلفة)
    price: "" as number | "",     // سعر البيع
    chassisNumber: "",
    color: "",
    modelYear: "",
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

  // جلب ownerUid الخاص بالحساب المسجل
  const getOwnerUid = () => {
    const activeSession = sessionStorage.getItem("active_session");
    if (activeSession) {
      try {
        const parsed = JSON.parse(activeSession);
        if (parsed.ownerUid) return parsed.ownerUid;
      } catch (e) {}
    }
    return user?.uid || null;
  };

  // تحميل البيانات
  const loadData = async () => {
    setLoading(true);
    try {
      const data = activeTab === "available" ? await getAvailableInventory() : await getSoldInventory();
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
  }, [activeTab]);

  // فتح نافذة التعديل مع تعبئة البيانات القديمة
  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title || "",
      category: item.category || "هواتف",
      costPrice: item.costPrice ? Number(item.costPrice) : "",
      price: item.price ? Number(item.price) : "",
      chassisNumber: item.specs?.chassisNumber || "",
      color: item.specs?.color || "",
      modelYear: item.specs?.modelYear || "",
    });
    setIsAddOpen(true);
  };

  // إغلاق النافذة وتنظيف النموذج
  const handleCloseModal = () => {
    setIsAddOpen(false);
    setEditingItem(null);
    setFormData({ title: "", category: "هواتف", costPrice: "", price: "", chassisNumber: "", color: "", modelYear: "" });
  };

  // دالة الحفظ مع الربط التلقائي بالخزينة (مرة واحدة فقط عند إضافة السلعة)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.price) {
      toast.error("يرجى إدخال اسم المنتج وسعر البيع على الأقل");
      return;
    }

    try {
      const costPriceNum = formData.costPrice ? Number(formData.costPrice) : 0;
      const priceNum = Number(formData.price);

      const payload = {
        title: formData.title,
        category: formData.category,
        costPrice: costPriceNum,
        price: priceNum,
        specs: {
          chassisNumber: formData.chassisNumber,
          color: formData.color,
          modelYear: formData.modelYear,
        },
      };

      if (editingItem && editingItem.id) {
        // تعديل منتج قائم
        await updateInventoryItem(editingItem.id, payload);
        toast.success("تم تعديل بيانات المنتج بنجاح!");
      } else {
        // 1. إضافة منتج جديد للمخزن
        await addInventoryItem({
          ...payload,
          status: "available",
        });

        // 2. ⚡ ربط تلقائي بالخزينة: تسجيل حركة شراء بضاعة ومخزن المرة الأولى فقط عند إضافة المادة للمخزن
        if (costPriceNum > 0) {
          const ownerUid = getOwnerUid();
          if (ownerUid) {
            await addTreasuryTransaction({
              userId: ownerUid,
              type: "outflow",
              category: "inventory_purchase",
              amount: costPriceNum,
              description: `شراء بضاعة ومخزن: ${formData.title} ${formData.chassisNumber ? `(سيريال: ${formData.chassisNumber})` : ""}`,
              date: new Date().toISOString(),
            });
          }
        }
        toast.success("تمت إضافة المنتج للمخزن وتسجيل العملية بالخزينة بنجاح!");
      }

      handleCloseModal();
      loadData();
    } catch (error) {
      console.error("خطأ في حفظ المنتج والربط بالخزينة:", error);
      toast.error("حدث خطأ أثناء حفظ التغيرات.");
    }
  };

  // دالة الحذف المباشرة
  const handleDeleteItem = async (item: InventoryItem) => {
    if (!item.id) return;
    if (!window.confirm(`هل أنت متأكد من حذف المنتج (${item.title}) من المخزن؟`)) return;
    
    try {
      await deleteInventoryItem(item.id);
      toast.success(`تم حذف المنتج (${item.title}) بنجاح من المخزن.`);
      loadData();
    } catch (error) {
      console.error("خطأ في حذف المنتج:", error);
      toast.error("حدث خطأ أثناء محاولة حذف المنتج.");
    }
  };

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
            <Package className="w-6 h-6 text-primary" />
            إدارة المخزن المالي والمنتجات
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 font-bold">عرض السلع المتوفرة، حركات البيع، والربط بالخزينة.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setEditingItem(null);
              setFormData({ title: "", category: "هواتف", costPrice: "", price: "", chassisNumber: "", color: "", modelYear: "" });
              setIsAddOpen(true);
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-5 py-3 rounded-2xl font-black text-xs md:text-sm shadow-md shadow-primary/20 hover:opacity-95 transition-opacity cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة منتج جديد</span>
          </motion.button>

          <div className="flex items-center gap-1 bg-secondary/60 backdrop-blur-md p-1 rounded-2xl border border-border">
            <button
              onClick={() => setActiveTab("available")}
              className={`px-4 py-2 text-xs md:text-sm font-black rounded-xl transition-all ${
                activeTab === "available" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              المتوفر
            </button>
            <button
              onClick={() => setActiveTab("sold")}
              className={`px-4 py-2 text-xs md:text-sm font-black rounded-xl transition-all ${
                activeTab === "sold" ? "bg-secondary text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              المباع
            </button>
          </div>
        </div>
      </div>

      {/* 2. شبكة كروت المنتجات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {loading ? (
          <div className="col-span-full bg-card/40 backdrop-blur-md p-12 text-center text-muted-foreground text-sm font-black rounded-3xl border border-dashed border-border animate-pulse">
            جاري تحميل بضائع المخزن...
          </div>
        ) : items.length === 0 ? (
          <div className="col-span-full bg-card/40 backdrop-blur-md p-12 text-center text-muted-foreground text-sm font-black rounded-3xl border border-dashed border-border">
            {activeTab === "available" ? "لا توجد منتجات متوفرة حالياً في المخزن." : "لم يتم بيع أي منتجات بعد."}
          </div>
        ) : (
          items.map((item, index) => (
            <motion.div 
              key={item.id || index} 
              whileHover={{ y: -4 }}
              className="bg-card/90 backdrop-blur-md p-5 rounded-3xl border border-border space-y-4 flex flex-col justify-between shadow-sm hover:border-primary/40 transition-all relative group"
            >
              <div>
                <div className="flex justify-between items-start border-b border-border/60 pb-3">
                  <span className="text-xs font-black px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {item.category}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <div className="text-left">
                      <span className="text-lg md:text-2xl font-black text-foreground block tracking-tight font-mono">
                        {Number(item.price).toLocaleString("en-US")} د.ع
                      </span>
                      {item.costPrice ? (
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-mono block font-black">
                          التكلفة: {Number(item.costPrice).toLocaleString("en-US")} د.ع
                        </span>
                      ) : null}
                    </div>
                    
                    <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-xl border border-border/60 mr-1.5">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        title="تعديل المنتج"
                        className="text-blue-600 hover:text-blue-700 p-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item)}
                        title="حذف المنتج"
                        className="text-rose-600 hover:text-rose-700 p-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <h3 className="font-black text-foreground text-base md:text-lg mt-3">{item.title}</h3>

                <div className="mt-3 space-y-2 text-xs md:text-sm text-muted-foreground bg-secondary/40 p-3.5 rounded-2xl border border-border/50">
                  {item.specs?.chassisNumber && (
                    <div className="flex justify-between items-center">
                      <span className="font-bold">السيريال  :</span>
                      <span className="font-mono font-black text-primary">{item.specs.chassisNumber}</span>
                    </div>
                  )}
                  {item.specs?.color && (
                    <div className="flex justify-between items-center">
                      <span className="font-bold">اللون:</span>
                      <span className="font-black text-foreground">{item.specs.color}</span>
                    </div>
                  )}
                  {item.specs?.modelYear && (
                    <div className="flex justify-between items-center">
                      <span className="font-bold">الموديل / السنة:</span>
                      <span className="font-black text-foreground">{item.specs.modelYear}</span>
                    </div>
                  )}
                </div>
              </div>

              {item.status === "sold" && item.soldToClientId && (
                <div className="pt-3 border-t border-border/60 flex justify-between items-center text-xs md:text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground font-bold">
                    <User className="w-4 h-4 text-primary" />
                    <span>المشتري: <strong className="text-foreground font-black">{item.soldToClientName}</strong></span>
                  </div>

                  <Link
                    href={`/customers?id=${item.soldToClientId}`}
                    className="flex items-center gap-1 text-primary hover:underline font-black transition-all"
                  >
                    <span>سجل العميل</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* 3. نافذة الإضافة والتعديل Modal */}
      <AnimatePresence>
        {isAddOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-card border border-border rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-border pb-3.5">
                <h3 className="text-base md:text-lg font-black text-foreground flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  {editingItem ? "تعديل بيانات المنتج" : "إضافة مادة جديدة للمخزن"}
                </h3>
                <button onClick={handleCloseModal} className="p-1.5 hover:bg-secondary rounded-xl text-muted-foreground cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveItem} className="space-y-4">
                <div>
                  <label className="text-xs md:text-sm font-black text-foreground block mb-1.5">اسم المادة / المنتج *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: ايفون 16 برو ماكس أو دراجة ياماها"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-xs md:text-sm font-black text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs md:text-sm font-black text-foreground block mb-1.5">القسم / التصنيف</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-xs md:text-sm font-black text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    <option value="هواتف">هواتف / أجهزة ذكية</option>
                    <option value="دراجات">دراجات وهواتف نارية</option>
                    <option value="سيارات">سيارات آليات</option>
                    <option value="كهربائيات">كهربائيات وأجهزة منزلية</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* سعر الشراء / التكلفة */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs md:text-sm font-black text-foreground block">سعر التكلفة / الشراء (د.ع)</label>
                      {formData.costPrice !== "" && (
                        <span className="text-[10px] font-black text-amber-500 animate-pulse">
                          {formatArabicCurrency(formData.costPrice)}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="0"
                      value={formatInputDisplay(formData.costPrice)}
                      onChange={(e) => setFormData({ ...formData, costPrice: parseFormattedNumber(e.target.value) })}
                      className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm md:text-base font-black text-amber-600 dark:text-amber-400 dir-ltr text-right focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                    />
                    <div className="flex gap-1 pt-0.5 dir-ltr justify-end">
                      <button 
                        type="button" 
                        onClick={() => addAmount(formData.costPrice, (v) => setFormData((prev) => ({ ...prev, costPrice: v })), 1000, true)}
                        className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all cursor-pointer"
                      >
                        +000 (ألف)
                      </button>
                      <button 
                        type="button" 
                        onClick={() => addAmount(formData.costPrice, (v) => setFormData((prev) => ({ ...prev, costPrice: v })), 1000000, true)}
                        className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all cursor-pointer"
                      >
                        +000000 (مليون)
                      </button>
                    </div>
                  </div>

                  {/* سعر البيع المطلوب */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-xs md:text-sm font-black text-foreground block">سعر البيع المطلوب (د.ع) *</label>
                      {formData.price !== "" && (
                        <span className="text-[10px] font-black text-emerald-500 animate-pulse">
                          {formatArabicCurrency(formData.price)}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="0"
                      value={formatInputDisplay(formData.price)}
                      onChange={(e) => setFormData({ ...formData, price: parseFormattedNumber(e.target.value) })}
                      className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm md:text-base font-black text-emerald-600 dark:text-emerald-400 dir-ltr text-right focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                    />
                    <div className="flex gap-1 pt-0.5 dir-ltr justify-end">
                      <button 
                        type="button" 
                        onClick={() => addAmount(formData.price, (v) => setFormData((prev) => ({ ...prev, price: v })), 1000, true)}
                        className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all cursor-pointer"
                      >
                        +000 (ألف)
                      </button>
                      <button 
                        type="button" 
                        onClick={() => addAmount(formData.price, (v) => setFormData((prev) => ({ ...prev, price: v })), 1000000, true)}
                        className="px-2 py-0.5 bg-secondary hover:bg-primary/20 border border-border rounded-lg text-[10px] font-black text-muted-foreground hover:text-primary transition-all cursor-pointer"
                      >
                        +000000 (مليون)
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs md:text-sm font-black text-foreground block mb-1.5">رقم الشاصي / السيريال (اختياري)</label>
                  <input
                    type="text"
                    placeholder="رقم الشاصي أو Serial Number"
                    value={formData.chassisNumber}
                    onChange={(e) => setFormData({ ...formData, chassisNumber: e.target.value })}
                    className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-xs md:text-sm font-black text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs md:text-sm font-black text-foreground block mb-1.5">اللون</label>
                    <input
                      type="text"
                      placeholder="أسود، أبيض..."
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-xs md:text-sm font-black text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs md:text-sm font-black text-foreground block mb-1.5">الموديل / السنة</label>
                    <input
                      type="text"
                      placeholder="2026"
                      value={formData.modelYear}
                      onChange={(e) => setFormData({ ...formData, modelYear: e.target.value })}
                      className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-xs md:text-sm font-black text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 bg-secondary hover:bg-secondary/80 text-foreground py-3 rounded-2xl font-black text-xs md:text-sm border border-border transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-3 rounded-2xl font-black text-xs md:text-sm shadow-md shadow-primary/20 hover:opacity-95 transition-opacity cursor-pointer"
                  >
                    {editingItem ? "حفظ التعديلات" : "حفظ المنتج بالنظام"}
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