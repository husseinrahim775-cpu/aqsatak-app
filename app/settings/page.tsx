"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../components/AuthProvider";
import packageJson from "@/package.json";
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
  Image as ImageIcon,
  RefreshCw,
  Sparkles,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Settings,
  Zap,
  ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  const { user, userData } = useAuth() as any;
  const [saved, setSaved] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [uploadingToDrive, setUploadingToDrive] = useState(false);
  const [downloadingFromDrive, setDownloadingFromDrive] = useState(false);
  const [isDriveConnected, setIsDriveConnected] = useState(false);

  // إيميل الأدمن الرئيسي
  const ADMIN_EMAIL = "admin@aqsatak.com";
  // فحص هل الحساب الحالي هو الأدمن الرئيسي
  const isAdmin = userData?.role === "admin" || (user?.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());

  // 🗂️ حالة التحكم بالبطاقات المطوية
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    subscriptionInfo: true, // مفتوح افتراضياً لعرض حالة الاشتراك
    updates: true,
    security: false,
    employees: false,
    company: false,
    whatsapp: false,
    financial: false,
    theme: false,
    backup: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 📐 حساب الأيام المتبقية والباقة للحساب المسجل
  const currentSub = userData?.subscription;
  const endDate = currentSub?.endDate ? new Date(currentSub.endDate) : null;
  const daysLeft = endDate ? Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;

  const planNames: Record<string, string> = {
    basic: "الباقة الأساسية (Basic)",
    plus: "باقة بلس (Plus)",
    super: "الباقة الفائقة (Super)",
  };

  // حالات التحديث التلقائي ورقم الإصدار الحقيقي للديسك توب
  const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "available" | "downloading" | "ready" | "not_available" | "error">("idle");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [newVersion, setNewVersion] = useState("");
  const [currentAppVersion, setCurrentAppVersion] = useState("1.0.1");

  // حالات الإعدادات العامة
  const [storeName, setStoreName] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storeLogo, setStoreLogo] = useState("");
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

  // 🔄 الاستماع لإشارات التحديث ورقم الإصدار من Electron
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require("electron");

        ipcRenderer.invoke("get_app_version").then((ver: string) => {
          if (ver) setCurrentAppVersion(ver);
        }).catch(() => {});

        const handleUpdateStatus = (_: any, data: any) => {
          setUpdateStatus(data.status);

          if (data.status === "available" || data.status === "ready") {
            setNewVersion(data.version || "");
          }

          if (data.status === "downloading") {
            setDownloadProgress(data.percent || 0);
          }

          if (data.status === "not_available") {
            toast.info("أنظمة أقساطك محدثة لأحدث إصدار بالفعل!");
          }

          if (data.status === "error") {
            toast.error(data.error || "تعذر الفحص، تأكد من الاتصال بالإنترنت.");
          }
        };

        ipcRenderer.on("update_status", handleUpdateStatus);

        return () => {
          ipcRenderer.removeListener("update_status", handleUpdateStatus);
        };
      } catch (e) {
        console.log("Not running in Electron desktop environment");
      }
    }
  }, []);

  const handleCheckForUpdates = () => {
    setUpdateStatus("checking");

    if (typeof window !== "undefined" && (window as any).require) {
      try {
        const { ipcRenderer } = (window as any).require("electron");
        ipcRenderer.send("check_for_updates");
      } catch (e) {
        setUpdateStatus("idle");
        toast.error("حدث خطأ أثناء الاتصال بأداة التحديث.");
      }
    } else {
      setUpdateStatus("idle");
      toast.error("هذه الميزة تعمل فقط بداخل تطبيق الديسك توب المثبت.");
    }
  };

  const handleRestartAndInstall = () => {
    if (typeof window !== "undefined" && (window as any).require) {
      const { ipcRenderer } = (window as any).require("electron");
      ipcRenderer.send("restart_and_install");
    }
  };

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

  const processBackupJSON = async (content: any) => {
    if (!content.installments || !Array.isArray(content.installments)) {
      throw new Error("ملف النسخة الاحتياطية غير صالح!");
    }

    const ownerUid = getOwnerUid();
    if (!ownerUid) return;

    for (const inst of content.installments) {
      if (inst.id) {
        const instRef = doc(db, "installments", inst.id);
        await setDoc(instRef, { ...inst, userId: ownerUid, updatedAt: new Date().toISOString() }, { merge: true });
      } else {
        const { id, createdAt, ...cleanInst } = inst;
        await addInstallmentRecord({ ...cleanInst, userId: ownerUid });
      }
    }

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
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="max-w-4xl mx-auto space-y-5 md:space-y-6 pb-12 font-sans dir-rtl text-right"
    >
      {/* 1. ترويسة الصفحة المودرن  */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/80 backdrop-blur-xl p-5 md:p-6 rounded-3xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-orange-500" />
            إعدادات النظام وإدارة الموظفين
          </h1>
          <p className="text-xs text-muted-foreground mt-1">تخصيص تفاصيل المكتب، التحديثات المباشرة، الصلاحيات، والنسخ الاحتياطي .</p>
        </div>

        <button
          onClick={() => handleSaveSettings({ preventDefault: () => {} } as any)}
          disabled={loadingAction}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-5 py-3 rounded-2xl font-bold text-xs md:text-sm shadow-md shadow-orange-500/20 hover:opacity-95 transition-all disabled:opacity-50"
        >
          {loadingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>حفظ التعديلات العامة</span>
        </button>
      </div>

      {saved && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center gap-2.5 text-xs font-black animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5" />
          <span>تم حفظ الإعدادات وتحديث بيانات الشعار والشركة بنجاح!</span>
        </div>
      )}

      {/* 🎯 كارت متابعة تفاصيل الاشتراك الحالي وحساب الأيام المتبقية (محدث للـ Admin) */}
      <div className="bg-card/90 backdrop-blur-md border border-border rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-500" />
            <h3 className="font-black text-sm text-foreground">حالة اشتراك الحساب المسجل</h3>
          </div>
          <span className="text-[10px] font-black px-3 py-1 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
            {isAdmin ? "وصول غير محدود" : (planNames[currentSub?.planType || "basic"] || "الباقة الأساسية")}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 bg-secondary/30 rounded-2xl border border-border/50">
            <span className="text-[10px] text-muted-foreground font-bold block">نوع الباقة المخصصة</span>
            <span className="text-xs font-black text-foreground">
              {isAdmin ? "الباقة الإدارية الشاملة" : (planNames[currentSub?.planType || "basic"] || "الباقة الأساسية (Basic)")}
            </span>
          </div>

          <div className="p-4 bg-secondary/30 rounded-2xl border border-border/50">
            <span className="text-[10px] text-muted-foreground font-bold block">فترة الاشتراك</span>
            <span className="text-xs font-black text-foreground">
              {isAdmin ? "دائم / غير محدود" : (currentSub?.period === "yearly" ? "سنوي" : "شهري")}
            </span>
          </div>

          <div className="p-4 bg-secondary/30 rounded-2xl border border-border/50">
            <span className="text-[10px] text-muted-foreground font-bold block">المدة المتبقية</span>
            {isAdmin ? (
              <span className="text-xs font-black text-purple-600 dark:text-purple-400 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-purple-500" />
                غير محدود (أدمن)
              </span>
            ) : daysLeft > 0 ? (
              <span className={`text-xs font-black font-mono ${daysLeft <= 7 ? "text-rose-500 animate-pulse" : "text-emerald-500"}`}>
                {daysLeft} يوم متبقي
              </span>
            ) : (
              <span className="text-xs font-black text-rose-500">
                منتهي (يرجى التواصل للتجديد)
              </span>
            )}
          </div>
        </div>

        {!isAdmin && daysLeft <= 7 && daysLeft > 0 && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-2xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>تنبيّه: اشتراكك الحسابي على وشك الانتهاء خلال {daysLeft} أيام!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-4">
        
        {/* 🚀 1. قسم التحديثات الذكية  Card */}
        <div className="bg-card/90 backdrop-blur-md border border-border rounded-3xl overflow-hidden shadow-sm transition-all">
          <button
            type="button"
            onClick={() => toggleSection("updates")}
            className="w-full p-4 md:p-5 flex items-center justify-between bg-secondary/30 hover:bg-secondary/60 transition-colors"
          >
            <div className="flex items-center gap-2.5 font-extrabold text-sm text-foreground">
              <div className="p-2 bg-orange-500/10 text-orange-500 rounded-xl">
                <RefreshCw className={`w-4 h-4 ${updateStatus === "checking" ? "animate-spin" : ""}`} />
              </div>
              <span>تحديثات النظام وإصدار التطبيق</span>
              <span className="text-[10px] bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 px-2.5 py-0.5 rounded-full font-bold dir-ltr">
                v{currentAppVersion}
              </span>
            </div>

            {openSections.updates ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {openSections.updates && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-5 border-t border-border space-y-4"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h4 className="font-bold text-xs md:text-sm text-foreground">البحث الآلي عن التحديثات المباشرة</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">افحص وجود إصدار جديد من أداة أقساطك الديسك توب لضمان أعلى أداء.</p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCheckForUpdates}
                    disabled={updateStatus === "checking" || updateStatus === "downloading"}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold rounded-2xl hover:opacity-95 transition-all disabled:opacity-50 shadow-sm shrink-0"
                  >
                    {updateStatus === "checking" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>{updateStatus === "checking" ? "جاري الفحص..." : "فحص التحديثات الآن"}</span>
                  </button>
                </div>

                {updateStatus === "downloading" && (
                  <div className="space-y-2 p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                    <div className="flex justify-between items-center text-xs text-blue-600 font-bold">
                      <span>جاري تنزيل التحديث الجديد ({newVersion})...</span>
                      <span dir="ltr">{downloadProgress}%</span>
                    </div>
                    <div className="w-full bg-blue-200/50 dark:bg-blue-950 rounded-full h-2 overflow-hidden">
                      <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${downloadProgress}%` }} />
                    </div>
                  </div>
                )}

                {updateStatus === "ready" && (
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span className="text-xs font-bold">تم تنزيل الإصدار الجديد ({newVersion}) وجاهز للتثبيت!</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRestartAndInstall}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm w-full sm:w-auto justify-center"
                    >
                      <Download className="w-4 h-4" />
                      <span>إعادة التشغيل والتثبيت الآن</span>
                    </button>
                  </div>
                )}

                {updateStatus === "not_available" && (
                  <p className="text-xs text-emerald-600 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> تطبيقك يعمل بأحدث إصدار متوفر.
                  </p>
                )}

                {updateStatus === "error" && (
                  <p className="text-xs text-rose-500 font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" /> تعذر الاتصال بخادم التحديثات. تحقق من شبكة الإنترنت.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 🔒 2. قسم أمان حساب الشركة والرمز السرّي PIN  Card */}
        <div className="bg-card/90 backdrop-blur-md border border-border rounded-3xl overflow-hidden shadow-sm transition-all">
          <button
            type="button"
            onClick={() => toggleSection("security")}
            className="w-full p-4 md:p-5 flex items-center justify-between bg-secondary/30 hover:bg-secondary/60 transition-colors"
          >
            <div className="flex items-center gap-2.5 font-extrabold text-sm text-foreground">
              <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl">
                <Key className="w-4 h-4" />
              </div>
              <span>أمان حساب الشركة ورمز PIN السريع للمالك</span>
            </div>

            {openSections.security ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {openSections.security && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-5 border-t border-border space-y-4"
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-orange-500/5 border border-orange-500/20 p-4 rounded-2xl">
                  <div className="space-y-1">
                    <p className="font-bold text-xs text-foreground flex items-center gap-2">
                      <Mail className="w-4 h-4 text-orange-500" />
                      <span>البريد الإلكتروني الحالي لمالك المنظومة:</span>
                    </p>
                    <p className="text-xs font-mono font-bold text-orange-500 dir-ltr">{user?.email || "غير مسجل"}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      إرسال رابط استعادة وتغيير كلمة السر الرسمية للشركة إلى صندوق الجيميل الخاص بك.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendPasswordReset}
                    disabled={isSendingReset}
                    className="px-4 py-2.5 bg-orange-500 text-white text-xs font-bold rounded-2xl hover:opacity-95 transition-all shadow-sm flex items-center gap-2 shrink-0 disabled:opacity-50"
                  >
                    {isSendingReset ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    <span>إرسال رابط التغيير للجيميل</span>
                  </button>
                </div>

                <div className="pt-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-secondary/30 p-4 rounded-2xl border border-border/50">
                  <div>
                    <p className="text-xs font-bold text-foreground">رمز PIN السريع لحساب الأدمن / المالك:</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      الرمز الذي تستخدمه لدخول حساب المالك من شاشة الموظفين بدلاً من كتابة كلمة سر الشركة.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="password"
                      value={adminPin}
                      onChange={(e) => setAdminPin(e.target.value)}
                      placeholder="1234"
                      className="p-2.5 border border-border bg-background rounded-2xl text-center font-mono w-28 text-xs outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={handleUpdateAdminPin}
                      disabled={savingPin}
                      className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-xs rounded-2xl hover:opacity-95 transition-all shadow-sm disabled:opacity-50"
                    >
                      {savingPin ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ الرمز"}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 👥 3. قسم إضافة وتحديد صلاحيات الموظفين  Card */}
        <div className="bg-card/90 backdrop-blur-md border border-border rounded-3xl overflow-hidden shadow-sm transition-all">
          <button
            type="button"
            onClick={() => toggleSection("employees")}
            className="w-full p-4 md:p-5 flex items-center justify-between bg-secondary/30 hover:bg-secondary/60 transition-colors"
          >
            <div className="flex items-center gap-2.5 font-extrabold text-sm text-foreground">
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                <UserPlus className="w-4 h-4" />
              </div>
              <span>إدارة الموظفين وتحديد صلاحيات النظام ({usersList.length})</span>
            </div>

            {openSections.employees ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {openSections.employees && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-5 border-t border-border space-y-4"
              >
                <div className="space-y-4 bg-secondary/20 p-4 rounded-2xl border border-border/50">
                  <h4 className="font-bold text-xs text-foreground">إضافة موظف أو كادر جديد للمكتب:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">اسم الموظف الثلاثي</label>
                      <input
                        type="text"
                        placeholder="مثال: أحمد علي"
                        value={empForm.name}
                        onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                        className="w-full p-3 bg-background border border-border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">اسم المستخدم (Username)</label>
                      <input
                        type="text"
                        placeholder="مثال: ahmed123"
                        value={empForm.username}
                        onChange={(e) => setEmpForm({ ...empForm, username: e.target.value })}
                        className="w-full p-3 bg-background border border-border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500 text-left font-mono"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-muted-foreground mb-1">رمز السر الخاص به</label>
                      <input
                        type="text"
                        placeholder="11223344"
                        value={empForm.password}
                        onChange={(e) => setEmpForm({ ...empForm, password: e.target.value })}
                        className="w-full p-3 bg-background border border-border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500 text-left font-mono"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground mb-2">تحديد الصلاحيات المسموح بها للموظف:</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 text-xs font-bold">
                      <label className="flex items-center gap-2 p-2.5 rounded-2xl bg-background border border-border/80 cursor-pointer hover:border-orange-500 transition-colors">
                        <input
                          type="checkbox"
                          checked={empForm.canManageCustomers}
                          onChange={(e) => setEmpForm({ ...empForm, canManageCustomers: e.target.checked })}
                          className="rounded text-orange-500 focus:ring-orange-500 w-4 h-4 accent-orange-500"
                        />
                        <span>تسجيل عملاء وتلقي دفعات</span>
                      </label>

                      <label className="flex items-center gap-2 p-2.5 rounded-2xl bg-background border border-border/80 cursor-pointer hover:border-orange-500 transition-colors">
                        <input
                          type="checkbox"
                          checked={empForm.canManageStore}
                          onChange={(e) => setEmpForm({ ...empForm, canManageStore: e.target.checked })}
                          className="rounded text-orange-500 focus:ring-orange-500 w-4 h-4 accent-orange-500"
                        />
                        <span>إدارة المخزن والمبيعات</span>
                      </label>

                      <label className="flex items-center gap-2 p-2.5 rounded-2xl bg-background border border-border/80 cursor-pointer hover:border-orange-500 transition-colors">
                        <input
                          type="checkbox"
                          checked={empForm.canViewDashboard}
                          onChange={(e) => setEmpForm({ ...empForm, canViewDashboard: e.target.checked })}
                          className="rounded text-orange-500 focus:ring-orange-500 w-4 h-4 accent-orange-500"
                        />
                        <span>عرض الداشبورد والمالية</span>
                      </label>

                      <label className="flex items-center gap-2 p-2.5 rounded-2xl bg-background border border-border/80 cursor-pointer hover:border-orange-500 transition-colors">
                        <input
                          type="checkbox"
                          checked={empForm.canViewTreasury}
                          onChange={(e) => setEmpForm({ ...empForm, canViewTreasury: e.target.checked })}
                          className="rounded text-orange-500 focus:ring-orange-500 w-4 h-4 accent-orange-500"
                        />
                        <span>عرض الخزينة والسيولة</span>
                      </label>

                      <label className="flex items-center gap-2 p-2.5 rounded-2xl bg-background border border-border/80 cursor-pointer hover:border-orange-500 transition-colors">
                        <input
                          type="checkbox"
                          checked={empForm.canDeleteOrEdit}
                          onChange={(e) => setEmpForm({ ...empForm, canDeleteOrEdit: e.target.checked })}
                          className="rounded text-orange-500 focus:ring-orange-500 w-4 h-4 accent-orange-500"
                        />
                        <span>تعديل وحذف العقود</span>
                      </label>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddEmployee}
                    disabled={submittingUser || !empForm.name || !empForm.username}
                    className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl text-xs hover:opacity-95 transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm"
                  >
                    {submittingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    <span>تأكيد وحفظ الموظف</span>
                  </button>
                </div>

                <div className="pt-2 space-y-2">
                  <h4 className="font-bold text-xs text-muted-foreground flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-orange-500" />
                    <span>قائمة الكادر والموظفين المسجلين:</span>
                  </h4>

                  {loadingUsers ? (
                    <div className="text-center py-4 text-orange-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    </div>
                  ) : usersList.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-2">لا يوجد موظفين مسجلين في الوقت الحالي.</p>
                  ) : (
                    <div className="divide-y divide-border/60 border border-border/80 rounded-2xl overflow-hidden bg-background">
                      {usersList.map((emp) => (
                        <div key={emp.id} className="p-3 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                          <div>
                            <p className="font-bold text-xs text-foreground flex items-center gap-2">
                              <UserCheck className="w-4 h-4 text-emerald-500" />
                              <span>{emp.name}</span>
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5" dir="ltr">
                              المستخدم: <strong className="text-orange-500">{emp.username || emp.email.split('@')[0]}</strong> • الرمز: {emp.password}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => emp.id && handleDeleteEmp(emp.id, emp.name)}
                            className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                            title="حذف الموظف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 🏢 4. تفاصيل الشركة والشعار والطباعة  Card */}
        <div className="bg-card/90 backdrop-blur-md border border-border rounded-3xl overflow-hidden shadow-sm transition-all">
          <button
            type="button"
            onClick={() => toggleSection("company")}
            className="w-full p-4 md:p-5 flex items-center justify-between bg-secondary/30 hover:bg-secondary/60 transition-colors"
          >
            <div className="flex items-center gap-2.5 font-extrabold text-sm text-foreground">
              <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                <Store className="w-4 h-4" />
              </div>
              <span>بيانات الشركة والشعار وعقود الطباعة الرسمية</span>
            </div>

            {openSections.company ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {openSections.company && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-5 border-t border-border space-y-4"
              >
                <div className="p-4 bg-secondary/30 border border-border/60 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl border border-border bg-background flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                      {storeLogo ? (
                        <img src={storeLogo} alt="شعار المكتب" className="w-full h-full object-contain" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-foreground">شعار / لوجو المكتب الخاص بك</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        سيظهر بوضوح أعلى العقود، الكشوفات، والإيصالات المطبوعة.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <label className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-xs rounded-2xl hover:opacity-95 transition-all cursor-pointer shadow-sm flex items-center gap-1.5">
                      <Upload className="w-4 h-4" />
                      <span>رفع شعار جديد</span>
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>

                    {storeLogo && (
                      <button
                        type="button"
                        onClick={() => setStoreLogo("")}
                        className="px-3 py-2.5 border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 rounded-2xl text-xs font-bold transition-colors"
                      >
                        إزالة
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">اسم المكتب / الشركة البائعة</label>
                    <input
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="مثال: أقساطك للتجارة والتقسيط"
                      className="w-full p-3 bg-background border border-border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-orange-500" /> رقم هاتف المكتب الرئيسي
                    </label>
                    <input
                      type="text"
                      value={storePhone}
                      onChange={(e) => setStorePhone(e.target.value)}
                      placeholder="07700000000"
                      className="w-full p-3 bg-background border border-border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-orange-500" /> عنوان الفرع الرئيسي
                    </label>
                    <input
                      type="text"
                      value={storeAddress}
                      onChange={(e) => setStoreAddress(e.target.value)}
                      placeholder="مثال: بغداد - المنصور"
                      className="w-full p-3 bg-background border border-border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">حساب المالك الحسابي</label>
                    <input
                      type="text"
                      disabled
                      value={user?.email || "المستخدم الحالي"}
                      className="w-full p-3 bg-secondary/40 border border-border rounded-2xl text-xs font-bold text-muted-foreground cursor-not-allowed font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-orange-500" /> شروط وتعهدات العقد المطبوع
                  </label>
                  <textarea
                    rows={4}
                    value={contractTerms}
                    onChange={(e) => setContractTerms(e.target.value)}
                    placeholder="أدخل الشروط والأحكام التي تظهر بأسفل العقد..."
                    className="w-full p-3 bg-background border border-border rounded-2xl text-xs font-bold outline-none resize-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 💬 5. قسم ربط الواتساب والإشعارات الآلية  Card */}
        <div className="bg-card/90 backdrop-blur-md border border-border rounded-3xl overflow-hidden shadow-sm transition-all">
          <button
            type="button"
            onClick={() => toggleSection("whatsapp")}
            className="w-full p-4 md:p-5 flex items-center justify-between bg-secondary/30 hover:bg-secondary/60 transition-colors"
          >
            <div className="flex items-center gap-2.5 font-extrabold text-sm text-foreground">
              <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                <MessageSquare className="w-4 h-4" />
              </div>
              <span>تذكير الأقساط عبر الواتساب و ربط API التلقائي</span>
            </div>

            {openSections.whatsapp ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {openSections.whatsapp && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-5 border-t border-border space-y-4"
              >
                <div className="flex items-center justify-between p-3.5 bg-secondary/30 rounded-2xl border border-border/60">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-bold text-foreground">تفعيل إرسال الرسائل تلقائياً عبر API</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={useAutoApi}
                    onChange={(e) => setUseAutoApi(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 accent-emerald-500 cursor-pointer"
                  />
                </div>

                {useAutoApi && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3">
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                      ✓ يتم الإرسال المباشر للرسالة بالخلفية لخدمة UltraMsg دون الحاجة لفتح تطبيق الواتساب.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-muted-foreground mb-1">Instance ID / Account ID</label>
                        <input
                          type="text"
                          value={waInstanceId}
                          onChange={(e) => setWaInstanceId(e.target.value)}
                          placeholder="مثال: instance12345"
                          className="w-full p-3 bg-background border border-border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-muted-foreground mb-1">API Token / Access Key</label>
                        <input
                          type="password"
                          value={waToken}
                          onChange={(e) => setWaToken(e.target.value)}
                          placeholder="أدخل الـ Token"
                          className="w-full p-3 bg-background border border-border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">قالب نص رسالة التذكير بالأقساط</label>
                  <textarea
                    rows={3}
                    value={whatsappTemplate}
                    onChange={(e) => setWhatsappTemplate(e.target.value)}
                    className="w-full p-3 bg-background border border-border rounded-2xl text-xs font-bold outline-none resize-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                    المتغيرات المتاحة: &#123;name&#125; اسم العميل، &#123;amount&#125; القسط، &#123;product&#125; المنتج.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 📊 6. قسم النسبة المالية الافتراضية والمظهر  Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card/90 backdrop-blur-md border border-border rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-orange-500 border-b border-border/60 pb-2.5">
              <Percent className="w-4 h-4" />
              <h3 className="font-extrabold text-xs">النسبة المالية الافتراضية</h3>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-muted-foreground mb-1">نسبة الربح الافتراضية (%)</label>
              <input
                type="number"
                value={defaultProfitRate}
                onChange={(e) => setDefaultProfitRate(Number(e.target.value))}
                className="w-full p-3 bg-background border border-border rounded-2xl text-xs font-black dir-ltr text-right focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
          </div>

          <div className="bg-card/90 backdrop-blur-md border border-border rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-purple-500 border-b border-border/60 pb-2.5">
              <Sun className="w-4 h-4" />
              <h3 className="font-extrabold text-xs">مظهر المنظومة (Dark / Light)</h3>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-secondary/30 rounded-2xl border border-border/50">
              <div className="flex items-center gap-2">
                {isDarkMode ? <Moon className="w-4 h-4 text-purple-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                <span className="text-xs font-bold text-foreground">الوضع الليلي (Dark)</span>
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                  isDarkMode 
                    ? "bg-purple-600 text-white" 
                    : "bg-secondary text-foreground border border-border"
                }`}
              >
                {isDarkMode ? "مُفعل" : "معطل"}
              </button>
            </div>
          </div>
        </div>

        {/* 💾 7. قسم النسخ الاحتياطي و Google Drive  Card */}
        <div className="bg-card/90 backdrop-blur-md border border-border rounded-3xl overflow-hidden shadow-sm transition-all">
          <button
            type="button"
            onClick={() => toggleSection("backup")}
            className="w-full p-4 md:p-5 flex items-center justify-between bg-secondary/30 hover:bg-secondary/60 transition-colors"
          >
            <div className="flex items-center gap-2.5 font-extrabold text-sm text-foreground">
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                <Database className="w-4 h-4" />
              </div>
              <span>إدارة النسخ الاحتياطية والتزامن السحابي Google Drive</span>
            </div>

            {openSections.backup ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {openSections.backup && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-5 border-t border-border space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    disabled={loadingAction}
                    className="p-4 bg-secondary/20 border border-border rounded-2xl hover:border-orange-500/50 transition-all text-right flex flex-col justify-between space-y-2 group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs text-foreground group-hover:text-orange-500 transition-colors">تصدير نسخة (JSON)</span>
                      <Download className="w-4 h-4 text-orange-500" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">حفظ كامل بياناتك وسجلاتك في ملف خارجي آمن.</p>
                  </button>

                  <label className="p-4 bg-secondary/20 border border-border rounded-2xl hover:border-orange-500/50 transition-all text-right flex flex-col justify-between space-y-2 cursor-pointer group">
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs text-foreground group-hover:text-orange-500 transition-colors">استعادة نسخة محليّة</span>
                      <Upload className="w-4 h-4 text-orange-500" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">قراءة واسترجاع السجلات من ملف .json محلي.</p>
                    <input type="file" accept=".json" onChange={handleImportBackup} disabled={loadingAction} className="hidden" />
                  </label>

                  <div className="p-4 bg-secondary/20 border border-blue-500/30 rounded-2xl flex flex-col justify-between space-y-2.5">
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs text-blue-500">تزامن Google Drive</span>
                      <CloudUpload className="w-4 h-4 text-blue-500" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      مزامنة تلقائية مع حساب جوجل للحماية من ضياع البيانات.
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
                          className="w-full py-2 px-3 bg-emerald-600 text-white rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Google Drive مُتصل بنجاح</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleConnectGoogleDrive}
                          className="w-full py-2 px-3 bg-blue-600 text-white rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 shadow-sm"
                        >
                          <Key className="w-3.5 h-3.5" />
                          <span>ربط حساب Google Drive</span>
                        </button>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUploadToGoogleDrive(false)}
                          disabled={uploadingToDrive || loadingAction || !isDriveConnected}
                          className="flex-1 py-1.5 px-2 bg-secondary text-foreground border border-border rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {uploadingToDrive ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" /> : <CloudUpload className="w-3.5 h-3.5 text-blue-500" />}
                          <span>رفع الآن</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadFromGoogleDrive(undefined, false)}
                          disabled={downloadingFromDrive || loadingAction || !isDriveConnected}
                          className="flex-1 py-1.5 px-2 bg-secondary text-foreground border border-border rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          {downloadingFromDrive ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" /> : <CloudDownload className="w-3.5 h-3.5 text-emerald-500" />}
                          <span>استعادة</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </form>
    </motion.div>
  );
}