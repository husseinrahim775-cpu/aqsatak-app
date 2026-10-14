import "./globals.css";
import type { Metadata } from "next";
import ClientLayout from "./ClientLayout";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "أقساطك",
  description: "نظام إدارة الأقساط والحسابات المالية",
  icons: {
    icon: [
      { url: "./logo.png" },
      { url: "./logo.png", sizes: "32x32", type: "image/png" },
      { url: "./logo.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "./logo.png",
    apple: [
      { url: "./logo.png", sizes: "180x180", type: "image/png" },
    ],
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
        <link rel="apple-touch-icon" href="./logo.png" />
        <link rel="icon" type="image/png" href="./logo.png" />
      </head>
      <body className="flex flex-col md:flex-row bg-background min-h-screen text-foreground transition-colors duration-300">
        <ClientLayout>{children}</ClientLayout>
        {/* إضافة الإشعارات بأعلى منتصف الشاشة وبشكل تلقائي بدون تجميد */}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}