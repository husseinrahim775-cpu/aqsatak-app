import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { code, refreshToken, redirectUri } = await request.json();

    const CLIENT_ID = "42704920630-fh1e8kni3er2bhc6ejjj2kkhcgi01nvc.apps.googleusercontent.com";
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

    // 1️⃣ الحالة الأولى: تبديل الـ authorization_code المرتجع من callback بـ Refresh Token و Access Token لأول مرة
    if (code) {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code: code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri || "https://aqsatak-app.vercel.app/api/google/callback",
        }),
      });

      const data = await response.json();

      if (response.ok && data.access_token) {
        return NextResponse.json({
          accessToken: data.access_token,
          refreshToken: data.refresh_token || null,
        });
      } else {
        return NextResponse.json(
          { error: data.error_description || 'فشل استبدال الرمز بالتوكن' },
          { status: 400 }
        );
      }
    }

    // 2️⃣ الحالة الثانية: تجديد الـ Access Token المنتهي باستخدام الـ Refresh Token المخزون في Firestore
    if (refreshToken) {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      const data = await response.json();

      if (response.ok && data.access_token) {
        return NextResponse.json({ accessToken: data.access_token });
      } else {
        return NextResponse.json(
          { error: data.error_description || 'فشل تجديد التوكن' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ error: 'Missing parameters (code or refreshToken)' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}