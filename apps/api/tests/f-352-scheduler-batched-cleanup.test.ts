// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-352 回归锁(2026-11-13)。不连库:mock db 链式。
 *
 * 病灶:`markInactiveAgents` 先全量 SELECT 180 天未更新 agent 再逐行 UPDATE(无 LIMIT、
 * 无集合更新、不复核 status);两个 cleanup 的 `.delete().returning()` 把每一行完整读回
 * Node ⇒ 上千次往返、积压时内存峰值/OOM 与长事务锁。
 *
 * 本文件锁:
 *   ① 标记非活跃只发一条集合 UPDATE(无全量 select、无逐行 update),条件复核 status;
 *   ② cleanup 满 5000 续批、不足即停、总数 = 各批库确认行数之和;
 *   ③ 删除子查询带 LIMIT 5000(两个 cleanup 都是);
 *   ④ returning 只取主键 id,不物化整行;
 *   ⑤ 失败先记 logger.error(任务名 + 已删数 + 错误)再原样抛出。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { state, mockLoggerError, mockUpdate, mockDelete, mockSelect } = vi.hoisted(() => {
  const state = {
    /** update().returning() 的返回值(库确认被更新的行)。 */
    updateRows: [] as { agentId: string }[],
    updateSet: [] as unknown[],
    updateWhere: [] as unknown[],
    updateReturning: [] as unknown[],
    /** 第 N 批 delete().returning() 返回的行数。 */
    deleteBatches: [] as number[],
    deleteCalls: 0,
    deleteWhere: [] as unknown[],
    deleteReturning: [] as unknown[],
    /** 子查询 select().from().where().limit() 的捕获。 */
    childWhere: [] as unknown[],
    childLimits: [] as unknown[],
    deleteError: new Error('db down'),
    /** 第几批抛错(-1 = 不抛)。 */
    deleteFailAt: -1,
  }
  return {
    state,
    mockLoggerError: vi.fn(),
    mockUpdate: vi.fn(),
    mockDelete: vi.fn(),
    mockSelect: vi.fn(),
  }
})

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: mockLoggerError },
}))

vi.mock('../src/db/index.js', () => {
  const makeUpdate = () => ({
    set: (arg: unknown) => {
      state.updateSet.push(arg)
      return {
        where: (arg2: unknown) => {
          state.updateWhere.push(arg2)
          return {
            returning: (arg3: unknown) => {
              state.updateReturning.push(arg3)
              return Promise.resolve(state.updateRows)
            },
          }
        },
      }
    },
  })

  const makeDelete = () => ({
    where: (arg: unknown) => {
      state.deleteWhere.push(arg)
      return {
        returning: (arg2: unknown) => {
          state.deleteReturning.push(arg2)
          const idx = state.deleteCalls++
          if (idx === state.deleteFailAt) return Promise.reject(state.deleteError)
          const n = state.deleteBatches[idx] ?? 0
          return Promise.resolve(Array.from({ length: n }, (_, i) => ({ id: `id-${idx}-${i}` })))
        },
      }
    },
  })

  const makeSelect = () => {
    const step: Record<string, unknown> = {}
    step.from = () => step
    step.where = (arg: unknown) => {
      state.childWhere.push(arg)
      return step
    }
    step.limit = (arg: unknown) => {
      state.childLimits.push(arg)
      return step
    }
    step.then = (resolve: (v: unknown) => void) => resolve([])
    return step
  }

  mockUpdate.mockImplementation(() => makeUpdate())
  mockDelete.mockImplementation(() => makeDelete())
  mockSelect.mockImplementation(() => makeSelect())

  return {
    db: {
      update: mockUpdate,
      delete: mockDelete,
      select: mockSelect,
      insert: vi.fn(),
      execute: vi.fn().mockResolvedValue([]),
    },
    dbRead: {},
    dbClient: {},
  }
})

import {
  markInactiveAgents,
  cleanupOldHeatStats,
  cleanupOauthSessions,
} from '../src/services/scheduled-tasks-service.js'

/**
 * drizzle 的 SQL 对象没有可裸调的 toString,但 queryChunks 递归里带着列元数据
 * (name = SQL 列名)与 Param(value = 绑定值)。按此还原路由真发出去的条件。
 */
function describeCondition(
  node: unknown,
  seen = new Set<unknown>(),
): { columns: string[]; params: unknown[] } {
  const acc = { columns: [] as string[], params: [] as unknown[] }
  const walk = (n: unknown): void => {
    if (!n || typeof n !== 'object' || seen.has(n)) return
    seen.add(n)
    const o = n as Record<string, unknown>
    if (typeof o.name === 'string' && typeof o.getSQL === 'function') acc.columns.push(o.name)
    if (o.constructor?.name === 'Param') acc.params.push(o.value)
    if (Array.isArray(o.queryChunks)) {
      for (const q of o.queryChunks) walk(typeof q === 'function' ? (q as () => unknown)() : q)
    }
  }
  walk(node)
  return acc
}

beforeEach(() => {
  state.updateRows = []
  state.updateSet.length = 0
  state.updateWhere.length = 0
  state.updateReturning.length = 0
  state.deleteBatches = []
  state.deleteCalls = 0
  state.deleteWhere.length = 0
  state.deleteReturning.length = 0
  state.childWhere.length = 0
  state.childLimits.length = 0
  state.deleteFailAt = -1
  mockLoggerError.mockClear()
  mockUpdate.mockClear()
  mockDelete.mockClear()
  mockSelect.mockClear()
})

describe('F-352 定时清理分批化', () => {
  it('① markInactiveAgents 只发一条集合 UPDATE,条件复核 status', async () => {
    state.updateRows = [{ agentId: 'a1' }, { agentId: 'a2' }]

    const res = await markInactiveAgents()

    expect(res).toEqual({ scanned: 2, updated: 2 })
    // 一条集合 UPDATE:既无全量 SELECT,也不会因行数产生第二次 update
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockSelect).not.toHaveBeenCalled()
    expect(state.updateSet).toHaveLength(1)
    expect(state.updateSet[0]).toMatchObject({ status: 'inactive' })

    const { columns, params } = describeCondition(state.updateWhere[0])
    expect(columns).toContain('status')
    expect(columns).toContain('updated_at')
    expect(params).toContain('published')
    // 逐行 update 的特征是按 agent_id 单行定位;集合更新不应出现
    expect(columns).not.toContain('agent_id')
  })

  it('② cleanupOldHeatStats 满 5000 续批、不足即停、总数正确', async () => {
    // 第一次:3 批(满、满、不足);第二次:2 批(满、不足)。deleteBatches 按调用序整体排布。
    state.deleteBatches = [5000, 5000, 123, 5000, 100]

    const res = await cleanupOldHeatStats()

    expect(res.deleted).toBe(10123)
    expect(mockDelete).toHaveBeenCalledTimes(3)
    // 每批子查询都带 LIMIT 5000
    expect(state.childLimits).toEqual([5000, 5000, 5000])

    const res2 = await cleanupOldHeatStats()
    expect(res2.deleted).toBe(5100)
    expect(mockDelete).toHaveBeenCalledTimes(5)
  })

  it('②b cleanupOauthSessions 同样按批计数(首批不足即停)', async () => {
    state.deleteBatches = [7]

    const res = await cleanupOauthSessions()

    expect(res.deleted).toBe(7)
    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(describeCondition(state.childWhere[0]).columns).toContain('expires_at')
  })

  it('③ 删除子查询带 LIMIT 5000(两个 cleanup 都是)', async () => {
    state.deleteBatches = [0]
    await cleanupOldHeatStats()
    await cleanupOauthSessions()

    expect(state.childLimits).toEqual([5000, 5000])
    expect(describeCondition(state.childWhere[0]).columns).toContain('created_at')
  })

  it('④ returning 只取 id,不物化整行字段', async () => {
    await markInactiveAgents()
    const updateFields = state.updateReturning[0] as Record<string, unknown>
    expect(Object.keys(updateFields)).toEqual(['agentId'])
    expect((updateFields['agentId'] as { name?: string }).name).toBe('agent_id')

    state.deleteBatches = [0]
    await cleanupOldHeatStats()
    const deleteFields = state.deleteReturning[0] as Record<string, unknown>
    expect(Object.keys(deleteFields)).toEqual(['id'])
    expect((deleteFields['id'] as { name?: string }).name).toBe('id')
  })

  it('⑤ 删除失败先记 logger.error(任务名/已删数/错误)再原样抛出', async () => {
    state.deleteBatches = [5000, 5000]
    state.deleteFailAt = 1

    await expect(cleanupOldHeatStats()).rejects.toBe(state.deleteError)

    expect(mockLoggerError).toHaveBeenCalledTimes(1)
    const [msg, meta] = mockLoggerError.mock.calls[0] as [string, Record<string, unknown>]
    expect(msg).toContain('cleanup-old-heat')
    expect(meta).toMatchObject({
      jobName: 'cleanup-old-heat',
      deleted: 5000,
      error: state.deleteError,
    })
  })
})
