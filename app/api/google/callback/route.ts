export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return new NextResponse('لم يتم استلام رمز التفويض من Google', { status: 400 });
  }

  // صفحة HTML تقوم بنقل الـ Code للنافذة المفتوحة (سواء popup أو تطبيق EXE محلي)
  const html = `
    <!DOCTYPE html>
    <html dir="rtl">
      <head>
        <meta charset="utf-8" />
        <title>Google Auth Sync</title>
        <style>
          body { 
            font-family: system-ui, -apple-system, sans-serif; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            height: 100vh; 
            margin: 0; 
            background: #090d16; 
            color: #fff; 
          }
          .loader { font-size: 15px; font-weight: 600; text-align: center; }
        </style>
      </head>
      <body>
        <div class="loader">جاري إكمال ربط Google Drive وتوجيهك للتطبيق...</div>
        <script>
          // 1. إذا فتحت نافذة منبثقة (Popup)
          if (window.opener) {
            window.opener.postMessage({ type: 'GOOGLE_AUTHORIZATION_CODE', code: '${code}' }, '*');
            window.close();
          } else {
            // 2. إذا فتحت مباشرة في تطبيق الـ EXE عبر السيرفر المحلي
            window.location.href = 'http://127.0.0.1:39200/settings?code=${code}';
          }
        </script>
      </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}