// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-666 回归锁(2026-11-13):手写 `count(*) filter (...)` / `count(distinct ...)` 未 `::int`。
 *
 * 病灶:PG 的 count 返回 int8,postgres.js 原样给字符串;`sql<number>` 只是类型断言,
 *       不做运行时转换 ⇒ 接口契约声明 number,实际 JSON 是 `"123"`(前端 +/toFixed/严格比较全错)。
 * 修法:所有返回给 JSON 的手写 count 聚合统一 `(count(...))::int` / `count(...)::int`;
 *       drizzle 的 `count()` 自带 mapWith(Number),保持原样。
 * 判据:源码里每一处 `count(` 要么是 drizzle `count()`、要么紧跟 `::int`(含 FILTER 子句后),
 *       否则判红。测试为静态断言,不触达真库;并内置反向对照,防扫描器写成恒绿。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = new URL('../src/routes/admin-monitoring-routes.ts', import.meta.url)

/** 注释里的 `count()` 不算统计点,先剔除(含行注释与块注释)。 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

interface CountHit {
  line: number
  text: string
}

/**
 * 扫描所有 `count(`:
 *   ① `count()`(空参)= drizzle 聚合助手,内部 mapWith(Number),安全;
 *   ② 有参数时平衡扫到右括号,再跳过可选 `filter (where ...)`,要求紧跟 `::int`,
 *      或外层包裹后紧跟 `::int`(如 `(count(*) filter (...))::int`、`coalesce((count(...))::int, 0)`);
 *   ③ 其余一律视为裸 count(会被驱动当字符串返回)。
 */
function findUncastCounts(raw: string): CountHit[] {
  const src = stripComments(raw)
  const bad: CountHit[] = []
  const re = /\bcount\s*\(/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    let i = m.index + m[0].length
    // ① drizzle count()(允许空参里夹空白)
    if (/^\s*\)/.test(src.slice(i, i + 16))) continue
    // ② 平衡扫过 count(...) 参数
    let depth = 1
    while (i < src.length && depth > 0) {
      const c = src.charAt(i)
      if (c === '(') depth++
      else if (c === ')') depth--
      i++
    }
    let j = i
    const skipWs = () => {
      while (j < src.length && /\s/.test(src.charAt(j))) j++
    }
    skipWs()
    // 可选 FILTER (WHERE ...) 子句(聚合表达式的一部分,不算转型)
    if (/^filter\b/i.test(src.slice(j, j + 6))) {
      j += 6
      skipWs()
      if (src.charAt(j) === '(') {
        let d = 0
        do {
          const c = src.charAt(j)
          if (c === '(') d++
          else if (c === ')') d--
          j++
        } while (d > 0 && j < src.length)
      }
      skipWs()
    }
    // ③ 直接转型,或外层括号包裹后转型
    const directCast = /^::\s*int\b/i.test(src.slice(j, j + 16))
    const wrappedCast =
      src.charAt(j) === ')' && /^\)\s*::\s*int\b/i.test(src.slice(j, j + 16))
    if (directCast || wrappedCast) continue
    bad.push({
      line: src.slice(0, m.index).split('\n').length,
      text: src.slice(m.index, Math.min(j + 8, src.length)).replace(/\s+/g, ' '),
    })
  }
  return bad
}

describe('F-666 手写 count 聚合必须 ::int(接口契约 number)', () => {
  const src = readFileSync(SRC, 'utf8')

  it('源码内不存在未转型的裸 count 聚合', () => {
    expect(findUncastCounts(src)).toEqual([])
  })

  it('票面 6 处 + 同型遗漏 3 处逐个落位(共 9 个统计点)', () => {
    // 票面点名:todayCalls / todayAuth / activeApps / anomalyEvents / today·processing·failed / paidOrders
    // 同型遗漏:performance-dashboard 的 qps(coalesce 内 count)
    const fields = [
      'todayCalls',
      'todayAuth',
      'activeApps',
      'anomalyEvents',
      'today',
      'processing',
      'failed',
      'qps',
      'paidOrders',
    ]
    const lines = src.split('\n')
    for (const field of fields) {
      const line = lines.find((l) => l.includes(`${field}: sql<number>`) && /\bcount\s*\(/i.test(l)) ?? ''
      expect(line, `${field} 未找到手写 count 聚合行`).not.toBe('')
      expect(line, `${field} 缺少 ::int`).toMatch(/::\s*int/)
    }
  })

  it('类型断言与 SQL 一致:count 聚合不得再声明为 sql<string>', () => {
    expect(src).not.toMatch(/sql<string>`\s*\(?count\s*\(/i)
  })

  it('反向对照:去掉任意一处 ::int 扫描器必须变红(防恒绿)', () => {
    const mutated = src.replace(
      "(count(*) filter (where ${orders.status} = 'paid'))::int",
      "count(*) filter (where ${orders.status} = 'paid')",
    )
    expect(mutated).not.toBe(src)
    const hits = findUncastCounts(mutated)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.some((h) => h.text.includes('paid'))).toBe(true)
  })

  it('反向对照:drizzle count() 不被误报(白名单只放行空参调用)', () => {
    expect(findUncastCounts('total: count(\n)')).toEqual([])
    expect(findUncastCounts('x: count(userId)')).toHaveLength(1)
  })
})
