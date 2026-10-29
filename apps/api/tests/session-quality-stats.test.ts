// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话质量聚合的判据取证(2026-10-26 立)。
 *
 * 钉的是**口径**不是形状:
 *  - 会话数为 0 时,单页占比与人均一律 null(不是 0):窗口内没有会话是**判过**的结果,
 *    写成 0% 会被读成"来的人都不翻页"(把空集说成结论)。
 *  - 总量腿的行键 = drizzle 的 select 别名(camelCase),**不是** SQL 列名(snake_case):
 *    实测踩过这一脚 —— 按 snake_case 读 ⇒ 只有 sessions 命中、其余读数全 0,
 *    而屏上看不出任何异常(0 也是合法读数),所以钉死。
 *  - 深度分档恒为四档且由服务端数(前端只渲染,不许自己数档)。
 *  - 落地页取"该会话最早一条有 url 的记录":url 为 null 的噪声行不得占住落地页。
 *
 * 零连接:本文件不碰 PG 8810 / Redis 8811(AGENTS §5 测试隔离铁律);
 * `../src/db/index.js` 被 mock 掉,只验判据与 SQL 形状。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {} }))

import {
  buildSessionQuality,
  SESSION_DEPTH_BUCKETS,
  SESSION_ROWS_COLUMNS,
  SESSION_QUALITY_WINDOW_HOURS,
} from '../src/services/session-quality-stats-service.js'

/**
 * 把 drizzle 的 SQL 对象摊成可搜文本(形状断言用)。
 * 不能用 JSON.stringify:列引用里带着 PgTable → 循环结构 ⇒ 直接抛错。
 */
function sqlText(obj: unknown): string {
  const out: string[] = []
  const seen = new Set<unknown>()
  const walk = (node: unknown): void => {
    if (
      node === null ||
      node === undefined ||
      typeof node === 'number' ||
      typeof node === 'boolean'
    )
      return
    if (typeof node === 'string') {
      out.push(node)
      return
    }
    if (typeof node !== 'object') return
    if (seen.has(node)) return
    seen.add(node)
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    for (const value of Object.values(node as Record<string, unknown>)) walk(value)
  }
  walk(obj)
  return out.join(' ')
}

describe('会话质量:总量腿的行键必须是 drizzle 的 select 别名(camelCase)', () => {
  it('A1 按 camelCase 别名取值,六个读数全部命中', () => {
    const q = buildSessionQuality(
      {
        sessions: 6,
        singlePageSessions: 4,
        totalPv: 11,
        depth1: 4,
        depth2to3: 1,
        depth4to7: 1,
        depth8plus: 0,
      },
      [],
      [],
    )
    expect(q.sessions).toBe(6)
    expect(q.singlePageSessions).toBe(4)
    expect(q.singlePageRate).toBeCloseTo(4 / 6, 6)
    expect(q.avgPvPerSession).toBeCloseTo(11 / 6, 6)
    expect(q.depth.map((d) => d.sessions)).toEqual([4, 1, 1, 0])
  })

  it('A2 snake_case 列名读不出数(反面对照:那正是当初静默读成 0 的形态)', () => {
    // 按 SQL 列名喂 ⇒ 一个读数都读不到 ⇒ sessions=0、占比 null
    const q = buildSessionQuality(
      {
        sessions: 6,
        single_page_sessions: 4,
        total_pv: 11,
        depth_1: 4,
      } as never,
      [],
      [],
    )
    expect(q.sessions).toBe(6)
    expect(q.singlePageSessions).toBe(0)
    expect(q.singlePageRate).toBe(0)
  })

  it('A3 字符串数字也认(PG 的 int4 经某些驱动回传字符串时不得读成 0)', () => {
    const q = buildSessionQuality(
      { sessions: '6', singlePageSessions: '4', totalPv: '11', depth1: '4' },
      [],
      [],
    )
    expect(q.sessions).toBe(6)
    expect(q.singlePageSessions).toBe(4)
    expect(q.singlePageRate).toBeCloseTo(4 / 6, 6)
  })
})

describe('会话质量:空集不许被说成结论', () => {
  it('B1 窗口内没有会话 ⇒ 占比与人均为 null(不是 0、不是 0%)', () => {
    const q = buildSessionQuality(
      { sessions: 0, singlePageSessions: 0, totalPv: 0, depth1: 0 },
      [],
      [],
    )
    expect(q.sessions).toBe(0)
    expect(q.singlePageRate).toBeNull()
    expect(q.avgPvPerSession).toBeNull()
    // 深度四档恒在(零会话时各档为 0),前端才能画出空条而不是崩掉
    expect(q.depth).toHaveLength(4)
    expect(q.depth.every((d) => d.sessions === 0)).toBe(true)
  })

  it('B2 整个总量腿取不到(aggRow 缺失)⇒ 同样落 null,不落 0', () => {
    const q = buildSessionQuality(undefined, [], [])
    expect(q.sessions).toBe(0)
    expect(q.singlePageRate).toBeNull()
    expect(q.avgPvPerSession).toBeNull()
  })
})

describe('会话质量:深度分档与落地页', () => {
  it('C1 分档常量逐字是四档(前端不许自己数档,桶键必须能对上)', () => {
    expect([...SESSION_DEPTH_BUCKETS]).toEqual(['1', '2-3', '4-7', '8+'])
  })

  it('C2 落地页行按 entryUrl 取,空 url 行被丢掉', () => {
    const q = buildSessionQuality(
      { sessions: 3 },
      [
        { entryUrl: '/ecosystem', sessions: 2, singlePageSessions: 1 },
        { entryUrl: '', sessions: 9, singlePageSessions: 9 },
        { entryUrl: null, sessions: 9, singlePageSessions: 9 },
      ],
      [],
    )
    expect(q.entryPages).toHaveLength(1)
    expect(q.entryPages[0]).toEqual({ url: '/ecosystem', sessions: 2, singlePageSessions: 1 })
  })

  it('C3 落地页取"最早一条有 url 的记录":array_agg + filter 不得被摘掉', () => {
    const text = sqlText(SESSION_ROWS_COLUMNS.entryUrl)
    expect(text).toContain('array_agg')
    // filter 是承重的那半句:去掉它,url 为 null 的噪声行会占住落地页
    expect(text).toContain('filter')
    expect(text).toContain('created_at')
  })

  it('C4 窗口与大屏其它腿同档(24h),不同口径不许并排比', () => {
    expect(SESSION_QUALITY_WINDOW_HOURS).toBe(24)
  })
})

describe('会话质量:退出页(2026-10-27 立,与落地页镜像)', () => {
  it('D1 退出页行按 exitUrl 取,空 url 行被丢掉', () => {
    const q = buildSessionQuality(
      { sessions: 3 },
      [],
      [
        { exitUrl: '/pricing', sessions: 2, singlePageSessions: 1 },
        { exitUrl: '', sessions: 9, singlePageSessions: 9 },
        { exitUrl: null, sessions: 9, singlePageSessions: 9 },
      ],
    )
    expect(q.exitPages).toHaveLength(1)
    expect(q.exitPages[0]).toEqual({ url: '/pricing', sessions: 2, singlePageSessions: 1 })
  })

  it('D2 退出页取"最后一条有 url 的记录":array_agg 倒序 + filter 不得被摘掉', () => {
    const text = sqlText(SESSION_ROWS_COLUMNS.exitUrl)
    expect(text).toContain('array_agg')
    expect(text).toContain('filter')
    // 与落地页的差别只在排序方向:desc = 最后一条;改成 asc 就成了第二个落地页腿
    expect(text).toContain('desc')
    expect(text).toContain('created_at')
  })

  it('D3 单页会话两榜同时计入(那一页既是入口也是出口),不做互斥剔除', () => {
    const q = buildSessionQuality(
      { sessions: 1 },
      [{ entryUrl: '/only', sessions: 1, singlePageSessions: 1 }],
      [{ exitUrl: '/only', sessions: 1, singlePageSessions: 1 }],
    )
    expect(q.entryPages[0]?.url).toBe('/only')
    expect(q.exitPages[0]?.url).toBe('/only')
    expect(q.entryPages[0]?.singlePageSessions).toBe(1)
    expect(q.exitPages[0]?.singlePageSessions).toBe(1)
  })

  it('D4 退出页腿取不到(exitRows 空)不折成 entryPages 兜底:两榜各自独立', () => {
    const q = buildSessionQuality(
      { sessions: 2 },
      [{ entryUrl: '/a', sessions: 2, singlePageSessions: 0 }],
      [],
    )
    expect(q.entryPages).toHaveLength(1)
    expect(q.exitPages).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
