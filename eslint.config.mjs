import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';

const config = [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  nextPlugin.configs.recommended,
  {
    rules: {
      'import/no-anonymous-default-export': 'off', // ← 必要ならここでオフにできます
    },
  },
];

export default config;
