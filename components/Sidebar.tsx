"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuth } from './AuthProvider';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Settings, 
  ShieldCheck, 
  Sun, 
  Moon,
  LogOut 
} from 'lucide-react';
import { useEffect, useState } from 'react';

const menuItems = [
  { name: 'لوحة التحكم', path: '/dashboard', icon: LayoutDashboard },
  { name: 'العملاء والأقساط', path: '/customers', icon: Users },
  { name: 'الحسابات والمدفوعات', path: '/accounts', icon: CreditCard },
  { name: 'الإعدادات', path: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth() as any;
  const [mounted, setMounted] = useState(false);

  const ADMIN_EMAIL = "admin@aqsatak.com"; // ضع إيميل الأدمن الخاص بك هنا

  useEffect(() => setMounted(true), []);

  const handleLogout = async () => {
    if (window.confirm("هل أنت متأكد من تسجيل الخروج؟")) {
      if (logout) await logout();
    }
  };

  return (
    <aside className="w-64 bg-card border-l border-border h-screen sticky top-0 flex flex-col justify-between p-4 shadow-sm">
      
      <div>
        {/* اسم النظام أو الشعار */}
        <div className="mb-8 mt-4 text-center">
          <h2 className="text-3xl font-extrabold text-primary">أقساطك</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">نظام الإدارة المالي</p>
        </div>
        
        {/* روابط التنقل الرئيسية */}
        <nav className="flex flex-col gap-2">
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.path);
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.path} 
                href={item.path}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-primary text-primary-foreground shadow-md' 
                    : 'text-foreground hover:bg-border/50 hover:text-primary'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium text-lg">{item.name}</span>
              </Link>
            );
          })}

          {/* زر الأدمن (للإدارة فقط) */}
          {user?.email === ADMIN_EMAIL && (
            <div className="pt-3 mt-3 border-t border-border/60">
              <Link
                href="/admin"
                className={`flex items-center gap-3 p-3 rounded-lg font-bold transition-all duration-200 ${
                  pathname.startsWith('/admin')
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                    : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/20'
                }`}
              >
                <ShieldCheck className="w-5 h-5 text-purple-500" />
                <span className="text-lg">إدارة الحسابات</span>
              </Link>
            </div>
          )}
        </nav>
      </div>

      {/* الأدوات السفلية (زر الثيم + زر تسجيل الخروج) */}
      {mounted && (
        <div className="flex flex-col gap-2 pt-4 border-t border-border">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center justify-center gap-2 p-2.5 w-full rounded-lg border border-border bg-background text-foreground hover:bg-border/50 transition-colors text-sm font-medium"
          >
            {theme === 'dark' ? (
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

          {/* زر تسجيل الخروج للابتوب */}
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 p-2.5 w-full rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all text-sm font-bold"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      )}
    </aside>
  );
}