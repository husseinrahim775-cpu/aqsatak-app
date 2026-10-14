"use client";

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../../services/firebase";
import { Loader2, Lock, Mail, ShieldCheck, LogOut, KeyRound, UserCheck, Shield, ChevronRight } from "lucide-react";
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

      // 🎯 التعديل الجوهري: إذا كان الحساب جديداً أو بدون موظفين، ادخل مباشرة للوحة التحكم!
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
    <div className="min-h-screen w-full flex items-center justify-center bg-radial from-slate-900 via-zinc-950 to-black p-4 relative overflow-hidden select-none">
      
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-zinc-900/80 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-8 space-y-6 relative z-10 animate-in fade-in zoom-in-95 duration-300">
        
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary to-blue-500 shadow-lg shadow-primary/25 mb-1">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">أقساطك</h1>
          <p className="text-xs text-zinc-400 font-medium">
            {!isCompanyAuthenticated ? "تسجيل دخول المنظومة الماليّة" : "اختر المستخدم وأدخل رمز الأمان للبدء"}
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-2xl text-xs text-center font-bold animate-in slide-in-from-top-2 duration-200">
            {error}
          </div>
        )}

        {!isCompanyAuthenticated ? (
          <form onSubmit={handleCompanyLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">البريد الإلكتروني للشركة</label>
              <div className="relative">
                <Mail className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="email"
                  required
                  placeholder="admin@company.com"
                  className="w-full pr-10 pl-4 py-3 rounded-2xl border border-white/10 bg-zinc-950/50 text-white placeholder:text-zinc-600 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400">كلمة سر الشركة</label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full pr-10 pl-4 py-3 rounded-2xl border border-white/10 bg-zinc-950/50 text-white placeholder:text-zinc-600 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all font-mono"
                  value={companyPassword}
                  onChange={(e) => setCompanyPassword(e.target.value)}
                  dir="ltr"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white py-3.5 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-primary/20 flex justify-center items-center gap-2 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isNewAccount ? "إنشاء حساب شركة" : "ربط المنظومة")}
            </button>

            <div className="text-center text-xs pt-1">
              <button
                type="button"
                onClick={() => { setIsNewAccount(!isNewAccount); setError(""); }}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                {isNewAccount ? "لديك حساب شركة بالفعل؟ تسجيل الدخول" : "أنشئ حساب شركة جديد للمكتب"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleEmployeeLogin} className="space-y-4">
            
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-emerald-300">الشركة متصلة بنجاح</span>
              </div>
              <button
                type="button"
                onClick={handleSwitchCompany}
                className="text-[11px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 transition-colors"
              >
                <LogOut className="w-3 h-3" />
                <span>تغيير الشركة</span>
              </button>
            </div>

            {loadingEmployees ? (
              <div className="py-8 text-center text-primary">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                <p className="text-xs text-zinc-500 mt-2">جاري جلب بيانات الموظفين...</p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">اختر حساب الحضور / الموظف</label>
                  <div className="relative">
                    <UserCheck className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <select
                      value={selectedEmpId}
                      onChange={(e) => {
                        setSelectedEmpId(e.target.value);
                        setEmpPinCode("");
                        setError("");
                      }}
                      className="w-full pr-10 pl-4 py-3 rounded-2xl border border-white/10 bg-zinc-950/70 text-white text-sm font-bold outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
                    >
                      <option value="admin_owner" className="bg-zinc-900 text-white">🔑 مدير النظام (المالك)</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id} className="bg-zinc-900 text-white">
                          👤 {emp.name} ({emp.username || emp.email?.split("@")[0]})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400">
                    {selectedEmpId === "admin_owner" ? "رمز PIN الخاص بالمالك" : "الرمز السرّي الخاص بالموظف"}
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="password"
                      required
                      placeholder={selectedEmpId === "admin_owner" ? "أدخل رمز PIN المالك..." : "أدخل الرمز السرّي..."}
                      className="w-full pr-10 pl-4 py-3 rounded-2xl border border-white/10 bg-zinc-950/50 text-white placeholder:text-zinc-600 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      value={empPinCode}
                      onChange={(e) => setEmpPinCode(e.target.value)}
                      dir="ltr"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white py-3.5 rounded-2xl font-bold text-sm transition-all shadow-lg shadow-primary/20 flex justify-center items-center gap-2 active:scale-[0.98] disabled:opacity-50 mt-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <>
                      <span>تأكيد ودخول المنظومة</span>
                      <ChevronRight className="w-4 h-4 rotate-180" />
                    </>
                  )}
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}