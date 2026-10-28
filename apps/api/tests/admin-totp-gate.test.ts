// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 管理员 TOTP 闸(2026-10-28 安全审计)行为契约。
 *
 * 加固目标:此前 TOTP 只对"**已开启** 2FA 的账号"生效,管理员不主动开 2FA 就能纯密码
 * 登录后走 requireAdmin 保护的全部 admin 路由。本闸给 requireAdmin /
 * requireAdminRouteGuard 补一道"管理员必须绑 TOTP"的判断,档位 `ADMIN_TOTP_MODE`:
 *
 *  - `off`     :完全不检查(不查库) —— 回滚口子
 *  - `warn`    :未绑放行 + 一条结构化告警(含 userId / path) —— **env 默认值**
 *  - `enforce` :未绑 → 403,文案直接告诉用户去「安全设置」绑 TOTP
 *
 * 另钉两条不变量:
 *  1. 非管理员不受本闸影响(仍是"需要管理员权限"403,且不查 TOTP 表);
 *  2. 查库失败一律放行 —— 数据库抖动不得整体 403 掉管理后台。
 *
 * 模式:真实集中封装(require-permission.ts) + mock authenticate / getTotpStatus /
 * config / logger,零真实 DB。
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const {
  mockAuthenticate,
  mockRequireActiveUser,
  mockGetTotpStatus,
  mockConfig,
  mockLoggerWarn,
  mockLoggerError,
} = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockRequireActiveUser: vi.fn(),
  mockGetTotpStatus: vi.fn(),
  // 档位在调用时读取 ⇒ 用例内改这个对象即可切换 off/warn/enforce
  mockConfig: { ADMIN_TOTP_MODE: 'warn' } as { ADMIN_TOTP_MODE: string | undefined },
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  requireActiveUser: mockRequireActiveUser,
  checkAuth: vi.fn(),
}))

vi.mock('../src/services/totp-service.js', () => ({
  getTotpStatus: mockGetTotpStatus,
}))

vi.mock('../src/config/index.js', () => ({ config: mockConfig }))

// 真实 db/index.js 会用 config.DATABASE_URL 建池,这里只要占位(mock 的 config 没有连接串)
vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {}, dbClient: {} }))

vi.mock('../src/db/rbac-queries.js', () => ({ checkAnyPermission: vi.fn() }))

vi.mock('../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}))

import { requireAdmin, requireAdminRouteGuard } from '../src/plugins/require-permission.js'

type GateRequest = Parameters<typeof requireAdmin>[0]

function setAdmin(userId = 'admin-001'): void {
  mockAuthenticate.mockImplementation(async (request: GateRequest & { jwtPayload?: object }) => {
    ;(request as { userId?: string }).userId = userId
    request.jwtPayload = { userId, roleId: 1, phone: '13800000001', familyId: 'fam-001' }
  })
}

function setUser(userId = 'user-001'): void {
  mockAuthenticate.mockImplementation(async (request: GateRequest & { jwtPayload?: object }) => {
    ;(request as { userId?: string }).userId = userId
    request.jwtPayload = { userId, roleId: 0, phone: '13800000002', familyId: 'fam-002' }
  })
}

function setNoAuth(): void {
  const err = new Error('Authentication required') as Error & { statusCode: number }
  err.statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

function setMode(mode: 'off' | 'warn' | 'enforce'): void {
  mockConfig.ADMIN_TOTP_MODE = mode
}

describe('管理员 TOTP 闸(ADMIN_TOTP_MODE)', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    mockConfig.ADMIN_TOTP_MODE = 'warn'
    mockRequireActiveUser.mockResolvedValue(undefined)
    if (!app) {
      app = Fastify({ logger: false })
      app.get('/api/admin/legacy', { preHandler: requireAdmin }, async (_req, reply) =>
        reply.send({ code: 0, message: 'success', data: { ok: true } }),
      )
      app.get('/api/admin/guarded', { preHandler: requireAdminRouteGuard }, async (_req, reply) =>
        reply.send({ code: 0, message: 'success', data: { ok: true } }),
      )
      await app.ready()
    }
  })

  afterAll(async () => {
    await app?.close()
  })

  describe('off —— 回滚口子', () => {
    it('未绑 TOTP 的管理员放行,且完全不查库', async () => {
      setMode('off')
      setAdmin()
      mockGetTotpStatus.mockResolvedValue({ enabled: false, enabledAt: null })

      const res = await app.inject({ method: 'GET', url: '/api/admin/legacy' })

      expect(res.statusCode).toBe(200)
      expect(mockGetTotpStatus).not.toHaveBeenCalled()
      expect(mockLoggerWarn).not.toHaveBeenCalled()
    })

    it('off 档下非管理员仍是"需要管理员权限"403', async () => {
      setMode('off')
      setUser()

      const res = await app.inject({ method: 'GET', url: '/api/admin/legacy' })

      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('管理员')
    })
  })

  describe('warn —— 默认档:只告警,绝不阻断', () => {
    it('未绑 TOTP 的管理员放行,并记一条含 userId / path 的结构化告警', async () => {
      setMode('warn')
      setAdmin('admin-unbound')
      mockGetTotpStatus.mockResolvedValue({ enabled: false, enabledAt: null })

      const res = await app.inject({ method: 'GET', url: '/api/admin/legacy?page=1' })

      expect(res.statusCode).toBe(200)
      expect(mockGetTotpStatus).toHaveBeenCalledTimes(1)
      expect(mockGetTotpStatus).toHaveBeenCalledWith('admin-unbound')

      expect(mockLoggerWarn).toHaveBeenCalledTimes(1)
      const [msg, meta] = mockLoggerWarn.mock.calls[0] as [string, Record<string, unknown>]
      expect(msg).toContain('未绑定 TOTP')
      expect(meta).toMatchObject({
        event: 'admin_totp_unbound',
        userId: 'admin-unbound',
        path: '/api/admin/legacy?page=1',
        method: 'GET',
      })
      expect(mockLoggerError).not.toHaveBeenCalled()
    })

    it('已绑 TOTP 的管理员放行且不告警', async () => {
      setMode('warn')
      setAdmin()
      mockGetTotpStatus.mockResolvedValue({ enabled: true, enabledAt: new Date() })

      const res = await app.inject({ method: 'GET', url: '/api/admin/legacy' })

      expect(res.statusCode).toBe(200)
      expect(mockGetTotpStatus).toHaveBeenCalledWith('admin-001')
      expect(mockLoggerWarn).not.toHaveBeenCalled()
    })

    it('warn 档同样作用于 requireAdminRouteGuard(admin/* 面)', async () => {
      setMode('warn')
      setAdmin()
      mockGetTotpStatus.mockResolvedValue({ enabled: false, enabledAt: null })

      const res = await app.inject({ method: 'GET', url: '/api/admin/guarded' })

      expect(res.statusCode).toBe(200)
      expect(mockLoggerWarn).toHaveBeenCalledTimes(1)
    })
  })

  describe('enforce —— 未绑即拒', () => {
    it('未绑 TOTP → 403,文案明确要求先绑定 TOTP', async () => {
      setMode('enforce')
      setAdmin()
      mockGetTotpStatus.mockResolvedValue({ enabled: false, enabledAt: null })

      const res = await app.inject({ method: 'GET', url: '/api/admin/legacy' })

      expect(res.statusCode).toBe(403)
      const body = res.json() as { code: number; message: string }
      expect(body.code).toBe(403)
      expect(body.message).toContain('TOTP')
      expect(body.message).toContain('安全设置')
      expect(mockLoggerWarn).not.toHaveBeenCalled()
    })

    it('已绑 TOTP 的管理员放行', async () => {
      setMode('enforce')
      setAdmin()
      mockGetTotpStatus.mockResolvedValue({ enabled: true, enabledAt: new Date() })

      const res = await app.inject({ method: 'GET', url: '/api/admin/legacy' })

      expect(res.statusCode).toBe(200)
      expect(mockGetTotpStatus).toHaveBeenCalledWith('admin-001')
    })

    it('enforce 档同样作用于 requireAdminRouteGuard(admin/* 面)', async () => {
      setMode('enforce')
      setAdmin()
      mockGetTotpStatus.mockResolvedValue({ enabled: false, enabledAt: null })

      const res = await app.inject({ method: 'GET', url: '/api/admin/guarded' })

      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('TOTP')
    })
  })

  describe('非管理员不受本闸影响', () => {
    it('enforce 档下 roleId=0 → 仍是"需要管理员权限"403,且不查 TOTP', async () => {
      setMode('enforce')
      setUser()

      const res = await app.inject({ method: 'GET', url: '/api/admin/legacy' })

      expect(res.statusCode).toBe(403)
      const message = res.json().message as string
      expect(message).toContain('管理员')
      expect(message).not.toContain('TOTP')
      expect(mockGetTotpStatus).not.toHaveBeenCalled()
    })

    it('未登录仍是 401,且不查 TOTP', async () => {
      setMode('enforce')
      setNoAuth()

      const res = await app.inject({ method: 'GET', url: '/api/admin/legacy' })

      expect(res.statusCode).toBe(401)
      expect(mockGetTotpStatus).not.toHaveBeenCalled()
    })
  })

  describe('查询失败 fail-open —— 数据库抖动不得锁死管理后台', () => {
    it('enforce 档下查询抛错 → 放行并记 error 日志', async () => {
      setMode('enforce')
      setAdmin()
      mockGetTotpStatus.mockRejectedValue(new Error('connection refused'))

      const res = await app.inject({ method: 'GET', url: '/api/admin/legacy' })

      expect(res.statusCode).toBe(200)
      expect(mockLoggerError).toHaveBeenCalledTimes(1)
      const [, meta] = mockLoggerError.mock.calls[0] as [string, Record<string, unknown>]
      expect(meta).toMatchObject({
        event: 'admin_totp_gate_error',
        userId: 'admin-001',
        mode: 'enforce',
      })
    })

    it('查不到该用户(返回 null)→ 放行,不按"未绑"处理', async () => {
      setMode('enforce')
      setAdmin()
      mockGetTotpStatus.mockResolvedValue(null)

      const res = await app.inject({ method: 'GET', url: '/api/admin/legacy' })

      expect(res.statusCode).toBe(200)
      expect(mockLoggerWarn).toHaveBeenCalledTimes(1)
    })
  })

  describe('档位缺省', () => {
    it('schema 默认档为 warn(钉源码,不读进程 env)', async () => {
      // 为什么不读真实 config:测试进程的 env 被 tests/setup-env.ts 显式设成 off
      // (那是为了不破坏既有 admin 测试的顺序队列 DB mock,见该文件注释),所以
      // "当前进程读到的值"证明不了默认值。这里直接钉 config schema 的 .default('warn'),
      // 钉的是"部署方不配这个变量时会得到什么"—— 那才是这条契约的本体。
      const { readFileSync } = await import('node:fs')
      const src = readFileSync(new URL('../src/config/index.ts', import.meta.url), 'utf8')
      const decl = /ADMIN_TOTP_MODE\s*:\s*z[\s\S]{0,200}?\.default\(\s*'warn'\s*\)/
      expect(src).toMatch(decl)
    })

    it('config 缺该字段(仅旧测试 mock 会如此)→ 不检查,行为同加固前', async () => {
      mockConfig.ADMIN_TOTP_MODE = undefined
      setAdmin()
      mockGetTotpStatus.mockResolvedValue({ enabled: false, enabledAt: null })

      const res = await app.inject({ method: 'GET', url: '/api/admin/legacy' })

      expect(res.statusCode).toBe(200)
      expect(mockGetTotpStatus).not.toHaveBeenCalled()
      expect(mockLoggerWarn).not.toHaveBeenCalled()
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
