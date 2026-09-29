// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 第二十八批·泳道「认证/会话/令牌/偏好」布尔写 ack 的 1:1 回归。
 *
 * 每枚用例钉的都是同一个不变量:**UPDATE/DELETE 命中 0 行时,端点不得回 true**。
 * 改前这 6 处里 5 处在"0 行/没执行写"的情况下也回常量 true(见各交付报告的三问表),
 * 唯一有 404 闸的 settings/authorizations 也只防得住"没执行写"。
 * 夹具与真 drizzle 同形:`update()/delete()` 经 `where()` 后的产物**既可 await 也可再
 * `.returning()`**(同形写法见 tests/oss-files-delete.test.ts);`state.writeRows` 由
 * 各用例显式设定为"库侧回报的命中集"。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import cookie from '@fastify/cookie'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.REDIS_URL ??= 'redis://localhost:6379/0'
})

const USER_ID = '00000000-0000-4000-8000-000000000001'
// refresh_tokens.id 是 uuid 主键(packages/database/src/schema/users.ts:88,
// DDL 0043_neat_the_spike.sql "id" uuid PRIMARY KEY)。DELETE /settings/authorizations/:id
// 在进 SQL 前挂 isUuidString 形状闸(src/routes/user/settings-routes.ts:139),
// 假 id 'sess-1' 被拦成 400 ⇒ 本用例要判的"0 行 ⇒ 404 / 1 行 ⇒ revoked:true"压根没跑到。
// 注:该路由的成功响应只有 { revoked } 一键,不回传 id,所以这里没有"原样回传"可断言 ——
// 能跑到写链本身就是 uuid 通过形状闸的证据(由 state.writeRows 旋钮控制命中集)。
const SESSION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

// 写链回报的唯一旋钮:selectRows 喂"读侧"(存在性预读),writeRows 喂 RETURNING 命中集。
const state = vi.hoisted(() => ({
  selectRows: [] as unknown[],
  writeRows: [] as Array<{ id: string }>,
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
    AI_SERVICE_URL: 'http://localhost:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

// 鉴权面与本源无关(本批判据在写链回报):authenticate/requireAuth 只负责注入 userId。
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: FastifyRequest) => {
    ;(request as { userId?: string }).userId = USER_ID
    return { userId: USER_ID, familyId: 'f-1', roleId: 0, type: 'access' as const }
  }),
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: vi.fn(async (request: FastifyRequest) => {
    ;(request as { userId?: string }).userId = USER_ID
  }),
  requireAdmin: vi.fn(async (request: FastifyRequest) => {
    ;(request as { userId?: string }).userId = USER_ID
  }),
  requirePermission: () => vi.fn(async () => {}),
  requireAnyPermission: () => vi.fn(async () => {}),
}))

// 与真 drizzle 同形的可配置链:任一中间态既可继续链式调用,也可 await / .returning()。
// 代理目标必须是**函数**而不是普通对象 —— 链上任何一环都会被当函数调用(update(table)),
// 且 get 必须返回代理本体(返回裸 target 会让 .set() 变成"chain is not a function")。
function makeChain(getRows: () => unknown[]): Record<string, unknown> {
  const proxy: Record<string, unknown> = new Proxy(function () {}, {
    get(_t, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
          Promise.resolve(getRows()).then(resolve, reject)
      }
      return proxy
    },
    apply() {
      return proxy
    },
  })
  return proxy
}

function makeDb() {
  return {
    select: () => makeChain(() => state.selectRows),
    update: () => makeChain(() => state.writeRows),
    delete: () => makeChain(() => state.writeRows),
    insert: () => makeChain(() => state.writeRows),
    execute: () => Promise.resolve([]),
  }
}

vi.mock('../src/db/index.js', () => ({
  db: makeDb(),
  dbRead: makeDb(),
  dbClient: {},
}))

vi.mock('../src/db/usercenter-queries.js', () => ({
  getUserStatus: vi.fn().mockResolvedValue(1),
}))

import { authRoutes } from '../src/routes/auth.js'
import { authExtendedRoutes } from '../src/routes/auth-extended.js'
import developerRelayRoutes from '../src/routes/developer-relay.js'
import { oauthKeysRoutes } from '../src/routes/oauth-keys.js'
import settingsRoutes from '../src/routes/user/settings-routes.js'

beforeEach(() => {
  state.selectRows = []
  state.writeRows = []
})

describe('POST /api/auth/logout — revoked 必须由 revokeRefreshToken 的 RETURNING 派生', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(cookie)
    await app.register(authRoutes, { prefix: '/api/auth' })
    await app.ready()
  })
  afterAll(async () => {
    await app.close()
  })

  it('token 存在且 UPDATE 命中 0 行 ⇒ revoked: false(不得冒充吊销成功)', async () => {
    state.selectRows = [{ id: 'rt-1', token: 'tok', revokedAt: null }]
    state.writeRows = []
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      payload: { refreshToken: 'tok' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ revoked: false })
  })

  it('UPDATE 命中 1 行 ⇒ revoked: true', async () => {
    state.selectRows = [{ id: 'rt-1', token: 'tok', revokedAt: null }]
    state.writeRows = [{ id: 'rt-1' }]
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      payload: { refreshToken: 'tok' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ revoked: true })
  })
})

describe('POST /api/auth/bindings/remove — removed 必须由 RETURNING 派生', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(cookie)
    await app.register(authExtendedRoutes, { prefix: '/api' })
    await app.ready()
  })
  afterAll(async () => {
    await app.close()
  })

  it('UPDATE 命中 0 行 ⇒ removed: false', async () => {
    state.writeRows = []
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/bindings/remove',
      headers: { authorization: 'Bearer access-token' },
      payload: { uuid: USER_ID, platform: 'wechat' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ removed: false })
  })

  it('UPDATE 命中 1 行 ⇒ removed: true', async () => {
    state.writeRows = [{ id: 'b-1' }]
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/bindings/remove',
      headers: { authorization: 'Bearer access-token' },
      payload: { uuid: USER_ID, platform: 'wechat' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ removed: true })
  })
})

describe('POST /api/developer/relay/keys/:id/revoke — revoked 派生且 404 闸逐字保留', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(developerRelayRoutes, { prefix: '/api' })
    await app.ready()
  })
  afterAll(async () => {
    await app.close()
  })

  it('读得到 active 行但 UPDATE 命中 0 行(并发删除)⇒ 404,不得回 200+revoked:true', async () => {
    state.selectRows = [{ id: 'key-1', userId: USER_ID, status: 'active' }]
    state.writeRows = []
    const res = await app.inject({
      method: 'POST',
      url: '/api/developer/relay/keys/key-1/revoke',
    })
    expect(res.statusCode).toBe(404)
  })

  it('UPDATE 命中 1 行 ⇒ 200 + revoked: true', async () => {
    state.selectRows = [{ id: 'key-1', userId: USER_ID, status: 'active' }]
    state.writeRows = [{ id: 'key-1' }]
    const res = await app.inject({
      method: 'POST',
      url: '/api/developer/relay/keys/key-1/revoke',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ revoked: true })
  })
})

describe('POST /api/oauth-keys/revoke — revoked 必须由本写链 RETURNING 派生', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(oauthKeysRoutes, { prefix: '/api/oauth-keys' })
    await app.ready()
  })
  afterAll(async () => {
    await app.close()
  })

  it('存在性预读通过但 UPDATE 命中 0 行 ⇒ revoked: false', async () => {
    state.selectRows = [{ id: 'key-9', clientId: 'c-1', isActive: 1 }]
    state.writeRows = []
    const res = await app.inject({
      method: 'POST',
      url: '/api/oauth-keys/revoke',
      payload: { keyId: 'key-9' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ keyId: 'key-9', revoked: false })
  })

  it('UPDATE 命中 1 行 ⇒ revoked: true', async () => {
    state.selectRows = [{ id: 'key-9', clientId: 'c-1', isActive: 1 }]
    state.writeRows = [{ id: 'key-9' }]
    const res = await app.inject({
      method: 'POST',
      url: '/api/oauth-keys/revoke',
      payload: { keyId: 'key-9' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ keyId: 'key-9', revoked: true })
  })
})

describe('settings 两处 DELETE — 0 行回报不得判成动作完成', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    app = Fastify({ logger: false })
    // 路由本身只消费 request.userId(鉴权 preHandler 住在 routes/user/index.ts,
    // 不在本插件内)—— 这里按同一约定注入。
    app.addHook('preHandler', async (request) => {
      ;(request as { userId?: string }).userId = USER_ID
    })
    await app.register(settingsRoutes, { prefix: '/api' })
    await app.ready()
  })
  afterAll(async () => {
    await app.close()
  })

  it('DELETE /api/settings/authorizations/:id — revokeSession 命中 0 行 ⇒ 404', async () => {
    state.writeRows = []
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/settings/authorizations/${SESSION_ID}`,
    })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /api/settings/authorizations/:id — 命中 1 行 ⇒ revoked: true', async () => {
    state.writeRows = [{ id: SESSION_ID }]
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/settings/authorizations/${SESSION_ID}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ revoked: true })
  })

  it('DELETE /api/settings/devices/:deviceId — DELETE 命中 0 行 ⇒ removed: false', async () => {
    state.writeRows = []
    const res = await app.inject({ method: 'DELETE', url: '/api/settings/devices/dev-1' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ success: true, deviceId: 'dev-1', removed: false })
  })

  it('DELETE /api/settings/devices/:deviceId — 命中 1 行 ⇒ removed: true', async () => {
    state.writeRows = [{ id: 'p-1' }]
    const res = await app.inject({ method: 'DELETE', url: '/api/settings/devices/dev-1' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({ success: true, deviceId: 'dev-1', removed: true })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
