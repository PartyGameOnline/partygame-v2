// eslint.config.mjs
import js from "@eslint/js";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactPlugin from "eslint-plugin-react";

/** @type {import('eslint').Linter.FlatConfig[]} */
const { browser: browserGlobals, node: nodeGlobals } = globals;

export default [
  // ignore（.eslintignore の代替）
  { ignores: ["node_modules/", ".next/", "dist/", "build/", "out/", "coverage/"] },

  // JS 推奨（ベース）
  js.configs.recommended,

  // JS / JSX
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...browserGlobals, ...nodeGlobals },
    },
    plugins: { react: reactPlugin },
    rules: {
      "react/react-in-jsx-scope": "off",
    },
    settings: { react: { version: "detect" } },
  },

  // TS / TSX（非 type-aware）
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: false,
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: { ...browserGlobals, ...nodeGlobals },
    },
    plugins: { "@typescript-eslint": tsPlugin, react: reactPlugin },
    rules: {
      // TS では @typescript-eslint 側を使うのでベースを無効化
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "react/react-in-jsx-scope": "off",
    },
    settings: { react: { version: "detect" } },
  },

  // Node スクリプト（console を許可）
  {
    files: ["scripts/**/*.{js,ts}", "*.config.{js,ts}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...nodeGlobals },
      parser: tsParser,
      parserOptions: { project: false },
    },
    rules: {
      "no-console": "off",
    },
  },

  // 型だけのファイルは未使用変数チェックを完全オフ
  {
    files: ["**/*.d.ts", "**/types.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { project: false },
      globals: { ...browserGlobals, ...nodeGlobals },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];
