import { NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

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

  try {
    // 1. جلب بيانات المستخدمين وتجميع التوكنات حسب الـ Owner UID
    const [usersSnap, systemUsersSnap, installmentsSnap, paymentsSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("system_users").get(),
      db.collection("installments").get(),
      db.collection("payments").get(),
    ]);

    // خريطة لتخزين توكنات وأرقام كل حساب SaaS على حدة
    const tenantMap: Record<string, { tokens: string[]; todayCount: number; overdueCount: number }> = {};

    // أ) جمع توكنات حسابات الرئيسية (users)
    usersSnap.forEach((doc) => {
      const data = doc.data();
      const uid = doc.id;
      if (data.fcmToken && typeof data.fcmToken === "string" && data.fcmToken.trim() !== "") {
        if (!tenantMap[uid]) tenantMap[uid] = { tokens: [], todayCount: 0, overdueCount: 0 };
        if (!tenantMap[uid].tokens.includes(data.fcmToken)) {
          tenantMap[uid].tokens.push(data.fcmToken);
        }
      }
    });

    // ب) جمع توكنات الموظفين الفرعيين (system_users) وربطها بالـ ownerUid
    systemUsersSnap.forEach((doc) => {
      const data = doc.data();
      const ownerUid = data.ownerUid;
      if (ownerUid && data.fcmToken && typeof data.fcmToken === "string" && data.fcmToken.trim() !== "") {
        if (!tenantMap[ownerUid]) tenantMap[ownerUid] = { tokens: [], todayCount: 0, overdueCount: 0 };
        if (!tenantMap[ownerUid].tokens.includes(data.fcmToken)) {
          tenantMap[ownerUid].tokens.push(data.fcmToken);
        }
      }
    });

    // 2. معالجة المدفوعات وتاريخ اليوم
    const payments = paymentsSnap.docs.map((doc) => doc.data());
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // 3. حساب متعثرات كل مستأجر (Tenant) على حدة
    installmentsSnap.forEach((doc) => {
      const inst = doc.data();
      const tenantId = inst.userId || inst.ownerUid; // معرف التاجر صاحب العقد

      // إذا لم يكن العقد ينتمي لتاجر مسجل لديه توكنات، نتجاوزه
      if (!tenantId || !tenantMap[tenantId]) return;

      const installmentAmount = Number(inst.monthlyInstallment) || 0;
      const totalMonths = Number(inst.months) || 1;
      const calculatedRemainingDebt = Math.max(0, Number(inst.totalDue) || 0);

      if (!inst.startDate || calculatedRemainingDebt <= 0) return;

      const instPayments = payments.filter((p) => p.installmentId === doc.id || p.installmentId === inst.id);
      const [sYear, sMonth, sDay] = inst.startDate.split("-").map(Number);

      let contractOverdueSum = 0;
      let unpaidCount = 0;
      let hasTodayDue = false;

      for (let m = 0; m < totalMonths; m++) {
        let dueDateOnly: Date;
        if (inst.paymentPeriod === "daily") {
          dueDateOnly = new Date(sYear, sMonth - 1, sDay + m);
        } else if (inst.paymentPeriod === "weekly") {
          dueDateOnly = new Date(sYear, sMonth - 1, sDay + m * 7);
        } else {
          dueDateOnly = new Date(sYear, sMonth - 1 + m, sDay);
        }

        dueDateOnly.setHours(0, 0, 0, 0);
        const dueDateMidnight = dueDateOnly.getTime();

        const y = dueDateOnly.getFullYear();
        const monthStr = String(dueDateOnly.getMonth() + 1).padStart(2, "0");
        const dayStr = String(dueDateOnly.getDate()).padStart(2, "0");
        const formattedFullDate = `${y}-${monthStr}-${dayStr}`;
        const formattedYearMonth = `${y}-${monthStr}`;

        const isPaid =
          instPayments.some(
            (p) => p.targetMonth === formattedFullDate || p.targetMonth === formattedYearMonth
          ) ||
          inst.paidMonths?.includes(formattedFullDate) ||
          inst.paidMonths?.includes(formattedYearMonth);

        if (!isPaid && dueDateMidnight <= todayMidnight) {
          const diffDays = Math.floor((todayMidnight - dueDateMidnight) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0) {
            contractOverdueSum += installmentAmount;
            unpaidCount += 1;
            if (diffDays === 0) hasTodayDue = true;
          }
        }
      }

      if (unpaidCount > 0 && contractOverdueSum > 0) {
        tenantMap[tenantId].overdueCount++;
        if (hasTodayDue) tenantMap[tenantId].todayCount++;
      }
    });

    // 4. إرسال الإشعارات مخصصة لكل عميل SaaS وأجهزة موظفيه
    const sendPromises: Promise<any>[] = [];
    let totalNotificationsSent = 0;

    Object.keys(tenantMap).forEach((tenantId) => {
      const { tokens, todayCount, overdueCount } = tenantMap[tenantId];

      // إذا لم تكن هناك عقود متعثرة لهذا الحساب تحديداً، لا نرسل له إشعاراً
      if (overdueCount === 0 || tokens.length === 0) return;

      const notificationBody = todayCount > 0
        ? `يوجد اليوم (${todayCount}) عقد مستحق، وإجمالي العقود المتعثرة (${overdueCount}) عقد.`
        : `إجمالي العقود المتعثرة والمتأخرة حالياً (${overdueCount}) عقد تتطلب المتابعة.`;

      tokens.forEach((token) => {
        totalNotificationsSent++;
        sendPromises.push(
          messaging.send({
            notification: {
              title: "تنبيه التعثرات والمستحقات ⚠️",
              body: notificationBody,
            },
            token: token,
          })
        );
      });
    });

    await Promise.all(sendPromises);

    return NextResponse.json({
      success: true,
      message: `تم إرسال التنبيهات المخصصة لـ ${totalNotificationsSent} جهاز عبر كافة حسابات العملاء!`,
    });
  } catch (error: any) {
    console.error("Error in send-overdue API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}