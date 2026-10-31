import { NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// ⚠️ force-static نجعل المسار أستاتيكياً ليتوافق مع output: export الخاص بالأندرويد
export const dynamic = 'force-dynamic';
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

  // التحقق من المفتاح السري
  if (secret !== "husseinrahimabd1998") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const db = getFirestore();
  const messaging = getMessaging();

  try {
    const [usersSnap, systemUsersSnap, installmentsSnap, paymentsSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("system_users").get(),
      db.collection("installments").get(),
      db.collection("payments").get(),
    ]);

    // 1. إنشاء خريطة لربط كل توكن بصاحبه الأصلي (Tenant ID)
    const tokenOwnerMap: Record<string, string> = {};

    // أ) ربط توكنات الحسابات الرئيسية في users
    usersSnap.forEach((doc) => {
      const data = doc.data();
      if (data.fcmToken && typeof data.fcmToken === "string" && data.fcmToken.trim() !== "") {
        tokenOwnerMap[data.fcmToken] = doc.id;
      }
    });

    // ب) ربط توكنات الموظفين الفرعيين في system_users بالـ ownerUid
    systemUsersSnap.forEach((doc) => {
      const data = doc.data();
      const ownerUid = data.ownerUid || data.userId;
      if (ownerUid && data.fcmToken && typeof data.fcmToken === "string" && data.fcmToken.trim() !== "") {
        tokenOwnerMap[data.fcmToken] = ownerUid;
      }
    });

    // 2. إعداد التوقيت المحلي والمدفوعات
    const now = new Date();
    const localNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Baghdad" }));
    const todayMidnight = new Date(localNow.getFullYear(), localNow.getMonth(), localNow.getDate()).getTime();

    const payments = paymentsSnap.docs.map((doc) => doc.data());
    const tenantStats: Record<string, { todayCount: number; overdueCount: number }> = {};

    // 3. تجميع إحصائيات العقود لكل Tenant على حدة
    installmentsSnap.forEach((doc) => {
      const inst = doc.data();
      const tenantId = inst.userId || inst.ownerUid;

      if (!tenantId) return;
      if (!tenantStats[tenantId]) tenantStats[tenantId] = { todayCount: 0, overdueCount: 0 };

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
        tenantStats[tenantId].overdueCount++;
        if (hasTodayDue) tenantStats[tenantId].todayCount++;
      }
    });

    // 4. إرسال الإشعار المخصص لكل Token برقم حاسبة المستأجر حصراً
    const sendPromises: Promise<any>[] = [];

    Object.keys(tokenOwnerMap).forEach((token) => {
      const ownerId = tokenOwnerMap[token];
      const stats = tenantStats[ownerId];

      if (!stats || stats.overdueCount === 0) return;

      const notificationBody = stats.todayCount > 0
        ? `يوجد اليوم (${stats.todayCount}) عقد مستحق، وإجمالي العقود المتعثرة (${stats.overdueCount}) عقد.`
        : `إجمالي العقود المتعثرة والمتأخرة حالياً (${stats.overdueCount}) عقد تتطلب المتابعة.`;

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

    await Promise.all(sendPromises);

    return NextResponse.json({
      success: true,
      message: "تم معالجة وإرسال الإشعارات بنجاح.",
    });
  } catch (error: any) {
    console.error("Error in send-overdue API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}