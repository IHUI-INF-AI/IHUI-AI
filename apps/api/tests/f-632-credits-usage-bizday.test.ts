// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, vi } from 'vitest'

const { dbQueue, captured } = vi.hoisted(() => ({
  dbQueue: { items: [] as unknown[][] },
  captured: { groupByArgs: [] as unknown[][] },
}))

// 只读查询链替身:select().from().where().groupBy(),await 时吐队列行
vi.mock('../src/db/index.js', () => {
  function createChain() {
    const chain: {
      then: (resolve: (v: unknown[]) => unknown) => Promise<unknown>
      [m: string]: unknown
    } = {
      then: (resolve) => {
        const result = dbQueue.items.length > 0 ? dbQueue.items.shift()! : []
        return Promise.resolve(result).then(resolve)
      },
    }
    for (const m of ['select', 'from', 'where', 'groupBy']) {
      chain[m] = vi.fn((...args: unknown[]) => {
        if (m === 'groupBy') captured.groupByArgs.push(args)
        return chain
      })
    }
    return chain
  }
  return { db: { select: vi.fn(() => createChain()) } }
})

import { getDailyCreditsUsage } from '../src/services/credits-usage-service'
import { bizDayKey } from '../src/utils/biz-day'

/** 递归收集 drizzle SQL 模板里的字面量 chunk */
function flattenSqlChunks(node: unknown, out: string[]): string[] {
  if (typeof node === 'string') out.push(node)
  else if (Array.isArray(node)) for (const item of node) flattenSqlChunks(item, out)
  else if (node && typeof node === 'object') {
    const rec = node as Record<string, unknown>
    if ('queryChunks' in rec) flattenSqlChunks(rec['queryChunks'], out)
    if ('value' in rec) flattenSqlChunks(rec['value'], out)
  }
  return out
}

function groupByLiterals(): string {
  return captured.groupByArgs.map((args) => flattenSqlChunks(args[0], []).join('')).join('|')
}

describe('F-632 积分消耗日历按上海业务日分桶', () => {
  beforeEach(() => {
    dbQueue.items = []
    captured.groupByArgs = []
  })

  it("消耗/会话两条序列的 SQL 分桶都使用 AT TIME ZONE 'Asia/Shanghai'", async () => {
    dbQueue.items = [[], []]
    const res = await getDailyCreditsUsage({
      userId: 'user-1',
      days: 2,
      now: new Date('2026-09-01T16:30:00Z'),
    })
    const literals = groupByLiterals()
    expect(literals).toContain(`AT TIME ZONE 'Asia/Shanghai'`)
    expect(literals).not.toContain(`AT TIME ZONE 'UTC'`)
    expect(res.timezone).toBe('Asia/Shanghai')
  })

  it('沪 00:30(16:30Z)的消耗落入今日桶,不再因 UTC 日判成昨天而显示今日消耗=0', async () => {
    const now = new Date('2026-09-01T16:30:00Z') // 上海 2026-09-02 00:30
    dbQueue.items = [
      [{ date: '2026-09-02', count: '1', points: '42' }],
      [],
    ]
    const res = await getDailyCreditsUsage({ userId: 'user-1', days: 2, now })
    expect(bizDayKey(now)).toBe('2026-09-02')
    expect(res.endDate).toBe('2026-09-02')
    expect(res.buckets).toEqual([
      { date: '2026-09-01', count: 0, points: 0, sessions: 0 },
      { date: '2026-09-02', count: 1, points: 42, sessions: 0 },
    ])
  })

  it('返回区间端点与 bizDayKey 逐一致(沪日界 16:00Z 翻面)', async () => {
    for (const iso of ['2026-09-01T15:59:59.999Z', '2026-09-01T16:00:00.000Z']) {
      const now = new Date(iso)
      dbQueue.items = [[], []]
      const res = await getDailyCreditsUsage({ userId: 'user-1', days: 1, now })
      expect(res.endDate).toBe(bizDayKey(now))
      expect(res.startDate).toBe(bizDayKey(now))
      expect(res.buckets).toHaveLength(1)
      expect(res.buckets[0]?.date).toBe(bizDayKey(now))
    }
  })
})
