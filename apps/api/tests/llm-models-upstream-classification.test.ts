// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B67 验收:GET /api/llm/models 的上游失败分类(2026-10-30 立)。
 *
 * 票面(HEAD:PROJECT_PLAN.md):`GET /api/llm/models -> 502` 在 24h 内同签名 2 次
 * (2026-10-30 06:29:25 / 06:42:48,耗时 11ms / 34ms),而 ai-service 正常出这份清单要
 * 0.5–1.2s、连接被拒只要 ~1ms —— 两次都是"上游没给成功响应",但旧实现把三类完全不同的
 * 失败压成同一个 502,api_logs 里只剩一行状态码,事后无法归因。
 *
 * 本文件钉住五件事(缺一条都不算修好):
 *   ① 上游超时(真 deadline 触发,不是手搓错误对象)⇒ 504 GATEWAY_TIMEOUT;
 *   ② 上游连不上 ⇒ 503 SERVICE_UNAVAILABLE,与超时分开;
 *   ③ 上游 401 ⇒ 502 UPSTREAM_AUTH_FAILED(不是"服务不可用");
 *   ④ 上游 200 但不是 JSON ⇒ 502 UPSTREAM_FAILURE(契约破坏,不是 500 也不是裸 502);
 *   ⑤ 正向对照:200 原样透传(证明分类没有削掉成功路径)。
 *
 * 关于"本仓缺陷不再被盖成 502":旧实现的 catch-all 把 handler 内任何异常(含查库失败)
 * 都回 502 "AI service unavailable";现在异常区只剩上游那一次调用,其余抛出直接走全局
 * errorHandler(500)。这一条由结构保证(diff 见 route),不另造一条生产不可达的路径来"演"它。
 *
 * 零真 SQL:数据库整体走 `vi.mock('../src/db/index.js')` 桩;网络整体走 `globalThis.fetch` 假件。
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'

const ADMIN_ID = '00000000-0000-4000-8000-000000000001'
const FAMILY_ID = '00000000-0000-4000-8000-000000000002'

const mocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  fetch: vi.fn(),
}))

// 避免 env 校验在 import 期 process.exit(1)(与 ai-chain-contract.test.ts 同款桩)
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://mock-ai-service:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

vi.mock('jose', () => ({ decodeJwt: () => ({}) }))

vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
  verifyAccessToken: mocks.verifyAccessToken,
  createFamilyId: vi.fn(),
}))

// auth 的会话态查询(见 plugins/auth.ts 的 getUserStatus 调用)
vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

function createChainableMock() {
  const thenFn = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve)
  const make = (): Record<string, unknown> =>
    new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        if (prop === 'then') return thenFn
        return vi.fn().mockReturnValue(make())
      },
    })
  return make()
}

// 零真 SQL:连接池整体桩掉(本票用例根本不走 /list 的查询,但模块级 import 必须能解析)
vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => createChainableMock()),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]) })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 'mock-id' }]) })),
      })),
    })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    execute: vi.fn().mockResolvedValue([]),
  },
  dbRead: {},
  dbClient: {},
}))

const { llmModelsRoutes } = await import('../src/routes/llm-models.js')

const ADMIN_TOKEN = 'Bearer admin-token'

/** 假 Response:只实现路由真正用到的字段(ok / status / text / json)。 */
function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

function textResponse(status: number, text: string) {
  return {
    ok: false,
    status,
    json: async () => JSON.parse(text),
    text: async () => text,
  }
}

describe('B67 GET /api/llm/models 上游失败分类', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(llmModelsRoutes, { prefix: '/api/llm' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    mocks.verifyAccessToken.mockResolvedValue({
      userId: ADMIN_ID,
      phone: '13800000001',
      familyId: FAMILY_ID,
      roleId: 1,
    })
    mocks.fetch.mockReset()
    globalThis.fetch = mocks.fetch as unknown as typeof globalThis.fetch
    // deadline 收紧到 60ms:这一档必须由**真的 deadline** 触发(手搓错误对象测的是分类函数,
    // 不是"超时真的会发生"),否则用例要么慢 15s、要么证明力归零。
    process.env.LLM_MODELS_UPSTREAM_TIMEOUT_MS = '60'
  })

  afterEach(() => {
    delete process.env.LLM_MODELS_UPSTREAM_TIMEOUT_MS
  })

  it('① 上游超时 ⇒ 504 + GATEWAY_TIMEOUT(不是裸 502)', async () => {
    // 上游"连上了但不回话":只在 signal 被 abort 时 reject,reject 的正是 deadline 的 reason
    mocks.fetch.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init.signal as AbortSignal
          signal.addEventListener('abort', () => reject(signal.reason), { once: true })
        }),
    )

    const res = await server.inject({
      method: 'GET',
      url: '/api/llm/models',
      headers: { authorization: ADMIN_TOKEN },
    })

    expect(res.statusCode).not.toBe(502)
    expect(res.statusCode).toBe(504)
    const body = res.json()
    expect(body.code).toBe(504)
    expect(body.errorCode).toBe('GATEWAY_TIMEOUT')
    expect(String(body.message)).toContain('timeout')
  })

  it('② 上游连不上 ⇒ 503 + SERVICE_UNAVAILABLE,与超时分成两档', async () => {
    mocks.fetch.mockRejectedValue(new Error('fetch failed: connect ECONNREFUSED 127.0.0.1:8803'))

    const res = await server.inject({
      method: 'GET',
      url: '/api/llm/models',
      headers: { authorization: ADMIN_TOKEN },
    })

    expect(res.statusCode).toBe(503)
    const body = res.json()
    expect(body.errorCode).toBe('SERVICE_UNAVAILABLE')
    expect(String(body.message)).toContain('unreachable')
  })

  it('③ 上游 401 ⇒ 502 + UPSTREAM_AUTH_FAILED(凭据面,不是"服务不可用")', async () => {
    mocks.fetch.mockResolvedValue(
      textResponse(401, '{"code":401,"message":"Authentication required"}'),
    )

    const res = await server.inject({
      method: 'GET',
      url: '/api/llm/models',
      headers: { authorization: ADMIN_TOKEN },
    })

    expect(res.statusCode).toBe(502)
    const body = res.json()
    expect(body.errorCode).toBe('UPSTREAM_AUTH_FAILED')
    // 契约:上游细节(URL/凭据形态)不回显
    expect(String(body.message)).not.toContain('Authentication required')
  })

  it('④ 上游 200 但不是 JSON ⇒ 502 UPSTREAM_FAILURE(契约破坏单独成档)', async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0')
      },
      text: async () => '<html>gateway</html>',
    })

    const res = await server.inject({
      method: 'GET',
      url: '/api/llm/models',
      headers: { authorization: ADMIN_TOKEN },
    })

    expect(res.statusCode).toBe(502)
    const body = res.json()
    expect(body.errorCode).toBe('UPSTREAM_FAILURE')
    expect(String(body.message)).toContain('invalid JSON')
  })

  it('⑤ 上游 500 ⇒ 502 + UPSTREAM_FAILURE,响应带上游状态码(不再只有"unavailable")', async () => {
    mocks.fetch.mockResolvedValue(textResponse(500, 'Internal Server Error'))

    const res = await server.inject({
      method: 'GET',
      url: '/api/llm/models',
      headers: { authorization: ADMIN_TOKEN },
    })

    expect(res.statusCode).toBe(502)
    const body = res.json()
    expect(body.errorCode).toBe('UPSTREAM_FAILURE')
    expect(String(body.message)).toContain('500')
  })

  it('⑥ 正向对照:上游 200 ⇒ 原样透传 + points_multiplier 附加 + Bearer 转发', async () => {
    const payload = {
      models: [
        { id: 'agnes/agnes-2.5-flash', name: 'Agnes 2.5 Flash', provider: 'agnes' },
        { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek' },
      ],
      default: 'agnes/agnes-2.5-flash',
    }
    mocks.fetch.mockResolvedValue(jsonResponse(payload))

    const res = await server.inject({
      method: 'GET',
      url: '/api/llm/models',
      headers: { authorization: ADMIN_TOKEN },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.models).toHaveLength(2)
    expect(body.data.models[0].id).toBe('agnes/agnes-2.5-flash')
    expect(body.data.default).toBe('agnes/agnes-2.5-flash')
    // 透传的倍数由 inferPointsMultiplier 附加(成功路径未被分类改动削掉)
    expect(typeof body.data.models[0].points_multiplier).toBe('number')
    // 鉴权头原样转发给 ai-service(管理员身份下不做受限模型过滤)
    const [, init] = mocks.fetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe(ADMIN_TOKEN)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
