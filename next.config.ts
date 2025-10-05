import type { NextConfig } from "next";

const isCI = process.env.CI === "true";

const nextConfig: NextConfig = {
  experimental: {
    optimizeCss: !isCI,
  },
  // このオプションで next/font の最適化を無効化
  // Next 14 などバージョンによって名前が異なる可能性もある
  fontLoaders: isCI ? [] : undefined,
  // または
  // optimizeFonts: !isCI,  ← すでに入れているならそれで十分な場合もあり
};

export default nextConfig;
