// eslint.config.mjs
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import nextPlugin from "@next/eslint-plugin-next";
import prettier from "eslint-config-prettier";

export default [
  // JS の基本推奨
  js.configs.recommended,

  // TypeScript の推奨
  ...tseslint.configs.recommended,

  // TS/TSX 用のパーサー設定（←今回の肝）
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true }, // JSX を有効化
        // 必要に応じて次の2行を有効化（型情報を使うルールを有効にしたい場合）
        // projectService: true,
        // tsconfigRootDir: new URL('.', import.meta.url).pathname,
      },
    },
    plugins: {
      react: reactPlugin,
      "@next/next": nextPlugin,
    },
    rules: {
      // Next.js 13+ では不要
      "react/react-in-jsx-scope": "off",
    },
  },

  // Prettier で最終整形（競合ルールを無効に）
  prettier,
];
