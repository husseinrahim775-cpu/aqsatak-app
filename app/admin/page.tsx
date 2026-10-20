"use client";

import { useEffect, useState } from "react";
import { db, storage } from "@/services/firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc, query, setDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { 
  CheckCircle2, 
  XCircle, 
  PauseCircle, 
  PlayCircle, 
  RefreshCw, 
  UserCheck, 
  ShieldAlert, 
  Users, 
  Trash2, 
  Zap, 
  MessageSquare, 
  Image as ImageIcon, 
  Upload, 
  Crown,
  Calendar
} from "lucide-react";
import { toast } from "sonner";

interface UserAccount {
  id: string;
  email: string;
  name?: string;
  role?: string;
  status: "pending" | "active" | "disabled" | "rejected";
  createdAt?: any;
  subscription?: {
    planType?: "basic" | "plus" | "super";
    period?: string;
    startDate?: string;
    endDate?: string;
    isActive?: boolean;
  };
  phoneNumber?: string;
}

export default function AdminDashboardPage() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // حالات الإدخال المخصص لمدّة الاشتراك
  const [customMonths, setCustomMonths] = useState<{ [key: string]: number }>({});
  const [customEndDate, setCustomEndDate] = useState<{ [key: string]: string }>({});

  // حالات تغيير وإدارة الشعار المباشر للنظام
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [globalLogoUrl, setGlobalLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // جلب كافة الحسابات واللوجو العام من Firestore
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef);
      const querySnapshot = await getDocs(q);
      
      const userList: UserAccount[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        userList.push({
          id: docSnap.id,
          email: data.email || docSnap.id,
          name: data.name || data.companyName || "",
          role: data.role || "client",
          status: data.status || "pending",
          createdAt: data.createdAt || null,
          subscription: data.subscription || undefined,
          phoneNumber: data.phoneNumber || data.phone || "",
        });
      });

      setUsers(userList);

      // جلب الشعار العام الحقيقي المرفوع
      const globalSettingsSnap = await getDoc(doc(db, "settings", "global"));
      if (globalSettingsSnap.exists()) {
        setGlobalLogoUrl(globalSettingsSnap.data().systemLogoUrl || "");
      }
    } catch (error) {
      console.error("خطأ في جلب الحسابات:", error);
      toast.error("حدث خطأ أثناء جلب قائمة الحسابات.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 👑 تحديث وتحديد باقة الاشتراك بالمدّة أو التاريخ المخصص للعميل
  const handleUpdateSubscription = async (
    userId: string, 
    planType: "basic" | "plus" | "super", 
    daysOrDate: number | string
  ) => {
    setUpdatingId(userId);
    try {
      const now = new Date();
      let endDate: Date;

      if (typeof daysOrDate === "string") {
        endDate = new Date(daysOrDate);
      } else {
        endDate = new Date(now.getTime() + daysOrDate * 24 * 60 * 60 * 1000);
      }

      const subData = {
        planType,
        period: typeof daysOrDate === "number" && daysOrDate > 30 ? "custom" : "monthly",
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        isActive: true,
      };

      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        subscription: subData,
        status: "active",
        updatedAt: new Date(),
      });

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: "active", subscription: subData as any } : u))
      );

      const planNames = { basic: "الأساسية", plus: "بلس", super: "سوبر" };
      toast.success(`تم تفعيل باقة (${planNames[planType]}) حتى تاريخ ${endDate.toLocaleDateString("ar-IQ")} بنجاح!`);
    } catch (error) {
      console.error("خطأ في تحديث الاشتراك:", error);
      toast.error("حدث خطأ أثناء تحديد باقة الاشتراك.");
    } finally {
      setUpdatingId(null);
    }
  };

  // تحديث حالة الحساب (تفعيل، إيقاف مؤقت، رفض)
  const handleUpdateStatus = async (userId: string, newStatus: "active" | "disabled" | "rejected") => {
    setUpdatingId(userId);
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        status: newStatus,
        updatedAt: new Date(),
      });
      
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
      );

      const statusLabels = {
        active: "تفعيل",
        disabled: "إيقاف",
        rejected: "رفض"
      };
      toast.success(`تم ${statusLabels[newStatus]} الحساب بنجاح!`);
    } catch (error) {
      console.error("خطأ في تغيير حالة الحساب:", error);
      toast.error("حدث خطأ أثناء تحديث حالة الحساب.");
    } finally {
      setUpdatingId(null);
    }
  };

  // 🗑️ دالة حذف الحساب نهائياً من Firestore
  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`هل أنت متأكد من حذف حساب (${userEmail}) نهائياً؟`)) return;

    setUpdatingId(userId);
    try {
      const userRef = doc(db, "users", userId);
      await deleteDoc(userRef);

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success(`تم حذف حساب (${userEmail}) نهائياً من قاعدة البيانات.`);
    } catch (error) {
      console.error("خطأ في حذف الحساب:", error);
      toast.error("حدث خطأ أثناء حذف الحساب، يرجى المحاولة لاحقاً.");
    } finally {
      setUpdatingId(null);
    }
  };

 // 🖼️ رفع وتغيير الشعار الرسمي الشامل للموقع (بسرعة وفورية دون تعليق)
const handleLogoUpload = async () => {
  if (!logoFile) {
    toast.error("يرجى اختيار صورة الشعار أولاً.");
    return;
  }

  // فحص حجم الصورة (أقل من 1 ميغابايت لضمان السرعة)
  if (logoFile.size > 1 * 1024 * 1024) {
    toast.error("حجم الصورة كبير جداً! يرجى اختيار صورة أقل من 1 ميغابايت.");
    return;
  }

  try {
    setUploadingLogo(true);

    // تحويل الصورة إلى Base64 للحفظ المباشر والسريع
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result as string;

      // حفظ الصورة مباشرة بداخل Firestore
      await setDoc(doc(db, "settings", "global"), { systemLogoUrl: base64Image }, { merge: true });
      
      setGlobalLogoUrl(base64Image);
      setLogoFile(null);
      toast.success("تم تحديث الشعار الرسمي للموقع بنجاح!");
      setUploadingLogo(false);
    };

    reader.onerror = () => {
      toast.error("حدث خطأ أثناء قراءة ملف الصورة.");
      setUploadingLogo(false);
    };

    reader.readAsDataURL(logoFile);
  } catch (error) {
    console.error("خطأ في رفع اللوجو:", error);
    toast.error("حدث خطأ أثناء حفظ الشعار.");
    setUploadingLogo(false);
  }
};

  // الإحصائيات
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "active").length;
  const pendingUsers = users.filter((u) => u.status === "pending").length;
  const disabledUsers = users.filter((u) => u.status === "disabled").length;

  return (
    <div className="space-y-8 p-2 md:p-4 font-sans dir-rtl text-right">
      {/* الهيدر الرئيسي */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Crown className="w-7 h-7 text-amber-500" />
            لوحة تحكم الإدارة العليا للأدمن
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            إدارة اشتراكات العملاء، تحديد باقات متعددة الأشهُر أو تواريخ مخصصة، وتغيير الشعار الرسمي للموقع.
          </p>
        </div>

        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-border bg-card hover:bg-accent text-xs font-bold transition-all active:scale-95 w-fit shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>تحديث القائمة</span>
        </button>
      </div>

      {/* 🖼️ قسم إدارة شعار المشروع واللوجو الكامل */}
      <div className="bg-card border border-border p-5 rounded-3xl space-y-3 shadow-sm">
        <h3 className="text-xs md:text-sm font-black text-foreground flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-orange-500" />
          تحديث الشعار واللوجو الرسمي للموقع كاملاً
        </h3>
        <p className="text-[11px] text-muted-foreground">
          اختر صورة جديدة لرفعها لتتحدث تلقائياً كشعار رسمي للنظام لدى كافة المشتركين.
        </p>

        <div className="flex items-center gap-4 flex-wrap pt-1">
          {globalLogoUrl && (
            <div className="w-14 h-14 rounded-2xl border border-border p-1 bg-secondary flex items-center justify-center shrink-0 shadow-sm">
              <img src={globalLogoUrl} alt="Logo" className="w-full h-full object-contain" />
            </div>
          )}

          <input 
            type="file" 
            accept="image/*"
            onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
            className="text-xs text-muted-foreground file:bg-orange-500 file:text-white file:border-0 file:px-3 file:py-2 file:rounded-xl file:font-bold cursor-pointer"
          />

          <button
            type="button"
            onClick={handleLogoUpload}
            disabled={uploadingLogo || !logoFile}
            className="py-2.5 px-5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold rounded-2xl hover:opacity-90 disabled:opacity-50 shadow-md shadow-orange-500/20 flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" />
            <span>{uploadingLogo ? "جاري الرفع..." : "حفظ الشعار المباشر"}</span>
          </button>
        </div>
      </div>

      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-5 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">إجمالي الحسابات</span>
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-2xl font-black mt-2">{totalUsers}</div>
        </div>

        <div className="bg-card border border-border p-5 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">اشتراكات نشطة</span>
            <UserCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-black mt-2 text-emerald-600 dark:text-emerald-400">{activeUsers}</div>
        </div>

        <div className="bg-card border border-border p-5 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">طلبات معلقة</span>
            <ShieldAlert className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-2xl font-black mt-2 text-amber-600 dark:text-amber-400">{pendingUsers}</div>
        </div>

        <div className="bg-card border border-border p-5 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">موقوفة (منتهية)</span>
            <PauseCircle className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-2xl font-black mt-2 text-red-600 dark:text-red-400">{disabledUsers}</div>
        </div>
      </div>

      {/* جدول الحسابات والاشتراكات */}
      <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border flex justify-between items-center">
          <h2 className="font-black text-sm md:text-base flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-500" />
            <span>قائمة مشتركين النظام وإدارة الباقات ({users.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground font-bold">جاري تحميل الحسابات والاشتراكات...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground font-bold">لا يوجد حسابات مسجلة في النظام حالياً.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs whitespace-nowrap">
              <thead className="bg-secondary/40 border-b border-border text-muted-foreground font-black">
                <tr>
                  <th className="p-3.5">اسم العميل / البريد</th>
                  <th className="p-3.5">الباقة الحالية</th>
                  <th className="p-3.5">الأيام المتبقية</th>
                  <th className="p-3.5">حالة الاشتراك</th>
                  <th className="p-3.5 text-center">تخصيص الباقة والمدّة المخصصة</th>
                  <th className="p-3.5 text-center">الإجراءات والتنبيه</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-bold">
                {users.map((account) => {
                  const isBusy = updatingId === account.id;
                  const isAccountAdmin = account.role === "admin" || account.email.toLowerCase() === "admin@aqsatak.com";

                  const subEnd = account.subscription?.endDate ? new Date(account.subscription.endDate) : null;
                  const daysLeft = subEnd ? Math.ceil((subEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

                  const planLabels: Record<string, string> = {
                    basic: "أساسي",
                    plus: "بلس",
                    super: "سوبر",
                  };

                  return (
                    <tr key={account.id} className="hover:bg-secondary/30 transition-colors">
                      {/* اسم العميل / البريد */}
                      <td className="p-3.5">
                        <div className="flex flex-col">
                          <span className="font-black text-foreground flex items-center gap-1.5">
                            {account.name || "مستخدم غير معنون"}
                            {isAccountAdmin && (
                              <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 text-[9px] font-black border border-purple-500/20">
                                أدمن
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono dir-ltr text-right">{account.email}</span>
                        </div>
                      </td>

                      {/* الباقة الحالية */}
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 font-black text-[10px] border border-orange-500/20">
                          {planLabels[account.subscription?.planType || "basic"] || "أساسي"}
                        </span>
                      </td>

                      {/* الأيام المتبقية مع استثناء الأدمن الرئيسي */}
                      <td className="p-3.5 font-mono">
                        {isAccountAdmin ? (
                          <span className="px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-black text-[10px] border border-purple-500/20">
                            غير محدود (أدمن)
                          </span>
                        ) : daysLeft > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{daysLeft} يوم متبقي</span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400 font-extrabold">منتهي</span>
                        )}
                      </td>

                      {/* الحالة */}
                      <td className="p-3.5">
                        {account.status === "active" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" /> نشط
                          </span>
                        )}
                        {account.status === "pending" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <ShieldAlert className="w-3.5 h-3.5" /> معلق
                          </span>
                        )}
                        {account.status === "disabled" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                            <PauseCircle className="w-3.5 h-3.5" /> موقوف
                          </span>
                        )}
                        {account.status === "rejected" && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black bg-gray-500/10 text-gray-500 border border-gray-500/20">
                            <XCircle className="w-3.5 h-3.5" /> مرفوض
                          </span>
                        )}
                      </td>

                      {/* 🎯 تخصيص الباقة وإضافة شهور أو تاريخ محدد */}
                      <td className="p-3.5 text-center">
                        <div className="flex flex-col items-center gap-2">
                          {/* خيارات المدد السريعة */}
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              disabled={isBusy}
                              onClick={() => handleUpdateSubscription(account.id, "basic", 30)}
                              className="px-2 py-1 bg-secondary border border-border hover:border-orange-500 rounded-xl text-[10px] font-bold transition-all"
                            >
                              شهر
                            </button>
                            <button
                              disabled={isBusy}
                              onClick={() => handleUpdateSubscription(account.id, "plus", 90)}
                              className="px-2 py-1 bg-secondary border border-border hover:border-orange-500 rounded-xl text-[10px] font-bold transition-all text-orange-600 dark:text-orange-400"
                            >
                              3 شهور
                            </button>
                            <button
                              disabled={isBusy}
                              onClick={() => handleUpdateSubscription(account.id, "super", 365)}
                              className="px-2 py-1 bg-secondary border border-border hover:border-purple-500 rounded-xl text-[10px] font-bold transition-all text-purple-600 dark:text-purple-400"
                            >
                              سنة كاملة
                            </button>
                          </div>

                          {/* 📅 إدخال الشهور المخصصة أو اختيار التاريخ بمرونة */}
                          <div className="flex items-center gap-1.5 pt-1">
                            {/* إدخال عدد الشهور */}
                            <input
                              type="number"
                              min="1"
                              placeholder="عدد الأشهر"
                              value={customMonths[account.id] || ""}
                              onChange={(e) => setCustomMonths({ ...customMonths, [account.id]: Number(e.target.value) })}
                              className="w-20 p-1 text-[10px] bg-background border border-border rounded-lg text-center outline-none focus:ring-1 focus:ring-orange-500 font-bold"
                            />
                            <button
                              disabled={isBusy || !customMonths[account.id]}
                              onClick={() => {
                                const months = customMonths[account.id] || 1;
                                handleUpdateSubscription(account.id, "plus", months * 30);
                              }}
                              className="px-2 py-1 bg-orange-500 text-white rounded-lg text-[10px] font-bold hover:bg-orange-600 disabled:opacity-50"
                            >
                              تأكيد الشهور
                            </button>

                            {/* اختيار تاريخ محدد */}
                            <input
                              type="date"
                              value={customEndDate[account.id] || ""}
                              onChange={(e) => setCustomEndDate({ ...customEndDate, [account.id]: e.target.value })}
                              className="p-1 text-[10px] bg-background border border-border rounded-lg outline-none font-bold"
                            />
                            <button
                              disabled={isBusy || !customEndDate[account.id]}
                              onClick={() => {
                                if (customEndDate[account.id]) {
                                  handleUpdateSubscription(account.id, "plus", customEndDate[account.id]);
                                }
                              }}
                              className="p-1.5 bg-emerald-600 text-white rounded-lg text-[10px] hover:bg-emerald-700 disabled:opacity-50"
                              title="تأكيد التثبيت حسب التاريخ المحدد"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* الإجراءات والتنبيه */}
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* تذكير واتساب */}
                          <button
                            onClick={() => {
                              const phone = account.phoneNumber?.replace(/[^0-9]/g, "");
                              const clientName = account.name || "عزيزنا العميل";
                              window.open(`https://wa.me/${phone}?text=${encodeURIComponent(`مرحباً ${clientName}، نود تذكيرك بأن المتبقي على اشتراكك في نظام أقساطك هو (${daysLeft}) أيام.`)}`);
                            }}
                            className="p-1.5 bg-emerald-600 text-white rounded-xl text-[10px] flex items-center gap-1 hover:bg-emerald-700 transition-colors"
                            title="إرسال تذكير بالاشتراك عبر الواتساب"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          {/* تفعيل / إيقاف */}
                          {account.status !== "active" ? (
                            <button
                              disabled={isBusy}
                              onClick={() => handleUpdateStatus(account.id, "active")}
                              className="p-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 rounded-xl transition-all"
                              title="قبول وتفعيل الحساب"
                            >
                              <PlayCircle className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              disabled={isBusy}
                              onClick={() => handleUpdateStatus(account.id, "disabled")}
                              className="p-1.5 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 rounded-xl transition-all"
                              title="إيقاف الاشتراك مؤقتاً"
                            >
                              <PauseCircle className="w-4 h-4" />
                            </button>
                          )}

                          {/* 🗑️ زر الحذف النهائي */}
                          <button
                            disabled={isBusy}
                            onClick={() => handleDeleteUser(account.id, account.email)}
                            className="p-1.5 text-rose-600 hover:bg-rose-500/10 rounded-xl transition-all"
                            title="حذف الحساب نهائياً من قاعدة البيانات"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}