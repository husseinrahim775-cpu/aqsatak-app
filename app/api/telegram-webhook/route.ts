import { NextResponse } from 'next/server';
import { db } from '@/services/firebase';
import { doc, updateDoc } from 'firebase/firestore';

const TELEGRAM_BOT_TOKEN = "8813986823:AAEx2d3yvXXK31Pm7GHX5eqZPa4Z-YibQ_c";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // التحقق إذا كان الطلب من ضغطة زر (Callback Query)
    if (body.callback_query) {
      const callback = body.callback_query;
      const data = callback.data as string; // مثال: activate_30_USERID
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;

      const [action, daysOrTarget, ...rest] = data.split('_');

      if (action === 'activate') {
        const days = parseInt(daysOrTarget, 10);
        const userId = rest.join('_');

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + days);

        // تحديث الحساب في Firestore
        await updateDoc(doc(db, "users", userId), {
          status: "active",
          subscriptionEndDate: expiryDate.toISOString(),
        });

        // إرسال إشعار تأكيد وتحديث الرسالة بالتلغرام
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callback.id,
            text: `✅ تم تفعيل الحساب بنجاح لمدة ${days} يوم!`,
            show_alert: true,
          }),
        });

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: `${callback.message.text}\n\n✅ *تم التفعيل:* لمدة ${days} يوم (ينتهي في ${expiryDate.toLocaleDateString('ar-IQ')})`,
            parse_mode: "Markdown",
          }),
        });

      } else if (action === 'suspend') {
        const userId = daysOrTarget; // في حالة التوقيف، الشق الثاني هو الـ userId

        // إيقاف الحساب في Firestore
        await updateDoc(doc(db, "users", userId), {
          status: "suspended",
        });

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: callback.id,
            text: "🔴 تم إيقاف الحساب!",
            show_alert: true,
          }),
        });

        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: `${callback.message.text}\n\n⛔ *حالة الحساب:* تم الإيقاف / التعطيل.`,
            parse_mode: "Markdown",
          }),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}