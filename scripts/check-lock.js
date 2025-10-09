#!/usr/bin/env node
/* eslint-env node */
const fs = require("fs");
const path = require("path");

const lockPath = path.resolve(process.cwd(), "package-lock.json");
if (!fs.existsSync(lockPath)) {
  console.error("package-lock.json が見つかりません。まず npm install を実行してください。");
  process.exit(2);
}

const pkg = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));

// --- 設定 ----------------------------------------------------
const argv = new Set(process.argv.slice(2));
const VERBOSE = argv.has("--verbose");
const FAIL_ON_LOW = argv.has("--fail-on-low") || argv.has("--strict");
const CI_MODE = argv.has("--ci");

// よく重複するが無害な小物は既定で無視（必要に応じて調整）
const DEFAULT_ALLOW = [
  "ansi-regex",
  "ansi-styles",
  "brace-expansion",
  "debug",
  "emoji-regex",
  "escape-string-regexp",
  "fast-glob",
  "glob-parent",
  "semver",
  "strip-ansi",
  "supports-color",
  "picomatch",
  "minimatch",
];

// package.json の "lockcheck": { allow:[], deny:[] } で上書き可能
const userCfg = (pkg && pkg.lockcheck) || {};
const ALLOW = new Set([...(userCfg.allow || DEFAULT_ALLOW)]);
const DENY = new Set(userCfg.deny || []);

// ------------------------------------------------------------

function major(v) {
  const m = String(v).match(/^(\d+)\./);
  return m ? Number(m[1]) : NaN;
}

// package-lock v2 のツリーを走査して name->versions[] を集計
const versionsMap = new Map();

function collect(node) {
  if (!node || !node.packages) return;

  // lockfileVersion 2 以降は "packages" にフラットで入る
  for (const [, info] of Object.entries(node.packages)) {
    if (!info || !info.name || !info.version) continue;
    const name = info.name;
    const v = info.version;
    if (!versionsMap.has(name)) versionsMap.set(name, new Set());
    versionsMap.get(name).add(v);
  }
}
collect(lock);

// 集計 → リスク分類
const high = [];
const low = [];

for (const [name, set] of versionsMap.entries()) {
  if (ALLOW.has(name)) continue; // 既定で無視
  const list = [...set].sort();
  if (list.length <= 1) continue;

  const majors = new Set(list.map(major));
  const item = { name, versions: list, majors: [...majors].sort() };

  if (DENY.has(name) || majors.size > 1) {
    high.push(item);
  } else {
    low.push(item);
  }
}

// 出力
function print(items, title, emoji) {
  if (!items.length) return;
  console.log(`\n${emoji} ${title} (${items.length})`);
  for (const it of items.sort((a, b) => a.name.localeCompare(b.name))) {
    const trail = VERBOSE ? `  ← ${it.versions.join(", ")}` : "";
    console.log(`  - ${it.name}${trail}`);
  }
}

console.log("🔎 lockfile multi-version check");
print(high, "HIGH: メジャーバージョンが分岐（要対応）", "🛑");
print(low, "LOW: 同一メジャー内の複数バージョン（通常は無害）", "⚠️");

if (!high.length && !low.length) {
  console.log("✅ 重複バージョンはありません。");
}

// 退出コード（CI で落とすかどうか）
if (high.length > 0) {
  if (CI_MODE) console.log("\n❌ CI: HIGH があるため失敗扱いにします。");
  process.exit(1);
}
if (FAIL_ON_LOW && low.length > 0) {
  if (CI_MODE) console.log("\n❌ CI: --fail-on-low 指定のため LOW でも失敗扱い。");
  process.exit(1);
}
process.exit(0);
