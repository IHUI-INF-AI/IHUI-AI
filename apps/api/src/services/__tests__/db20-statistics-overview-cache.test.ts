// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * DB-25 回归夹具（纯 mock，不连库）。
 *
 * 缺陷：/statistics/overview 对任意登录用户每次请求都发 8 条全表 count(*)。
 * 断言：60s 进程内缓存生效——第二次调用不再触碰数据库，返回同一份聚合结果。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const state = vi.hoisted(() => ({ selectCalls: 0 }))

vi.mock('../../db/index.js', () => {
  const createChain = () => {
    const rows: Row[] = [{ count: 5 }]
    const chain: Record<string, unknown> = {}
    chain.from = () => chain
    chain.where = () => chain
    chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(onFulfilled, onRejected)
    return chain
  }
  return {
    db: {
      select: vi.fn(() => {
        state.selectCalls += 1
        return createChain()
      }),
    },
  }
})

import {
  getOverviewStatistics,
  __resetStatisticsOverviewCacheForTest,
} from '../../db/statistics-queries.js'

describe('DB-25 总览统计缓存', () => {
  beforeEach(() => {
    state.selectCalls = 0
    __resetStatisticsOverviewCacheForTest()
  })

  it('首次 8 条 count，第二次命中缓存不再查库', async () => {
    const first = await getOverviewStatistics()
    expect(state.selectCalls).toBe(8)
    expect(first).toEqual({
      memberTotal: 5,
      lessonTotal: 5,
      examTotal: 5,
      signupTotal: 5,
      examRecordTotal: 5,
      postTotal: 5,
      announcementTotal: 5,
      articleTotal: 5,
    })

    const second = await getOverviewStatistics()
    expect(state.selectCalls).toBe(8)
    expect(second).toEqual(first)
  })
})
