"use client";

import Sidebar from "../components/Sidebar";
import { ThemeProvider } from "../components/ThemeProvider";
import { AuthProvider, useAuth } from "../components/AuthProvider";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { auth, db } from "../services/firebase"; // تأكد من صحة مسار firebase لديك
import { signOut } from "firebase/auth";
import { 
  LayoutDashboard, 
  Users, 
  Wallet, 
  Settings, 
  Moon, 
  Sun,
  LogOut,
  ShieldCheck
} from "lucide-react";

function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth() as any;
  const isLoginPage = pathname === "/login";
  const isPendingPage = pathname === "/pending";
  const [isDarkMode, setIsDarkMode] = useState(false);

  const ADMIN_EMAIL = "admin@aqsatak.com";

  // 🔄 1. المراقبة الحية لحالة الحساب وتاريخ الاشتراك
  useEffect(() => {
    if (!user || isLoginPage) return;

    // استماع حي لمستند المستخدم في Firestore
    const userDocRef = doc(db, "users", user.uid);
    const unsubscribeDoc = onSnapshot(userDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const now = new Date();
        
        // تحويل تاريخ الانتهاء سواء كان Timestamp أو Date
        const expiryDate = data.expiresAt?.toDate 
          ? data.expiresAt.toDate() 
          : (data.expiresAt ? new Date(data.expiresAt) : null);

        const isSuspended = data.status === "suspended";
        const isRejected = data.status === "rejected";
        const isPending = data.status === "pending";
        const isExpired = expiryDate && now > expiryDate;

        // 🛡️ إذا انتهت صلاحيته أو تم إيقافه/رفضه
        if (isSuspended || isRejected || isExpired) {
          let message = "تم إيقاف حسابك. يرجى التواصل مع الإدارة للتجديد.";
          if (isExpired) message = "انتهت مدة اشتراكك. يرجى تجديد الاشتراك للتمكن من الاستمرار.";
          if (isRejected) message = "تم رفض طلب انضمامك للنظام.";

          alert(message);
          if (logout) await logout();
          await signOut(auth);
          router.push("/login");
        } 
        // ⏳ إذا كان الحساب قيد الانتظار ويحاول التصفح
        else if (isPending && !isPendingPage) {
          router.push("/pending");
        }
      }
    }, (error) => {
      console.error("خطأ في المراقبة الحية للحساب:", error);
    });

    return () => unsubscribeDoc();
  }, [user, pathname, router, logout, isLoginPage, isPendingPage]);

  // 2. التحكم في الوضع الليلي
  useEffect(() => {
    if (document.documentElement.classList.contains('dark')) {
      setIsDarkMode(true);
    }
  }, []);

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

  const handleLogout = async () => {
    if (window.confirm("هل أنت متأكد من تسجيل الخروج؟")) {
      if (logout) await logout();
    }
  };

  const navItems = [
    { name: "الرئيسية", href: "/dashboard", icon: LayoutDashboard },
    { name: "العملاء", href: "/customers", icon: Users },
    { name: "الحسابات", href: "/accounts", icon: Wallet },
    { name: "الإعدادات", href: "/settings", icon: Settings },
  ];

  if (user?.email === ADMIN_EMAIL) {
    navItems.push({ name: "الإدارة", href: "/admin", icon: ShieldCheck });
  }

  if (isLoginPage) {
    return <main className="flex-1 w-full">{children}</main>;
  }

  return (
    <>
      {/* 1. الشريط العلوي للموبايل */}
      <div className="md:hidden flex items-center justify-between bg-card/80 backdrop-blur-md border-b border-border p-4 shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-2 font-extrabold text-xl text-primary tracking-tight">
          <img src="/logo.png" alt="أقساطك" className="w-7 h-7 rounded-lg object-cover" />
          <span>أقساطك</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleTheme}
            className="p-2 bg-background border border-border rounded-xl text-foreground hover:bg-border/50 transition-all active:scale-95"
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-indigo-500" />}
          </button>
          <button 
            onClick={handleLogout}
            className="p-2 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl text-red-500 hover:bg-red-100 transition-all active:scale-95"
            title="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. القائمة الجانبية للشاشات الكبيرة */}
      <div className="hidden md:block sticky top-0 h-screen w-64 z-50">
        <Sidebar />
      </div>

      {/* 3. المحتوى الرئيسي */}
      <main className="flex-1 w-full overflow-y-auto p-4 pb-24 md:p-8 md:pb-8 transition-all duration-300">
        <div className="max-w-7xl mx-auto h-full">
          {children}
        </div>
      </main>

      {/* 4. الشريط السفلي للموبايل */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-md border-t border-border shadow-lg z-50 px-2 pb-safe">
        <nav className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className="relative flex flex-col items-center justify-center w-14 h-14 transition-all duration-300"
              >
                <div 
                  className={`absolute top-1 w-9 h-9 rounded-xl transition-all duration-300 ${
                    isActive 
                      ? 'bg-primary/10 backdrop-blur-sm border border-primary/20 scale-100 opacity-100 shadow-sm' 
                      : 'scale-50 opacity-0'
                  }`} 
                />
                
                <Icon 
                  className={`w-6 h-6 relative z-10 transition-all duration-300 ${
                    isActive ? "text-primary translate-y-[2px]" : "text-gray-400"
                  }`} 
                />
                
                <span 
                  className={`text-[10px] font-medium mt-1 relative z-10 transition-all duration-300 ${
                    isActive ? "text-primary opacity-100 font-semibold" : "text-gray-400 opacity-70"
                  }`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppLayout>{children}</AppLayout>
      </AuthProvider>
    </ThemeProvider>
  );
}