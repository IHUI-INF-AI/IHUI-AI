// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-59 回归锁(零真实 DB/Redis):
 *  - 自助创建租户不得由调用者指定计费 plan,配额按服务端固定默认档初始化;
 *  - 租户成员接口不得降级/移除 owner,也不得把任何人提升为 owner。
 *
 * 判据已抽成 routes/tenant.ts 的同文件导出纯函数,用例只断言判据本身。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({ db: {} }))
vi.mock('@ihui/database', () => ({ tenants: {}, tenantMembers: {}, tenantQuotas: {} }))
vi.mock('../src/plugins/tenant.js', () => ({ checkQuota: vi.fn(), clearTenantCache: vi.fn() }))
vi.mock('../src/plugins/auth.js', () => ({ authenticate: vi.fn() }))
vi.mock('../src/plugins/require-permission.js', () => ({ isSystemAdmin: vi.fn(() => false) }))

import {
  DEFAULT_TENANT_PLAN,
  PLAN_QUOTA_DEFAULTS,
  canChangeMemberRole,
  canRemoveMember,
} from '../src/routes/tenant.js'

describe('F-59 创建租户:套餐由服务端固定', () => {
  it('默认套餐为 free(改造前 schema 的默认值)', () => {
    expect(DEFAULT_TENANT_PLAN).toBe('free')
  })

  it('默认档初始配额与改造前 free 分支一致', () => {
    expect(PLAN_QUOTA_DEFAULTS[DEFAULT_TENANT_PLAN]).toEqual({
      apiCallsLimit: 100_000,
      storageLimitMb: 10_240,
      userLimit: 50,
    })
  })

  it('enterprise/pro 档位不复用 free 数值(避免默认档被套上高配额)', () => {
    expect(PLAN_QUOTA_DEFAULTS.enterprise.apiCallsLimit).toBeGreaterThan(
      PLAN_QUOTA_DEFAULTS.free.apiCallsLimit,
    )
    expect(PLAN_QUOTA_DEFAULTS.pro.apiCallsLimit).toBeGreaterThan(
      PLAN_QUOTA_DEFAULTS.free.apiCallsLimit,
    )
  })
})

describe('F-59 canChangeMemberRole', () => {
  it('租户 admin 不能把 owner 降级为 member(403)', () => {
    const d = canChangeMemberRole('admin', 'owner', 'member')
    expect(d).toMatchObject({ allowed: false, status: 403 })
  })

  it('owner 也不能经成员接口降级另一个 owner(403)', () => {
    const d = canChangeMemberRole('owner', 'owner', 'member')
    expect(d).toMatchObject({ allowed: false, status: 403 })
  })

  it('不允许把目标成员提升为 owner(400,所有权转移须走独立流程)', () => {
    const d = canChangeMemberRole('owner', 'member', 'owner')
    expect(d).toMatchObject({ allowed: false, status: 400 })
  })

  it('admin 可以把 member 提为 admin', () => {
    expect(canChangeMemberRole('admin', 'member', 'admin')).toEqual({ allowed: true })
  })

  it('普通 member 没有改角色权限(403)', () => {
    const d = canChangeMemberRole('member', 'admin', 'member')
    expect(d).toMatchObject({ allowed: false, status: 403 })
  })
})

describe('F-59 canRemoveMember', () => {
  it('admin 不能移除 owner(即使还有其他 owner)', () => {
    const d = canRemoveMember('admin', 'owner', 2)
    expect(d).toMatchObject({ allowed: false, status: 403 })
  })

  it('owner 操作者也不能移除最后一个 owner', () => {
    const d = canRemoveMember('owner', 'owner', 1)
    expect(d).toMatchObject({ allowed: false, status: 403 })
    if (d.allowed) throw new Error('unreachable')
    expect(d.message).toContain('最后一个')
  })

  it('owner 操作者也不能移除 owner(非最后一个同样拒绝)', () => {
    const d = canRemoveMember('owner', 'owner', 3)
    expect(d).toMatchObject({ allowed: false, status: 403 })
  })

  it('admin 可以移除普通 member', () => {
    expect(canRemoveMember('admin', 'member', 1)).toEqual({ allowed: true })
  })

  it('普通 member 不能移除他人(403)', () => {
    const d = canRemoveMember('member', 'member', 1)
    expect(d).toMatchObject({ allowed: false, status: 403 })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
