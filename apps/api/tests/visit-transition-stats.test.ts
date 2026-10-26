// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 页面流转的判据取证(2026-10-26 立)。
 *
 * 钉的是**口径**:
 *  - 自环(`/chat → /chat`)不是流转,是刷新 —— 混进来会把真正的流转挤掉;
 *  - `totalMoves` 是**全量**页对次数之和,不是只有 TOP N 的和
 *    (只把 TOP N 加起来却叫"总次数",读数会偏小);
 *  - 没有"上一个页面"的那一行(会话的第一次访问)不是流转;
 *  - 「上一个页面」必须用窗口函数按 session_id 分区取
 *    (`lag(url) over (partition by session_id order by created_at, id)`),
 *    `id` 参与排序是为了同刻写入的行也有确定顺序。
 *
 * 零连接:本文件不碰 PG 8810 / Redis 8811(AGENTS §5 测试隔离铁律);
 * `../src/db/index.js` 被 mock 掉,只验判据与 SQL 形状。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {} }))

import {
  buildVisitTransition,
  TRANSITION_PREV_URL_SQL,
  VISIT_TRANSITION_WINDOW_HOURS,
} from '../src/services/visit-transition-stats-service.js'

/** 把 drizzle 的 SQL 对象摊成可搜文本(不 JSON.stringify:列引用带 PgTable ⇒ 循环)。 */
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

describe('页面流转:页对口径', () => {
  it('A1 自环(同页刷新)不算流转', () => {
    const s = buildVisitTransition([
      { fromUrl: '/chat', toUrl: '/chat', n: 40 },
      { fromUrl: '/', toUrl: '/chat', n: 10 },
    ])
    expect(s.top).toHaveLength(1)
    expect(s.top[0]).toEqual({ fromUrl: '/', toUrl: '/chat', n: 10 })
  })

  it('A2 没有「上一个页面」的行不是流转(会话的第一次访问)', () => {
    const s = buildVisitTransition([{ fromUrl: null, toUrl: '/', n: 99 }])
    expect(s.top).toHaveLength(0)
    expect(s.totalMoves).toBe(0)
  })

  it('A3 totalMoves 是全量之和,不是只有 TOP N 的和', () => {
    const s = buildVisitTransition(
      [
        { fromUrl: '/a', toUrl: '/b', n: 5 },
        { fromUrl: '/c', toUrl: '/d', n: 3 },
        { fromUrl: '/e', toUrl: '/f', n: 2 },
      ],
      1,
    )
    expect(s.top).toHaveLength(1)
    expect(s.top[0].n).toBe(5)
    // 全量 5+3+2 = 10,不是 5
    expect(s.totalMoves).toBe(10)
    expect(s.distinctPairs).toBe(3)
  })

  it('A4 次数相同时按路径排序(读数稳定,不随查询返回顺序漂)', () => {
    const s = buildVisitTransition([
      { fromUrl: '/z', toUrl: '/b', n: 5 },
      { fromUrl: '/a', toUrl: '/b', n: 5 },
    ])
    expect(s.top[0].fromUrl).toBe('/a')
  })

  it('A5 空输入落空集(不是 0 行伪装成读数)', () => {
    const s = buildVisitTransition([])
    expect(s.top).toHaveLength(0)
    expect(s.totalMoves).toBe(0)
    expect(s.distinctPairs).toBe(0)
  })
})

describe('页面流转:SQL 形状', () => {
  it('B1 「上一个页面」用窗口函数按 session_id 分区取', () => {
    const text = sqlText(TRANSITION_PREV_URL_SQL)
    expect(text).toContain('lag(')
    expect(text).toContain('partition by')
    expect(text).toContain('order by')
  })

  it('B2 窗口与大屏其它腿同档(24h),不同口径不许并排比', () => {
    expect(VISIT_TRANSITION_WINDOW_HOURS).toBe(24)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
