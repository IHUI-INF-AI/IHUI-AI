// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-962 死端点簇 · 模板串三族补后端形状锁定 —— 不连库。
 *
 * 判据:RN 三屏(AgentChat/LiveChat/CircleChat)声明的六条 method+path 在**与 index.ts
 * 同款前缀(/api)**的注册面上真实存在(不得落 FST_ERR_NOT_FOUND),且鉴权闸先回 401。
 * 路由 404(FST_ERR_NOT_FOUND)与业务 404 以响应体 message 区分(同 g962-b8 手法)。
 * 阳性对照:同一条尺对未注册的 /api/agents/:id/nope 必须判缺。
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

import { mobileChatRoutes } from '../src/routes/mobile-chat-routes.js'

/** 路由级 404(Fastify 默认 not-found 体)与业务 404 区分 */
function isRouteMissing(res: { statusCode: number; body: string }): boolean {
  if (res.statusCode !== 404) return false
  try {
    return /not found/i.test((JSON.parse(res.body) as { message?: string }).message ?? '')
  } catch {
    return false
  }
}

describe('G-962 模板串三族(agents|live|circles /:id/messages)注册形状', () => {
  const server: FastifyInstance = Fastify({ logger: false })

  beforeAll(async () => {
    // 与 apps/api/src/routes/index.ts 同款前缀
    await server.register(mobileChatRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  const UUID = '11111111-1111-4111-8111-111111111111'
  const AUTHED: Array<[string, 'GET' | 'POST', string]> = [
    ['Agent 历史', 'GET', `/api/agents/${UUID}/messages`],
    ['Agent 发送', 'POST', `/api/agents/${UUID}/messages`],
    ['直播历史', 'GET', '/api/live/7/messages'],
    ['直播发送', 'POST', '/api/live/7/messages'],
    ['圈子历史', 'GET', `/api/circles/${UUID}/messages`],
    ['圈子发送', 'POST', `/api/circles/${UUID}/messages`],
  ]

  it.each(AUTHED)('%s %s %s 在册且鉴权闸先回 401', async (_tag, method, url) => {
    const res = await server.inject({
      method,
      url,
      ...(method === 'POST' ? { payload: { content: 'hi' } } : {}),
    })
    expect(isRouteMissing(res), `${method} ${url} 未注册`).toBe(false)
    expect(res.statusCode, `${method} ${url} 应回 401`).toBe(401)
  })

  it('反向对照:同族未注册尾段必须判缺(尺有牙)', async () => {
    const res = await server.inject({ method: 'GET', url: `/api/agents/${UUID}/nope` })
    expect(isRouteMissing(res)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
