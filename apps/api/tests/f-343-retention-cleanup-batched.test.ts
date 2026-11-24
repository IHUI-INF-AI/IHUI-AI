// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-343 回归锁(2026-11-13)。
 *
 * 病灶:保留期清理用一条 `DELETE ... RETURNING` 全量删除,删除行数无上限;
 * 失败仅 warn 返回 0。积压时形成长事务/长锁、WAL 膨胀,Node 侧物化全部 id 造成内存峰值。
 *
 * 本文件锁:
 *   ① 首批满 5000 继续下一批,直到不足 5000 停止,总数为各批之和;
 *   ② 单批 <5000 立即停止(不多发一条 DELETE);
 *   ③ 生成 SQL 的子查询带 LIMIT 5000;
 *   ④ 失败不再静默:relay 侧记 logger.error 并返回已删数量,审计侧记 logger.error 后抛出。
 *
 * 只 mock db 与 logger,不触达真实 PG。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => {
  type Outcome = { rows?: unknown[]; error?: Error }
  const state: { outcomes: Outcome[]; index: number; where: unknown[] } = {
    outcomes: [],
    index: 0,
    where: [],
  }
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
  return { state, logger }
})

vi.mock('../src/utils/logger.js', () => ({ logger: h.logger }))

vi.mock('../src/db/index.js', () => {
  function deleteChain(): unknown {
    const chain: Record<string, unknown> = {}
    chain.where = (cond: unknown) => {
      h.state.where.push(cond)
      return chain
    }
    chain.returning = () => {
      const outcome = h.state.outcomes[h.state.index++] ?? { rows: [] }
      if (outcome.error) return Promise.reject(outcome.error)
      return Promise.resolve(outcome.rows ?? [])
    }
    chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve([]).then(resolve, reject)
    return chain
  }
  return {
    db: {
      delete: vi.fn(() => deleteChain()),
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
    },
    dbRead: { select: vi.fn() },
    dbClient: {},
  }
})

import { purgeAccountUsage } from '../src/services/relay-account-usage.js'
import { deleteOldLogs } from '../src/services/audit-service.js'

const BATCH_SIZE = 5000

/** 构造一批删除结果(RETURNING 1 的形状)。 */
function batch(count: number): { rows: unknown[] } {
  return { rows: Array.from({ length: count }, () => ({ one: 1 })) }
}

function setOutcomes(outcomes: Array<{ rows?: unknown[]; error?: Error }>): void {
  h.state.outcomes = outcomes
  h.state.index = 0
  h.state.where.length = 0
}

/** 把 drizzle SQL 对象粗渲染成文本,用于断言子查询里的 LIMIT 与批大小。 */
function sqlText(node: unknown): string {
  if (node === null || node === undefined) return ''
  if (typeof node !== 'object') return String(node)
  const chunks = (node as { queryChunks?: unknown[] }).queryChunks
  if (Array.isArray(chunks)) return chunks.map(sqlText).join('')
  const value = (node as { value?: unknown }).value
  if (Array.isArray(value)) return value.join('')
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  const name = (node as { name?: unknown }).name
  return typeof name === 'string' ? name : ''
}

beforeEach(() => {
  setOutcomes([])
  h.logger.info.mockClear()
  h.logger.warn.mockClear()
  h.logger.error.mockClear()
})

describe('F-343 保留期清理必须分批 DELETE', () => {
  it('relay:首批满 5000 继续下一批,不足 5000 停止,总数为各批之和', async () => {
    setOutcomes([batch(BATCH_SIZE), batch(BATCH_SIZE), batch(12)])
    await expect(purgeAccountUsage(30)).resolves.toBe(BATCH_SIZE * 2 + 12)
    expect(h.state.where).toHaveLength(3)
  })

  it('relay:单批返回 <5000 立即停止,不多发一条 DELETE', async () => {
    setOutcomes([batch(7)])
    await expect(purgeAccountUsage(30)).resolves.toBe(7)
    expect(h.state.where).toHaveLength(1)
  })

  it('relay:SQL 子查询带 LIMIT 5000(不全量删除、不物化全部 id)', async () => {
    setOutcomes([batch(1)])
    await purgeAccountUsage(30)
    const text = sqlText(h.state.where[0])
    expect(text).toContain('IN (SELECT')
    expect(text).toMatch(/LIMIT/i)
    expect(text).toContain(String(BATCH_SIZE))
  })

  it('relay:失败不再静默——记 logger.error(表名/已删数量/错误)并返回 0', async () => {
    setOutcomes([{ error: new Error('db down') }])
    await expect(purgeAccountUsage(30)).resolves.toBe(0)
    expect(h.logger.error).toHaveBeenCalledTimes(1)
    expect(h.logger.error.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        table: 'ai_relay_account_usage_ledger',
        deleted: 0,
        error: 'db down',
      }),
    )
  })

  it('relay:中途失败时如实返回已删数量并记 error', async () => {
    setOutcomes([batch(BATCH_SIZE), { error: new Error('db down') }])
    await expect(purgeAccountUsage(30)).resolves.toBe(BATCH_SIZE)
    expect(h.logger.error).toHaveBeenCalledTimes(1)
    expect(h.logger.error.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ table: 'ai_relay_account_usage_ledger', deleted: BATCH_SIZE }),
    )
  })

  it('audit:首批满 5000 继续下一批,不足 5000 停止,总数为各批之和', async () => {
    setOutcomes([batch(BATCH_SIZE), batch(BATCH_SIZE), batch(3)])
    await expect(deleteOldLogs(90)).resolves.toBe(BATCH_SIZE * 2 + 3)
    expect(h.state.where).toHaveLength(3)
  })

  it('audit:单批返回 <5000 立即停止,不多发一条 DELETE', async () => {
    setOutcomes([batch(2)])
    await expect(deleteOldLogs(90)).resolves.toBe(2)
    expect(h.state.where).toHaveLength(1)
  })

  it('audit:SQL 子查询带 LIMIT 5000', async () => {
    setOutcomes([batch(1)])
    await deleteOldLogs(90)
    const text = sqlText(h.state.where[0])
    expect(text).toContain('IN (SELECT')
    expect(text).toMatch(/LIMIT/i)
    expect(text).toContain(String(BATCH_SIZE))
  })

  it('audit:失败记 logger.error(表名/已删数量/错误)后如实抛出', async () => {
    setOutcomes([{ error: new Error('db down') }])
    await expect(deleteOldLogs(90)).rejects.toThrow('db down')
    expect(h.logger.error).toHaveBeenCalledTimes(1)
    expect(h.logger.error.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ table: 'audit_logs', deleted: 0, error: 'db down' }),
    )
  })
})
