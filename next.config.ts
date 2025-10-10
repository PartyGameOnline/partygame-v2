import type { NextConfig } from "next";

const isCI = process.env.CI === "true";

const nextConfig: NextConfig = {
  experimental: {
    // Turbopack 時に効くCSS最適化（警告に出ていた通り有効）
    optimizeCss: !isCI,
  },
  // NOTE: optimizeFonts は Next.js 15 で削除されたため設定不要
};

export default nextConfig;
