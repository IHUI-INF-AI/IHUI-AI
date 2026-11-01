// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 门 121 接线(2026-11-01)的删除安全锁:新挂上触发点的两族清理都必须
// 「先按批上界取主键 → 再按主键删」,短批即止、空批不落 DELETE。
// 批上界的**具体数值不在测试里复写**(§22c 同一纪律):先用一轮空批把该族自己
// 用的 limit 实参量出来,再据此造"满批"验证续跑。
// 测试禁连生产库(§5):../src/db/index.js 整面换成链式替身,零 SQL 落库。
import { describe, it, expect, vi } from 'vitest'
import type * as DrizzleOrm from 'drizzle-orm'

const { state } = vi.hoisted(() => ({
  state: {
    /** 每轮 select 出的主键批次队列(出尽后给空批 = 已排空) */
    batchQueue: [] as unknown[][],
    selectLimits: [] as number[],
    deleteTables: [] as unknown[],
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          async limit(n: number) {
            state.selectLimits.push(n)
            return state.batchQueue.shift() ?? []
          },
        }),
      }),
    }),
    delete: (table: unknown) => ({
      async where() {
        state.deleteTables.push(table)
        return []
      },
    }),
    insert: vi.fn(),
    update: vi.fn(),
  },
  dbRead: { select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }) },
}))

// 半 mock:保留 drizzle-orm 全部实现,只把 inArray 包成 spy 以便断言"按主键集合删"
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof DrizzleOrm>()
  return { ...actual, inArray: vi.fn(actual.inArray) }
})

import { inArray } from 'drizzle-orm'
import { apiKeyShares } from '@ihui/database'
import { cleanupExpired } from '../src/services/api-key-share-service.js'
import { aiRelayChannelDailyUsage, resetDailyQuota } from '../src/services/channel-quota-service.js'

const inArrayMock = vi.mocked(inArray)

function resetState(batches: unknown[][]) {
  state.batchQueue = batches
  state.selectLimits = []
  state.deleteTables = []
  inArrayMock.mockClear()
}

/** 造 n 条主键行。 */
function ids(n: number): Array<{ id: string }> {
  return Array.from({ length: n }, (_, i) => ({ id: `id-${i}` }))
}

/** 先用一轮空批"量出"该族自己用的批上界(不在测试里复写常量)。 */
async function observeBatchLimit(run: () => Promise<unknown>): Promise<number> {
  resetState([[]])
  await run()
  const cap = state.selectLimits[0]
  if (typeof cap !== 'number') throw new Error('批上界未量到(该族没有走 limit?)')
  return cap
}

describe('cleanupExpired(api_key_shares)— 批上界与按主键删', () => {
  it('批上界存在且有限;空批不落 DELETE', async () => {
    const cap = await observeBatchLimit(() => cleanupExpired())

    expect(cap).toBeGreaterThan(0)
    expect(cap).toBeLessThanOrEqual(1000)
    expect(state.deleteTables).toHaveLength(0)
    expect(inArrayMock).not.toHaveBeenCalled()
  })

  it('先按批取主键、再按主键删;满批续跑、短批即止,条数如实累计', async () => {
    const cap = await observeBatchLimit(() => cleanupExpired())
    resetState([ids(cap), ids(3)])

    const deleted = await cleanupExpired()

    expect(deleted).toBe(cap + 3)
    expect(state.selectLimits).toEqual([cap, cap])
    expect(inArrayMock).toHaveBeenCalledTimes(2)
    // 两轮的删除集合都来自"刚取到的那批主键",而不是范围条件
    expect(inArrayMock.mock.calls[0]?.[0]).toBe(apiKeyShares.id)
    expect(inArrayMock.mock.calls[0]?.[1]).toHaveLength(cap)
    expect(inArrayMock.mock.calls[1]?.[0]).toBe(apiKeyShares.id)
    expect(inArrayMock.mock.calls[1]?.[1]).toEqual(['id-0', 'id-1', 'id-2'])
    expect(state.deleteTables).toEqual([apiKeyShares, apiKeyShares])
  })
})

describe('resetDailyQuota(ai_relay_channel_daily_usage)— 批上界与按主键删', () => {
  it('先按批取主键、再按主键删;短批即止', async () => {
    const cap = await observeBatchLimit(() => resetDailyQuota())
    expect(cap).toBeGreaterThan(0)
    expect(cap).toBeLessThanOrEqual(1000)
    resetState([ids(cap), ids(2)])

    const deleted = await resetDailyQuota()

    expect(deleted).toBe(cap + 2)
    expect(state.selectLimits).toEqual([cap, cap])
    expect(inArrayMock).toHaveBeenCalledTimes(2)
    expect(inArrayMock.mock.calls[0]?.[0]).toBe(aiRelayChannelDailyUsage.id)
    expect(inArrayMock.mock.calls[1]?.[1]).toEqual(['id-0', 'id-1'])
    expect(state.deleteTables).toEqual([aiRelayChannelDailyUsage, aiRelayChannelDailyUsage])
  })

  it('无到期行:不发 DELETE,返回 0', async () => {
    resetState([[]])

    await expect(resetDailyQuota()).resolves.toBe(0)
    expect(state.deleteTables).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
