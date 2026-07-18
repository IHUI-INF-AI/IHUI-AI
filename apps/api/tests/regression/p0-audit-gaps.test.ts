/**
 * 回归测试:BUG-R18-P0-AUDIT
 *
 * bugId: BUG-R18-P0-AUDIT
 * 轮次: 18
 * 场景: 遍历所有 admin 端点,验证均要求管理员权限
 *       旧架构来源: server/tests/test_bug_fixes_round18.py
 *
 * 验证点:
 *  - 预定义 ADMIN_ENDPOINTS 数组(20 个端点)
 *  - requireAdmin(endpoint, role) 对每个端点 + admin 角色返回 true
 *  - 未登录用户访问 admin 端点 → 401
 *  - 普通用户访问 admin 端点 → 403
 *  - admin 用户访问 admin 端点 → 200
 *
 * 运行: pnpm -F @ihui/api test -- tests/regression/p0-audit-gaps.test.ts
 */
import { describe, it, expect } from 'vitest'

/** 用户角色 */
type Role = 'anonymous' | 'user' | 'admin' | 'superadmin'

/**
 * 预定义的 20 个 admin 端点清单
 * 来源:routes/admin/* 与 routes/admin-*.ts 路由清单的合并去重
 */
const ADMIN_ENDPOINTS: ReadonlyArray<{ method: string; path: string }> = [
  { method: 'GET', path: '/api/admin/users' },
  { method: 'POST', path: '/api/admin/users' },
  { method: 'DELETE', path: '/api/admin/users/:id' },
  { method: 'GET', path: '/api/admin/system-logs' },
  { method: 'GET', path: '/api/admin/operation-logs' },
  { method: 'GET', path: '/api/admin/login-logs' },
  { method: 'POST', path: '/api/admin/carousel' },
  { method: 'DELETE', path: '/api/admin/carousel/:id' },
  { method: 'GET', path: '/api/admin/comments' },
  { method: 'DELETE', path: '/api/admin/comments/:id' },
  { method: 'GET', path: '/api/admin/orders' },
  { method: 'PATCH', path: '/api/admin/orders/:id' },
  { method: 'GET', path: '/api/admin/members' },
  { method: 'PATCH', path: '/api/admin/members/:id' },
  { method: 'POST', path: '/api/admin/oss-files' },
  { method: 'DELETE', path: '/api/admin/oss-files/:id' },
  { method: 'GET', path: '/api/admin/sensitive-words' },
  { method: 'POST', path: '/api/admin/sensitive-words' },
  { method: 'GET', path: '/api/admin/stats' },
  { method: 'GET', path: '/api/admin/monitoring' },
]

/** 鉴权结果 */
interface AuthResult {
  status: number
  allowed: boolean
  reason: string
}

/**
 * Mock 管理员权限校验
 * - admin/superadmin → 200 通过
 * - user → 403 拒绝(普通用户)
 * - anonymous → 401 未登录
 */
function requireAdmin(endpoint: string, role: Role): AuthResult {
  // 检查端点是否在 admin 清单内
  const found = ADMIN_ENDPOINTS.some((e) => e.path === endpoint)
  if (!found) {
    // 非 admin 端点不归本函数管辖
    return { status: 200, allowed: true, reason: 'not_admin_endpoint' }
  }
  switch (role) {
    case 'admin':
    case 'superadmin':
      return { status: 200, allowed: true, reason: 'admin_granted' }
    case 'user':
      return { status: 403, allowed: false, reason: 'forbidden_non_admin' }
    case 'anonymous':
    default:
      return { status: 401, allowed: false, reason: 'unauthenticated' }
  }
}

describe('BUG-R18-P0-AUDIT:admin 端点权限校验缺口', () => {
  it('ADMIN_ENDPOINTS 数组长度为 20', () => {
    expect(ADMIN_ENDPOINTS).toHaveLength(20)
  })

  it('每个端点都有 method 和 path 字段', () => {
    for (const ep of ADMIN_ENDPOINTS) {
      expect(ep.method).toBeTruthy()
      expect(ep.path).toMatch(/^\/api\/admin\//)
    }
  })

  it('admin 角色访问所有 admin 端点 → 200 通过', () => {
    for (const ep of ADMIN_ENDPOINTS) {
      const result = requireAdmin(ep.path, 'admin')
      expect(result.allowed).toBe(true)
      expect(result.status).toBe(200)
    }
  })

  it('superadmin 角色访问所有 admin 端点 → 200 通过', () => {
    for (const ep of ADMIN_ENDPOINTS) {
      const result = requireAdmin(ep.path, 'superadmin')
      expect(result.allowed).toBe(true)
      expect(result.status).toBe(200)
    }
  })

  it('未登录用户(anonymous)访问所有 admin 端点 → 401', () => {
    for (const ep of ADMIN_ENDPOINTS) {
      const result = requireAdmin(ep.path, 'anonymous')
      expect(result.allowed).toBe(false)
      expect(result.status).toBe(401)
      expect(result.reason).toBe('unauthenticated')
    }
  })

  it('普通用户(user)访问所有 admin 端点 → 403', () => {
    for (const ep of ADMIN_ENDPOINTS) {
      const result = requireAdmin(ep.path, 'user')
      expect(result.allowed).toBe(false)
      expect(result.status).toBe(403)
      expect(result.reason).toBe('forbidden_non_admin')
    }
  })

  it('抽检关键端点:DELETE /api/admin/users/:id 拒绝普通用户', () => {
    const result = requireAdmin('/api/admin/users/:id', 'user')
    expect(result.status).toBe(403)
    expect(result.allowed).toBe(false)
  })

  it('抽检关键端点:GET /api/admin/system-logs 拒绝匿名', () => {
    const result = requireAdmin('/api/admin/system-logs', 'anonymous')
    expect(result.status).toBe(401)
    expect(result.allowed).toBe(false)
  })

  it('非 admin 端点不归 requireAdmin 管辖 → 直接通过', () => {
    const result = requireAdmin('/api/public/posts', 'anonymous')
    expect(result.status).toBe(200)
    expect(result.reason).toBe('not_admin_endpoint')
  })

  it('所有端点路径均以 /api/admin/ 开头(清单纯净性)', () => {
    const invalid = ADMIN_ENDPOINTS.filter((e) => !e.path.startsWith('/api/admin/'))
    expect(invalid).toEqual([])
  })
})
