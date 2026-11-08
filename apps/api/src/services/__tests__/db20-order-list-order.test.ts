// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DB-23 回归夹具（纯 mock，不连库）。
 *
 * 缺陷：订单列表按 uuid v4 主键 id 倒序，既不是时间序，也无法利用索引。
 * 断言：列表排序首列必须是 created_at（次级 id 决胜），不得再按随机 id 排。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const state = vi.hoisted(() => ({
  orderTable: null as Record<string, unknown> | null,
  orderByArgs: [] as unknown[],
}))

vi.mock('../../db/index.js', () => {
  const createChain = (projection: Row | undefined) => {
    let table: Record<string, unknown> | null = null
    const chain: Record<string, unknown> = {}
    chain.from = (t: Record<string, unknown>) => {
      table = t
      return chain
    }
    chain.where = () => chain
    chain.orderBy = (...args: unknown[]) => {
      if (table === state.orderTable) state.orderByArgs = args
      return chain
    }
    chain.limit = () => chain
    chain.offset = () => chain
    chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
      const rows = projection && 'count' in projection ? [{ count: 3 }] : []
      return Promise.resolve(rows).then(onFulfilled, onRejected)
    }
    return chain
  }
  return {
    db: {
      select: vi.fn((projection?: Row) => createChain(projection)),
    },
  }
})

/** 递归收集 drizzle SQL 节点里的列名（desc(col) 的 queryChunks 内嵌 Column） */
function collectColumnNames(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out
  const rec = node as Row
  if (typeof rec.name === 'string' && typeof rec.columnType === 'string') out.push(rec.name)
  const chunks = rec.queryChunks
  if (Array.isArray(chunks)) {
    for (const chunk of chunks) collectColumnNames(chunk, out)
  }
  return out
}

import { eduOrders } from '@ihui/database'
import { findOrders } from '../../db/order-queries.js'

describe('DB-23 订单列表排序', () => {
  beforeEach(() => {
    state.orderTable = eduOrders as unknown as Record<string, unknown>
    state.orderByArgs = []
  })

  it('按 created_at DESC, id DESC 排序，而不是随机 uuid 主键', async () => {
    await findOrders({ page: 1, pageSize: 10 })

    expect(state.orderByArgs.length).toBe(2)
    expect(collectColumnNames(state.orderByArgs[0])).toEqual(['created_at'])
    expect(collectColumnNames(state.orderByArgs[1])).toEqual(['id'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
