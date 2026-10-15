import "./globals.css";
import type { Metadata } from "next";
import ClientLayout from "./ClientLayout";
import { Toaster } from "sonner";
import logoImg from "@/public/logo.png"; // 🖼️ جلب الشعار كموديول مباشر

export const metadata: Metadata = {
  title: "أقساطك",
  description: "نظام إدارة الأقساط والحسابات المالية",
  icons: {
    icon: logoImg.src,
    shortcut: logoImg.src,
    apple: logoImg.src,
  },
  appleWebApp: {
    capable: true,
    title: "أقساطك",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href={logoImg.src} />
        <link rel="shortcut icon" href={logoImg.src} />
        <link rel="apple-touch-icon" href={logoImg.src} />
      </head>
      <body className="flex flex-col md:flex-row bg-background min-h-screen text-foreground transition-colors duration-300">
        <ClientLayout>{children}</ClientLayout>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}