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

  // JS 推奨
  js.configs.recommended,

  // JS / JSX（Flat Config では ecmaFeatures は使わない）
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...browserGlobals, ...nodeGlobals },
      // ← ecmaFeatures は置かない
    },
    plugins: { react: reactPlugin },
    rules: {
      "react/react-in-jsx-scope": "off",
    },
    settings: { react: { version: "detect" } },
  },

  // TS / TSX（type-aware なし）
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: false,
        ecmaVersion: "latest",
        sourceType: "module",
        // ← ここにも ecmaFeatures は置かない
      },
      globals: { ...browserGlobals, ...nodeGlobals },
    },
    plugins: { "@typescript-eslint": tsPlugin, react: reactPlugin },
    rules: {
      "react/react-in-jsx-scope": "off",
      "no-undef": "off",
    },
    settings: { react: { version: "detect" } },
  },
];
