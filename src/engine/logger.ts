// src/engine/logger.ts

type Args = unknown[];

// 本番は完全無音。開発は console.* を許可。
const isDev = process.env.NODE_ENV !== "production";

export const devLog = (...args: Args) => {
  if (isDev) console.log(...args);
};

export const devWarn = (...args: Args) => {
  if (isDev) console.warn(...args);
};

export const devError = (...args: Args) => {
  if (isDev) console.error(...args);
};
