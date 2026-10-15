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
  UserCheck,
  CloudUpload,
  CloudDownload,
  Check,
  Image as ImageIcon
} from "lucide-react";
import { 
  getUserInstallments, 
  getUserPayments, 
  addInstallmentRecord, 
  addPaymentRecord,
  addSystemUser,
  getSystemUsers,
  deleteSystemUser,
  getCompanySettings,
  saveCompanySettings,
  SystemUser
} from "../../services/firestore";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../services/firebase";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [uploadingToDrive, setUploadingToDrive] = useState(false);
  const [downloadingFromDrive, setDownloadingFromDrive] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(false);

  // حالات الإعدادات العامة
  const [storeName, setStoreName] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storeLogo, setStoreLogo] = useState(""); // 🖼️ حالة لوجو/شعار المكتب
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

  // ⚡ تحميل البيانات
  const fetchUsersAndSettings = async () => {
    const ownerUid = getOwnerUid();
    if (!ownerUid) {
      setLoadingUsers(false);
      return;
    }

    setLoadingUsers(true);
    try {
      const list = await getSystemUsers(ownerUid);
      setUsersList(list || []);

      const companyData = await getCompanySettings(ownerUid);
      if (companyData) {
        if (companyData.companyName) setStoreName(companyData.companyName);
        if (companyData.phone) setStorePhone(companyData.phone);
        if (companyData.address) setStoreAddress(companyData.address);
        if ((companyData as any).logoUrl || (companyData as any).logo) {
          setStoreLogo((companyData as any).logoUrl || (companyData as any).logo);
        }
        if (companyData.notes) setContractTerms(companyData.notes);
      }

      const userDocRef = doc(db, "users", ownerUid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        setAdminPin(userDocSnap.data().adminPin || "1234");
      }
    } catch (err) {
      console.error("خطأ في جلب البيانات:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // 🖼️ معالجة رفع صورة اللوجو وتحويلها إلى Base64
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("حجم الصورة كبير جداً! يرجى اختيار صورة أقل من 2 ميغابايت.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setStoreLogo(reader.result as string);
      toast.success("تم رفع الشعار بنجاح! اضغط (حفظ وتحديث الإعدادات) لتطبيقه.");
    };
    reader.readAsDataURL(file);
  };

  // 📥 دالة معالجة واستعادة ملف بيانات JSON إلى Firestore بدون تكرار
  const processBackupJSON = async (content: any) => {
    if (!content.installments || !Array.isArray(content.installments)) {
      throw new Error("ملف النسخة الاحتياطية غير صالح!");
    }

    const ownerUid = getOwnerUid();
    if (!ownerUid) return;

    // 1. استعادة الأقساط
    for (const inst of content.installments) {
      if (inst.id) {
        const instRef = doc(db, "installments", inst.id);
        await setDoc(instRef, { ...inst, userId: ownerUid, updatedAt: new Date().toISOString() }, { merge: true });
      } else {
        const { id, createdAt, ...cleanInst } = inst;
        await addInstallmentRecord({ ...cleanInst, userId: ownerUid });
      }
    }

    // 2. استعادة الدفعات
    if (content.payments && Array.isArray(content.payments)) {
      for (const pay of content.payments) {
        if (pay.id) {
          const payRef = doc(db, "payments", pay.id);
          await setDoc(payRef, { ...pay, userId: ownerUid, updatedAt: new Date().toISOString() }, { merge: true });
        } else {
          const { id, createdAt, ...cleanPay } = pay;
          await addPaymentRecord({ ...cleanPay, userId: ownerUid });
        }
      }
    }

    await fetchUsersAndSettings();
  };

  // ☁️ 🔄 جلب واستعادة أحدث نسخة من Google Drive تلقائياً
  const handleDownloadFromGoogleDrive = async (tokenParam?: string, isSilent = false) => {
    const token = tokenParam || localStorage.getItem("google_drive_access_token");
    if (!token) return;

    try {
      if (!isSilent) setDownloadingFromDrive(true);

      const searchRes = await fetch(
        "https://www.googleapis.com/drive/v3/files?q=name+contains+'aqsatk_backup_'&orderBy=createdTime+desc&pageSize=1",
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!searchRes.ok) throw new Error("فشل البحث عن النسخ الاحتياطية.");

      const searchData = await searchRes.json();
      if (!searchData.files || searchData.files.length === 0) {
        if (!isSilent) toast.info("لم يتم العثور على نسخ احتياطية سابقة على Google Drive.");
        return;
      }

      const fileId = searchData.files[0].id;

      const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!fileRes.ok) throw new Error("فشل قراءة الملف من Google Drive.");

      const backupContent = await fileRes.json();
      await processBackupJSON(backupContent);

      toast.success("تم استرجاع واستعادة أحدث نسخة احتياطية من Google Drive بنجاح!");
    } catch (error) {
      console.error("خطأ في استعادة النسخة من Google Drive:", error);
      if (!isSilent) toast.error("تعذر استرجاع النسخة الاحتياطية من Google Drive.");
    } finally {
      if (!isSilent) setDownloadingFromDrive(false);
    }
  };

  // ☁️ ⬆️ رفع النسخة الاحتياطية إلى Google Drive
  const handleUploadToGoogleDrive = async (isSilent = false) => {
    const ownerUid = getOwnerUid();
    const googleAccessToken = localStorage.getItem("google_drive_access_token");
    if (!ownerUid || !googleAccessToken) return;

    try {
      if (!isSilent) setUploadingToDrive(true);

      const [installments, payments] = await Promise.all([
        getUserInstallments(ownerUid),
        getUserPayments(ownerUid),
      ]);

      const backupData = {
        exportDate: new Date().toISOString(),
        userId: ownerUid,
        installments,
        payments,
      };

      const fileName = `aqsatk_backup_${new Date().toISOString().slice(0, 10)}.json`;
      const fileContent = JSON.stringify(backupData, null, 2);

      const metadata = { name: fileName, mimeType: "application/json" };
      const formData = new FormData();
      formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
      formData.append("file", new Blob([fileContent], { type: "application/json" }));

      const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: { Authorization: `Bearer ${googleAccessToken}` },
        body: formData,
      });

      if (response.ok) {
        localStorage.setItem("last_auto_drive_backup", new Date().toISOString());
        if (!isSilent) toast.success("تم رفع النسخة الاحتياطية بنجاح إلى حساب Google Drive!");
      } else if (response.status === 401) {
        localStorage.removeItem("google_drive_access_token");
        setIsDriveConnected(false);
        if (!isSilent) toast.error("انتهت صلاحية الجلسة، يرجى إعادة الضغط على (ربط الحساب).");
      }
    } catch (error) {
      console.error("خطأ في الرفع:", error);
      if (!isSilent) toast.error("تعذر الرفع إلى Google Drive.");
    } finally {
      if (!isSilent) setUploadingToDrive(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.hash && window.location.hash.includes("access_token=")) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const token = hashParams.get("access_token");

        if (token) {
          localStorage.setItem("google_drive_access_token", token);
          if (window.opener) {
            window.opener.postMessage({ type: "GOOGLE_AUTH_SUCCESS", token }, "*");
            window.close();
            return;
          }
        }
      }

      const handleAuthMessage = async (event: MessageEvent) => {
        if (event.data?.type === "GOOGLE_AUTH_SUCCESS") {
          const token = event.data.token;
          localStorage.setItem("google_drive_access_token", token);
          setIsDriveConnected(true);
          toast.success("تم تسجيل الدخول وربط Google Drive بنجاح!");
          await handleDownloadFromGoogleDrive(token, false);
        }
      };

      window.addEventListener("message", handleAuthMessage);

      const savedToken = localStorage.getItem("google_drive_access_token");
      if (savedToken) {
        setIsDriveConnected(true);

        const lastBackup = localStorage.getItem("last_auto_drive_backup");
        const now = new Date().getTime();
        if (!lastBackup || now - new Date(lastBackup).getTime() > 24 * 60 * 60 * 1000) {
          handleUploadToGoogleDrive(true);
        }
      }

      const savedProfitRate = localStorage.getItem("app_default_profit_rate");
      const savedAutoApi = localStorage.getItem("app_wa_use_api") === "true";
      const savedInstance = localStorage.getItem("app_wa_instance_id");
      const savedTokenSetting = localStorage.getItem("app_wa_token");
      const savedTemplate = localStorage.getItem("app_whatsapp_template");
      const savedTheme = localStorage.getItem("theme");

      if (savedProfitRate) setDefaultProfitRate(Number(savedProfitRate));
      setUseAutoApi(savedAutoApi);
      if (savedInstance) setWaInstanceId(savedInstance);
      if (savedTokenSetting) setWaToken(savedTokenSetting);
      if (savedTemplate) setWhatsappTemplate(savedTemplate);
      if (savedTheme === "dark" || document.documentElement.classList.contains("dark")) {
        setIsDarkMode(true);
      }

      fetchUsersAndSettings();

      return () => {
        window.removeEventListener("message", handleAuthMessage);
      };
    }
  }, [user]);

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

  const handleSendPasswordReset = async () => {
    if (!user?.email) {
      toast.error("تعذر العثور على البريد الإلكتروني للحساب الحالي.");
      return;
    }

    try {
      setIsSendingReset(true);
      const authInstance = getAuth();
      await sendPasswordResetEmail(authInstance, user.email);
      toast.success(`تم إرسال رابط إعادة تعيين كلمة المرور إلى البريد الإلكتروني (${user.email}).`);
    } catch (error: any) {
      console.error("خطأ في إرسال رابط التعيين:", error);
      toast.error("حدث خطأ أثناء إرسال البريد الإلكتروني.");
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleUpdateAdminPin = async () => {
    const ownerUid = getOwnerUid();
    if (!ownerUid) return;
    if (!adminPin.trim()) {
      toast.error("يرجى كتابة رمز PIN جديد أولاً.");
      return;
    }

    try {
      setSavingPin(true);
      await setDoc(doc(db, "users", ownerUid), { adminPin: adminPin.trim() }, { merge: true });
      toast.success("تم حفظ وتحديث رمز PIN الخاص بحساب المالك بنجاح!");
    } catch (error) {
      console.error("خطأ في حفظ رمز PIN المالك:", error);
      toast.error("حدث خطأ أثناء حفظ الرمز.");
    } finally {
      setSavingPin(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const ownerUid = getOwnerUid();
    if (!ownerUid || !empForm.name || !empForm.username || !empForm.password) return;

    try {
      setSubmittingUser(true);
      const cleanUsername = empForm.username.trim().toLowerCase();

      await addSystemUser({
        ownerUid: ownerUid,
        name: empForm.name,
        email: `${cleanUsername}@local.app`,
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

      toast.success("تم إنشاء حساب الموظف بنجاح!");
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
      toast.error("حدث خطأ أثناء إضافة الموظف.");
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleDeleteEmp = async (id: string, name: string) => {
    try {
      await deleteSystemUser(id);
      toast.success(`تم حذف الموظف (${name}) وإلغاء صلاحية دخوله.`);
      await fetchUsersAndSettings();
    } catch (error) {
      console.error("خطأ أثناء حذف الموظف:", error);
      toast.error("حدث خطأ أثناء حذف الموظف.");
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const ownerUid = getOwnerUid();
    
    if (!ownerUid) {
      toast.error("تعذر التعرف على حساب الشركة المسجل.");
      return;
    }

    setLoadingAction(true);
    try {
      await saveCompanySettings(ownerUid, {
        companyName: storeName,
        phone: storePhone,
        address: storeAddress,
        logoUrl: storeLogo,
        notes: contractTerms,
      });

      localStorage.setItem(`company_settings_${ownerUid}`, JSON.stringify({
        companyName: storeName,
        phone: storePhone,
        address: storeAddress,
        logoUrl: storeLogo,
        notes: contractTerms,
      }));

      localStorage.setItem("app_default_profit_rate", defaultProfitRate.toString());
      localStorage.setItem("app_wa_use_api", useAutoApi ? "true" : "false");
      localStorage.setItem("app_wa_instance_id", waInstanceId);
      localStorage.setItem("app_wa_token", waToken);
      localStorage.setItem("app_whatsapp_template", whatsappTemplate);

      setSaved(true);
      toast.success("تم حفظ وتحديث إعدادات الشركة والشعار بنجاح!");
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("خطأ في حفظ الإعدادات:", err);
      toast.error("حدث خطأ أثناء حفظ تفاصيل الشركة.");
    } finally {
      setLoadingAction(false);
    }
  };

  const handleExportBackup = async () => {
    const ownerUid = getOwnerUid();
    if (!ownerUid) return;
    try {
      setLoadingAction(true);
      const [installments, payments] = await Promise.all([
        getUserInstallments(ownerUid),
        getUserPayments(ownerUid),
      ]);

      const backupData = {
        exportDate: new Date().toISOString(),
        userId: ownerUid,
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

      toast.success("تم تصدير وتحميل النسخة الاحتياطية بنجاح!");
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ أثناء تصدير البيانات.");
    } finally {
      setLoadingAction(false);
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
          await processBackupJSON(content);
          toast.success("تمت استعادة وتحديث البيانات بنجاح بدون تكرار!");
        } catch (err) {
          console.error(err);
          toast.error("خطأ في قراءة ملف النسخة الاحتياطية.");
        } finally {
          setLoadingAction(false);
          event.target.value = "";
        }
      };
    }
  };

  const handleConnectGoogleDrive = () => {
    const CLIENT_ID = "42704920630-fh1e8kni3er2bhc6ejjj2kkhcgi01nvc.apps.googleusercontent.com"; 
    const REDIRECT_URI = "https://aqsatak-app.vercel.app/settings";
    const SCOPE = "https://www.googleapis.com/auth/drive.file";

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&response_type=token&scope=${encodeURIComponent(SCOPE)}`;

    const width = 500;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const authWindow = window.open(
      authUrl,
      "GoogleDriveAuth",
      `width=${width},height=${height},top=${top},left=${left}`
    );

    const checkTokenInterval = setInterval(() => {
      try {
        if (!authWindow || authWindow.closed) {
          clearInterval(checkTokenInterval);
          return;
        }

        const currentUrl = authWindow.location.href;
        if (currentUrl && currentUrl.includes("access_token=")) {
          const hashString = currentUrl.split("#")[1];
          if (hashString) {
            const hashParams = new URLSearchParams(hashString);
            const token = hashParams.get("access_token");

            if (token) {
              localStorage.setItem("google_drive_access_token", token);
              setIsDriveConnected(true);
              toast.success("تم تسجيل الدخول وربط Google Drive بنجاح!");

              authWindow.close();
              clearInterval(checkTokenInterval);

              handleDownloadFromGoogleDrive(token, false);
            }
          }
        }
      } catch (e) {}
    }, 300);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6 animate-in fade-in duration-500 pb-12">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">إعدادات النظام وإدارة الموظفين</h1>
        <p className="text-gray-500 text-xs md:text-sm mt-1">
          تخصيص تفاصيل المكتب، رفع الشعار، تغيير كلمة المرور عبر الجيميل، إضافة الموظفين وصلاحياتهم، والنسخ الاحتياطي.
        </p>
      </div>

      {saved && (
        <div className="p-3 md:p-4 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 rounded-xl flex items-center gap-2 md:gap-3 text-xs md:text-sm font-bold animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5" />
          <span>تم حفظ الإعدادات وتحديث بيانات الشعار والشركة بنجاح!</span>
        </div>
      )}

      {/* 🔒 1. أمان وحماية حساب الشركة والرمز السرّي */}
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

      {/* 👥 2. إضافة وتحديد صلاحيات الموظفين */}
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
        {/* 🏢 3. تفاصيل المكتب واللوجو والطباعة */}
        <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-primary border-b border-border pb-3">
            <Store className="w-4 h-4 md:w-5 md:h-5" />
            <h2 className="font-bold text-base md:text-lg">تفاصيل المكتب والشعار وبيانات المطبوعات</h2>
          </div>

          {/* 🖼️ قسم اختيار ورفع شعار/لوجو المكتب */}
          <div className="p-4 bg-secondary/20 border border-border rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl border border-border bg-background flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                {storeLogo ? (
                  <img src={storeLogo} alt="شعار المكتب" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <div>
                <p className="font-bold text-xs md:text-sm text-foreground">شعار / لوجو المكتب الخاص بك</p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  سيظهر هذا الشعار بوضوح أعلى العقود، الكشوفات، والإيصالات المطبوعة.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="px-4 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition-all cursor-pointer shadow-sm flex items-center gap-2">
                <Upload className="w-4 h-4" />
                <span>رفع شعار جديد</span>
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>

              {storeLogo && (
                <button
                  type="button"
                  onClick={() => setStoreLogo("")}
                  className="px-3 py-2.5 border border-rose-500/30 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl text-xs font-bold transition-colors"
                  title="حذف الشعار واستخدام الافتراضي"
                >
                  إزالة
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">اسم المكتب / الشركة البائعة</label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="مثال: أقساطك للتجارة والتقسيط"
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

        {/* 💾 7. إدارة النسخ الاحتياطية و Google Drive */}
        <div className="bg-card border border-border rounded-2xl p-4 md:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-primary border-b border-border pb-3">
            <Database className="w-4 h-4 md:w-5 md:h-5" />
            <h2 className="font-bold text-base md:text-lg">إدارة النسخ الاحتياطية والتخزين السحابي</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={loadingAction}
              className="p-4 bg-background border border-border rounded-xl hover:bg-primary/5 hover:border-primary/30 transition-all text-right flex flex-col justify-between space-y-2 md:space-y-3 group"
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">تصدير نسخة (JSON)</span>
                <Download className="w-5 h-5 text-primary opacity-80 group-hover:opacity-100 group-hover:-translate-y-1 transition-all" />
              </div>
              <p className="text-[10px] md:text-xs text-gray-500">حفظ كافة بيانات الأقساط والدفعات في ملف لضمان عدم ضياعها.</p>
            </button>

            <label className="p-4 bg-background border border-border rounded-xl hover:bg-primary/5 hover:border-primary/30 transition-all text-right flex flex-col justify-between space-y-2 md:space-y-3 cursor-pointer group">
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">استعادة نسخة محليّة</span>
                <Upload className="w-5 h-5 text-primary opacity-80 group-hover:opacity-100 group-hover:-translate-y-1 transition-all" />
              </div>
              <p className="text-[10px] md:text-xs text-gray-500">استرجاع وتحديث البيانات من ملف .json محلي.</p>
              <input type="file" accept=".json" onChange={handleImportBackup} disabled={loadingAction} className="hidden" />
            </label>

            <div className="p-4 bg-background border border-blue-500/20 rounded-xl flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-sm text-blue-600 dark:text-blue-400">تخزين Google Drive الآلي</span>
                <CloudUpload className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-[10px] md:text-xs text-gray-500">
                مزامنة أوتوماتيكية يومية واستعادة فورية عند تسجيل الدخول.
              </p>

              <div className="flex flex-col gap-2 pt-1">
                {isDriveConnected ? (
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem("google_drive_access_token");
                      setIsDriveConnected(false);
                      toast.info("تم إلغاء ربط Google Drive.");
                    }}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                    title="اضغط لإلغاء الربط"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>تم الربط بنجاح (مُتصل)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnectGoogleDrive}
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>ربط الحساب للتزامن الآلي</span>
                  </button>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUploadToGoogleDrive(false)}
                    disabled={uploadingToDrive || loadingAction || !isDriveConnected}
                    className="flex-1 py-1.5 px-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {uploadingToDrive ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                    ) : (
                      <CloudUpload className="w-3.5 h-3.5 text-blue-500" />
                    )}
                    <span>رفع الآن</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadFromGoogleDrive(undefined, false)}
                    disabled={downloadingFromDrive || loadingAction || !isDriveConnected}
                    className="flex-1 py-1.5 px-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {downloadingFromDrive ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                    ) : (
                      <CloudDownload className="w-3.5 h-3.5 text-emerald-500" />
                    )}
                    <span>استعادة من Drive</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loadingAction}
          className="w-full py-3.5 md:py-4 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-md text-sm md:text-base active:scale-[0.98]"
        >
          {loadingAction ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          <span>حفظ وتحديث الإعدادات الشاملة</span>
        </button>
      </form>
    </div>
  );
}