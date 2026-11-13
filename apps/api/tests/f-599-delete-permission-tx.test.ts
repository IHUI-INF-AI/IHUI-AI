// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-599 回归锁(2026-11-13)。不连库:mock db.transaction 模拟事务回滚。
 *
 * 病灶:`deletePermission` 里规则 → 审计日志 → 主记录三条 `db.delete` 顺序独立执行,
 * 未包事务。主记录删除失败时,前两条已提交删除且不可恢复 —— "半删"且审计链断裂。
 *
 * 本文件锁:
 *   ① 三条删除全部在同一个 `db.transaction` 的 `tx` 上执行,事务外不发生删除;
 *   ② 任一步抛错 ⇒ 事务回调抛出、整体回滚,三张表数据原样保留(不产生半删);
 *   ③ 成功时返回被删主记录 id 数组;
 *   ④ 无主记录命中时按原逻辑返回空数组,事务正常提交。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const state = {
    /** 物理表名 → 现存行 id(模拟库内状态)。 */
    rows: {} as Record<string, string[]>,
    transactions: 0,
    commits: 0,
    rollbacks: 0,
    txDeleteTables: [] as string[],
    untxDeleteTables: [] as string[],
    /** 第 N 次事务内 delete 抛错(-1 = 不抛)。 */
    failAt: -1,
  }
  return { state }
})

const RULES = 'workspace_permission_rules'
const AUDIT = 'workspace_permission_audit_logs'
const MAIN = 'workspace_permissions'

vi.mock('../src/db/index.js', () => {
  const state = h.state
  const tableName = (table: unknown): string => {
    const name = (table as { [key: symbol]: unknown })[Symbol.for('drizzle:Name')]
    return typeof name === 'string' ? name : 'unknown'
  }

  const performDelete = async (name: string): Promise<Array<{ id: string }>> => {
    const idx = state.txDeleteTables.length
    if (idx === state.failAt) throw new Error(`${name} delete failed`)
    state.txDeleteTables.push(name)
    const removed = state.rows[name] ?? []
    state.rows[name] = []
    return name === MAIN ? removed.map((id) => ({ id })) : []
  }

  const query = (name: string) => ({
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      performDelete(name).then(resolve, reject),
    returning: () => performDelete(name),
  })

  const tx = {
    delete: (table: unknown) => ({
      where: () => query(tableName(table)),
    }),
  }

  return {
    db: {
      transaction: async (fn: (t: unknown) => Promise<unknown>) => {
        state.transactions += 1
        const snapshot = JSON.parse(JSON.stringify(state.rows)) as Record<string, string[]>
        try {
          const result = await fn(tx)
          state.commits += 1
          return result
        } catch (err) {
          state.rows = snapshot
          state.rollbacks += 1
          throw err
        }
      },
      delete: (table: unknown) => {
        state.untxDeleteTables.push(tableName(table))
        throw new Error('deletePermission 不得在事务外删除')
      },
    },
    dbRead: {},
  }
})

import { deletePermission } from '../src/db/workspace-permission-queries.js'

beforeEach(() => {
  h.state.rows = {}
  h.state.transactions = 0
  h.state.commits = 0
  h.state.rollbacks = 0
  h.state.txDeleteTables.length = 0
  h.state.untxDeleteTables.length = 0
  h.state.failAt = -1
})

function seed(): void {
  h.state.rows[RULES] = ['rule-1', 'rule-2']
  h.state.rows[AUDIT] = ['log-1']
  h.state.rows[MAIN] = ['perm-1']
}

describe('F-599 deletePermission 三次删除同一事务', () => {
  it('① 三次删除全部走同一个事务的 tx,事务外不删除', async () => {
    seed()

    await deletePermission('f599-user', '/f599/workspace')

    expect(h.state.transactions).toBe(1)
    expect(h.state.txDeleteTables).toEqual([RULES, AUDIT, MAIN])
    expect(h.state.untxDeleteTables).toEqual([])
    expect(h.state.commits).toBe(1)
    expect(h.state.rollbacks).toBe(0)
  })

  it('② 删除主记录时抛错 ⇒ 整体回滚,规则与审计日志不丢(无半删)', async () => {
    seed()
    h.state.failAt = 2 // 第三步:删主记录失败

    await expect(deletePermission('f599-user', '/f599/workspace')).rejects.toThrow(
      'workspace_permissions delete failed',
    )

    expect(h.state.transactions).toBe(1)
    expect(h.state.commits).toBe(0)
    expect(h.state.rollbacks).toBe(1)
    // 前两步的删除随事务回滚,三张表原样保留
    expect(h.state.rows[RULES]).toEqual(['rule-1', 'rule-2'])
    expect(h.state.rows[AUDIT]).toEqual(['log-1'])
    expect(h.state.rows[MAIN]).toEqual(['perm-1'])
  })

  it('③ 成功时返回被删主记录 id,三张表均已清空', async () => {
    seed()

    const deleted = await deletePermission('f599-user', '/f599/workspace')

    expect(deleted).toEqual(['perm-1'])
    expect(h.state.rows[RULES]).toEqual([])
    expect(h.state.rows[AUDIT]).toEqual([])
    expect(h.state.rows[MAIN]).toEqual([])
  })

  it('④ 无主记录命中时返回空数组,事务照常提交', async () => {
    h.state.rows[RULES] = ['rule-1']
    h.state.rows[MAIN] = []

    const deleted = await deletePermission('f599-user', '/f599/workspace')

    expect(deleted).toEqual([])
    expect(h.state.commits).toBe(1)
    expect(h.state.rollbacks).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
