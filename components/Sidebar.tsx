"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useAuth } from "./AuthProvider";
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
  Loader2
} from "lucide-react";
import { useEffect, useState } from "react";

// جميع النوافذ المتاحة بالنظام مفلترة بحسب الصلاحيات
const allMenuItems = [
  { name: 'لوحة التحكم', path: '/dashboard', icon: LayoutDashboard, permissionKey: 'canViewDashboard' },
  { name: 'العملاء والأقساط', path: '/customers', icon: Users, permissionKey: 'canManageCustomers' },
  { name: 'الحسابات والمدفوعات', path: '/accounts', icon: CreditCard, permissionKey: 'canManageCustomers' }, // 👈 المسار الفعلي /accounts
  { name: 'الخزينة والصندوق', path: '/treasury', icon: Vault, permissionKey: 'canViewTreasury' },
  { name: 'المخزن والمبيعات', path: '/inventory', icon: Package, permissionKey: 'canManageStore' }, // 👈 المسار الفعلي /inventory
  { name: 'سجل الديون', path: '/debts', icon: Wallet, permissionKey: 'canManageCustomers' }, 
  { name: 'الإعدادات', path: '/settings', icon: Settings, permissionKey: 'isAdminOnly' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, userData, logout } = useAuth() as any;
  const [mounted, setMounted] = useState(false);

  const ADMIN_EMAIL = "admin@aqsatak.com";

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    if (window.confirm("هل أنت متأكد من تسجيل الخروج؟")) {
      if (logout) await logout();
    }
  };

  // 🎯 تحديد ما إذا كان المستخدم الحالي موظفاً أم مالك الحساب الرئيسي
  const isEmployee = userData?.role === "employee";
  const userPermissions = userData?.permissions || {};

  // 🎯 تصفية القائمة الجانبية بناءً على نوع المستخدم والجلسة النشطة
  const visibleMenuItems = allMenuItems.filter((item) => {
    // 1. إذا كان أدمن رئيسي (ليس موظفاً)، تُعرض كل القوائم
    if (!isEmployee) {
      return true;
    }

    // 2. إذا كان موظفاً، تُخفى شاشة الإعدادات دائماً
    if (item.permissionKey === "isAdminOnly") {
      return false;
    }

    // 3. فحص الجدول الخاص بالصلاحيات المسندة للموظف
    const permKey = item.permissionKey as keyof typeof userPermissions;
    return userPermissions?.[permKey] ?? false;
  });

  return (
    <aside className="w-64 bg-card border-l border-border h-screen sticky top-0 flex flex-col justify-between p-4 shadow-sm select-none">
      
      <div>
        {/* اسم النظام والشعار */}
        <div className="mb-8 mt-4 text-center">
          <h2 className="text-3xl font-extrabold text-primary">أقساطك</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
            {isEmployee ? `حساب موظف: ${userData?.name || "الموظف"}` : "نظام الإدارة المالي"}
          </p>
        </div>
        
        {/* روابط التنقل المفلترة حسب الصلاحيات */}
        <nav className="flex flex-col gap-2">
          {visibleMenuItems.map((item) => {
            const isActive = pathname.startsWith(item.path);
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.path} 
                href={item.path}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-md font-bold" 
                    : "text-foreground hover:bg-border/50 hover:text-primary font-medium"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-base">{item.name}</span>
              </Link>
            );
          })}

          {/* زر الأدمن الخاص بإدارة الحسابات (يظهر فقط للسوبر أدمن) */}
          {(!isEmployee && user?.email === ADMIN_EMAIL) && (
            <div className="pt-3 mt-3 border-t border-border/60">
              <Link
                href="/admin"
                className={`flex items-center gap-3 p-3 rounded-xl font-bold transition-all duration-200 ${
                  pathname.startsWith("/admin")
                    ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                    : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/20"
                }`}
              >
                <ShieldCheck className="w-5 h-5 text-purple-500" />
                <span className="text-base">إدارة الحسابات</span>
              </Link>
            </div>
          )}
        </nav>
      </div>

      {/* الأدوات السفلية (زر الثيم + زر تسجيل الخروج) */}
      {mounted && (
        <div className="flex flex-col gap-2 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center justify-center gap-2 p-2.5 w-full rounded-xl border border-border bg-background text-foreground hover:bg-border/50 transition-colors text-xs font-bold"
          >
            {theme === "dark" ? (
              <>
                <Sun className="w-4 h-4 text-yellow-500" />
                <span>الوضع النهاري</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-blue-600" />
                <span>الوضع الليلي</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 p-2.5 w-full rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all text-xs font-bold"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      )}
    </aside>
  );
}