import type { NextConfig } from "next";

const isCI = process.env.CI === "true";

const nextConfig: NextConfig = {
  experimental: {
    // CI では Lightning CSS を使わない（PostCSSにフォールバック）
    optimizeCss: !isCI,
  },
  // CI では next/font の最適化も切る（LightningCSS 経由の処理を避ける）
  optimizeFonts: !isCI,
};

export default nextConfig;
