import type { NextConfig } from "next";

const isCI = process.env.CI === "true";

const nextConfig: NextConfig = {
  // ✅ optimizeCss は Next.js 15 でも有効（CI環境では無効化）
  experimental: {
    optimizeCss: !isCI,
  },

  // ❌ fontLoaders は Next.js 15 では非対応のため削除
  // 🟢 代わりに optimizeFonts を明示的に使用
  optimizeFonts: !isCI,

  // 他の設定がある場合はこの下に追記
};

export default nextConfig;
