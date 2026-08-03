"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../components/AuthProvider";
import { 
  Store, 
  Percent, 
  Moon, 
  Sun, 
  Save, 
  CheckCircle2,
  Download,
  Upload,
  MessageSquare,
  Key,
  Database,
  Loader2,
  Bot
} from "lucide-react";
import { 
  getUserInstallments, 
  getUserPayments, 
  addInstallmentRecord, 
  addPaymentRecord 
} from "../../services/firestore";

export default function SettingsPage() {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // حالات الإعدادات
  const [storeName, setStoreName] = useState("مكتب السلام");
  const [defaultProfitRate, setDefaultProfitRate] = useState<number>(35);
  
  // إعدادات الواتساب وقوالب الرسائل
  const [useAutoApi, setUseAutoApi] = useState(false);
  const [waInstanceId, setWaInstanceId] = useState("");
  const [waToken, setWaToken] = useState("");
  const [whatsappTemplate, setWhatsappTemplate] = useState(
    "مرحباً {name}، نود تذكيرك بحلول موعد قسط مبلغ {amount} د.ع الخاص بمنتج ({product}). يرجى التسديد في أقرب وقت."
  );
  const [isDarkMode, setIsDarkMode] = useState(false);

  // تحميل الإعدادات من LocalStorage
  useEffect(() => {
    const savedStoreName = localStorage.getItem("app_store_name");
    const savedProfitRate = localStorage.getItem("app_default_profit_rate");
    const savedAutoApi = localStorage.getItem("app_wa_use_api") === "true";
    const savedInstance = localStorage.getItem("app_wa_instance_id");
    const savedToken = localStorage.getItem("app_wa_token");
    const savedTemplate = localStorage.getItem("app_whatsapp_template");
    const savedTheme = localStorage.getItem("theme");

    if (savedStoreName) setStoreName(savedStoreName);
    if (savedProfitRate) setDefaultProfitRate(Number(savedProfitRate));
    setUseAutoApi(savedAutoApi);
    if (savedInstance) setWaInstanceId(savedInstance);
    if (savedToken) setWaToken(savedToken);
    if (savedTemplate) setWhatsappTemplate(savedTemplate);
    if (savedTheme === "dark" || document.documentElement.classList.contains("dark")) {
      setIsDarkMode(true);
    }
  }, []);

  // دالة تبديل المظهر
  const toggleTheme = () => {
    const nextState = !isDarkMode;
    setIsDarkMode(nextState);
    if (nextState) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  // حفظ الإعدادات العامة
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("app_store_name", storeName);
    localStorage.setItem("app_default_profit_rate", defaultProfitRate.toString());
    localStorage.setItem("app_wa_use_api", useAutoApi ? "true" : "false");
    localStorage.setItem("app_wa_instance_id", waInstanceId);
    localStorage.setItem("app_wa_token", waToken);
    localStorage.setItem("app_whatsapp_template", whatsappTemplate);

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // تصدير واستعادة النسخ الاحتياطية
  const handleExportBackup = async () => {
    if (!user?.uid) return;
    try {
      setLoadingAction(true);
      const [installments, payments] = await Promise.all([
        getUserInstallments(user.uid),
        getUserPayments(user.uid),
      ]);

      const backupData = {
        exportDate: new Date().toISOString(),
        userId: user.uid,
        installments,
        payments,
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `aqsatk_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setActionMessage("تم تحميل النسخة الاحتياطية بنجاح!");
    } catch (error) {
      console.error(error);
      setActionMessage("حدث خطأ أثناء تصدير البيانات.");
    } finally {
      setLoadingAction(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (event.target.files && event.target.files[0]) {
      fileReader.readAsText(event.target.files[0], "UTF-8");
      fileReader.onload = async (e) => {
        try {
          setLoadingAction(true);
          const content = JSON.parse(e.target?.result as string);

          if (!content.installments || !Array.isArray(content.installments)) {
            alert("ملف النسخة الاحتياطية غير صالح!");
            return;
          }

          if (!user?.uid) return;

          for (const inst of content.installments) {
            const { id, createdAt, ...cleanInst } = inst;
            await addInstallmentRecord({
              ...cleanInst,
              userId: user.uid,
            });
          }

          if (content.payments && Array.isArray(content.payments)) {
            for (const pay of content.payments) {
              const { id, createdAt, ...cleanPay } = pay;
              await addPaymentRecord({
                ...cleanPay,
                userId: user.uid,
              });
            }
          }

          setActionMessage("تمت استعادة البيانات بنجاح إلى حسابك!");
        } catch (err) {
          console.error(err);
          alert("خطأ في قراءة ملف النسخة الاحتياطية.");
        } finally {
          setLoadingAction(false);
          setTimeout(() => setActionMessage(null), 4000);
        }
      };
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6 animate-in fade-in duration-500 pb-12">
      {/* الهيدر */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">إعدادات النظام</h1>
        <p className="text-gray-500 text-xs md:text-sm mt-1">
          تخصيص تفاصيل المكتب، النسخ الاحتياطي، وربط خدمة إشعارات الواتساب.
        </p>
      </div>

      {/* تنبيهات النجاح */}
      {saved && (
        <div className="p-3 md:p-4 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 rounded-xl flex items-center gap-2 md:gap-3 text-xs md:text-sm font-bold animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
          <span>تم حفظ الإعدادات بنجاح!</span>
        </div>
      )}

      {actionMessage && (
        <div className="p-3 md:p-4 bg-primary/10 border border-primary/20 text-primary rounded-xl flex items-center gap-2 md:gap-3 text-xs md:text-sm font-bold animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
          <span>{actionMessage}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-4 md:space-y-6">
        {/* 1. تفاصيل المكتب */}
        <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-primary border-b border-border pb-3">
            <Store className="w-4 h-4 md:w-5 md:h-5" />
            <h2 className="font-bold text-base md:text-lg">تفاصيل المكتب / النشاط التجاري</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">اسم المكتب / المتجر</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full p-2.5 md:p-3 bg-background border border-border rounded-xl text-sm md:text-base outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">حساب المستورد / المالك</label>
              <input
                type="text"
                disabled
                value={user?.email || "المستخدم الحالي"}
                className="w-full p-2.5 md:p-3 bg-background/50 border border-border rounded-xl text-sm md:text-base text-gray-400 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* 2. إعدادات الواتساب و API التلقائي */}
        <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-3 gap-3">
            <div className="flex items-center gap-2 text-primary">
              <MessageSquare className="w-4 h-4 md:w-5 md:h-5 text-green-500" />
              <h2 className="font-bold text-base md:text-lg">إشعارات الواتساب و ربط الـ API</h2>
            </div>

            {/* مفتاح تفعيل الـ API التلقائي */}
            <div className="flex items-center justify-between sm:justify-start gap-3 bg-background p-2 md:p-1.5 rounded-xl border border-border">
              <div className="flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-green-500" />
                <span className="text-xs font-bold text-foreground">إرسال تلقائي عبر API</span>
              </div>
              <input
                type="checkbox"
                checked={useAutoApi}
                onChange={(e) => setUseAutoApi(e.target.checked)}
                className="w-4 h-4 md:w-4 md:h-4 rounded accent-green-500 cursor-pointer"
              />
            </div>
          </div>

          {/* حقول الـ API في حالة التفعيل */}
          {useAutoApi && (
            <div className="p-3 md:p-4 bg-green-500/5 border border-green-500/20 rounded-xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <p className="text-[10px] md:text-xs text-green-600 dark:text-green-400 font-bold">
                ✓ سيتم إرسال الرسائل في الخلفية مباشرة لخدمة الواتساب الخاصة بك دون الحاجة لفتح التطبيق.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] md:text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-primary" /> Instance ID / Account ID
                  </label>
                  <input
                    type="text"
                    value={waInstanceId}
                    onChange={(e) => setWaInstanceId(e.target.value)}
                    placeholder="مثال: instance12345"
                    className="w-full p-2.5 md:p-3 bg-background border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] md:text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                    <Key className="w-3.5 h-3.5 text-primary" /> API Token / Access Key
                  </label>
                  <input
                    type="password"
                    value={waToken}
                    onChange={(e) => setWaToken(e.target.value)}
                    placeholder="أدخل الـ Token"
                    className="w-full p-2.5 md:p-3 bg-background border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500/50"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">قالب رسالة التذكير بالأقساط</label>
            <textarea
              rows={3}
              value={whatsappTemplate}
              onChange={(e) => setWhatsappTemplate(e.target.value)}
              className="w-full p-3 md:p-4 bg-background border border-border rounded-xl text-sm outline-none resize-none focus:ring-2 focus:ring-primary/50"
            />
            <p className="text-[10px] md:text-[11px] text-gray-400 mt-1.5">
              المتغيرات المتاحة: &#123;name&#125; اسم العميل، &#123;amount&#125; القسط، &#123;product&#125; المنتج.
            </p>
          </div>
        </div>

        {/* 3. الإعدادات المالية */}
        <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-primary border-b border-border pb-3">
            <Percent className="w-4 h-4 md:w-5 md:h-5" />
            <h2 className="font-bold text-base md:text-lg">الإعدادات المالية الافتراضية</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">نسبة الربح الافتراضية (%)</label>
              <input
                type="number"
                value={defaultProfitRate}
                onChange={(e) => setDefaultProfitRate(Number(e.target.value))}
                className="w-full p-2.5 md:p-3 bg-background border border-border rounded-xl text-sm md:text-base outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>

        {/* 4. مظهر التطبيق */}
        <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-primary border-b border-border pb-3">
            <Sun className="w-4 h-4 md:w-5 md:h-5" />
            <h2 className="font-bold text-base md:text-lg">مظهر البرنامج (التصميم)</h2>
          </div>

          <div className="flex items-center justify-between p-3 md:p-4 bg-background rounded-xl border border-border">
            <div className="flex items-center gap-3">
              {isDarkMode ? <Moon className="w-5 h-5 md:w-6 md:h-6 text-purple-400" /> : <Sun className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />}
              <div>
                <p className="font-bold text-xs md:text-sm text-foreground">الوضع الليلي (Dark Mode)</p>
                <p className="text-[10px] md:text-xs text-gray-500">تبديل ألوان النظام</p>
              </div>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                isDarkMode 
                  ? "bg-purple-600 hover:bg-purple-700 text-white" 
                  : "bg-gray-200 hover:bg-gray-300 text-gray-800"
              }`}
            >
              {isDarkMode ? "مُفعل" : "معطل"}
            </button>
          </div>
        </div>

        {/* 5. النسخ الاحتياطي */}
        <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-primary border-b border-border pb-3">
            <Database className="w-4 h-4 md:w-5 md:h-5" />
            <h2 className="font-bold text-base md:text-lg">إدارة النسخ الاحتياطية</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={loadingAction}
              className="p-4 bg-background border border-border rounded-xl hover:bg-primary/5 hover:border-primary/30 transition-all text-right flex flex-col justify-between space-y-2 md:space-y-3 group"
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">تصدير نسخة احتياطية (JSON)</span>
                <Download className="w-5 h-5 text-primary opacity-80 group-hover:opacity-100 group-hover:-translate-y-1 transition-all" />
              </div>
              <p className="text-[10px] md:text-xs text-gray-500">حفظ كافة بيانات الأقساط والدفعات في ملف لضمان عدم ضياعها.</p>
            </button>

            <label className="p-4 bg-background border border-border rounded-xl hover:bg-primary/5 hover:border-primary/30 transition-all text-right flex flex-col justify-between space-y-2 md:space-y-3 cursor-pointer group">
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">استعادة نسخة احتياطية</span>
                <Upload className="w-5 h-5 text-primary opacity-80 group-hover:opacity-100 group-hover:-translate-y-1 transition-all" />
              </div>
              <p className="text-[10px] md:text-xs text-gray-500">استرجاع البيانات من ملف JSON سابق بكل سهولة.</p>
              <input type="file" accept=".json" onChange={handleImportBackup} disabled={loadingAction} className="hidden" />
            </label>
          </div>
        </div>

        {/* زر الحفظ */}
        <button
          type="submit"
          disabled={loadingAction}
          className="w-full py-3.5 md:py-4 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-md text-sm md:text-base active:scale-[0.98]"
        >
          {loadingAction ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          <span>حفظ وتحديث الإعدادات</span>
        </button>
      </form>
    </div>
  );
}