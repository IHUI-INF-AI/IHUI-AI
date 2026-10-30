/**
 * GET /api/llm/models 的鉴权闭环(2026-10-31 立,票面出处 HEAD:PROJECT_PLAN.md B67 行「未收格」)。
 *
 * 缺陷本体:`getUserUuid()` 读 `request.user`,而本仓身份的唯一写入点是
 * `plugins/auth.ts` 的 `request.userId`(现读:auth.ts 内 `request.userId = payload.userId`,
 * 全仓生产代码零处写 `request.user`)。两者从不相遇 ⇒ 该函数恒返空串 ⇒
 * 旧判定 `if (userUuid && !(await isSystemAdminUser(userUuid)))` 的短路条件永远为假 ⇒
 * 2026-08-05 立的「非系统内置管理员不得看到真实付费 key 模型」红线**从未生效过一次**:
 * 任何登录用户都拿到完整受限模型清单(付费上游身份/规格/可用性)。
 *
 * 本文件走真鉴权链(只桩 @ihui/auth 的验签与两处 DB 查询),钉两档互补的读数:
 *   ① 普通登录用户 ⇒ 受限三档(字面档 deepseek-chat/gpt-4o + 前缀档 agnes/)全部剔除,
 *      且判定确实拿这个主体的 uuid 去查过管理员位(不是靠"查不到⇒不是管理员"蒙对);
 *   ② 正向对照:系统内置管理员 ⇒ 全量透传(证明过滤不是无差别阉割)。
 * 「身份取不到时也必须过滤」那一档在 llm-models-identity-fail-closed.test.ts
 * (那里把承载层换成"只写 request.user"的桩,正面复现旧缺陷)。
 *
 * 零真 SQL:`db/index.js` 与 `db/queries.js` 整体桩掉;网络走 `globalThis.fetch` 假件。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'

const ADMIN_ID = '00000000-0000-4000-8000-000000000001'
const PLAIN_ID = '00000000-0000-4000-8000-000000000003'
const FAMILY_ID = '00000000-0000-4000-8000-000000000002'

const mocks = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  isSystemAdminUser: vi.fn(),
  fetch: vi.fn(),
}))

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

vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

vi.mock('../src/db/queries.js', () => ({
  isSystemAdminUser: mocks.isSystemAdminUser,
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

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => createChainableMock()),
    execute: vi.fn().mockResolvedValue([]),
  },
  dbRead: {},
  dbClient: {},
}))

const { llmModelsRoutes } = await import('../src/routes/llm-models.js')

/** 受限三档 + 公共两档;受限档同时覆盖 RESTRICTED_MODEL_IDS 与 RESTRICTED_PREFIXES 两条判定 */
const UPSTREAM_MODELS = [
  { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek' },
  { id: 'agnes/agnes-2.5-flash', name: 'Agnes 2.5 Flash', provider: 'agnes' },
  { id: 'xai/grok-4', name: 'Grok 4', provider: 'xai' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'moonshot/kimi-k2', name: 'Kimi K2', provider: 'moonshot' },
]

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

describe('GET /api/llm/models 受限模型清单按主体收口', () => {
  const server = Fastify({ logger: false })
  let ready = false

  beforeEach(async () => {
    if (!ready) {
      await server.register(llmModelsRoutes, { prefix: '/api/llm' })
      await server.ready()
      ready = true
    }
    mocks.fetch.mockReset()
    mocks.isSystemAdminUser.mockReset()
    globalThis.fetch = mocks.fetch as unknown as typeof globalThis.fetch
    mocks.fetch.mockResolvedValue(jsonResponse({ models: UPSTREAM_MODELS, default: 'x' }))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  async function modelIdsAs(userId: string): Promise<string[]> {
    mocks.verifyAccessToken.mockResolvedValue({
      userId,
      phone: '13800000009',
      familyId: FAMILY_ID,
      roleId: 0,
    })
    const res = await server.inject({
      method: 'GET',
      url: '/api/llm/models',
      headers: { authorization: `Bearer tok-${userId}` },
    })
    expect(res.statusCode).toBe(200)
    return (res.json().data.models as Array<{ id: string }>).map((m) => m.id)
  }

  it('① 普通登录用户 ⇒ 字面档与前缀档的受限模型一并剔除', async () => {
    mocks.isSystemAdminUser.mockResolvedValue(false)

    const ids = await modelIdsAs(PLAIN_ID)

    expect(ids).toEqual(['xai/grok-4', 'moonshot/kimi-k2'])
    expect(ids).not.toContain('deepseek-chat')
    expect(ids).not.toContain('gpt-4o')
    expect(ids).not.toContain('agnes/agnes-2.5-flash')
    // 判定必须真的拿这个主体去查管理员位:否则"恒查不到"也会得到同一结论,
    // 而那条捷径在身份取错字段时恰好翻成"永不查询 ⇒ 永不过滤"。
    expect(mocks.isSystemAdminUser).toHaveBeenCalledWith(PLAIN_ID)
  })

  it('② 正向对照:系统内置管理员 ⇒ 全量透传(过滤不是无差别阉割)', async () => {
    mocks.isSystemAdminUser.mockResolvedValue(true)

    const ids = await modelIdsAs(ADMIN_ID)

    expect(ids).toEqual([
      'deepseek-chat',
      'agnes/agnes-2.5-flash',
      'xai/grok-4',
      'gpt-4o',
      'moonshot/kimi-k2',
    ])
  })
})
