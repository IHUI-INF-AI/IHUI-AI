// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-321 回归锁(2026-11-13)。
 *
 * 病灶:`groupBy(label)/limit(TOP_N)` 作用在原始 label 上,归一在取回后才做 ⇒
 *      `/course/123` 与 `/course/456` 各占一行、归一后同为 `/course/:id`,
 *      返回同 url 重复行且动态路由挤占 TOP_N 名额(前端 find 只取第一行)。
 *
 * 本文件锁:
 *   ① 同一动态模板的多行合并为一行:次数相加、时长按样本数加权(非两行均值再平均);
 *   ② 归一后排序取 TOP_N,不出现同 url 重复行、不因原始 label 分组丢真实高停留页;
 *   ③ 非动态路径行为不变(防误伤)。
 *
 * 不连 DB:mocked db.select 直接返回「SQL 已按原始 label 分组」的原始行。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  limits: [] as unknown[],
}))

vi.mock('@ihui/database', () => ({
  analyticsEvents: { properties: {}, createdAt: {}, event: {} },
}))

vi.mock('../src/db/index.js', () => {
  const createChain = (result: unknown[]) => {
    const chain: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
      from: () => chain,
      where: () => chain,
      groupBy: () => chain,
      orderBy: () => chain,
      limit: (n: unknown) => {
        store.limits.push(n)
        return chain
      },
    }
    return chain
  }
  return { db: { select: () => createChain(store.rows) } }
})

import {
  getPageDwellLiveSnapshot,
  __resetPageDwellLiveCacheForTest,
} from '../src/services/page-dwell-stats-service.js'

describe('F-321 page-dwell 归一后合并/排序', () => {
  beforeEach(() => {
    store.rows = []
    store.limits = []
    __resetPageDwellLiveCacheForTest()
  })

  it('动态段的多个 label 合并为一行:次数相加、时长加权', async () => {
    // 归一后同为 /course/:id => 总秒数 20*3 + 40*1 = 100,样本 4,加权均值 25
    store.rows = [
      { label: '/course/123', avgSec: '20.0', n: 3 },
      { label: '/course/456', avgSec: '40.0', n: 1 },
    ]
    const snap = await getPageDwellLiveSnapshot()
    expect(snap.rows).toHaveLength(1)
    expect(snap.rows[0]).toEqual({ url: '/course/:id', avgDwellSec: 25, samples: 4 })
    // 加权合并而非两行均值再平均((20+40)/2=30)
    expect(snap.rows[0]!.avgDwellSec).not.toBe(30)
  })

  it('归一后排序取 TOP_N,同 url 不重复且动态页不挤占名额', async () => {
    const statics = Array.from({ length: 12 }, (_, i) => ({
      label: `/topic-${String.fromCharCode(97 + i)}`,
      avgSec: String(70 - i),
      n: 1,
    }))
    store.rows = [
      { label: '/course/123', avgSec: '90.0', n: 1 },
      { label: '/course/456', avgSec: '80.0', n: 1 },
      ...statics,
    ]
    const snap = await getPageDwellLiveSnapshot()
    // 合并后 /course/:id 均值 85 排第一;12 个非动态页只留 11 个,最末 /topic-l(59) 被截
    expect(snap.rows).toHaveLength(12)
    expect(snap.rows[0]).toEqual({ url: '/course/:id', avgDwellSec: 85, samples: 2 })
    const urls = snap.rows.map((r) => r.url)
    expect(new Set(urls).size).toBe(urls.length)
    expect(urls).toContain('/topic-a')
    expect(urls).not.toContain('/topic-l')
    // 合并后按时长降序
    const secs = snap.rows.map((r) => r.avgDwellSec)
    expect([...secs].sort((a, b) => b - a)).toEqual(secs)
  })

  it('取回阶段放大名额,避免按原始 label 截断挤掉真实高停留页', async () => {
    await getPageDwellLiveSnapshot()
    expect(store.limits).toEqual([120])
    expect(store.limits[0]).toBeGreaterThan(12)
  })

  it('非动态路径行为不变:均值/样本原样、静态资源与路由组仍被丢弃', async () => {
    store.rows = [
      { label: '/dashboard', avgSec: '12.5', n: 4 },
      { label: '/agents', avgSec: '7.0', n: 2 },
      { label: '/logo.png', avgSec: '99.0', n: 1 },
      { label: '/(main)/admin', avgSec: '88.0', n: 1 },
    ]
    const snap = await getPageDwellLiveSnapshot()
    expect(snap.rows).toEqual([
      { url: '/dashboard', avgDwellSec: 12.5, samples: 4 },
      { url: '/agents', avgDwellSec: 7, samples: 2 },
    ])
  })
})
