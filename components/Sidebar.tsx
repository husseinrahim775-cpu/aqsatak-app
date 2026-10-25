"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "./AuthProvider";
import { motion } from "framer-motion";
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Settings, 
  ShieldCheck, 
  Sun, 
  Moon,
  LogOut,
  Wallet,
  Package,
  Vault,
  FileText
} from "lucide-react";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../services/firebase";
import { signOut } from "firebase/auth";

const allMenuItems = [
  { name: 'لوحة التحكم', path: '/dashboard', icon: LayoutDashboard, permissionKey: 'canViewDashboard' },
  { name: 'العملاء والأقساط', path: '/customers', icon: Users, permissionKey: 'canManageCustomers' },
  { name: 'الحسابات والمدفوعات', path: '/accounts', icon: CreditCard, permissionKey: 'canManageCustomers' },
  { name: 'التقارير المالية', path: '/reports', icon: FileText, permissionKey: 'canViewDashboard' },
  { name: 'الخزينة والصندوق', path: '/treasury', icon: Vault, permissionKey: 'canViewTreasury' },
  { name: 'المخزن والمبيعات', path: '/inventory', icon: Package, permissionKey: 'canManageStore' },
  { name: 'سجل الديون', path: '/debts', icon: Wallet, permissionKey: 'canManageCustomers' }, 
  { name: 'الإعدادات', path: '/settings', icon: Settings, permissionKey: 'isAdminOnly' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, userData, logout } = useAuth() as any;
  const [mounted, setMounted] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>("/logo.png");

  const ADMIN_EMAIL = "admin@aqsatak.com";

  // 🔄 الاستماع الحي للشعار المرفوع من Firestore مع حماية الخطأ
  useEffect(() => {
    setMounted(true);

    const unsubLogo = onSnapshot(
      doc(db, "settings", "global"), 
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().systemLogoUrl) {
          setLogoUrl(docSnap.data().systemLogoUrl);
        }
      },
      (error) => {
        // تجاهل أخطاء الصلاحيات أثناء الخروج
        if (error.code === "permission-denied") return;
        console.warn("تعذر تحميل الشعار الحي:", error);
      }
    );

    return () => unsubLogo();
  }, []);

  // 🚪 دالة تسجيل الخروج النظيفة
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

  const isEmployee = userData?.role === "employee";
  const userPermissions = userData?.permissions || {};

  const visibleMenuItems = allMenuItems.filter((item) => {
    if (!isEmployee) return true;
    if (item.permissionKey === "isAdminOnly") return false;
    const permKey = item.permissionKey as keyof typeof userPermissions;
    return userPermissions?.[permKey] ?? false;
  });

  return (
    <aside className="w-20 bg-card/90 backdrop-blur-2xl border-l border-border h-screen sticky top-0 flex flex-col justify-between items-center py-6 shadow-sm select-none z-50">
      
      {/* 1. الشعار والأيقونات */}
      <div className="flex flex-col items-center gap-7 w-full">
        {/* الشعار الديناميكي V14 المربوط بـ Firestore */}
        <div className="w-11 h-11 rounded-2xl p-0.5 bg-gradient-to-tr from-orange-500 to-red-500 shadow-md shadow-orange-500/20 flex items-center justify-center overflow-hidden">
          <img 
            src={logoUrl} 
            alt="أقساطك" 
            className="w-full h-full object-contain rounded-xl bg-white p-0.5"
          />
        </div>
        
        {/* أيقونات التنقل المصغرة مع التلميح (Tooltip) */}
        <nav className="flex flex-col gap-3 w-full px-3">
          {visibleMenuItems.map((item) => {
            const isActive = pathname.startsWith(item.path);
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.path} 
                href={item.path}
                title={item.name}
                className="relative flex justify-center group"
              >
                <motion.div
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className={`p-3.5 rounded-2xl transition-all duration-300 relative ${
                    isActive 
                      ? "bg-gradient-to-tr from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25" 
                      : "text-foreground/70 hover:bg-secondary hover:text-orange-500"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  
                  {/* شريط الإضاءة المعتمد للتبويب النشط */}
                  {isActive && (
                    <motion.div 
                      layoutId="activeSideDot"
                      className="absolute -right-3 top-1/2 -translate-y-1/2 w-1.5 h-5 bg-orange-500 rounded-l-full"
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    />
                  )}
                </motion.div>

                {/* نص مساعدة يظهر عند تحريك الماوس (Hover Label) */}
                <span className="absolute right-16 top-1/2 -translate-y-1/2 bg-foreground text-background text-[11px] font-bold px-2.5 py-1 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md whitespace-nowrap z-50">
                  {item.name}
                </span>
              </Link>
            );
          })}

          {/* زر الأدمن المصغر */}
          {(!isEmployee && user?.email === ADMIN_EMAIL) && (
            <div className="pt-2 border-t border-border/60 flex justify-center w-full">
              <Link href="/admin" title="إدارة الحسابات" className="relative group">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className={`p-3.5 rounded-2xl transition-all duration-300 ${
                    pathname.startsWith("/admin")
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-500/25"
                      : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                  }`}
                >
                  <ShieldCheck className="w-5 h-5" />
                </motion.div>
              </Link>
            </div>
          )}
        </nav>
      </div>
      

      {/* 2. الأزرار السفلية (الوضع الليلي وتسجيل الخروج) */}
      {mounted && (
        <div className="flex flex-col gap-3 items-center w-full px-3">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-3.5 rounded-2xl border border-border bg-background/80 text-foreground hover:bg-secondary transition-all shadow-sm"
            title={theme === "dark" ? "الوضع النهاري" : "الوضع الليلي"}
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5 text-amber-500" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-500" />
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={handleLogout}
            className="p-3.5 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
            title="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5" />
          </motion.button>
        </div>
      )}
    </aside>
  );
}