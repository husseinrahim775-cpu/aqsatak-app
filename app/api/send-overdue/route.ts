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
    // 1. جلب بيانات العقود والمدفوعات لتطبيق خوارزمية المودال
    const [installmentsSnap, paymentsSnap] = await Promise.all([
      db.collection("installments").get(),
      db.collection("payments").get(),
    ]);

    const payments = paymentsSnap.docs.map((doc) => doc.data());
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    let overdueContractsCount = 0; // إجمالي العقود المتعثرة
    let todayDueContractsCount = 0; // العقود المستحقة اليوم حصراً

    installmentsSnap.forEach((doc) => {
      const inst = doc.data();
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
        overdueContractsCount++;
        if (hasTodayDue) todayDueContractsCount++;
      }
    });

    if (overdueContractsCount === 0) {
      return NextResponse.json({ success: true, message: "لا توجد عقود مستحقة أو متأخرة اليوم." });
    }

    // 2. جلب التوكنات من مجموعتي users و system_users معا
    const [usersSnap, systemUsersSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("system_users").get(),
    ]);

    const targetTokens: string[] = [];

    const extractToken = (doc: any) => {
      const data = doc.data();
      if (data.fcmToken && typeof data.fcmToken === "string" && data.fcmToken.trim() !== "") {
        if (!targetTokens.includes(data.fcmToken)) {
          targetTokens.push(data.fcmToken);
        }
      }
    };

    usersSnap.forEach(extractToken);
    systemUsersSnap.forEach(extractToken);

    if (targetTokens.length === 0) {
      return NextResponse.json({ success: false, message: "لم يتم العثور على أجهزة مسجلة بها fcmToken." });
    }

    // 3. إرسال الإشعار بالدقة النصية المطلوبة
    const notificationBody = todayDueContractsCount > 0
      ? `يوجد اليوم (${todayDueContractsCount}) عقد مستحق، وإجمالي العقود المتعثرة (${overdueContractsCount}) عقد.`
      : `إجمالي العقود المتعثرة والمتأخرة حالياً (${overdueContractsCount}) عقد تتطلب المتابعة.`;

    const sendPromises = targetTokens.map((token) =>
      messaging.send({
        notification: {
          title: "تنبيه التعثرات والمستحقات ⚠️",
          body: notificationBody,
        },
        token: token,
      })
    );

    await Promise.all(sendPromises);

    return NextResponse.json({
      success: true,
      message: `تم إرسال التنبيه بنجاح لـ ${targetTokens.length} جهاز!`,
      todayDueContractsCount,
      overdueContractsCount,
    });
  } catch (error: any) {
    console.error("Error in send-overdue API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}