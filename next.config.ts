import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "export", // معطل حالياً لتشغيل واختبار الـ API Route محلياً وعرض الاستجابة الديناميكية
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;