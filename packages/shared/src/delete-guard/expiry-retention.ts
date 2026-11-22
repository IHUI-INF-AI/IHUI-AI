// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { TrashExpiryUnit } from './types'

/**
 * 到期清理的取数与保留期解析(goal-b49 X3,2026-11-05:从 `expiry.ts` 原样搬行,判据一条未改)。
 *
 * 为什么单独成页:`expiry.ts` 已到 259 行(AGENTS §3「每页 <250 行」),而"条目档 > 清单档 > 策略档"
 * 的三档解析与数值宽容取数是可独立成页的一类职责(取数 ≠ 判据)。搬行后语义逐字不变:
 * 可清/该留/判不出/超上限的判据、结论聚合与 `unitsFromManifest` 仍住 `expiry.ts`。
 *
 * 公共面不变:本文件**不进** `delete-guard/index.ts` 的 `export *` 桶,两处导出只为同目录
 * `expiry.ts` 复用 —— 导出集形状由 `tests/delete-guard-expiry-shape.test.ts` 钉住。
 */

/** 字节数/TTL 等数值字段的宽容取数:非有限数 ⇒ null(不猜 0,不猜"没这个档") */
export function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/** 保留期解析:条目档 > 清单档 > 策略档;任一档"存在但形态非法"⇒ 未判定(不跳过去拿下一档猜) */
export function resolveRetention(
  unit: TrashExpiryUnit,
  policyMs: number,
): { ms: number } | { bad: string } {
  const entryRaw = unit.entry.retentionMs
  if (entryRaw !== undefined) {
    const ms = asFiniteNumber(entryRaw)
    if (ms === null || ms < 0) return { bad: `条目 retentionMs 形态非法(${String(entryRaw)})` }
    return { ms }
  }
  const manifestRaw = unit.manifestRetentionMs
  if (manifestRaw !== undefined && manifestRaw !== null) {
    const ms = asFiniteNumber(manifestRaw)
    if (ms === null || ms < 0) return { bad: `清单 retentionMs 形态非法(${String(manifestRaw)})` }
    return { ms }
  }
  return { ms: policyMs }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
