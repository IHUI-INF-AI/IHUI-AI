// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 2026-09-27 布尔删除 ack 清账(第四型):POST /settings/delete-account 的
// `deleted: true` 原是路由层常量,真实写链在 services/purge-user-pii.ts 的
// users 主行匿名化 UPDATE 里。本文件钉两条:
//   ① purge 回报"库侧匿名化命中 ≥1 行" ⇒ deleted:true;
//   ② purge 回报"库侧命中 0 行"(如并发下用户行已不在) ⇒ deleted:false,
//      即"删 0 行不得报 deleted:true"。
// 响应键名/状态码语义逐字不变(success/deleted/userId 三键原样)。
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

const { mockIsSystemAdminUser, mockFindUserById, mockVerifyPassword, mockPurgeUserPii } =
  vi.hoisted(() => ({
    mockIsSystemAdminUser: vi.fn().mockResolvedValue(false),
    mockFindUserById: vi.fn(),
    mockVerifyPassword: vi.fn().mockResolvedValue(true),
    mockPurgeUserPii: vi.fn(),
  }))

vi.mock('../src/db/queries.js', () => ({
  isSystemAdminUser: mockIsSystemAdminUser,
  findUserById: mockFindUserById,
}))

// 处理器用 `await import('../../utils/password-crypto.js')` 动态导入;
// vi.mock 同样拦截动态 import(模块 id 归一后一致)。
vi.mock('../src/utils/password-crypto.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('hash'),
  verifyPassword: mockVerifyPassword,
}))

vi.mock('../src/services/purge-user-pii.js', () => ({
  purgeUserPii: mockPurgeUserPii,
}))

import settingsRoutes from '../src/routes/user/settings-routes.js'

const USER_ID = '00000000-0000-4000-8000-000000000001'

describe('POST /settings/delete-account — deleted 由库侧 RETURNING 证据派生', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    // 真实挂载链(src/routes/user/index.ts)在父作用域注入 request.userId;
    // 本测试直接挂 settingsRoutes,用同级 preHandler 复刻该注入,不重测鉴权。
    app.addHook('preHandler', async (request) => {
      request.userId = USER_ID
    })
    await app.register(settingsRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('库侧匿名化命中 0 行(purge 回报 false)⇒ 不得报 deleted:true', async () => {
    mockFindUserById.mockResolvedValue({
      id: USER_ID,
      phone: null,
      passwordHash: 'existing-hash',
      status: 1,
    })
    mockPurgeUserPii.mockResolvedValue({ userPiiTableCount: 0, userRowAnonymized: false })

    const res = await app.inject({
      method: 'POST',
      url: '/api/settings/delete-account',
      body: { password: 'old-pass' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    // 键名与状态码逐字不变,只有值从常量变成库侧证据
    expect(body.data).toHaveProperty('success')
    expect(body.data.userId).toBe(USER_ID)
    expect(body.data.deleted).toBe(false)
  })

  it('库侧匿名化命中 ≥1 行(purge 回报 true)⇒ 如实报 deleted:true', async () => {
    mockFindUserById.mockResolvedValue({
      id: USER_ID,
      phone: null,
      passwordHash: 'existing-hash',
      status: 1,
    })
    mockPurgeUserPii.mockResolvedValue({ userPiiTableCount: 19, userRowAnonymized: true })

    const res = await app.inject({
      method: 'POST',
      url: '/api/settings/delete-account',
      body: { password: 'old-pass' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.deleted).toBe(true)
    expect(body.data.success).toBe(true)
    expect(body.data.userId).toBe(USER_ID)
  })
})
