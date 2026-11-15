// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-574 回归锁(2026-11-14):金额/用量 `sum(...)::int` 溢出的 11 处新实例。
 *
 * 病灶:F-22/F-458 之后仍有 9 个文件里的 `coalesce(sum(<金额/用量>), 0)::int`
 * 与 `::bigint::int` 末端截断;累计值越过 int4 上限(2,147,483,647 分,即
 * ¥21,474,836.47)时 PG 抛 `22003 integer out of range`,报表/列表接口直接 500。
 *
 * 本文件为纯源码接线锁(不引 DB):
 *   ① 9 个目标文件里,任何含 `sum(` 的代码行都不得再出现 `::int`
 *      (同时覆盖 `::bigint::int` 的末端 int4 截断);
 *   ② 逐处锚定 11 处金额/用量聚合,断言都已切到 `::bigint`;
 *   ③ 9 个文件中 `sum(...)::bigint` 的代码行合计 ≥ 11。
 *
 * 修复前:relay-stats / relay-ops-snapshot 的 `::bigint::int` 与另 8 处 `::int`
 * 会让 ① 直接变红;把任意一处改回 `::int` 同理。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const TARGET_FILES = [
  '../src/routes/admin.ts',
  '../src/services/redemption-code-service.ts',
  '../src/services/relay-commission-service.ts',
  '../src/services/api-key-group-service.ts',
  '../src/routes/admin/relay-api-keys.ts',
  '../src/routes/admin/relay-stats.ts',
  '../src/services/relay-ops-snapshot.ts',
  '../src/routes/admin-ops-wallboard.ts',
  '../src/db/commission-queries.ts',
] as const

const INT_CAST = /::\s*int\b/
const BIGINT_CAST = /::\s*bigint\b/

const sourceOf = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

/** 去掉块注释行/行注释行,避免文档里的 `::int` 误判。 */
const codeLinesOf = (relative: string) =>
  sourceOf(relative)
    .split('\n')
    .map((line, index) => ({ line: line.trim(), no: index + 1 }))
    .filter(({ line }) => !line.startsWith('*') && !line.startsWith('//'))

const sumLinesOf = (relative: string) =>
  codeLinesOf(relative).filter(({ line }) => line.includes('sum('))

describe('F-574 源码锁:9 个目标文件的 sum 聚合不再强转 int4', () => {
  for (const file of TARGET_FILES) {
    it(`${file} 不含 sum(...)::int 或 ::bigint::int`, () => {
      const offenders = sumLinesOf(file)
        .filter(({ line }) => INT_CAST.test(line))
        .map(({ line, no }) => `${no}: ${line}`)
      expect(offenders).toEqual([])
    })
  }
})

/**
 * 11 处锚点:marker 必须同时出现在含 `sum(` 的行上,count 为该文件内的处数。
 * 行号会漂移,故用稳定标识符定位。
 */
const ANCHORS = [
  { file: '../src/routes/admin/relay-api-keys.ts', marker: 'costUsedTotalCents', count: 1 },
  { file: '../src/services/api-key-group-service.ts', marker: 'usedTokens', count: 1 },
  { file: '../src/services/api-key-group-service.ts', marker: 'usedCostCents', count: 1 },
  { file: '../src/services/redemption-code-service.ts', marker: 'faceValueSum', count: 1 },
  { file: '../src/services/relay-commission-service.ts', marker: 'sumCents', count: 1 },
  { file: '../src/services/relay-commission-service.ts', marker: 'todayCents', count: 1 },
  { file: '../src/services/relay-commission-service.ts', marker: 'last7dCents', count: 1 },
  { file: '../src/services/relay-commission-service.ts', marker: 'last30dCents', count: 1 },
  { file: '../src/routes/admin/relay-stats.ts', marker: 'totalTokens', count: 2 },
  { file: '../src/services/relay-ops-snapshot.ts', marker: 'totalTokens', count: 1 },
] as const

const anchoredLines = (anchor: (typeof ANCHORS)[number]) =>
  sumLinesOf(anchor.file).filter(({ line }) => line.includes(anchor.marker))

describe('F-574 逐处锁:11 处金额/用量聚合已切到 ::bigint', () => {
  for (const anchor of ANCHORS) {
    it(`${anchor.file} 的 ${anchor.marker} 共 ${anchor.count} 处`, () => {
      const hits = anchoredLines(anchor)
      expect(hits.map(({ no }) => no)).toHaveLength(anchor.count)
      for (const { line, no } of hits) {
        expect(`${no}: ${line}`).toMatch(BIGINT_CAST)
      }
    })
  }

  it('11 处锚点合计为 11', () => {
    const total = ANCHORS.reduce((sum, anchor) => sum + anchoredLines(anchor).length, 0)
    expect(total).toBe(11)
  })

  it('9 个文件中 sum(...)::bigint 的行数 ≥ 11', () => {
    const total = TARGET_FILES.reduce(
      (sum, file) => sum + sumLinesOf(file).filter(({ line }) => BIGINT_CAST.test(line)).length,
      0,
    )
    expect(total).toBeGreaterThanOrEqual(11)
  })
})
