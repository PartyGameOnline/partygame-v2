// eslint.config.mjs
import js from "@eslint/js";
import { browser, node } from "globals"; // ★ v16 は named export
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactPlugin from "eslint-plugin-react";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // .eslintignore の代替
  {
    ignores: ["node_modules/", ".next/", "dist/", "build/", "out/", "coverage/"],
  },

  // JS の推奨
  js.configs.recommended,

  // JS/JSX
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      ecmaFeatures: { jsx: true },
      globals: { ...browser, ...node }, // ★ ここも修正
    },
    plugins: { react: reactPlugin },
    rules: {
      "react/react-in-jsx-scope": "off",
    },
    settings: { react: { version: "detect" } },
  },

  // TS/TSX（type-aware ではない軽量モード）
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: false,
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: { ...browser, ...node }, // ★ 同上
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      react: reactPlugin,
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "no-undef": "off",
    },
    settings: { react: { version: "detect" } },
  },
];
