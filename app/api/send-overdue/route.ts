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
    const usersSnap = await db.collection("users").get();

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const fcmToken = userData.fcmToken;

      if (fcmToken) {
        const instSnap = await db
          .collection("installments")
          .where("userId", "==", userDoc.id)
          .get();

        let todayDueCount = 0;

        instSnap.forEach((inst) => {
          const data = inst.data();
          if (data.nextDueDate === todayStr || data.startDate === todayStr) {
            todayDueCount++;
          }
        });

        if (todayDueCount > 0) {
          await messaging.send({
            notification: {
              title: "تذكير الأقساط اليومية 🔔",
              body: `لديك ${todayDueCount} أقساط مستحقة الدفع اليوم. يرجى المتابعة والتسديد.`,
            },
            token: fcmToken,
          });
        }
      }
    }

    return NextResponse.json({ success: true, message: "Notifications sent!" });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}