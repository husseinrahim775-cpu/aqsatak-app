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
  Bot,
  FileText,
  Phone,
  MapPin,
  UserPlus,
  Shield,
  Trash2,
  Mail,
  Lock,
  UserCheck
} from "lucide-react";
import { 
  getUserInstallments, 
  getUserPayments, 
  addInstallmentRecord, 
  addPaymentRecord,
  addSystemUser,
  getSystemUsers,
  deleteSystemUser,
  SystemUser
} from "../../services/firestore";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../services/firebase";

export default function SettingsPage() {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // حالات الإعدادات العامة
  const [storeName, setStoreName] = useState("مكتب السلام");
  const [storePhone, setStorePhone] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [contractTerms, setContractTerms] = useState(
    "1. يتعهد الطرف الثاني بتسديد أقساطه المستحقة في مواعيدها المحدد أعلاه دون تأخير.\n2. في حال التأخير عن التسديد، يحق للطرف الأول اتخاذ الإجراءات القانونية المترتبة على ذلك.\n3. يعتبر هذا العقد وثيقة رسمية ملزمة للطرفين وللكفيل الضامن."
  );

  const [defaultProfitRate, setDefaultProfitRate] = useState<number>(35);
  
  // إعدادات الواتساب وقوالب الرسائل
  const [useAutoApi, setUseAutoApi] = useState(false);
  const [waInstanceId, setWaInstanceId] = useState("");
  const [waToken, setWaToken] = useState("");
  const [whatsappTemplate, setWhatsappTemplate] = useState(
    "مرحباً {name}، نود تذكيرك بحلول موعد قسط مبلغ {amount} د.ع الخاص بمنتج ({product}). يرجى التسديد في أقرب وقت."
  );
  const [isDarkMode, setIsDarkMode] = useState(false);

  // حالات تغيير كلمة المرور والأدمن PIN
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [adminPin, setAdminPin] = useState("1234");
  const [savingPin, setSavingPin] = useState(false);

  // حالات إدارة الموظفين والصلاحيات
  const [usersList, setUsersList] = useState<SystemUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [submittingUser, setSubmittingUser] = useState(false);

  // نموذج إضافة الموظف
  const [empForm, setEmpForm] = useState({
    name: "",
    username: "",
    password: "",
    canViewDashboard: false,
    canManageCustomers: true,
    canViewTreasury: false,
    canManageStore: true,
    canDeleteOrEdit: false,
  });

  // جلب قائمة الموظفين ورمز PIN الخاص بحساب الأدمن
  const fetchUsersAndSettings = async () => {
    if (user?.uid) {
      setLoadingUsers(true);
      const list = await getSystemUsers(user.uid);
      setUsersList(list);
      setLoadingUsers(false);

      // جلب رمز PIN المالك من Firestore
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setAdminPin(userDocSnap.data().adminPin || "1234");
        }
      } catch (err) {
        console.error("خطأ في جلب رمز المالك:", err);
      }
    }
  };

  // تحميل الإعدادات من LocalStorage والموظفين
  useEffect(() => {
    const savedStoreName = localStorage.getItem("app_store_name");
    const savedStorePhone = localStorage.getItem("app_store_phone");
    const savedStoreAddress = localStorage.getItem("app_store_address");
    const savedContractTerms = localStorage.getItem("app_contract_terms");

    const savedProfitRate = localStorage.getItem("app_default_profit_rate");
    const savedAutoApi = localStorage.getItem("app_wa_use_api") === "true";
    const savedInstance = localStorage.getItem("app_wa_instance_id");
    const savedToken = localStorage.getItem("app_wa_token");
    const savedTemplate = localStorage.getItem("app_whatsapp_template");
    const savedTheme = localStorage.getItem("theme");

    if (savedStoreName) setStoreName(savedStoreName);
    if (savedStorePhone) setStorePhone(savedStorePhone);
    if (savedStoreAddress) setStoreAddress(savedStoreAddress);
    if (savedContractTerms) setContractTerms(savedContractTerms);

    if (savedProfitRate) setDefaultProfitRate(Number(savedProfitRate));
    setUseAutoApi(savedAutoApi);
    if (savedInstance) setWaInstanceId(savedInstance);
    if (savedToken) setWaToken(savedToken);
    if (savedTemplate) setWhatsappTemplate(savedTemplate);
    if (savedTheme === "dark" || document.documentElement.classList.contains("dark")) {
      setIsDarkMode(true);
    }

    fetchUsersAndSettings();
  }, [user]);

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

  // 🔒 إرسال رابط إعادة تعيين رمز الدخول إلى الجيميل
  const handleSendPasswordReset = async () => {
    if (!user?.email) {
      alert("تعذر العثور على البريد الإلكتروني للحساب الحالي.");
      return;
    }

    const confirmSend = window.confirm(
      `هل ترغب بإرسال رابط إعادة تعيين كلمة المرور إلى البريد الإلكتروني التالي:\n(${user.email})؟`
    );

    if (confirmSend) {
      try {
        setIsSendingReset(true);
        const auth = getAuth();
        await sendPasswordResetEmail(auth, user.email);
        alert(`تم إرسال رابط إعادة تعيين كلمة المرور إلى البريد الإلكتروني (${user.email}). يرجى فحص صندوق الوارد بريدك الإلكتروني.`);
      } catch (error: any) {
        console.error("خطأ في إرسال رابط التعيين:", error);
        alert("حدث خطأ أثناء إرسال البريد الإلكتروني. يرجى التأكد من الاتصال بالإنترنت.");
      } finally {
        setIsSendingReset(false);
      }
    }
  };

  // 🔑 حفظ رمز PIN الخفي الخاص بمدير الشركة في Firestore
  const handleUpdateAdminPin = async () => {
    if (!user?.uid) return;
    if (!adminPin.trim()) {
      alert("يرجى كتابة رمز PIN جديد أولاً.");
      return;
    }

    try {
      setSavingPin(true);
      await setDoc(doc(db, "users", user.uid), { adminPin: adminPin.trim() }, { merge: true });
      alert("تم حفظ وتحديث رمز PIN الخاص بحساب المالك بنجاح!");
    } catch (error) {
      console.error("خطأ في حفظ رمز PIN المالك:", error);
      alert("حدث خطأ أثناء حفظ الرمز.");
    } finally {
      setSavingPin(false);
    }
  };

  // 🎯 إضافة الموظف باسم مستخدم عادي
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !empForm.name || !empForm.username || !empForm.password) return;

    try {
      setSubmittingUser(true);
      const cleanUsername = empForm.username.trim().toLowerCase();

      // حفظ بيانات الموظف مباشرة في Firestore
      await addSystemUser({
        ownerUid: user.uid,
        name: empForm.name,
        email: `${cleanUsername}@local.app`, // بريد إلكتروني افتراضي للمنظومة
        username: cleanUsername,
        password: empForm.password,
        role: "employee" as const,
        isApproved: true,
        permissions: {
          canViewDashboard: empForm.canViewDashboard,
          canManageCustomers: empForm.canManageCustomers,
          canViewTreasury: empForm.canViewTreasury,
          canManageStore: empForm.canManageStore,
          canDeleteOrEdit: empForm.canDeleteOrEdit,
        },
        createdAt: new Date().toISOString(),
      });

      alert("تم إنشاء حساب الموظف بنجاح! يمكنه الآن استخدام اسم المستخدم والرمز للتسجيل.");
      setEmpForm({
        name: "",
        username: "",
        password: "",
        canViewDashboard: false,
        canManageCustomers: true,
        canViewTreasury: false,
        canManageStore: true,
        canDeleteOrEdit: false,
      });
      await fetchUsersAndSettings();
    } catch (error: any) {
      console.error(error);
      alert("حدث خطأ أثناء إضافة الموظف: " + (error.message || ""));
    } finally {
      setSubmittingUser(false);
    }
  };

  // حذف الموظف
  const handleDeleteEmp = async (id: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف الموظف (${name}) وإلغاء صلاحية دخوله؟`)) {
      await deleteSystemUser(id);
      await fetchUsersAndSettings();
    }
  };

  // حفظ الإعدادات العامة
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem("app_store_name", storeName);
    localStorage.setItem("app_store_phone", storePhone);
    localStorage.setItem("app_store_address", storeAddress);
    localStorage.setItem("app_contract_terms", contractTerms);

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
        <h1 className="text-xl md:text-2xl font-bold text-foreground">إعدادات النظام وإدارة الموظفين</h1>
        <p className="text-gray-500 text-xs md:text-sm mt-1">
          تخصيص تفاصيل المكتب، تغيير كلمة المرور عبر الجيميل، إضافة الموظفين وصلاحياتهم، والنسخ الاحتياطي.
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

      {/* 🔒 1. قسم حماية حساب الأدمن وتغيير الرمز عبر الجيميل وتعيين الـ PIN */}
      <div className="bg-card border border-primary/30 rounded-2xl p-4 md:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-primary border-b border-border pb-3">
          <Key className="w-4 h-4 md:w-5 md:h-5" />
          <h2 className="font-bold text-base md:text-lg">أمان وحماية حساب الشركة والرمز السرّي</h2>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-primary/5 border border-primary/20 p-4 rounded-xl">
          <div className="space-y-1">
            <p className="font-bold text-sm text-foreground flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <span>البريد الإلكتروني الحالي للمدير:</span>
            </p>
            <p className="text-xs font-mono font-bold text-primary dir-ltr">{user?.email || "غير مسجل"}</p>
            <p className="text-[11px] text-gray-500 mt-1">
              في حال نسيت كلمة المرور أو رغبت بتغييرها، اضغط الزر لإرسال رابط إعادة التعيين الرسمي لحساب الجيميل الخاص بك.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSendPasswordReset}
            disabled={isSendingReset}
            className="px-4 py-2.5 bg-primary text-primary-foreground text-xs md:text-sm font-bold rounded-xl hover:bg-primary/90 transition-all shadow-sm flex items-center gap-2 shrink-0 active:scale-95 disabled:opacity-50"
          >
            {isSendingReset ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            <span>إرسال رابط تغيير الرمز إلى الجيميل</span>
          </button>
        </div>

        {/* 🔑 حقل تعيين رمز PIN السريع الخاص بالمالك */}
        <div className="pt-3 border-t border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-secondary/20 p-4 rounded-xl">
          <div>
            <p className="text-xs md:text-sm font-bold text-foreground">رمز PIN السريع لحساب الأدمن / المالك:</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              الرمز الذي تستخدمه لدخول حساب المالك من شاشة اختيار الموظف بدلاً من كتابة كلمة سر الشركة أمام الآخرين.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="password"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              placeholder="1234"
              className="p-2.5 border border-border bg-background rounded-xl text-center font-mono w-32 text-sm outline-none focus:ring-2 focus:ring-primary font-bold"
              dir="ltr"
            />
            <button
              type="button"
              onClick={handleUpdateAdminPin}
              disabled={savingPin}
              className="px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs rounded-xl transition-all shadow-sm disabled:opacity-50"
            >
              {savingPin ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ الرمز"}
            </button>
          </div>
        </div>
      </div>

      {/* 👥 2. قسم إضافة وتحديد صلاحيات الموظفين */}
      <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-primary border-b border-border pb-3">
          <UserPlus className="w-4 h-4 md:w-5 md:h-5" />
          <h2 className="font-bold text-base md:text-lg">إضافة موظف جديد وتخصيص الصلاحيات</h2>
        </div>

        <form onSubmit={handleAddEmployee} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">اسم الموظف</label>
              <input
                type="text"
                required
                placeholder="مثال: أحمد علي"
                value={empForm.name}
                onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                className="w-full p-2.5 md:p-3 bg-background border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">اسم المستخدم (Username)</label>
              <input
                type="text"
                required
                placeholder="مثال: ahmed123"
                value={empForm.username}
                onChange={(e) => setEmpForm({ ...empForm, username: e.target.value })}
                className="w-full p-2.5 md:p-3 bg-background border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 text-left font-mono"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">رمز المرور الخاص به</label>
              <input
                type="text"
                required
                placeholder="11223344"
                value={empForm.password}
                onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })}
                className="w-full p-2.5 md:p-3 bg-background border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/50 text-left font-mono"
                dir="ltr"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <label className="block text-xs font-bold text-gray-500 mb-2">تحديد أقسام الشاشة المسموح للموظف بدخولها:</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 text-xs font-bold">
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/30 border border-border cursor-pointer hover:bg-secondary/60 transition-colors">
                <input
                  type="checkbox"
                  checked={empForm.canManageCustomers}
                  onChange={(e) => setEmpForm({ ...empForm, canManageCustomers: e.target.checked })}
                  className="rounded text-primary focus:ring-primary w-4 h-4 accent-primary"
                />
                <span>تسجيل عملاء وتلقي دفعات</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/30 border border-border cursor-pointer hover:bg-secondary/60 transition-colors">
                <input
                  type="checkbox"
                  checked={empForm.canManageStore}
                  onChange={(e) => setEmpForm({ ...empForm, canManageStore: e.target.checked })}
                  className="rounded text-primary focus:ring-primary w-4 h-4 accent-primary"
                />
                <span>إدارة المخزن والمبيعات</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/30 border border-border cursor-pointer hover:bg-secondary/60 transition-colors">
                <input
                  type="checkbox"
                  checked={empForm.canViewDashboard}
                  onChange={(e) => setEmpForm({ ...empForm, canViewDashboard: e.target.checked })}
                  className="rounded text-primary focus:ring-primary w-4 h-4 accent-primary"
                />
                <span>عرض الداشبورد والمركز المالي</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/30 border border-border cursor-pointer hover:bg-secondary/60 transition-colors">
                <input
                  type="checkbox"
                  checked={empForm.canViewTreasury}
                  onChange={(e) => setEmpForm({ ...empForm, canViewTreasury: e.target.checked })}
                  className="rounded text-primary focus:ring-primary w-4 h-4 accent-primary"
                />
                <span>عرض الخزينة ورصيد السيولة</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/30 border border-border cursor-pointer hover:bg-secondary/60 transition-colors">
                <input
                  type="checkbox"
                  checked={empForm.canDeleteOrEdit}
                  onChange={(e) => setEmpForm({ ...empForm, canDeleteOrEdit: e.target.checked })}
                  className="rounded text-primary focus:ring-primary w-4 h-4 accent-primary"
                />
                <span>تعديل وحذف العقود والدفعات</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={submittingUser || !empForm.name || !empForm.username}
            className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-xs md:text-sm hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm"
          >
            {submittingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            <span>حفظ الموظف بنجاح</span>
          </button>
        </form>

        {/* قائمة الموظفين النشطين */}
        <div className="pt-4 border-t border-border space-y-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span>قائمة الموظفين النشطين حالياً بالمنظومة:</span>
          </h3>

          {loadingUsers ? (
            <div className="text-center py-4">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
            </div>
          ) : usersList.length === 0 ? (
            <p className="text-xs text-gray-400 italic py-2">لا يوجد موظفين مسجلين في الوقت الحالي.</p>
          ) : (
            <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
              {usersList.map((emp) => (
                <div key={emp.id} className="p-3 flex items-center justify-between hover:bg-secondary/20 transition-colors bg-card">
                  <div>
                    <p className="font-bold text-xs md:text-sm text-foreground flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-primary" />
                      <span>{emp.name}</span>
                    </p>
                    <p className="text-[11px] text-gray-500 font-mono mt-0.5" dir="ltr">
                      اسم المستخدم: <strong className="text-primary">{emp.username || emp.email.split('@')[0]}</strong> • كلمة السر: {emp.password}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => emp.id && handleDeleteEmp(emp.id, emp.name)}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                    title="حذف الموظف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-4 md:space-y-6">
        {/* 🏢 3. تفاصيل المكتب والطباعة */}
        <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-primary border-b border-border pb-3">
            <Store className="w-4 h-4 md:w-5 md:h-5" />
            <h2 className="font-bold text-base md:text-lg">تفاصيل المكتب وبيانات العقود والمطبوعات</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">اسم المكتب / الشركة البائعة</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="مثال: مكتب السلام للتجارة والتقسيط"
                className="w-full p-2.5 md:p-3 bg-background border border-border rounded-xl text-sm md:text-base outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-primary" /> رقم هاتف المكتب / الشركة
              </label>
              <input
                type="text"
                value={storePhone}
                onChange={(e) => setStorePhone(e.target.value)}
                placeholder="07700000000"
                className="w-full p-2.5 md:p-3 bg-background border border-border rounded-xl text-sm md:text-base outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-primary" /> عنوان المكتب / الفرع الرئيسي
              </label>
              <input
                type="text"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                placeholder="مثال: بغداد - المنصور"
                className="w-full p-2.5 md:p-3 bg-background border border-border rounded-xl text-sm md:text-base outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">حساب المالك الحالي</label>
              <input
                type="text"
                disabled
                value={user?.email || "المستخدم الحالي"}
                className="w-full p-2.5 md:p-3 bg-background/50 border border-border rounded-xl text-sm md:text-base text-gray-400 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-primary" /> شروط وتعهدات العقد المطبوع
            </label>
            <textarea
              rows={4}
              value={contractTerms}
              onChange={(e) => setContractTerms(e.target.value)}
              placeholder="أدخل الشروط والأحكام التي تظهر بأسفل العقد..."
              className="w-full p-3 md:p-4 bg-background border border-border rounded-xl text-xs md:text-sm outline-none resize-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* 💬 4. إعدادات الواتساب و API التلقائي */}
        <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-3 gap-3">
            <div className="flex items-center gap-2 text-primary">
              <MessageSquare className="w-4 h-4 md:w-5 md:h-5 text-green-500" />
              <h2 className="font-bold text-base md:text-lg">إشعارات الواتساب و ربط الـ API</h2>
            </div>

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

        {/* 📊 5. الإعدادات المالية */}
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

        {/* 🎨 6. مظهر التطبيق */}
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

        {/* 💾 7. النسخ الاحتياطي */}
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

        {/* زر الحفظ النهائي */}
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