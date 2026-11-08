// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-03 回归锁(2026-11-08,apps/api P2 越权组)。
 *
 * 缺陷:/chat/stream 上下文压缩时按客户端 metadata.conversationId 直接
 * replaceMessages(先删后插),无属主谓词 ⇒ 可清空/覆写他人会话。
 * 判据:传入非属主时,事务内 delete/insert **零调用**。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const U1 = '00000000-0000-4000-8000-0000000000aa'
const U2 = '00000000-0000-4000-8000-0000000000bb'
const CONV = '11111111-1111-4111-8111-111111111111'

const state = vi.hoisted(() => ({
  ownedRows: [] as Array<{ id: string }>,
  rowsForProjection: [] as Array<{ turnOrdinal: number; content: string }>,
  deleted: 0,
  inserted: 0,
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    transaction: async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        select: () => ({
          from: () => ({
            where: () => {
              const rows = state.rowsForProjection
              return {
                limit: async () => state.ownedRows,
                // rollHistoryProjection 直接 await .where(...) 取行数组
                then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
                  Promise.resolve(rows).then(res, rej),
              }
            },
          }),
        }),
        update: () => ({
          set: () => ({
            where: async () => undefined,
          }),
        }),
        delete: () => ({
          where: async () => {
            state.deleted += 1
          },
        }),
        insert: () => ({
          values: async () => {
            state.inserted += 1
          },
        }),
      }
      await fn(tx)
    },
  },
  dbRead: {},
}))

import { replaceMessages } from '../src/db/chat-queries.js'

describe('F-03 replaceMessages 会话属主校验', () => {
  beforeEach(() => {
    state.ownedRows = []
    state.rowsForProjection = []
    state.deleted = 0
    state.inserted = 0
  })

  it('非属主:整段跳过,删除与插入零调用', async () => {
    state.ownedRows = [] // 会话不属于 U2
    await replaceMessages(CONV, [{ role: 'user', content: 'attacker payload' }], U2)
    expect(state.deleted).toBe(0)
    expect(state.inserted).toBe(0)
  })

  it('属主本人:正常删旧插新', async () => {
    state.ownedRows = [{ id: CONV }]
    await replaceMessages(CONV, [{ role: 'user', content: 'ok' }], U1)
    expect(state.deleted).toBe(1)
    expect(state.inserted).toBe(1)
  })
})
