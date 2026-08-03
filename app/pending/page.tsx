"use client";

import { Clock, LogOut } from "lucide-react";
import { useAuth } from "../../components/AuthProvider";

export default function PendingPage() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 absolute inset-0 z-50">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-xl space-y-6">
        <div className="w-20 h-20 bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Clock className="w-10 h-10" />
        </div>
        
        <h1 className="text-2xl font-bold text-foreground">حسابك قيد المراجعة</h1>
        <p className="text-gray-500 leading-relaxed">
          لقد استلمنا طلب تسجيلك بنجاح. حسابك حالياً قيد المراجعة من قبل الإدارة وسيعمل فور الموافقة عليه.
        </p>

        <button 
          onClick={logout}
          className="flex items-center justify-center gap-2 w-full mt-6 py-3 bg-secondary text-secondary-foreground rounded-xl hover:bg-secondary/80 font-medium transition-colors"
        >
          <LogOut className="w-5 h-5" />
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}