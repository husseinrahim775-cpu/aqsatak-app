"use client";

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../../services/firebase";
import { Loader2, Lock, Mail, ShieldCheck, LogOut, KeyRound, UserCheck, Shield, ChevronRight, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SystemUser } from "../../services/firestore";

export default function LoginPage() {
  const [isNewAccount, setIsNewAccount] = useState(false);
  const [isCompanyAuthenticated, setIsCompanyAuthenticated] = useState(false);

  // 1. بيانات دخول الشركة
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPassword, setCompanyPassword] = useState("");

  // 2. اختيار الموظف والرمز
  const [employees, setEmployees] = useState<SystemUser[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("admin_owner");
  const [empPinCode, setEmpPinCode] = useState("");
  
  // 🔒 رمز PIN الخاص بمدير الشركة يجلب من Firestore
  const [companyAdminPin, setCompanyAdminPin] = useState<string>("1234");

  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [error, setError] = useState("");

  // جلب بيانات الشركة وضمان وجود رمز PIN للأدمن
  const loadCompanyData = async (ownerUid: string) => {
    try {
      setLoadingEmployees(true);
      setError("");

      // أ. جلب فحص رمز الأدمن المخصص
      const userDocRef = doc(db, "users", ownerUid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        if (data.adminPin) {
          setCompanyAdminPin(String(data.adminPin));
        } else {
          await updateDoc(userDocRef, { adminPin: "1234" });
          setCompanyAdminPin("1234");
        }
      } else {
        await setDoc(userDocRef, {
          email: auth.currentUser?.email || "",
          adminPin: "1234",
          status: "active",
          createdAt: serverTimestamp(),
        }, { merge: true });
        setCompanyAdminPin("1234");
      }

      // ب. جلب الموظفين التابعين لهذه الشركة حصراً عبر ownerUid
      const q = query(collection(db, "system_users"), where("ownerUid", "==", ownerUid));
      const snap = await getDocs(q);

      let list: SystemUser[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as SystemUser);
      });

      setEmployees(list);

      // 🎯 إذا كان الحساب جديداً أو بدون موظفين، ادخل مباشرة للوحة التحكم!
      if (list.length === 0) {
        const sessionData = JSON.stringify({ role: "admin", name: "مدير النظام" });
        sessionStorage.setItem("active_session", sessionData);
        localStorage.setItem("active_session", sessionData);
        
        window.location.href = "/dashboard";
        return;
      }

    } catch (err: any) {
      console.error("خطأ في جلب البيانات:", err);
      setError("حدث خطأ أثناء تحميل بيانات الشركة والموظفين.");
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setIsCompanyAuthenticated(true);
        await loadCompanyData(user.uid);
      } else {
        setIsCompanyAuthenticated(false);
        sessionStorage.removeItem("active_session");
        localStorage.removeItem("current_employee");
      }
    });

    return () => unsubscribe();
  }, []);

  // تسجيل دخول حساب الشركة
  const handleCompanyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    sessionStorage.removeItem("active_session");
    localStorage.removeItem("current_employee");

    try {
      const cleanEmail = companyEmail.trim().toLowerCase();

      if (isNewAccount) {
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, companyPassword);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          status: "pending",
          role: "user",
          adminPin: "1234",
          createdAt: serverTimestamp(),
        });

        window.location.href = "/pending";
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, companyPassword);
        const user = userCredential.user;

        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          if (userData.status === "suspended" || userData.status === "rejected" || userData.status === "pending") {
            await signOut(auth);
            setError(
              userData.status === "pending"
                ? "حساب الشركة قيد الانتظار ولم يتم تفعيله بعد."
                : "حساب الشركة موقوف أو معطل."
            );
            return;
          }
        }

        setIsCompanyAuthenticated(true);
        setSelectedEmpId("admin_owner");
        setEmpPinCode("");
        await loadCompanyData(user.uid);
      }
    } catch (err: any) {
      console.error(err);
      setError("البريد الإلكتروني أو كلمة المرور الخاصة بالشركة غير صحيحة.");
    } finally {
      setLoading(false);
    }
  };

  // دخول المستخدم (في حال وجود موظفين)
  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!empPinCode.trim()) {
      setError("يرجى إدخال الرمز السرّي أولاً.");
      return;
    }

    // 1. دخول مدير النظام (المالك)
    if (selectedEmpId === "admin_owner") {
      const validPin = companyAdminPin || "1234";
      if (empPinCode.trim() !== validPin) {
        setError("الرمز السرّي الخاص بالمالك غير صحيح! (الرمز الافتراضي: 1234)");
        return;
      }

      const sessionData = JSON.stringify({ role: "admin", name: "مدير النظام" });
      sessionStorage.setItem("active_session", sessionData);
      localStorage.setItem("active_session", sessionData);

      window.location.href = "/dashboard";
      return;
    }

    // 2. دخول موظف
    const matchedEmp = employees.find((emp) => emp.id === selectedEmpId);

    if (!matchedEmp) {
      setError("يرجى اختيار الموظف من القائمة.");
      return;
    }

    if (matchedEmp.password?.trim() !== empPinCode.trim()) {
      setError("الرمز السرّي الخاص بالموظف غير صحيح!");
      return;
    }

    const empData = JSON.stringify(matchedEmp);
    sessionStorage.setItem("active_session", empData);
    localStorage.setItem("active_session", empData);

    const perms = matchedEmp.permissions || {};
    let targetRoute = "/customers";

    if (perms.canViewDashboard) targetRoute = "/dashboard";
    else if (perms.canManageStore) targetRoute = "/inventory";
    else if (perms.canManageCustomers) targetRoute = "/customers";
    else if (perms.canViewTreasury) targetRoute = "/treasury";

    window.location.href = targetRoute;
  };

  const handleSwitchCompany = async () => {
    await signOut(auth);
    sessionStorage.removeItem("active_session");
    localStorage.removeItem("active_session");
    localStorage.removeItem("current_employee");
    setIsCompanyAuthenticated(false);
    setSelectedEmpId("admin_owner");
    setEmpPinCode("");
    setError("");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 relative overflow-hidden select-none dir-rtl font-sans">
      
      {/* خلفية الإضاءة الدائرية العصرية  */}
      <div className="absolute top-1/4 right-1/2 translate-x-1/2 w-[500px] h-[500px] bg-orange-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-red-500/10 rounded-full blur-[140px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-md bg-card/90 backdrop-blur-2xl border border-border/80 rounded-3xl shadow-2xl p-6 md:p-8 space-y-6 relative z-10"
      >
        {/* الترويسة والشعار */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-orange-500 to-red-500 shadow-lg shadow-orange-500/25 mb-1">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">منظومة أقساطك</h1>
          <p className="text-xs text-muted-foreground font-medium">
            {!isCompanyAuthenticated ? "تسجيل دخول المنظومة الماليّة " : "اختر المستخدم وأدخل رمز الأمان للبدء"}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 p-3.5 rounded-2xl text-xs text-center font-bold"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {!isCompanyAuthenticated ? (
          <form onSubmit={handleCompanyLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">البريد الإلكتروني للشركة</label>
              <div className="relative">
                <Mail className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  placeholder="admin@company.com"
                  className="w-full pr-11 pl-4 py-3.5 rounded-2xl border border-border bg-background text-foreground placeholder:text-muted-foreground/50 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">كلمة السر الخاصة بالشركة</label>
              <div className="relative">
                <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full pr-11 pl-4 py-3.5 rounded-2xl border border-border bg-background text-foreground placeholder:text-muted-foreground/50 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                  value={companyPassword}
                  onChange={(e) => setCompanyPassword(e.target.value)}
                  dir="ltr"
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-95 text-white py-3.5 rounded-2xl font-bold text-xs transition-all shadow-lg shadow-orange-500/20 flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isNewAccount ? "إنشاء حساب شركة جديد" : "ربط المنظومة الماليّة")}
            </motion.button>

            <div className="text-center text-xs pt-1">
              <button
                type="button"
                onClick={() => { setIsNewAccount(!isNewAccount); setError(""); }}
                className="text-muted-foreground hover:text-foreground font-bold transition-colors"
              >
                {isNewAccount ? "لديك حساب شركة بالفعل؟ تسجيل الدخول" : "أنشئ حساب شركة جديد للمكتب"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleEmployeeLogin} className="space-y-4">
            
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">الشركة متصلة بنجاح</span>
              </div>
              <button
                type="button"
                onClick={handleSwitchCompany}
                className="text-[11px] text-rose-500 hover:text-rose-600 font-bold flex items-center gap-1 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تغيير الشركة</span>
              </button>
            </div>

            {loadingEmployees ? (
              <div className="py-8 text-center text-orange-500 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-orange-500" />
                <p className="text-xs text-muted-foreground font-bold">جاري جلب بيانات الموظفين...</p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">اختر حساب الحضور / الموظف</label>
                  <div className="relative">
                    <UserCheck className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <select
                      value={selectedEmpId}
                      onChange={(e) => {
                        setSelectedEmpId(e.target.value);
                        setEmpPinCode("");
                        setError("");
                      }}
                      className="w-full pr-11 pl-4 py-3.5 rounded-2xl border border-border bg-background text-foreground text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500/50 cursor-pointer"
                    >
                      <option value="admin_owner">🔑 مدير النظام (المالك)</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          👤 {emp.name} ({emp.username || emp.email?.split("@")[0]})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">
                    {selectedEmpId === "admin_owner" ? "رمز PIN الخاص بالمالك" : "الرمز السرّي الخاص بالموظف"}
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="password"
                      required
                      placeholder={selectedEmpId === "admin_owner" ? "أدخل رمز PIN المالك..." : "أدخل الرمز السرّي..."}
                      className="w-full pr-11 pl-4 py-3.5 rounded-2xl border border-border bg-background text-foreground placeholder:text-muted-foreground/50 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                      value={empPinCode}
                      onChange={(e) => setEmpPinCode(e.target.value)}
                      dir="ltr"
                    />
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-95 text-white py-3.5 rounded-2xl font-bold text-xs transition-all shadow-lg shadow-orange-500/20 flex justify-center items-center gap-2 disabled:opacity-50 mt-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <>
                      <span>تأكيد ودخول المنظومة</span>
                      <ChevronRight className="w-4 h-4 rotate-180" />
                    </>
                  )}
                </motion.button>
              </>
            )}
          </form>
        )}
      </motion.div>
    </div>
  );
}