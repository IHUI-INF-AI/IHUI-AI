// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * i18n 缺键守门（checkin 页面）。
 *
 * 背景：单测的 useTranslations mock 对未知键回退返回键名本身 ⇒ 缺键在
 * vitest 恒过、只会在生产渲染时以 next-intl 缺键错误爆出（已实锤两次：
 * 2026-10-08 的 13 键事故、2026-10-09 的 cooldownUntil 遗漏）。本测试把
 * 「page.tsx 引用的 t() 键全集 ⊆ 五语言文件键集」钉成确定性判据，缺一即红。
 *
 * 路径约定：vitest 工作目录 = apps/web 仓内应用根。
 */
const appRoot = process.cwd();
const pageSrc = readFileSync(
  join(appRoot, "app", "(main)", "checkin", "page.tsx"),
  "utf8",
);

const usedKeys = new Set<string>();
for (const m of pageSrc.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)) {
  const key = m[1];
  if (key !== undefined) usedKeys.add(key);
}

const langs = ["zh-CN", "zh-TW", "en", "ja", "ko"] as const;

function flattenLeaves(obj: unknown): string[] {
  if (obj === null || typeof obj !== "object") return [];
  // 只取叶子名（页面经 useTranslations('checkin') 取命名空间下的叶子键，
  // 故与文件比对口径 = 叶子名，不带区段前缀）
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? flattenLeaves(v) : [k],
  );
}

function loadLangLeaves(lang: string): Set<string> {
  // i18n 消息在仓库根 packages/ 下（apps/web ⇒ 上两级）
  const p = join(appRoot, "..", "..", "packages", "i18n", "messages", "web", `${lang}.json`);
  return new Set(flattenLeaves(JSON.parse(readFileSync(p, "utf8"))));
}

describe("checkin 页面 i18n 键完整性（缺键守门）", () => {
  it("page.tsx 至少引用了一批 t() 键（防正则失配空转）", () => {
    expect(usedKeys.size).toBeGreaterThan(50);
  });

  for (const lang of langs) {
    it(`${lang} 含 page.tsx 引用的全部 ${usedKeys.size} 个键`, () => {
      const leaves = loadLangLeaves(lang);
      const missing = [...usedKeys].filter((k) => !leaves.has(k));
      expect(missing, `${lang} 缺键: ${missing.join(", ")}`).toEqual([]);
    });
  }
});
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
