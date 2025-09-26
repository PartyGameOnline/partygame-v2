// eslint.config.mjs ーー Flat Config + 互換レイヤーで next/core-web-vitals を利用
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 互換レイヤー: 旧 .eslintrc 形式の "extends" を Flat Config で使えるようにする
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  // Next.js 推奨ルール（core-web-vitals）を取り込む
  ...compat.config({ extends: ["next/core-web-vitals"] }),

  // 無視パターン
  {
    ignores: [".next/**", "node_modules/**", "dist/**"],
  },

  // 追加ルールや共通設定
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      // 例: 未使用変数は _ 始まりだけ許可
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];
