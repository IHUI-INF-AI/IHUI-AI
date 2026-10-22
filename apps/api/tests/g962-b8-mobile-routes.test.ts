// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-962 批 B8 补后端路由形状锁定 —— 不连库。
 *
 * 判据:本批补注册的每条 method+path 在**与 index.ts 同款前缀**的注册面上真实存在
 * (请求不得落 FST_ERR_NOT_FOUND),且鉴权闸先回 401(goods 为公开目录,回 200 空 list)。
 * 路由 404(FST_ERR_NOT_FOUND)与业务 404 以响应体 message 区分。
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
      'groupBy',
      'having',
      'limit',
      'offset',
      'values',
      'set',
      'returning',
      'onConflictDoNothing',
      'onConflictDoUpdate',
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

import walletRoutes from '../src/routes/wallet.js'
import { certificateRoutes } from '../src/routes/certificate.js'
import { customerServiceRoutes } from '../src/routes/customer-service.js'
import { orderRoutes } from '../src/routes/order.js'
import { agentsRoutes } from '../src/routes/agents.js'
import developerRoutes from '../src/routes/developer.js'
import { terminalRoutes } from '../src/routes/terminal.js'
import { goodsRoutes } from '../src/routes/goods.js'

/** 路由级 404(Fastify 默认 not-found 体)与业务 404 区分 */
function isRouteMissing(res: { statusCode: number; body: string }): boolean {
  if (res.statusCode !== 404) return false
  try {
    return /not found/i.test((JSON.parse(res.body) as { message?: string }).message ?? '')
  } catch {
    return false
  }
}

describe('G-962 批 B8 补后端注册的路由形状', () => {
  const server: FastifyInstance = Fastify({ logger: false })

  beforeAll(async () => {
    // 与 apps/api/src/routes/index.ts 同款前缀
    await server.register(walletRoutes, { prefix: '/api/wallet' })
    await server.register(certificateRoutes, { prefix: '/api' })
    await server.register(customerServiceRoutes, { prefix: '/api/customer-service' })
    await server.register(orderRoutes, { prefix: '/api' })
    await server.register(agentsRoutes, { prefix: '/api' })
    await server.register(developerRoutes, { prefix: '/api/developer' })
    await server.register(terminalRoutes, { prefix: '/api' })
    await server.register(goodsRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  const AUTHED: Array<[string, 'GET' | 'POST' | 'PUT', string]> = [
    ['agent-setting 读', 'GET', '/api/agent-setting'],
    ['agent-setting 写', 'PUT', '/api/agent-setting'],
    ['bank-cards', 'GET', '/api/wallet/bank-cards'],
    ['证书申请', 'POST', '/api/certificates'],
    ['客服信息', 'GET', '/api/customer-service/info'],
    ['订单日志', 'GET', '/api/order-log'],
    ['订单跟踪', 'GET', '/api/order-track'],
    ['API 版本', 'GET', '/api/developer/versions'],
    ['终端录制', 'GET', '/api/terminal/recordings'],
  ]

  it.each(AUTHED)('%s %s %s 在册且鉴权闸先回 401', async (_tag, method, url) => {
    const res = await server.inject({
      method,
      url,
      ...(method === 'PUT'
        ? { payload: { name: 'x', model: 'm', temperature: 0.5, enabled: true } }
        : {}),
      ...(method === 'POST' ? { payload: { name: 'x', idCard: '110101199001011234' } } : {}),
    })
    expect(isRouteMissing(res), `${method} ${url} 未注册`).toBe(false)
    expect(res.statusCode, `${method} ${url} 应回 401`).toBe(401)
  })

  it('GET /api/goods/select 在册,公开回 200 且 data.list 为数组', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/goods/select?page=1&pageSize=50' })
    expect(isRouteMissing(res), 'GET /api/goods/select 未注册').toBe(false)
    expect(res.statusCode).toBe(200)
    const body = res.json() as { data?: { list?: unknown } }
    expect(Array.isArray(body.data?.list)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
