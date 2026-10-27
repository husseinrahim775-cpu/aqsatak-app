"use client";

import Sidebar from "../components/Sidebar";
import { ThemeProvider } from "../components/ThemeProvider";
import { AuthProvider, useAuth } from "../components/AuthProvider";
import SubscriptionGuard from "../components/SubscriptionGuard";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { signOut } from "firebase/auth";
import InstallmentCalculatorModal from "../components/InstallmentCalculatorModal";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, 
  Users, 
  Wallet, 
  Settings, 
  Moon, 
  Sun,
  LogOut,
  ShieldCheck,
  Vault,
  Package,
  BookOpen,
  MoreHorizontal,
  X,
  Calculator,
  FileText
} from "lucide-react";

function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth() as any;

  // 🎯 فحص شمول لكافة مسارات صفحة تسجيل الدخول وحالة الجلسة
  const isExplicitLogin = pathname === "/login" || pathname === "/login/";
  const isRootPage = pathname === "/";
  const isLoginPage = isExplicitLogin || (isRootPage && !user);

  // 1. 🟢 إخفاء القائمة الجانبية والأشرطة العلوية/السفلية تماماً في صفحة تسجيل الدخول
  if (isLoginPage) {
    return (
      <main className="w-full min-h-screen bg-background flex items-center justify-center p-0 m-0 overflow-hidden">
        {children}
      </main>
    );
  }

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [waveGlow, setWaveGlow] = useState(false);
  const [mobileLogo, setMobileLogo] = useState<string>("/logo.png");

  // إيميل الأدمن الرئيسي
  const ADMIN_EMAIL = "admin@aqsatak.com";

  // 🔄 1. الاستماع الحي للشعار المرفوع وتحديث الشعار، Favicon، وأيقونة الآيفون للشاشة الرئيسية
  useEffect(() => {
    const unsubLogo = onSnapshot(
      doc(db, "settings", "global"), 
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().systemLogoUrl) {
          const newLogoUrl = docSnap.data().systemLogoUrl;
          setMobileLogo(newLogoUrl);

          // 1. تحديث favicon المتصفحات العادية
          let faviconLink: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
          if (!faviconLink) {
            faviconLink = document.createElement("link");
            faviconLink.rel = "shortcut icon";
            document.getElementsByTagName("head")[0].appendChild(faviconLink);
          }
          faviconLink.href = newLogoUrl;

          // 2. 📱 تحديث أيقونة الشاشة الرئيسية لأجهزة الآيفون (apple-touch-icon)
          let appleIconLink: HTMLLinkElement | null = document.querySelector("link[rel='apple-touch-icon']");
          if (!appleIconLink) {
            appleIconLink = document.createElement("link");
            appleIconLink.rel = "apple-touch-icon";
            document.getElementsByTagName("head")[0].appendChild(appleIconLink);
          }
          appleIconLink.href = newLogoUrl;
        }
      },
      (error) => {
        if (error.code === "permission-denied") return;
      }
    );

    return () => unsubLogo();
  }, []);

  // 🔄 2. المراقبة الحية لحالة الحساب وتأكيد التفعيل
  useEffect(() => {
    if (!user || isLoginPage) return;

    let unsubscribeDoc = () => {};

    try {
      const userDocRef = doc(db, "users", user.uid);
      unsubscribeDoc = onSnapshot(userDocRef, { includeMetadataChanges: true }, async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const now = new Date();
          
          const expiryDate = data.expiresAt?.toDate 
            ? data.expiresAt.toDate() 
            : (data.expiresAt ? new Date(data.expiresAt) : null);

          const status = data.status;

          if (status === "suspended" || status === "rejected" || (expiryDate && now > expiryDate)) {
            let message = "تم إيقاف حسابك. يرجى التواصل مع الإدارة للتجديد.";
            if (expiryDate && now > expiryDate) message = "انتهت مدة اشتراكك. يرجى تجديد الاشتراك للتمكن من الاستمرار.";
            if (status === "rejected") message = "تم رفض طلب انضمامك للنظام.";

            alert(message);
            if (logout) await logout();
            await signOut(auth);
            router.replace("/login");
          } 
          else if (status !== "active" && pathname !== "/pending") {
            router.replace("/pending");
          }
        } else {
          if (pathname !== "/pending" && navigator.onLine) {
            router.replace("/pending");
          }
        }
      }, (error) => {
        if (error.code === "permission-denied") return;
        console.warn("وضع الأوفلاين أو تعذر الاتصال المباشر بـ Firebase:", error);
      });
    } catch (e) {
      console.warn("خطأ في تشغيل استماع Firestore:", e);
    }

    return () => unsubscribeDoc();
  }, [user, pathname, router, logout, isLoginPage]);

  // 3. التحكم في الوضع الليلي وتأثير الحركة عند تنقل الصفحات
  useEffect(() => {
    if (document.documentElement.classList.contains('dark')) {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    setWaveGlow(true);
    const timer = setTimeout(() => setWaveGlow(false), 800);
    return () => clearTimeout(timer);
  }, [pathname]);

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
      try {
        sessionStorage.clear();
        localStorage.clear();
        if (logout) await logout();
        await signOut(auth);
        window.location.replace("/login");
      } catch (e) {
        window.location.replace("/login");
      }
    }
  };

  const baseNavItems = [
    { name: "الرئيسية", href: "/dashboard", icon: LayoutDashboard },
    { name: "العملاء", href: "/customers", icon: Users },
    { name: "الحسابات", href: "/accounts", icon: Wallet },
  ];

  // 📱 الأقسام الشاملة التي تظهر عند الضغط على "المزيد" بأسفل الهاتف
  const extraNavItems = [
    { name: "التقارير المالية", href: "/reports", icon: FileText },
    { name: "الخزينة والصندوق", href: "/treasury", icon: Vault },
    { name: "المخزن والمبيعات", href: "/inventory", icon: Package },
    { name: "سجل الديون", href: "/debts", icon: BookOpen },
    { name: "الإعدادات", href: "/settings", icon: Settings },
  ];

  const isAdmin = user?.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  if (isAdmin) {
    extraNavItems.push({ name: "لوحة الإدارة", href: "/admin", icon: ShieldCheck });
  }

  return (
    <>
      {/* 🧮 النافذة المنبثقة لحاسبة الأقساط */}
      <InstallmentCalculatorModal 
        isOpen={isCalcOpen} 
        onClose={() => setIsCalcOpen(false)} 
      />

      {/* 1. الشريط العلوي للموبايل */}
      <div className="md:hidden flex items-center justify-between bg-card/80 backdrop-blur-xl border-b border-border p-4 shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-2 font-extrabold text-xl text-theme-primary tracking-tight">
          <img src={mobileLogo} alt="أقساطك" className="w-8 h-8 rounded-2xl object-cover shadow-sm border border-theme-primary/20 bg-white p-0.5" />
          <span className="bg-theme-gradient bg-clip-text text-transparent font-black">أقساطك</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCalcOpen(true)}
            className="p-2.5 bg-theme-primary/10 border border-theme-primary/20 rounded-2xl text-theme-primary hover:bg-theme-primary/20 transition-all active:scale-95 flex items-center gap-1 font-bold text-xs"
            title="حاسبة الأقساط"
          >
            <Calculator className="w-5 h-5 text-theme-primary" />
          </button>

          <button 
            onClick={toggleTheme}
            className="p-2.5 bg-background/80 border border-border rounded-2xl text-foreground hover:bg-border/50 transition-all active:scale-95 shadow-sm"
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-indigo-500" />}
          </button>

          <button 
            onClick={handleLogout}
            className="p-2.5 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl text-red-500 hover:bg-red-100 transition-all active:scale-95"
            title="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. القائمة الجانبية للشاشات الكبيرة */}
      <div className="hidden md:block sticky top-0 h-screen w-20 z-50">
        <Sidebar />
      </div>

      {/* 3. المحتوى الرئيسي لجميع صفحات النظام */}
      <main className="flex-1 w-full overflow-y-auto p-4 pb-24 md:p-8 md:pb-8 transition-all duration-300">
        <div className={`max-w-7xl mx-auto h-full space-y-4 rounded-3xl transition-all duration-500 ${waveGlow ? 'tab-wave-active' : ''}`}>
          
          <div className="hidden md:flex justify-between items-center mb-4 pb-3 border-b border-border/50">
            <div className="flex items-center gap-1.5 bg-card/80 backdrop-blur-md p-1.5 rounded-full border border-border shadow-sm">
              {[
                { name: "الرئيسية", href: "/dashboard" },
                { name: "العملاء", href: "/customers" },
                { name: "الحسابات", href: "/accounts" },
                { name: "التقارير", href: "/reports" },
                { name: "الخزينة", href: "/treasury" },
                { name: "المخزن", href: "/inventory" },
                { name: "الديون", href: "/debts" },
              ].map((tab) => {
                const isActive = pathname.startsWith(tab.href);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
                      isActive 
                        ? "bg-theme-gradient text-white shadow-sm shadow-primary/20" 
                        : "text-muted-foreground hover:text-foreground hover:text-theme-primary"
                    }`}
                  >
                    {tab.name}
                  </Link>
                );
              })}
            </div>

            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsCalcOpen(true)}
              className="flex items-center gap-2.5 px-4 py-2 bg-card/90 backdrop-blur-md border border-theme-primary/30 hover:border-theme-primary text-theme-primary rounded-2xl font-bold text-xs shadow-sm hover:shadow-primary/10 transition-all group"
            >
              <div className="p-1 bg-theme-primary/10 rounded-lg group-hover:bg-theme-primary/20 transition-colors">
                <Calculator className="w-3.5 h-3.5 text-theme-primary" />
              </div>
              <span>حاسبة الأقساط</span>
            </motion.button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {/* 🛡️ تغليف الصفحات بحماية حارس الاشتراك */}
              <SubscriptionGuard>
                {children}
              </SubscriptionGuard>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* 4. النافذة المنبثقة "المزيد" للهاتف */}
      <AnimatePresence>
        {showMoreMenu && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden flex flex-col justify-end"
            onClick={() => setShowMoreMenu(false)}
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card border-t border-border rounded-t-3xl p-5 space-y-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center border-b border-border pb-3">
                <h3 className="font-bold text-foreground text-sm">بقية أقسام المنظومة</h3>
                <button 
                  onClick={() => setShowMoreMenu(false)} 
                  className="p-1.5 rounded-full hover:bg-secondary text-gray-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {extraNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setShowMoreMenu(false)}
                      className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
                        isActive 
                          ? "bg-theme-primary/10 border-theme-primary text-theme-primary font-bold" 
                          : "bg-secondary/40 border-border text-foreground hover:bg-secondary"
                      }`}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span className="text-xs font-bold">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. الشريط السفلي للموبايل */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card/85 backdrop-blur-xl border-t border-border shadow-2xl z-40 px-3 pb-safe">
        <nav className="flex items-center justify-around py-2">
          {baseNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className="relative flex flex-col items-center justify-center w-14 h-14 transition-all duration-300"
              >
                <div 
                  className={`absolute top-1 w-10 h-10 rounded-2xl transition-all duration-300 ${
                    isActive 
                      ? 'bg-theme-primary/15 backdrop-blur-sm border border-theme-primary/30 scale-100 opacity-100 shadow-sm' 
                      : 'scale-50 opacity-0'
                  }`} 
                />
                
                <Icon 
                  className={`w-5 h-5 relative z-10 transition-all duration-300 ${
                    isActive ? "text-theme-primary translate-y-[2px]" : "text-gray-400"
                  }`} 
                />
                
                <span 
                  className={`text-[10px] font-medium mt-1 relative z-10 transition-all duration-300 ${
                    isActive ? "text-theme-primary font-bold" : "text-gray-400 opacity-70"
                  }`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="relative flex flex-col items-center justify-center w-14 h-14 transition-all duration-300"
          >
            <div 
              className={`absolute top-1 w-10 h-10 rounded-2xl transition-all duration-300 ${
                extraNavItems.some(i => pathname === i.href || pathname.startsWith(`${i.href}/`)) || showMoreMenu
                  ? 'bg-theme-primary/15 backdrop-blur-sm border border-theme-primary/30 scale-100 opacity-100 shadow-sm' 
                  : 'scale-50 opacity-0'
              }`} 
            />

            <MoreHorizontal 
              className={`w-5 h-5 relative z-10 transition-all duration-300 ${
                extraNavItems.some(i => pathname === i.href || pathname.startsWith(`${i.href}/`)) || showMoreMenu
                  ? "text-theme-primary translate-y-[2px]" 
                  : "text-gray-400"
              }`} 
            />

            <span 
              className={`text-[10px] font-medium mt-1 relative z-10 transition-all duration-300 ${
                extraNavItems.some(i => pathname === i.href || pathname.startsWith(`${i.href}/`)) || showMoreMenu
                  ? "text-theme-primary font-bold" 
                  : "text-gray-400 opacity-70"
              }`}
            >
              المزيد
            </span>
          </button>
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