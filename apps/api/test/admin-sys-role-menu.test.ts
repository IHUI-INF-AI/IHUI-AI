import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { store, extractEqValue } = vi.hoisted(() => {
  const store = new Map<number, string[]>()

  function extractEqValue(cond: unknown): unknown {
    const chunks = (cond as { queryChunks?: unknown[] })?.queryChunks
    if (Array.isArray(chunks)) {
      for (const chunk of chunks) {
        if (chunk !== null && typeof chunk === 'object') {
          const val = (chunk as { value?: unknown }).value
          if (typeof val === 'number') return val
        }
      }
    }
    try {
      const toSQL = (cond as { toSQL?: () => { params?: unknown[] } })?.toSQL
      if (typeof toSQL === 'function') {
        const result = toSQL.call(cond)
        if (Array.isArray(result?.params)) {
          for (const p of result.params) {
            if (typeof p === 'number') return p
          }
        }
      }
    } catch {
      // ignore
    }
    return undefined
  }

  return { store, extractEqValue }
})

vi.mock('../src/db/index.js', () => ({
  db: {
    transaction: async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        delete: () => ({
          where: (cond: unknown) => {
            const rid = extractEqValue(cond) as number
            store.set(rid, [])
            return Promise.resolve()
          },
        }),
        insert: () => ({
          values: (rows: { roleId: number; menuId: string }[]) => ({
            onConflictDoNothing: () => {
              for (const row of rows) {
                const existing = store.get(row.roleId) ?? []
                if (!existing.includes(row.menuId)) existing.push(row.menuId)
                store.set(row.roleId, existing)
              }
              return Promise.resolve()
            },
          }),
        }),
      }
      await fn(tx)
    },
    select: () => ({
      from: () => ({
        where: (cond: unknown) => {
          const rid = extractEqValue(cond) as number
          const menuIds = store.get(rid) ?? []
          return Promise.resolve(menuIds.map((menuId) => ({ menuId })))
        },
      }),
    }),
  },
}))

import { assignRoleMenus, findMenuIdsByRole } from '../src/db/admin-sys-queries.js'

describe('admin-sys role-menu queries', () => {
  beforeEach(() => {
    store.clear()
  })

  it('assignRoleMenus 分配菜单后, findMenuIdsByRole 返回正确 menuIds', async () => {
    const roleId = 1
    const menuIds = ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002']
    await assignRoleMenus(roleId, menuIds)
    const result = await findMenuIdsByRole(roleId)
    expect(result.sort()).toEqual(menuIds.sort())
  })

  it('assignRoleMenus 再次分配(覆盖), 旧关联被清除, 仅保留新关联', async () => {
    const roleId = 2
    await assignRoleMenus(roleId, ['00000000-0000-0000-0000-000000000001'])
    await assignRoleMenus(roleId, [
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000003',
    ])
    const result = await findMenuIdsByRole(roleId)
    expect(result.sort()).toEqual([
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000003',
    ])
  })

  it('assignRoleMenus 传空数组, 清除所有关联', async () => {
    const roleId = 3
    await assignRoleMenus(roleId, ['00000000-0000-0000-0000-000000000001'])
    await assignRoleMenus(roleId, [])
    const result = await findMenuIdsByRole(roleId)
    expect(result).toEqual([])
  })

  it('findMenuIdsByRole 查询无关联的角色, 返回空数组', async () => {
    const result = await findMenuIdsByRole(999)
    expect(result).toEqual([])
  })
})
