// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-419 回归(2026-11-14):权限授权的读-改-写必须是**同事务行锁**内的原子操作。
 *
 * 改前必红口径:create/revoke/GET 清理 各自 `loadPermissionGrants()` 再整行 upsert,
 * 两段之间没有锁 —— 并发撤销与授予都用同一份旧快照写回,已撤销的授权被复活、
 * 新建的授权被旧快照覆盖。
 *
 * 判据:
 *  1. 正例:并发撤销 + 授予 ⇒ 撤销生效,任何一次写回都不含已撤销的那一行;
 *  2. 反例(顺序):创建 → 列取 → 重复创建去重 → 撤销 → 再撤销返回 false;
 *  3. 首授并发:整行还不存在时先占位插入可锁行,两笔新授权都留得下;
 *  4. GET 的过期清理写回同样走锁,不覆盖并发新建的授权;
 *  5. 结构:所有写回都发生在事务连接上(writesOutsideTx = 0)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

type StoredGrant = { id: string; tool: string; expiresAt: number }

const harness = vi.hoisted(() => {
  const state = {
    exists: false,
    value: null as string | null,
    inTx: false,
    txStarts: 0,
    writesOutsideTx: 0,
    writes: [] as string[],
  }
  /** 模拟单行行锁的串行化:第二笔事务必须等第一笔提交后才开始。 */
  let tail: Promise<unknown> = Promise.resolve()
  const serialize = <T>(run: () => Promise<T>): Promise<T> => {
    const next = tail.then(run, run)
    tail = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }
  return {
    state,
    serialize,
    reset(): void {
      state.exists = false
      state.value = null
      state.inTx = false
      state.txStarts = 0
      state.writesOutsideTx = 0
      state.writes = []
    },
    grants(): StoredGrant[] {
      return state.value ? (JSON.parse(state.value) as StoredGrant[]) : []
    },
  }
})

vi.mock('../../db/index.js', () => {
  const { state, serialize } = harness
  const buildTx = () => ({
    select: () => ({
      from: () => ({
        where: () => ({
          for: async () => (state.exists ? [{ value: state.value }] : []),
        }),
      }),
    }),
    insert: () => ({
      values: (row: { value: string | null }) => ({
        onConflictDoNothing: async () => {
          if (!state.exists) {
            state.exists = true
            state.value = row.value
          }
        },
        onConflictDoUpdate: async (cfg: { set: { value: string | null } }) => {
          if (!state.inTx) state.writesOutsideTx += 1
          state.exists = true
          state.value = cfg.set.value
          if (cfg.set.value) state.writes.push(cfg.set.value)
        },
      }),
    }),
  })
  const db = {
    transaction: async (work: (tx: unknown) => Promise<unknown>) =>
      serialize(async () => {
        state.txStarts += 1
        state.inTx = true
        try {
          return await work(buildTx())
        } finally {
          state.inTx = false
        }
      }),
  }
  return { db, dbRead: db }
})

vi.mock('../../db/user-preferences-queries.js', () => ({
  USER_PREFERENCE_GROUPS: { permission: 'permission' },
  findUserPreferences: async () => {
    // 让并发调用都先读到旧快照:这正是旧实现会复活已撤销授权的窗口。
    await Promise.resolve()
    const { state } = harness
    return {
      list: state.exists ? [{ key: 'grants', value: state.value }] : [],
      total: state.exists ? 1 : 0,
    }
  },
}))

import {
  createPermissionGrant,
  loadPermissionGrants,
  revokePermissionGrant,
} from '../permission-grants.js'

const USER = '11111111-1111-4111-8111-111111111111'

function storedGrant(id: string, expiresAt = Date.now() + 60_000): string {
  return JSON.stringify({
    id,
    tool: 'tool-' + id,
    matchPattern: '*',
    scope: 'global',
    createdAt: Date.now(),
    expiresAt,
    grantedBy: USER,
  })
}

beforeEach(() => {
  harness.reset()
})

describe('F-419 权限授权读改写原子化', () => {
  it('并发撤销 + 授予:撤销生效,不被旧快照复活', async () => {
    harness.state.exists = true
    harness.state.value = `[${storedGrant('g1')},${storedGrant('g2')}]`

    const [removed, created] = await Promise.all([
      revokePermissionGrant(USER, 'g1'),
      createPermissionGrant(USER, { tool: 'shell.exec', matchPattern: 'ls *', scope: 'global' }),
    ])

    expect(removed).toBe(true)
    expect(created.id).not.toBe('g1')
    expect(harness.grants().map((g) => g.id)).toEqual(['g2', created.id])
    // 任何一次写回都不得把已撤销的 g1 带回来
    expect(harness.state.writes.some((v) => v.includes('"g1"'))).toBe(false)
    expect(harness.state.writesOutsideTx).toBe(0)
    expect(harness.state.txStarts).toBe(2)
  })

  it('顺序操作:创建 → 列取 → 重复创建去重 → 撤销 → 再撤销返回 false', async () => {
    const first = await createPermissionGrant(USER, {
      tool: 'browser',
      matchPattern: 'https://*',
      scope: 'global',
    })
    expect((await loadPermissionGrants(USER)).map((g) => g.id)).toEqual([first.id])

    const renewed = await createPermissionGrant(USER, {
      tool: 'browser',
      matchPattern: 'https://*',
      scope: 'global',
    })
    const listed = await loadPermissionGrants(USER)
    expect(listed).toHaveLength(1)
    expect(listed[0]?.id).toBe(renewed.id)

    expect(await revokePermissionGrant(USER, first.id)).toBe(false)
    expect(await revokePermissionGrant(USER, renewed.id)).toBe(true)
    expect(await loadPermissionGrants(USER)).toHaveLength(0)
    expect(await revokePermissionGrant(USER, renewed.id)).toBe(false)
    expect(harness.state.writesOutsideTx).toBe(0)
  })

  it('空存储并发首授:占位行后可锁,两笔授权都不丢', async () => {
    const [a, b] = await Promise.all([
      createPermissionGrant(USER, { tool: 'fs.read', matchPattern: '*', scope: 'global' }),
      createPermissionGrant(USER, { tool: 'fs.write', matchPattern: '*', scope: 'global' }),
    ])

    expect(
      harness
        .grants()
        .map((g) => g.id)
        .sort(),
    ).toEqual([a.id, b.id].sort())
  })

  it('GET 的过期清理写回在锁内,不覆盖并发新授权', async () => {
    harness.state.exists = true
    harness.state.value = `[${storedGrant('expired', Date.now() - 1_000)}]`

    const [, created] = await Promise.all([
      loadPermissionGrants(USER),
      createPermissionGrant(USER, { tool: 'fs.read', matchPattern: '*', scope: 'global' }),
    ])

    expect(harness.grants().map((g) => g.id)).toEqual([created.id])
    expect(harness.state.writesOutsideTx).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
