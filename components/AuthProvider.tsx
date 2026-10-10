"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

interface AuthContextType {
  user: User | null;
  userData: any | null; 
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const logout = async () => {
    sessionStorage.removeItem("active_session");
    localStorage.removeItem("current_employee");
    await signOut(auth);
    setUser(null);
    setUserData(null);
    router.push("/login");
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // 1. إذا لم يكن متصلاً بالشركة إطلاقاً، توجيهه لصفحة اللوجن
      if (!currentUser) {
        setUser(null);
        setUserData(null);
        sessionStorage.removeItem("active_session");
        setLoading(false);
        if (pathname !== "/login") {
          router.push("/login");
        }
        return;
      }

      setUser(currentUser);

      // 2. 🚨 الشرط الأهم: الفحص إن كان قد اختار الموظف أو المدير من القائمة
      const activeSession = sessionStorage.getItem("active_session");

      if (!activeSession) {
        // إذا لم يحدد الموظف أو المدير بعد، ابقه في صفحة اللوجن ولا تحوله أبداً للداشبورد!
        setUserData(null);
        setLoading(false);
        if (pathname !== "/login") {
          router.push("/login");
        }
        return;
      }

      // 3. إذا اختار حسابه، يكتمل تسجيل دخوله للوحة التحكم وتحديد الصفحة المناسبة
      try {
        const empObj = JSON.parse(activeSession);
        
        if (empObj.role === "admin") {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            setUserData({ ...userDoc.data(), role: "admin", status: "active" });
          } else {
            setUserData({ role: "admin", status: "active" });
          }

          if (pathname === "/login" || pathname === "/pending") {
            router.replace("/dashboard");
          }
        } else {
          // حساب الموظف
          setUserData({
            ...empObj,
            status: "active",
            role: "employee",
          });

          if (pathname === "/login" || pathname === "/pending") {
            // 🎯 توجيه الموظف الذكي لأول قسم يملك صلاحية دخوله بدلاً من التوجيه الإجباري للداشبورد
            const perms = empObj.permissions || {};
            let targetPath = "/dashboard";

            if (perms.canViewDashboard) {
              targetPath = "/dashboard";
            } else if (perms.canManageCustomers) {
              targetPath = "/customers";
            } else if (perms.canManageStore) {
              targetPath = "/inventory";
            } else if (perms.canViewTreasury) {
              targetPath = "/treasury";
            } else {
              targetPath = "/customers"; // صفحة افتراضية للعملاء
            }

            router.replace(targetPath);
          }
        }
      } catch (error) {
        console.error("خطأ قراءة الجلسة:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [pathname]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background text-primary">
        <Loader2 className="w-12 h-12 animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, userData, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}