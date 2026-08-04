"use client";

import { useEffect, useState } from "react";
import { db } from "@/services/firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc, query } from "firebase/firestore";
import { CheckCircle2, XCircle, PauseCircle, PlayCircle, RefreshCw, UserCheck, ShieldAlert, Users, Trash2 } from "lucide-react";

interface UserAccount {
  id: string;
  email: string;
  status: "pending" | "active" | "disabled" | "rejected";
  createdAt?: any;
}

export default function AdminDashboardPage() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // جلب كافة الحسابات من Firestore
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef);
      const querySnapshot = await getDocs(q);
      
      const userList: UserAccount[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        userList.push({
          id: docSnap.id,
          email: data.email || docSnap.id,
          status: data.status || "pending",
          createdAt: data.createdAt || null,
        });
      });

      setUsers(userList);
    } catch (error) {
      console.error("خطأ في جلب الحسابات:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // تحديث حالة الحساب (تفعيل، إيقاف مؤقت، رفض)
  const handleUpdateStatus = async (userId: string, newStatus: "active" | "disabled" | "rejected") => {
    setUpdatingId(userId);
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        status: newStatus,
        updatedAt: new Date(),
      });
      
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
      );
    } catch (error) {
      console.error("خطأ في تغيير حالة الحساب:", error);
      alert("حدث خطأ أثناء تحديث حالة الحساب");
    } finally {
      setUpdatingId(null);
    }
  };

  // 🗑️ دالة حذف الحساب نهائياً من Firestore
  const handleDeleteUser = async (userId: string, userEmail: string) => {
    const isConfirmed = window.confirm(`هل أنت متأكد من حذف حساب (${userEmail}) نهائياً؟\nلا يمكن التراجع عن هذا الإجراء.`);
    
    if (!isConfirmed) return;

    setUpdatingId(userId);
    try {
      const userRef = doc(db, "users", userId);
      await deleteDoc(userRef);

      // تحديث الحالة محلياً وإزالته من القائمة
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (error) {
      console.error("خطأ في حذف الحساب:", error);
      alert("حدث خطأ أثناء حذف الحساب، يرجى المحاولة لاحقاً.");
    } finally {
      setUpdatingId(null);
    }
  };

  // تنسيق التاريخ
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "غير محدد";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return new Intl.DateTimeFormat("ar-IQ", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date);
    } catch {
      return "غير محدد";
    }
  };

  // الإحصائيات
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === "active").length;
  const pendingUsers = users.filter((u) => u.status === "pending").length;
  const disabledUsers = users.filter((u) => u.status === "disabled").length;

  return (
    <div className="space-y-8 p-2 md:p-4">
      {/* الهيدر الرئيسي */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">لوحة تحكم الإدارة العليا</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة حسابات المشتركين وتفعيل/تجميد الاشتراكات في نظام أقساطك.
          </p>
        </div>

        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-accent text-sm font-semibold transition-all active:scale-95 w-fit"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          <span>تحديث القائمة</span>
        </button>
      </div>

      {/* بطاقات الإحصائيات */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">إجمالي الحسابات</span>
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-2xl font-black mt-2">{totalUsers}</div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">اشتراكات نشطة</span>
            <UserCheck className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-black mt-2 text-emerald-600 dark:text-emerald-400">{activeUsers}</div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">طلبات معلقة</span>
            <ShieldAlert className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-2xl font-black mt-2 text-amber-600 dark:text-amber-400">{pendingUsers}</div>
        </div>

        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">موقوفة (منتهية)</span>
            <PauseCircle className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-2xl font-black mt-2 text-red-600 dark:text-red-400">{disabledUsers}</div>
        </div>
      </div>

      {/* جدول الحسابات */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-bold text-lg">قائمة مشتركين النظام ({users.length})</h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground">جاري تحميل الحسابات...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">لا يوجد حسابات مسجلة في النظام حالياً.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                <tr>
                  <th className="p-4 font-semibold">البريد الإلكتروني</th>
                  <th className="p-4 font-semibold">تاريخ الانضمام</th>
                  <th className="p-4 font-semibold">حالة الاشتراك</th>
                  <th className="p-4 font-semibold text-center">التحكم والاشتراك</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((account) => {
                  const isBusy = updatingId === account.id;

                  return (
                    <tr key={account.id} className="hover:bg-accent/30 transition-colors">
                      {/* البريد */}
                      <td className="p-4 font-bold dir-ltr text-right">{account.email}</td>

                      {/* تاريخ الانضمام */}
                      <td className="p-4 text-muted-foreground">{formatDate(account.createdAt)}</td>

                      {/* الحالة */}
                      <td className="p-4">
                        {account.status === "active" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" /> مفعل ونشط
                          </span>
                        )}
                        {account.status === "pending" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <ShieldAlert className="w-3.5 h-3.5" /> قيد الانتظار
                          </span>
                        )}
                        {account.status === "disabled" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                            <PauseCircle className="w-3.5 h-3.5" /> موقوف (منتهي)
                          </span>
                        )}
                        {account.status === "rejected" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-500 border border-gray-500/20">
                            <XCircle className="w-3.5 h-3.5" /> مرفوض
                          </span>
                        )}
                      </td>

                      {/* إجراءات التحكم */}
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          {/* تفعيل أو إعادة تفعيل الاشتراك */}
                          {account.status !== "active" && (
                            <button
                              disabled={isBusy}
                              onClick={() => handleUpdateStatus(account.id, "active")}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
                            >
                              <PlayCircle className="w-4 h-4" />
                              <span>{account.status === "disabled" ? "تجديد الاشتراك" : "قبول وتفعيل"}</span>
                            </button>
                          )}

                          {/* إيقاف الاشتراك مؤقتاً */}
                          {account.status === "active" && (
                            <button
                              disabled={isBusy}
                              onClick={() => handleUpdateStatus(account.id, "disabled")}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
                              title="تجميد الحساب دون حذف بياناته"
                            >
                              <PauseCircle className="w-4 h-4" />
                              <span>إيقاف الاشتراك</span>
                            </button>
                          )}

                          {/* رفض الطلب إذا كان قيد الانتظار */}
                          {account.status === "pending" && (
                            <button
                              disabled={isBusy}
                              onClick={() => handleUpdateStatus(account.id, "rejected")}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>رفض</span>
                            </button>
                          )}

                          {/* 🗑️ زر الحذف النهائي (متاح لجميع الحالات) */}
                          <button
                            disabled={isBusy}
                            onClick={() => handleDeleteUser(account.id, account.email)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/10 hover:bg-red-600 hover:text-white text-red-600 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                            title="حذف الحساب نهائياً من قاعدة البيانات"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}