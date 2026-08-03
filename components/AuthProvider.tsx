"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

// إضافة بيانات المستخدم الإضافية (مثل الحالة والصلاحية) للسياق
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

  // دالة تسجيل الخروج
  const logout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        // جلب بيانات المستخدم من Firestore لمعرفة حالته (pending/active)
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);

          // نظام توجيه الأمان (Security Routing)
          if (data.status === "pending" && pathname !== "/pending") {
            router.push("/pending"); // اطرده لصفحة الانتظار
          } else if (data.status === "active" && (pathname === "/login" || pathname === "/pending")) {
            router.push("/dashboard"); // اسمح له بالدخول
          }
        } else {
          setUserData(null);
        }
      } else {
        // إذا لم يكن مسجلاً
        setUser(null);
        setUserData(null);
        if (pathname !== "/login") {
          router.push("/login");
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [pathname, router]);

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