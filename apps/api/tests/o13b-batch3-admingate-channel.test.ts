// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O13b-③ internalUserRoleId 通道并入集中封装后的**提权断言**(行为契约)。
 *
 * 钉死四件事:
 *  A. resolveAdminRoleId 的通道真值表 —— internal 通道只在显式
 *     `includeInternalChannel: true` 时被读;两条通道不可互相抬升
 *     (`??` 串联 ⇒ 已登录 roleId=0 用户不会回落到 internal 的 roleId)。
 *  B. requireAdmin(admin 面)**永不**接受 internal 通道读数:
 *     即便 internal 链路已完成注入且 X-User-Id 指向管理员,仍 403「需要管理员权限」。
 *  C. requireAnyPermission(RBAC 权限点豁免档)按 2026-09-19 既定语义接受 internal
 *     通道的管理员(不查 RBAC);internal 通道非管理员仍必须过 RBAC。
 *  D. principal 归一层无提权:apiKey 并存时取更严一侧(roleId 恒 0),
 *     internal 主体不触发数据闸 ⇒ 其 roleId 无从放宽数据可见性。
 *
 * 范式沿用 o13b-batch2-admingate-contract.test.ts:真实集中封装 + mock 鉴权/RBAC,不连库。
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockAuthenticate, mockCheckAnyPermission, mockHasInternalToken, mockCheckInternalToken } =
  vi.hoisted(() => ({
    mockAuthenticate: vi.fn(),
    mockCheckAnyPermission: vi.fn(),
    mockHasInternalToken: vi.fn().mockReturnValue(false),
    mockCheckInternalToken: vi.fn().mockResolvedValue(false),
  }))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  checkAuth: vi.fn(),
}))

vi.mock('../src/db/rbac-queries.js', () => ({
  checkAnyPermission: mockCheckAnyPermission,
}))

vi.mock('../src/plugins/internal-service-token.js', () => ({
  hasInternalServiceToken: mockHasInternalToken,
  checkInternalServiceToken: mockCheckInternalToken,
}))

import {
  requireAdmin,
  requireAnyPermission,
  isSystemAdmin,
  resolveAdminRoleId,
  type AdminChannelPolicy,
} from '../src/plugins/require-permission.js'
import { buildPrincipal } from '../src/plugins/principal.js'
import { isDataScopeEnforced } from '../src/utils/scoped-guard.js'

type GateRequest = Parameters<typeof resolveAdminRoleId>[0]

const JWT_ONLY: AdminChannelPolicy = { includeInternalChannel: false }
const WITH_INTERNAL: AdminChannelPolicy = { includeInternalChannel: true }

/** 集中封装 / principal 只读 request 上的少数字段,此处按需拼装。 */
function asRequest(fields: Record<string, unknown>): GateRequest {
  return fields as unknown as GateRequest
}

function unauthenticated(): Error & { statusCode: number } {
  return Object.assign(new Error('Authentication required'), { statusCode: 401 })
}

/** 模拟 internal-service-token.ts:89 的成功注入(userId + 来自 DB 的 roleId)。 */
function internalChannel(roleId: number): void {
  mockAuthenticate.mockRejectedValue(unauthenticated())
  mockHasInternalToken.mockReturnValue(true)
  mockCheckInternalToken.mockImplementation(
    async (request: { userId?: string; internalUserRoleId?: number }) => {
      Object.assign(request, { userId: 'internal-subject-001', internalUserRoleId: roleId })
      return true
    },
  )
}

describe('O13b-③ internalUserRoleId 通道并入集中封装:提权断言', () => {
  let adminApp: FastifyInstance
  let rbacApp: FastifyInstance

  beforeEach(async () => {
    mockCheckAnyPermission.mockResolvedValue(false)
    if (!adminApp) {
      adminApp = Fastify({ logger: false })
      adminApp.addHook('preHandler', requireAdmin)
      adminApp.get('/admin-only', async () => ({ ok: true }))
      await adminApp.ready()
    }
    if (!rbacApp) {
      rbacApp = Fastify({ logger: false })
      rbacApp.addHook('preHandler', requireAnyPermission(['edu:read']))
      rbacApp.get('/rbac-only', async () => ({ ok: true }))
      await rbacApp.ready()
    }
  })

  afterAll(async () => {
    await adminApp?.close()
    await rbacApp?.close()
  })

  describe('A. resolveAdminRoleId 通道真值表', () => {
    it('JWT roleId=1 → 两档一致,均为管理员', () => {
      const r = asRequest({ jwtPayload: { userId: 'u1', roleId: 1 } })
      expect(resolveAdminRoleId(r, JWT_ONLY)).toBe(1)
      expect(resolveAdminRoleId(r, WITH_INTERNAL)).toBe(1)
      expect(isSystemAdmin(r, JWT_ONLY)).toBe(true)
    })

    it('仅 internal roleId=1 → 严格档读不到(0),豁免档才读到(1)', () => {
      const r = asRequest({ internalUserRoleId: 1 })
      expect(resolveAdminRoleId(r, JWT_ONLY)).toBe(0)
      expect(isSystemAdmin(r, JWT_ONLY)).toBe(false)
      expect(resolveAdminRoleId(r, WITH_INTERNAL)).toBe(1)
      expect(isSystemAdmin(r, WITH_INTERNAL)).toBe(true)
    })

    it('已登录 roleId=0 用户不会回落到 internal 通道的 1(通道不可互相抬升)', () => {
      const r = asRequest({ jwtPayload: { userId: 'u1', roleId: 0 }, internalUserRoleId: 1 })
      expect(resolveAdminRoleId(r, WITH_INTERNAL)).toBe(0)
      expect(isSystemAdmin(r, WITH_INTERNAL)).toBe(false)
    })

    it('双通道皆缺失 → 0 且非管理员', () => {
      const r = asRequest({})
      expect(resolveAdminRoleId(r, WITH_INTERNAL)).toBe(0)
      expect(isSystemAdmin(r, JWT_ONLY)).toBe(false)
    })
  })

  describe('B. requireAdmin(admin 面)对 internal 通道恒拒绝', () => {
    it('internal 链路已完成注入且指向管理员 → 仍 403,文案逐字节不变', async () => {
      // 关键形态:authenticate 不报错(等价于链路上游已按 internal token 放行并注入),
      // 集中封装仍**不得**把 internalUserRoleId=1 当作 admin。
      mockAuthenticate.mockImplementation(async (request: Record<string, unknown>) => {
        Object.assign(request, { userId: 'internal-subject-001', internalUserRoleId: 1 })
      })
      const res = await adminApp.inject({ method: 'GET', url: '/admin-only' })
      expect(res.statusCode).toBe(403)
      expect(res.json()).toEqual({ code: 403, message: '需要管理员权限' })
    })

    it('人用 JWT roleId=1 才放行(对照:收敛未把闸门改严)', async () => {
      mockAuthenticate.mockImplementation(async (request: Record<string, unknown>) => {
        Object.assign(request, {
          userId: 'admin-001',
          jwtPayload: { userId: 'admin-001', roleId: 1 },
        })
      })
      const res = await adminApp.inject({ method: 'GET', url: '/admin-only' })
      expect(res.statusCode).toBe(200)
    })

    it('人用 JWT roleId=0 → 403(对照:严格档未放宽)', async () => {
      mockAuthenticate.mockImplementation(async (request: Record<string, unknown>) => {
        Object.assign(request, { userId: 'u2', jwtPayload: { userId: 'u2', roleId: 0 } })
      })
      const res = await adminApp.inject({ method: 'GET', url: '/admin-only' })
      expect(res.statusCode).toBe(403)
    })
  })

  describe('C. requireAnyPermission 的 internal 豁免档语义不变', () => {
    it('internal 通道 + 管理员 → 直接豁免,不查 RBAC(2026-09-19 既定行为)', async () => {
      internalChannel(1)
      const res = await rbacApp.inject({ method: 'GET', url: '/rbac-only' })
      expect(res.statusCode).toBe(200)
      expect(mockCheckAnyPermission).not.toHaveBeenCalled()
    })

    it('internal 通道 + 非管理员 → 仍走 RBAC,无权限即 403「权限不足」', async () => {
      internalChannel(0)
      const res = await rbacApp.inject({ method: 'GET', url: '/rbac-only' })
      expect(res.statusCode).toBe(403)
      expect(res.json()).toEqual({ code: 403, message: '权限不足' })
      expect(mockCheckAnyPermission).toHaveBeenCalledWith('internal-subject-001', ['edu:read'])
    })
  })

  describe('D. principal 归一层无提权', () => {
    it('apiKey 与 internal 管理员并存 → kind=apiKey 且 roleId 恒 0(取更严一侧)', () => {
      const p = buildPrincipal(
        asRequest({
          userId: 'subject-001',
          internalUserRoleId: 1,
          headers: { 'x-internal-service-token': 'secret' },
          apiKey: { userId: 'subject-001', id: 'key-1', permissions: [] },
        }),
      )
      expect(p?.kind).toBe('apiKey')
      expect(p?.roleId).toBe(0)
    })

    it('internal 主体不触发数据闸 ⇒ 其 roleId=1 无从放宽数据可见性', () => {
      const p = buildPrincipal(
        asRequest({
          userId: 'subject-001',
          internalUserRoleId: 1,
          headers: { 'x-internal-service-token': 'secret' },
        }),
      )
      expect(p?.kind).toBe('internal')
      expect(p?.roleId).toBe(1)
      expect(isDataScopeEnforced(p)).toBe(false)
    })

    it('人用 JWT 主体携带 internal 读数 → 角色只取 jwtPayload,不取 internal', () => {
      const p = buildPrincipal(
        asRequest({
          userId: 'u3',
          internalUserRoleId: 1,
          jwtPayload: { userId: 'u3', roleId: 0 },
        }),
      )
      expect(p?.kind).toBe('jwt')
      expect(p?.roleId).toBe(0)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
