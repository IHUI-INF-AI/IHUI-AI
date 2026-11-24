// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-553 回归锁(2026-11-13)。不连库:mock db 链式。
 *
 * 病灶:`archiveDailyData` 里 audit_logs / messages / relay_messages / notifications
 * 仍用单条 `DELETE ... RETURNING` 把整表过期行(百万级主键)一次物化进内存并长时间持锁,
 * 只有 chat_messages / conversation_message_archives 走了分批。
 *
 * 本文件锁:
 *   ① 过期行超过一批时按批删除,返回总数 = 各批之和(保留期语义不变);
 *   ② 某一批删除失败 ⇒ 错误如实进入 errors[],不静默当成功、不继续假装清完;
 *   ③ 每批选取与删除的主键数都不超过单批上限,不存在"整表一次物化"。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    /** 表名 → 仍在库中的主键(模拟未删除行)。 */
    rows: new Map<string, string[]>(),
    /** 表名 → 最近一次 select 取到的主键(紧随其后的 delete 只删这一批)。 */
    pendingDeleteIds: new Map<string, string[]>(),
    selectLimits: [] as number[],
    deleteCalls: 0,
    deleteBatchSizes: [] as number[],
    deleteTableNames: [] as string[],
    /** 第 N 次 delete 抛错(-1 = 不抛)。 */
    failAtDeleteCall: -1,
    deleteError: new Error('batch delete failed'),
  }
  return { state, loggerInfo: vi.fn() }
})

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: h.loggerInfo, warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../src/db/index.js', () => {
  const state = h.state
  const tableName = (table: unknown): string => {
    const name = (table as { [key: symbol]: unknown })[Symbol.for('drizzle:Name')]
    return typeof name === 'string' ? name : 'unknown'
  }

  return {
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            limit: (limit: number) => {
              const name = tableName(table)
              state.selectLimits.push(limit)
              // 每批最多 limit 行:与真实 SELECT ... LIMIT n 一致
              const batch = (state.rows.get(name) ?? []).slice(0, limit)
              state.pendingDeleteIds.set(name, batch)
              return Promise.resolve(batch.map((id) => ({ id })))
            },
          }),
        }),
      }),
      delete: (table: unknown) => ({
        where: () => {
          const name = tableName(table)
          const idx = state.deleteCalls
          state.deleteCalls += 1
          if (idx === state.failAtDeleteCall) return Promise.reject(state.deleteError)
          const batch = state.pendingDeleteIds.get(name) ?? []
          state.pendingDeleteIds.set(name, [])
          const drop = new Set(batch)
          state.rows.set(
            name,
            (state.rows.get(name) ?? []).filter((id) => !drop.has(id)),
          )
          state.deleteTableNames.push(name)
          state.deleteBatchSizes.push(batch.length)
          return Promise.resolve([])
        },
      }),
      execute: vi.fn(async () => []),
    },
    dbRead: {},
    dbClient: {},
  }
})

import { archiveDailyData } from '../src/services/data-archive-service.js'

function seed(tableName: string, count: number): void {
  h.state.rows.set(
    tableName,
    Array.from({ length: count }, (_, i) => `${tableName}-${i}`),
  )
}

beforeEach(() => {
  h.state.rows.clear()
  h.state.pendingDeleteIds.clear()
  h.state.selectLimits.length = 0
  h.state.deleteCalls = 0
  h.state.deleteBatchSizes.length = 0
  h.state.deleteTableNames.length = 0
  h.state.failAtDeleteCall = -1
  h.loggerInfo.mockClear()
})

describe('F-553 archiveDailyData 分批主键删除', () => {
  it('① 超过一批的过期行按批删除,返回总数正确', async () => {
    seed('relay_messages', 12_000)
    seed('notifications', 2_500)

    const res = await archiveDailyData()

    expect(res.errors).toEqual([])
    expect(res.relayMessagesArchived).toBe(12_000)
    expect(res.notificationsArchived).toBe(2_500)
    // relay_messages:12 批整批 + notifications:1000/1000/500(按表处理顺序)
    expect(h.state.deleteBatchSizes).toEqual([
      ...Array.from({ length: 12 }, () => 1000),
      1000,
      1000,
      500,
    ])
    expect(h.state.rows.get('relay_messages')).toEqual([])
    expect(h.state.rows.get('notifications')).toEqual([])
  })

  it('② 某一批删除失败时如实进入 errors,不静默当成功', async () => {
    seed('relay_messages', 4_000)
    h.state.failAtDeleteCall = 2 // 第 3 批失败

    const res = await archiveDailyData()

    expect(res.errors).toEqual(['relay_messages archive failed: batch delete failed'])
    // 未完成 ⇒ 不得把本表计数报成成功
    expect(res.relayMessagesArchived).toBe(0)
    // 前两批已删(2000),失败批及之后的行仍在库中
    expect(h.state.rows.get('relay_messages')).toHaveLength(2_000)
    expect(h.state.deleteBatchSizes).toEqual([1000, 1000])
  })

  it('③ 每批选取/删除的主键数都不超过单批上限,不做整表物化', async () => {
    seed('audit_logs', 2_500)

    const res = await archiveDailyData()

    expect(res.auditLogsArchived).toBe(2_500)
    // 每次 SELECT 的 LIMIT 都不超过票面 5000 上限(实际取 1000/批)
    expect(h.state.selectLimits.length).toBeGreaterThan(0)
    expect(h.state.selectLimits.every((n) => n <= 5_000)).toBe(true)
    // 每批 DELETE 的主键数 ≤ 单批上限,且从未一次删整表 2500 行
    expect(h.state.deleteBatchSizes).toEqual([1000, 1000, 500])
    expect(h.state.deleteBatchSizes.every((n) => n <= 5_000)).toBe(true)
    expect(h.state.deleteTableNames).toEqual(['audit_logs', 'audit_logs', 'audit_logs'])
  })
})
