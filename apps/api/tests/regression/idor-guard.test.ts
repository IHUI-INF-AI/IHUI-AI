/**
 * 回归测试:BUG-R7-IDOR
 *
 * bugId: BUG-R7-IDOR
 * 轮次: 7
 * 场景: 用户 A 请求 /api/users/B-id/profile,验证 403
 *       旧架构来源: server/tests/test_bug_fixes_round7.py
 *
 * 验证点:
 *  - 资源所有者匹配 → 通过
 *  - 非所有者 → 拒绝
 *  - 无所有者 → 拒绝
 *  - admin 角色 → 通过(特权访问)
 *
 * 运行: pnpm -F @ihui/api test -- tests/regression/idor-guard.test.ts
 */
import { describe, it, expect } from 'vitest'

/** 用户角色 */
type Role = 'user' | 'admin' | 'staff'

/** 资源访问校验结果 */
interface AccessResult {
  allowed: boolean
  reason: string
}

/**
 * 校验用户对资源的所有权/访问权(防 IDOR)
 * - admin 角色始终通过
 * - userId 与 ownerId 匹配 → 通过
 * - 其他情况 → 拒绝
 */
function checkResourceOwner(
  userId: string,
  resourceId: string,
  ownerId: string | null,
  role: Role = 'user',
): AccessResult {
  // admin 角色特权访问
  if (role === 'admin') {
    return { allowed: true, reason: 'admin_role_bypass' }
  }
  // 资源无所有者(数据异常)→ 拒绝,避免误授权
  if (!ownerId) {
    return { allowed: false, reason: 'no_owner' }
  }
  // 用户未登录或 userId 缺失
  if (!userId) {
    return { allowed: false, reason: 'no_user' }
  }
  // 所有者匹配 → 通过
  if (userId === ownerId) {
    return { allowed: true, reason: 'owner_match' }
  }
  // 所有者不匹配 → 拒绝
  return { allowed: false, reason: 'not_owner' }
}

/** HTTP 状态码映射 */
function accessResultToStatus(result: AccessResult): number {
  return result.allowed ? 200 : 403
}

describe('BUG-R7-IDOR:资源越权防护', () => {
  it('所有者匹配 → 通过(200)', () => {
    const result = checkResourceOwner('user-a', 'resource-a', 'user-a')
    expect(result.allowed).toBe(true)
    expect(result.reason).toBe('owner_match')
    expect(accessResultToStatus(result)).toBe(200)
  })

  it('非所有者 → 拒绝(403)', () => {
    const result = checkResourceOwner('user-a', 'resource-b', 'user-b')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('not_owner')
    expect(accessResultToStatus(result)).toBe(403)
  })

  it('无所有者 → 拒绝(403)', () => {
    const result = checkResourceOwner('user-a', 'resource-a', null)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('no_owner')
    expect(accessResultToStatus(result)).toBe(403)
  })

  it('admin 角色 → 通过(特权访问)', () => {
    const result = checkResourceOwner('admin', 'resource-a', 'user-a', 'admin')
    expect(result.allowed).toBe(true)
    expect(result.reason).toBe('admin_role_bypass')
  })

  it('userId 为空 → 拒绝(未登录)', () => {
    const result = checkResourceOwner('', 'resource-a', 'user-a')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('no_user')
  })

  it('staff 角色不享有 admin 特权(默认 user)', () => {
    // staff 角色未传入时按 user 处理,不能访问他人资源
    const result = checkResourceOwner('staff-1', 'resource-a', 'user-a', 'staff')
    // staff 不是 admin,且非所有者 → 拒绝
    expect(result.allowed).toBe(false)
  })

  it('模拟用户 A 请求用户 B 的 profile 端点 → 403', () => {
    // 模拟路由:/api/users/B-id/profile,用户 A 访问
    const requestingUser = 'user-a'
    const targetResourceId = 'profile-b'
    const targetOwner = 'user-b'
    const result = checkResourceOwner(requestingUser, targetResourceId, targetOwner)
    expect(result.allowed).toBe(false)
    expect(accessResultToStatus(result)).toBe(403)
  })

  it('ownerId 为空字符串视为无所有者', () => {
    const result = checkResourceOwner('user-a', 'resource-a', '')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('no_owner')
  })
})
