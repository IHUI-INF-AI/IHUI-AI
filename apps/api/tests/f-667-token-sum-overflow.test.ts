// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-667 回归锁(2026-11-13):token 计数聚合末端 `::int` 溢出 → 22003 → 500。
 *
 * 病灶:token 计数列(llm_call_logs.total_tokens / token_flows.quantity 等)是 int4,
 *       `sum(...)` 提升 int8 后又被 `::bigint::int` 截回 int4;任一聚合窗口合计
 *       > 2,147,483,647 时 PG 抛 `22003 integer out of range`,整个统计/配额/
 *       商城列表接口 500(F-574 只覆盖金额列,两类列不同、可叠加)。
 * 修法:去掉末端 `::int`,SQL 只到 `::bigint`,JS 侧用 toSafeCount 归一成 number;
 *       token 量级 < 2^53,Number 转换不丢精度,返回 JSON 仍是 number(契约不变)。
 * 本文件锁:
 *   ① 票面 5 个文件的 token 计数 sum 不得再出现 `sum(...)::int` / `::bigint::int`
 *      (金额列白名单见 WHITELIST,属 F-574 口径,本票不动);
 *   ② 各 token 聚合点已改为 `::bigint` 且出口统一走 toSafeCount;
 *   ③ toSafeCount 对 int4 溢出值 / MAX_SAFE_INTEGER / null 归一正确;
 *   ④ 反向对照:把任一 token 点改回 `::bigint::int`,扫描器必须变红。
 * 纯静态 + 纯函数,不触达真实 PG。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { toSafeCount } from '../src/utils/safe-count.js'

/** 票面点名 + 同文件同型的 token 计数聚合点所在文件。 */
const TOUCHED_FILES = [
  'src/routes/admin/relay-logs.ts',
  'src/services/api-key-group-service.ts',
  'src/routes/admin-saas-quota.ts',
  'src/routes/admin-shop-routes.ts',
  'src/db/commission-queries.ts',
] as const

/**
 * 白名单:同文件里的金额列聚合(F-574 已单独立票),本票只修 token 计数,不得顺手改。
 * 判据落在列名上(amount / originalAmount / costCents),不按行号,漂移不失效。
 */
const WHITELIST: Array<{ test: RegExp; reason: string }> = [
  { test: /amount|cost/i, reason: 'F-574 金额列(分),非 token 计数' },
]

interface Hit {
  file: string
  line: number
  text: string
}

function read(rel: string): string {
  return readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
}

/** 注释里的历史 SQL 不算聚合点,先剔除行注释与块注释。 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

/**
 * 扫描 `sum(...)` 后仍回到 int4 的写法:
 *   `sum(x)::int`、`sum(x)::bigint::int`、`coalesce(sum(x), 0)::bigint::int`。
 * 只要从 `sum(` 到 `::int` 之间没有其它转型,一律判红。
 */
function findSumIntCasts(file: string, raw: string): Hit[] {
  const hits: Hit[] = []
  const lines = stripComments(raw).split('\n')
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i] ?? ''
    const re = /sum\s*\(.*?\)\s*::\s*(?:bigint\s*::\s*)?int\b/gi
    if (re.test(text)) hits.push({ file, line: i + 1, text: text.trim() })
  }
  return hits
}

function describeHit(h: Hit): string {
  return `${h.file}:${h.line} ${h.text}`
}

describe('F-667 token 计数聚合不得再回截 int4', () => {
  it('5 个票面文件里不存在未白名单的 sum(...)::int', () => {
    const hits = TOUCHED_FILES.flatMap((f) => findSumIntCasts(f, read(f)))
    const unexpected = hits.filter((h) => !WHITELIST.some((w) => w.test.test(h.text)))
    expect(unexpected.map(describeHit)).toEqual([])
  })

  it('票面 token 聚合点已改成 ::bigint,且出口统一走 toSafeCount', () => {
    const points: Array<{ file: string; field: string }> = [
      { file: 'src/routes/admin/relay-logs.ts', field: 'totalTokens' },
      { file: 'src/routes/admin/relay-logs.ts', field: 'promptTokens' },
      { file: 'src/routes/admin/relay-logs.ts', field: 'completionTokens' },
      { file: 'src/services/api-key-group-service.ts', field: 'usedTokens' },
      { file: 'src/routes/admin-saas-quota.ts', field: 'used' },
      { file: 'src/routes/admin-shop-routes.ts', field: 'totalRecharge' },
      { file: 'src/routes/admin-shop-routes.ts', field: 'totalConsume' },
      { file: 'src/db/commission-queries.ts', field: 'totalEarned' },
      { file: 'src/db/commission-queries.ts', field: 'totalUsed' },
      { file: 'src/db/commission-queries.ts', field: 'totalToken' },
    ]
    for (const p of points) {
      const line =
        read(p.file)
          .split('\n')
          .find((l) => l.includes(`${p.field}: sql<number>`) && /\bsum\s*\(/.test(l)) ?? ''
      expect(line, `${p.file} 未找到 ${p.field} 的 token 聚合行`).not.toBe('')
      expect(line, `${p.file} ${p.field} 应聚合到 ::bigint`).toMatch(/::\s*bigint\b/)
      expect(line, `${p.file} ${p.field} 不得回截 ::int`).not.toMatch(/::\s*int\b/)
    }
    for (const file of TOUCHED_FILES) {
      expect(read(file), `${file} 出口未走 toSafeCount`).toContain('toSafeCount(')
    }
  })

  it('反向对照:任一 token 点改回 ::bigint::int 扫描器必须变红(防恒绿)', () => {
    const file = 'src/routes/admin/relay-logs.ts'
    const src = read(file)
    const mutated = src.replace(
      'coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint`',
      'coalesce(sum(${llmCallLogs.totalTokens}), 0)::bigint::int`',
    )
    expect(mutated).not.toBe(src)
    const hits = findSumIntCasts(file, mutated)
    expect(hits.map(describeHit)).toHaveLength(1)
    expect(hits[0]?.text).toContain('totalTokens')
    // 白名单只放行金额列,不能把 token 点一起放行
    expect(hits.some((h) => !WHITELIST.some((w) => w.test.test(h.text)))).toBe(true)
  })
})

describe('toSafeCount:bigint 字符串 → number(JSON 契约不变)', () => {
  it('超过 int4 上限的值原样返回(不再 22003 / 不再截断)', () => {
    expect(toSafeCount('2147483648')).toBe(2147483648)
  })

  it('MAX_SAFE_INTEGER 量级不丢精度', () => {
    expect(toSafeCount('9007199254740991')).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('null / undefined 归一为 0(无用量行不写 NaN)', () => {
    expect(toSafeCount(null)).toBe(0)
    expect(toSafeCount(undefined)).toBe(0)
  })

  it('已是 number 的原样透传', () => {
    expect(toSafeCount(0)).toBe(0)
    expect(toSafeCount(42)).toBe(42)
  })

  it('返回值类型必须是 number', () => {
    expect(typeof toSafeCount('2147483648')).toBe('number')
  })
})
