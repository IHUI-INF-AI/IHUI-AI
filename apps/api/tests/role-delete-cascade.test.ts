// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-403 (P2) 删除角色只清菜单绑定,残留用户-角色绑定。
 *
 * 缺陷:routes/admin-sys/role-routes.ts 的 DELETE /role/:roleId 走
 * db/admin-sys-queries.ts 的 deleteRoleMenuCascade,旧实现的事务里只删 sys_role_menu;
 * admin_user_role / admin_role_menu / admin_role_dept 与 users.roleId 全部留在原地,
 * 角色行被删除或 id 复用时旧用户仍挂着该角色,权限检查读到孤儿绑定。
 *
 * 现口径:同一事务内清理菜单绑定 + 用户-角色绑定(admin_user_role、users.roleId)+ 角色部门/历史菜单绑定;
 * 任一步失败 ⇒ 事务回滚、函数 reject(路由 await 抛错,不落 success)。
 *
 * 用例设计(不连库,mock db 记录每一次 delete/update):
 *   ① 一次事务内同时发出 sys_role_menu 与 admin_user_role 等绑定删除(旧实现只有菜单删除 ⇒ 必红)
 *   ② admin_user_role 删除失败 ⇒ 整体 reject,不得静默成功
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { mockTransaction, mockTx, deletedTables, roleIdUpdates, state } = vi.hoisted(() => {
  const deletedTables: unknown[] = []
  const roleIdUpdates: Array<{ table: unknown; set: Record<string, unknown> }> = []
  const state: { failOn: unknown } = { failOn: null }

  const mockTx = {
    delete: vi.fn((table: unknown) => ({
      where: vi.fn(() => {
        deletedTables.push(table)
        return table === state.failOn
          ? Promise.reject(new Error('injected user_role delete failure'))
          : Promise.resolve()
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((set: Record<string, unknown>) => ({
        where: vi.fn(() => {
          roleIdUpdates.push({ table, set })
          return Promise.resolve()
        }),
      })),
    })),
  }

  const mockTransaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx))

  return { mockTransaction, mockTx, deletedTables, roleIdUpdates, state }
})

vi.mock('../src/db/index.js', () => ({ db: { transaction: mockTransaction } }))

import { deleteRoleMenuCascade } from '../src/db/admin-sys-queries.js'
import { sysRoleMenu, adminRoleMenu, adminUserRole, adminRoleDept, users } from '@ihui/database'

const ROLE_ID = 7

beforeEach(() => {
  deletedTables.length = 0
  roleIdUpdates.length = 0
  state.failOn = null
  mockTx.delete.mockClear()
  mockTx.update.mockClear()
  mockTransaction.mockClear()
})

describe('deleteRoleMenuCascade — F-403 删除角色须同事务清理用户-角色绑定', () => {
  it('① 一次事务内同时删除菜单绑定与用户-角色绑定(旧实现缺 admin_user_role ⇒ 红)', async () => {
    await deleteRoleMenuCascade(ROLE_ID)

    expect(mockTransaction).toHaveBeenCalledTimes(1)
    // 旧实现这里只有 sys_role_menu,admin_user_role 删除次数为 0
    expect(deletedTables).toHaveLength(4)
    expect(deletedTables).toContain(sysRoleMenu)
    expect(deletedTables).toContain(adminUserRole)
    expect(deletedTables).toContain(adminRoleMenu)
    expect(deletedTables).toContain(adminRoleDept)
    expect(deletedTables.filter((t) => t === adminUserRole)).toHaveLength(1)

    // users.roleId 是这套鉴权体系里真正的用户-角色绑定,不得留下指向已删角色的残值
    expect(roleIdUpdates).toHaveLength(1)
    expect(roleIdUpdates[0]!.table).toBe(users)
    expect(roleIdUpdates[0]!.set).toMatchObject({ roleId: 0 })
  })

  it('② 用户-角色删除失败 ⇒ 整体 reject,不得静默成功', async () => {
    state.failOn = adminUserRole

    await expect(deleteRoleMenuCascade(ROLE_ID)).rejects.toThrow(
      'injected user_role delete failure',
    )
    // 失败发生在 transaction 回调内 ⇒ drizzle 回滚;路由 await 抛错,不会返回 success
    expect(mockTransaction).toHaveBeenCalledTimes(1)
  })
})
