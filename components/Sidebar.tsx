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
  { name: 'الإعدادات', path: '/settings', icon: Settings, permissionKey: 'allowAll' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, userData, logout } = useAuth() as any;
  const [mounted, setMounted] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>("/logo.png");

  const ADMIN_EMAIL = "admin@aqsatak.com";

  useEffect(() => {
    setMounted(true);
  }, []);

  // 🔄 الاستماع الحي للشعار المرفوع من Firestore
  useEffect(() => {
    const unsubLogo = onSnapshot(
      doc(db, "settings", "global"), 
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().systemLogoUrl) {
          setLogoUrl(docSnap.data().systemLogoUrl);
        }
      },
      (error) => {
        if (error.code === "permission-denied") return;
        console.warn("تعذر تحميل الشعار الحي:", error);
      }
    );

    return () => unsubLogo();
  }, []);

  // 🚪 دالة تسجيل الخروج
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

  // ☀️/🌙 التبديل السريع بين الوضع النهاري والداكن
  const toggleDarkLight = () => {
    const nextMode = theme === "dark" ? "light" : "dark";
    setTheme(nextMode);
  };

  const isEmployee = userData?.role === "employee";
  const userPermissions = userData?.permissions || {};

  const visibleMenuItems = allMenuItems.filter((item) => {
    if (!isEmployee) return true;
    if (item.permissionKey === "allowAll") return true;
    const permKey = item.permissionKey as keyof typeof userPermissions;
    return userPermissions?.[permKey] ?? false;
  });

  return (
    <aside className="w-20 bg-card/90 backdrop-blur-2xl border-l border-border h-screen sticky top-0 flex flex-col justify-between items-center py-6 shadow-sm select-none z-50">
      
      {/* 1. الشعار والأيقونات */}
      <div className="flex flex-col items-center gap-7 w-full">
        <div className="w-11 h-11 rounded-2xl p-0.5 bg-theme-gradient shadow-md shadow-primary/20 flex items-center justify-center overflow-hidden">
          <img 
            src={logoUrl} 
            alt="أقساطك" 
            className="w-full h-full object-contain rounded-xl bg-white p-0.5"
          />
        </div>
        
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
                      ? "bg-theme-gradient text-white shadow-lg shadow-primary/25" 
                      : "text-foreground/70 hover:bg-secondary hover:text-theme-primary"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  
                  {isActive && (
                    <motion.div 
                      layoutId="activeSideDot"
                      className="absolute -right-3 top-1/2 -translate-y-1/2 w-1.5 h-5 bg-theme-gradient rounded-l-full"
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    />
                  )}
                </motion.div>

                <span className="absolute right-16 top-1/2 -translate-y-1/2 bg-foreground text-background text-[11px] font-bold px-2.5 py-1 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md whitespace-nowrap z-50">
                  {item.name}
                </span>
              </Link>
            );
          })}

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

      {/* 2. الأزرار السفلية (الوضع النهاري/الداكن + تسجيل الخروج) */}
      {mounted && (
        <div className="flex flex-col gap-3 items-center w-full px-3">
          
          {/* زر التبديل المباشر بين النهار والليل فقط */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={toggleDarkLight}
            className="p-3.5 rounded-2xl border border-border bg-secondary/80 text-foreground hover:text-theme-primary transition-all shadow-sm cursor-pointer"
            title={theme === "dark" ? "التحويل للوضع النهاري" : "التحويل للوضع الداكن"}
          >
            {theme === "dark" ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-purple-400" />}
          </motion.button>

          {/* زر تسجيل الخروج */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={handleLogout}
            className="p-3.5 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all cursor-pointer"
            title="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5" />
          </motion.button>
        </div>
      )}
    </aside>
  );
}