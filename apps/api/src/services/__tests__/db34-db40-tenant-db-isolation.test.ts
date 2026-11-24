// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DB-40:withTenant 在事务外发 `SET LOCAL search_path`,租户 schema 隔离是空操作。
 *
 * 立因(2026-11-08 静态取证):`SET LOCAL` 只在事务内生效,事务外只发 warning;
 * 旧实现直接 `db.execute(sql\`SET LOCAL search_path TO ...\`)`,连接来自池、语句各自独立成事务,
 * 因此 search_path 从未被真正切换。另 `tenantId.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()`
 * 把 `a-b` 与 `a_b` 归一成同一个 schema。
 *
 * 本文件锁两条判据:
 * 1. `SET LOCAL` 必须发生在一个事务内(经 `db.transaction`,且在**同一事务句柄**上执行),
 *    且不得在事务外直接 `db.execute`;回调必须拿到该事务句柄才能让业务查询同处一个事务。
 * 2. 租户标识归一化必须无碰撞:接受 `a-b`,拒绝会与其撞名的 `a_b`(fail-closed 400)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

const mocks = vi.hoisted(() => {
  const txExecute = vi.fn(async (_query: unknown) => undefined)
  const tx = { execute: txExecute }
  const transaction = vi.fn(async (cb: (handle: typeof tx) => Promise<unknown>) => cb(tx))
  const execute = vi.fn(async () => undefined)
  return { tx, txExecute, transaction, execute }
})

vi.mock('../../db/index.js', () => ({
  db: { execute: mocks.execute, transaction: mocks.transaction },
}))

import { withTenant } from '../../plugins/tenant-db-isolation.js'

function render(fragment: unknown): string {
  const q = new PgDialect().sqlToQuery(fragment as never)
  return q.sql
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DB-40 withTenant 事务内 SET LOCAL', () => {
  it('SET LOCAL 必须在事务内执行，且同一事务句柄传给回调', async () => {
    const seen: unknown[] = []
    const result = await withTenant('11111111-1111-1111-1111-111111111111', async (tx) => {
      seen.push(tx)
      return 'ok'
    })

    expect(result).toBe('ok')
    // 必须在事务里:db.transaction 被调用一次,且不得在事务外直接 execute。
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(mocks.txExecute).toHaveBeenCalledTimes(1)

    const text = render(mocks.txExecute.mock.calls[0]?.[0])
    expect(text).toContain('SET LOCAL search_path')
    expect(text).toContain('tenant_11111111_1111_1111_1111_111111111111')
    // 回调拿到的就是事务句柄,业务查询才不会落在池里的另一条连接。
    expect(seen).toEqual([mocks.tx])
  })

  it('租户 ID 归一化无碰撞：a-b 可用，a_b 必须被拒绝（不得共用同一 schema）', async () => {
    const executed: string[] = []
    await withTenant('a-b', async () => {
      executed.push(render(mocks.txExecute.mock.calls[0]?.[0]))
      return undefined
    })
    expect(executed[0]).toContain('tenant_a_b')

    // 旧实现把 a_b 与 a-b 归一成同一个 tenant_a_b;新判据要求 fail-closed 拒绝后者。
    await expect(withTenant('a_b', async () => undefined)).rejects.toMatchObject({
      statusCode: 400,
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
