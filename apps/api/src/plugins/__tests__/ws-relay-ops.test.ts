// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
})

// ===== mock @ihui/auth:验证管理员校验的 token 分支 =====
vi.mock('@ihui/auth', () => ({
  verifyWsToken: vi.fn(async (token: string) => {
    if (token === 'ws-admin') return { userId: 'u1', claims: { roleId: 1 } }
    if (token === 'ws-user') return { userId: 'u2', claims: { roleId: 0 } }
    return null
  }),
  verifyAccessToken: vi.fn(async (token: string) => {
    if (token === 'access-admin') return { userId: 'u1', roleId: 1 }
    if (token === 'access-user') return { userId: 'u2', roleId: 0 }
    throw new Error('invalid')
  }),
}))

vi.mock('../../ws-helpers.js', () => ({
  wsAuth: vi.fn(async () => 'u1'),
  WS_CLOSE: {
    MISSING_TOKEN: 4001,
    RATE_LIMITED: 4002,
    INVALID_TOKEN: 4003,
    ACCOUNT_CANCELLED: 4004,
    TOO_MANY_CONNECTIONS: 4005,
  },
  WsUserConnectionLimiter: vi.fn().mockImplementation(function () {
    return {
      acquire: vi.fn(() => true),
      release: vi.fn(),
      currentCount: vi.fn(() => 0),
    }
  }),
}))

vi.mock('../../services/relay-ops-snapshot.js', () => ({
  buildRelayOpsSnapshot: vi.fn(async () => ({
    ts: new Date().toISOString(),
    alerts: { rules: [], events: [] },
    channels: { groups: [], stats: [] },
    usage: { overview: null },
  })),
}))

import { isAdminToken, wsRelayOps } from '../ws-relay-ops.js'

describe('ws-relay-ops(#58 运营面板 WS)', () => {
  it('isAdminToken:ws token claims.roleId>=1 → true', async () => {
    await expect(isAdminToken('ws-admin')).resolves.toBe(true)
  })

  it('isAdminToken:ws token 非管理员角色 → false', async () => {
    await expect(isAdminToken('ws-user')).resolves.toBe(false)
  })

  it('isAdminToken:access token payload.roleId>=1 → true', async () => {
    await expect(isAdminToken('access-admin')).resolves.toBe(true)
  })

  it('isAdminToken:access token 非管理员 → false', async () => {
    await expect(isAdminToken('access-user')).resolves.toBe(false)
  })

  it('isAdminToken:无效 token → false', async () => {
    await expect(isAdminToken('garbage')).resolves.toBe(false)
  })

  // 插件注册与优雅关闭(对齐 ws-tasks-idor 测试模式;连接级鉴权依赖 wsAuth mock)
  it('插件可注册且 onClose 不抛错', async () => {
    const Fastify = (await import('fastify')).default
    const fastifyWebsocket = (await import('@fastify/websocket')).default
    const app = Fastify({ logger: false })
    await app.register(fastifyWebsocket)
    await app.register(wsRelayOps)
    await app.ready()
    await expect(app.close()).resolves.toBeUndefined()
  })
})
