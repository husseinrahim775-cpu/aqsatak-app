import "./globals.css";
import type { Metadata } from "next";
import ClientLayout from "./ClientLayout";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "أقساطك",
  description: "نظام إدارة الأقساط والحسابات المالية",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "أقساطك",
  },
};

// ⚡ كود تهيئة الثيم المسبق لتجنب الفلاش/الرمشة
const themeInitializerScript = `
  (function() {
    try {
      var activeSession = sessionStorage.getItem("active_session");
      var employeeKey = null;
      if (activeSession) {
        var parsed = JSON.parse(activeSession);
        employeeKey = parsed.id || parsed.username || parsed.ownerUid;
      }
      
      var savedColorTheme = (employeeKey && localStorage.getItem('user_color_theme_' + employeeKey)) 
                         || localStorage.getItem('app_color_theme') 
                         || 'orange';
      
      document.documentElement.setAttribute('data-theme', savedColorTheme);
      if (document.body) {
        document.body.setAttribute('data-theme', savedColorTheme);
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        
        {/* 📱 وسوم أيقونة الآيفون والشاشة الرئيسية */}
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/logo.png" />

        {/* ⚡ سكريبت التهيئة المباشر بدون تحذيرات Next.js/React */}
        <script
          id="theme-initializer"
          dangerouslySetInnerHTML={{ __html: themeInitializerScript }}
        />
      </head>
      <body 
        suppressHydrationWarning 
        className="flex flex-col md:flex-row bg-background min-h-screen text-foreground transition-colors duration-300"
      >
        <ClientLayout>{children}</ClientLayout>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}