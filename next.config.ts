import type { NextConfig } from "next";

const isExportBuild = process.env.BUILD_TARGET === "EXPORT";

const nextConfig: NextConfig = {
  // يفعّل التصدير الأستاتيكي فقط عند البناء المحلي للأندرويد أو الحاسوب
  ...(isExportBuild ? { output: "export" } : {}),
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;