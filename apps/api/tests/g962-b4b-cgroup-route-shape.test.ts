// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-962 批 4b(C 组散点族补后端)路由形状锁定 —— 不连库。
 *
 * 判据只有一件事:本批补注册的每一条 method+path 在**与 index.ts 同款前缀**的注册面上
 * 真实存在(请求打进去不得落 FST_ERR_NOT_FOUND),且彼此无重复路由冲突(ready() 不抛)。
 * 端点行为面(归属/校验/响应壳)由 handler 内的 zod + 既有响应壳保证,本文件不重测行为,
 * 只锁"死调用 ⇒ 活路由"这一批 4b 验收口径。业务 404(记录不存在)与路由 404
 * (FST_ERR_NOT_FOUND)以响应体 code 区分。
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

/** 链式 db 桩:任何 select/insert/update/delete 都 resolve 空行(够判"路由在不在册") */
vi.mock('../src/db/index.js', () => {
  const makeChain = () => {
    const step: Record<string, unknown> = {}
    for (const m of [
      'from',
      'where',
      'orderBy',
      'limit',
      'offset',
      'values',
      'set',
      'returning',
      'onConflictDoNothing',
      'innerJoin',
    ]) {
      step[m] = vi.fn(() => step)
    }
    step.then = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve)
    return step
  }
  return {
    db: {
      select: vi.fn(() => makeChain()),
      insert: vi.fn(() => makeChain()),
      update: vi.fn(() => makeChain()),
      delete: vi.fn(() => makeChain()),
    },
  }
})

import eduAiManagementRoutes from '../src/routes/edu-ai-management.js'
import groupsRoutes from '../src/routes/groups.js'
import { usersRoutes } from '../src/routes/users.js'
import signUpsRoutes from '../src/routes/sign-ups.js'
import { aiFrontendRoutes } from '../src/routes/ai-frontend-routes.js'
import { plazaRoutes } from '../src/routes/plaza.js'
import miniprogramRoutes from '../src/routes/miniprogram.js'
import openclawRoutes from '../src/routes/user/openclaw-routes.js'
import tboxRoutes from '../src/routes/tbox.js'
import traderRoutes from '../src/routes/trader.js'
import productIdentityRoutes from '../src/routes/product-identity.js'
import { userCheckinRoutes } from '../src/routes/user.js'
import { legacyExamRoutes } from '../src/routes/legacy-exam.js'

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

describe('G-962 批 4b C 组补注册的路由形状', () => {
  const server: FastifyInstance = Fastify({ logger: false })

  beforeAll(async () => {
    // 与 apps/api/src/routes/index.ts 同款前缀
    await server.register(eduAiManagementRoutes, { prefix: '/api/edu-ai-management' })
    await server.register(groupsRoutes, { prefix: '/api/groups' })
    await server.register(usersRoutes, { prefix: '/api/users' })
    await server.register(signUpsRoutes, { prefix: '/api/sign-ups' })
    await server.register(aiFrontendRoutes, { prefix: '/api' })
    await server.register(plazaRoutes, { prefix: '/api/plaza' })
    await server.register(miniprogramRoutes, { prefix: '/api/miniprogram' })
    await server.register(openclawRoutes, { prefix: '/api' })
    await server.register(tboxRoutes, { prefix: '/api/tbox' })
    await server.register(traderRoutes, { prefix: '/api/trader' })
    await server.register(productIdentityRoutes, { prefix: '/api/product-identity' })
    await server.register(userCheckinRoutes, { prefix: '/api' })
    await server.register(legacyExamRoutes, { prefix: '/api/legacy' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  const EXPECTED: Array<[string, 'GET' | 'POST' | 'PUT' | 'DELETE', string]> = [
    ['#68', 'GET', '/api/edu-ai-management/trial-reservation'],
    ['#69', 'GET', '/api/edu-ai-management/parent-binding'],
    ['#70', 'GET', `/api/groups/${UUID}/members`],
    ['#71', 'GET', `/api/users/${UUID}/follows`],
    ['#72', 'GET', '/api/sign-ups'],
    ['#73', 'GET', '/api/ai/mcp/resources'],
    ['#74', 'GET', '/api/ai/mcp/prompts'],
    ['#75', 'GET', '/api/ai/mcp/usage'],
    ['#82', 'DELETE', `/api/user/unbind-third-party?id=${UUID}`],
    ['#83', 'GET', '/api/user/third-party-accounts'],
    ['#84', 'PUT', `/api/plaza/${UUID}`],
    ['#85', 'DELETE', `/api/plaza/${UUID}`],
    ['#86', 'POST', '/api/miniprogram'],
    ['#87', 'PUT', `/api/miniprogram/${UUID}`],
    ['#88', 'DELETE', `/api/miniprogram/${UUID}`],
    ['#90', 'PUT', `/api/openclaw/${UUID}`],
    ['#91', 'POST', '/api/tbox'],
    ['#92', 'PUT', `/api/tbox/${UUID}`],
    ['#93', 'DELETE', `/api/tbox/${UUID}`],
    ['#94', 'POST', `/api/trader/${UUID}/follow`],
    ['#95', 'POST', `/api/trader/${UUID}/unfollow`],
    ['#97', 'POST', '/api/product-identity/verify'],
    ['#98 证据(已在库,零改动)', 'DELETE', `/api/legacy/exam/wrong-questions/${UUID}`],
  ]

  it.each(EXPECTED)('%s %s 在册(不落 FST_ERR_NOT_FOUND)', async (_tag, method, url) => {
    const res = await server.inject({
      method,
      url,
      ...(method === 'POST' || method === 'PUT' ? { payload: {} } : {}),
    })
    expect(isRouteMissing(res), `${method} ${url} 未注册`).toBe(false)
  })

  it('反向对照:未补的残段端点不得被误注册(#96 stock quote)', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/stock/${UUID}/quote` })
    expect(isRouteMissing(res)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
