// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-962 批 7 补后端路由形状锁定 —— 不连库。
 *
 * 判据只有一件事:本批补注册的每一条 method+path 在**与 index.ts 同款前缀**的注册面上
 * 真实存在(请求打进去不得落 FST_ERR_NOT_FOUND),且彼此无重复路由冲突(ready() 不抛)。
 * 端点行为面(鉴权/校验/响应壳)由 handler 内的 zod + 既有响应壳保证,本文件不重测行为,
 * 只锁"死调用 ⇒ 活路由"这一批 7 验收口径。业务 404 与路由 404(FST_ERR_NOT_FOUND)
 * 以响应体 message 区分;鉴权闸(requireAdmin/checkAuth)先回的 401/403 同样不算缺失。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/test',
    REDIS_URL: 'redis://localhost:8811',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    TBOX_WEBHOOK_SECRET: 'test-secret',
  },
}))

/** 链式 db 桩:任何 select/insert/update/delete/execute 都 resolve 空行(够判"路由在不在册") */
vi.mock('../src/db/index.js', () => {
  const makeChain = () => {
    const step: Record<string, unknown> = {}
    for (const m of [
      'from',
      'where',
      'orderBy',
      'groupBy',
      'having',
      'limit',
      'offset',
      'values',
      'set',
      'returning',
      'onConflictDoNothing',
      'innerJoin',
      'leftJoin',
    ]) {
      step[m] = vi.fn(() => step)
    }
    step.then = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve)
    return step
  }
  const makeDb = () => ({
    select: vi.fn(() => makeChain()),
    insert: vi.fn(() => makeChain()),
    update: vi.fn(() => makeChain()),
    delete: vi.fn(() => makeChain()),
    execute: vi.fn(async () => []),
  })
  return { db: makeDb(), dbRead: makeDb() }
})

import { resourceRoutes } from '../src/routes/resource.js'
import { adminOrderRoutes } from '../src/routes/order.js'
import { agentsRoutes } from '../src/routes/agents.js'
import { messageRoutes } from '../src/routes/message.js'
import { gamificationRoutes } from '../src/routes/gamification.js'
import { authRoutes } from '../src/routes/auth.js'
import { vipRoutes } from '../src/routes/vip.js'

const UUID = '11111111-1111-4111-8111-111111111111'

/** 路由级 404(Fastify 默认 not-found 体:statusCode 404 + "Route ... not found")与业务 404 区分 */
function isRouteMissing(res: { statusCode: number; body: string }): boolean {
  if (res.statusCode !== 404) return false
  try {
    return /not found/i.test((JSON.parse(res.body) as { message?: string }).message ?? '')
  } catch {
    return false
  }
}

describe('G-962 批 7 补后端注册的路由形状', () => {
  const server: FastifyInstance = Fastify({ logger: false })

  beforeAll(async () => {
    // 与 apps/api/src/routes/index.ts 同款前缀
    await server.register(gamificationRoutes, { prefix: '/api' })
    await server.register(adminOrderRoutes, { prefix: '/api/admin' })
    await server.register(resourceRoutes, { prefix: '/api' })
    await server.register(messageRoutes, { prefix: '/api' })
    await server.register(agentsRoutes, { prefix: '/api' })
    await server.register(authRoutes, { prefix: '/api/auth' })
    await server.register(vipRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  const EXPECTED: Array<[string, 'GET' | 'POST' | 'PUT' | 'DELETE', string]> = [
    ['E-113', 'DELETE', `/api/resources/${UUID}`],
    ['E-119', 'POST', '/api/admin/orders'],
    ['E-120', 'POST', '/api/agents'],
    ['B8', 'GET', '/api/message/group'],
    ['B11', 'GET', '/api/points/records'],
    ['B12', 'PUT', '/api/auth/me'],
    ['B13', 'GET', '/api/vip-compare'],
  ]

  it.each(EXPECTED)('%s %s 在册(不落 FST_ERR_NOT_FOUND)', async (_tag, method, url) => {
    const res = await server.inject({
      method,
      url,
      ...(method === 'POST' || method === 'PUT' ? { payload: {} } : {}),
    })
    expect(isRouteMissing(res), `${method} ${url} 未注册`).toBe(false)
  })

  it('反向对照:本批残段(无表可补)不得被误注册(B16 goods)', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/goods' })
    expect(isRouteMissing(res)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
