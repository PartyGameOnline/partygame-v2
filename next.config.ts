import type { NextConfig } from "next";

const isCI = process.env.CI === "true";

const nextConfig: NextConfig = {
  experimental: {
    // CI環境ではLightning CSSを無効化（PostCSSにフォールバック）
    optimizeCss: !isCI,
  },
};

export default nextConfig;
