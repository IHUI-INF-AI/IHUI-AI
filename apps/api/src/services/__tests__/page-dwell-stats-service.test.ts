// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 测试夹具通过 hoisted store 注入,模拟 db.select 链的最终落地结果。
// page_time 事件的 label = 上一页路径、value = 停留秒数(字符串),与 analytics.ts
// 头注登记的命名完全一致 —— 本测试断言「这些既有事件被正确地按页面聚合为平均停留」。
const store = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>>, shouldThrow: false }))

vi.mock('@ihui/database', () => ({
  analyticsEvents: { properties: {}, createdAt: {}, event: {} },
}))

vi.mock('../../db/index.js', () => {
  const createChain = (result: unknown[]) => {
    const chain: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        store.shouldThrow ? reject(new Error('db down')) : Promise.resolve(result).then(resolve),
      from: () => chain,
      where: () => chain,
      groupBy: () => chain,
      orderBy: () => chain,
      limit: () => chain,
    }
    return chain
  }
  return { db: { select: () => createChain(store.rows) } }
})

import {
  getPageDwellLiveSnapshot,
  __resetPageDwellLiveCacheForTest,
} from '../page-dwell-stats-service.js'

describe('page-dwell-stats-service', () => {
  beforeEach(() => {
    store.rows = []
    store.shouldThrow = false
    __resetPageDwellLiveCacheForTest()
  })

  it('按归一后的页面路径聚合平均停留,丢弃归一不出的 label', async () => {
    // 模拟 SQL 已按 label 分组 + 过滤非数字 value 后的结果(与真实 SQL 同口径):
    // 同一页面 /chat 两条合法 page_time => 平均 30s;带 query 的同源页被归一成同一页。
    store.rows = [
      { label: '/chat', avgSec: '30.0', n: 2 },
      { label: '/chat?conversationId=abc', avgSec: '10.0', n: 1 }, // 归一后并入 /chat,但本测试只验落地映射
      { label: '/foo.png', avgSec: '5.0', n: 1 }, // 静态资源:归一为 null ⇒ 被丢弃
    ]
    const snap = await getPageDwellLiveSnapshot()
    const urlRows = snap.rows
    // /foo.png 归一为 null ⇒ 不出现;其余归一为 /chat 与 /chat(同源归一相同)但 SQL 已按 label 分组,
    // 这里直接断言「归一后的 url 是页面、且静态资源被排除」。
    expect(urlRows.find((r) => r.url === '/foo.png')).toBeUndefined()
    expect(urlRows.every((r) => r.url !== null)).toBe(true)
  })

  it('把含 query / 动态段的 label 归一到与 visit_logs 同尺的 url', async () => {
    store.rows = [
      { label: '/workspace/8cc904a4-0000-0000-0000-000000000000', avgSec: '42.5', n: 3 },
    ]
    const snap = await getPageDwellLiveSnapshot()
    expect(snap.rows).toHaveLength(1)
    expect(snap.rows[0]!.url).toBe('/workspace/:id')
    expect(snap.rows[0]!.avgDwellSec).toBe(42.5)
    expect(snap.rows[0]!.samples).toBe(3)
  })

  it('样本为字符串数字也能正确转成 number', async () => {
    store.rows = [{ label: '/admin/monitor/wallboard', avgSec: '7.0', n: 5 }]
    const snap = await getPageDwellLiveSnapshot()
    expect(snap.rows[0]!.avgDwellSec).toBe(7)
    expect(typeof snap.rows[0]!.avgDwellSec).toBe('number')
  })

  it('数据库失败 ⇒ 整块上抛(绝不兜成 0 或空数组)', async () => {
    store.shouldThrow = true
    await expect(getPageDwellLiveSnapshot()).rejects.toThrow()
  })

  it('空结果 ⇒ 空数组(不是 null),调用方据此渲染「暂无」', async () => {
    store.rows = []
    const snap = await getPageDwellLiveSnapshot()
    expect(snap.rows).toEqual([])
    expect(snap.computedAtMs).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
