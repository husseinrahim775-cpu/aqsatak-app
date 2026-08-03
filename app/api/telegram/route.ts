import { NextResponse } from 'next/server';

const TELEGRAM_BOT_TOKEN = "8813986823:AAEx2d3yvXXK31Pm7GHX5eqZPa4Z-YibQ_c";
const TELEGRAM_CHAT_ID = "6725620579";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, userId } = body;

    const message = `🔔 *تسجيل حساب جديد في نظام أقساطك!*\n\n` +
                    `📧 *البريد:* \`${email}\`\n` +
                    `🆔 *معرف المستخدم:* \`${userId}\`\n` +
                    `📅 *التاريخ:* ${new Date().toLocaleDateString('ar-IQ')}\n\n` +
                    `⚡ *اختر الإجراء المناسب لتفعيل أو إيقاف الحساب:*`;

    // أزرار تفاعلية تحت الرسالة
    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "🟢 تفعيل (شهر)", callback_data: `activate_30_${userId}` },
          { text: "🟢 تفعيل (سنة)", callback_data: `activate_365_${userId}` },
        ],
        [
          { text: "🔴 إيقاف الحساب", callback_data: `suspend_${userId}` }
        ]
      ]
    };

    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown",
        reply_markup: inlineKeyboard,
      }),
    });

    const data = await res.json();
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("خطأ التلغرام:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}