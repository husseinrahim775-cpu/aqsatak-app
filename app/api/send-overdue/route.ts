import { NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// يمنع التخزين المخبأ وضمان معالجة الـ Request في كل مرة
export const revalidate = 0;

function getPrivateKey() {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!privateKey) return undefined;
  return privateKey
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: getPrivateKey(),
    }),
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret")?.trim();

  // التحقق من مفتاح الحماية
  if (secret !== "husseinrahimabd1998") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const db = getFirestore();
  const messaging = getMessaging();

  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const todayStr = `${y}-${m}-${d}`;

  try {
    // 1. جلب الأقساط غير المدفوعة التي استحقاقها اليوم أو قبل اليوم (متأخرة)
    const instSnap = await db.collection("installments").get();
    
    let overdueCount = 0;
    instSnap.forEach((doc) => {
      const data = doc.data();
      const dueDate = data.nextDueDate || data.startDate;
      const isPending = data.status !== "paid" && data.status !== "completed";

      // فحص إذا القسط مستحق اليوم أو متأخر في تاريخ سابق
      if (isPending && dueDate && dueDate <= todayStr) {
        overdueCount++;
      }
    });

    if (overdueCount === 0) {
      return NextResponse.json({ success: true, message: "لا توجد أقساط مستحقة أو متأخرة اليوم." });
    }

    // 2. جلب أجهزة الموظفين والمدراء لاستلام الإشعارات
    const usersSnap = await db.collection("users").get();
    const staffTokens: string[] = [];

    usersSnap.forEach((doc) => {
      const data = doc.data();
      // تأكد أن الحساب لموظف أو أدمن ولديه توكن فعال
      if (data.fcmToken && (data.role === "admin" || data.role === "employee" || !data.role)) {
        staffTokens.push(data.fcmToken);
      }
    });

    if (staffTokens.length === 0) {
      return NextResponse.json({ success: false, message: "لم يتم العثور على أجهزة موظفين مسجلة." });
    }

    // 3. إرسال الإشعار التلخيصي لكافة الموظفين
    const sendPromises = staffTokens.map((token) =>
      messaging.send({
        notification: {
          title: "تنبيه التعثرات والمستحقات ⚠️",
          body: `يوجد اليوم ${overdueCount} قسط مستحق/متأخر يتطلب متابعة التسديد من العملاء.`,
        },
        token: token,
      })
    );

    await Promise.all(sendPromises);

    return NextResponse.json({
      success: true,
      message: `تم إرسال التنبيه بنجاح لـ ${staffTokens.length} جهاز!`,
      overdueCount,
    });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}