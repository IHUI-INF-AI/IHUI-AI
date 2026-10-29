// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B04 消费面接线(2026-10-27 立):工具调用明细账内部摄入路由的回归。
 * 权威口径:AGENTS §5「认证不等于授权」+ §5e「失败必须响」;载体先例 D154
 * `internal-user-broadcast.ts`,身份纪律先例 86H `cli-tool-approval-audit.ts`,
 * 兄弟路径拦截先例 D30① `webhook-intake-registration.test.ts`。
 *
 * 钉住的三组,每组对应一种真实失效型:
 *  组一(路由语义 A–H):
 *   A/B 无凭据/错凭据 ⇒ 401 且**账 service 一次都不被调**(鉴权先于写,AGENTS 既有要求);
 *   C 请求体混入自报 userId ⇒ strict schema 400 零写入,而不是"自报身份赢了";
 *   D 收束态 ⇒ principal 取承载层注入主体(与 body 无关),meta 带 ip/userAgent;
 *   E chain_failed ⇒ 如实 500(链不成则账不落,不演成"已落账");
 *   F 落库异常 ⇒ 500(不吞成 200);
 *   G duplicate ⇒ 200(账行在位的诚实终态);
 *   H 主体非 UUID ⇒ 归位 401,不外溢成 DB 错,record 不被调。
 *  组二(CSRF 兄弟路径 I–L):豁免是**凭据验真型,不是路径白名单**——
 *   I 无凭据打本路由 ⇒ 403(CSRF 钩子先于路由,匿名写被拦);
 *   J 同前缀兄弟诱饵路径 ⇒ 403(证明没人给 `/api/internal/tool-ledger/` 开过前缀洞);
 *   K 伪造密钥头 ⇒ 仍 403(头名在场≠豁免,#23 收口的判据);
 *   L 真密钥 ⇒ 抵达路由 200(豁免只免 CSRF,不免路由侧鉴权)。
 *  组三(接线锁,源码面):注册在位、scope 钉 api-tools、sqliGuard 关闭在位、
 *   csrf/tenant 两清单**不得**出现 tool-ledger 路径(裁决:照 D154 先例 = 凭据验真型,
 *   不逐路径登记;这一格把裁决钉进代码,防止后来者"补白名单"把防线改成路径放行)。
 *
 * 不连生产 PG/Redis(§5 测试隔离铁律):db 按 queryChunks 之外的 eq 桩形态取字面量
 * (webhook-intake-registration 同型);ledger service 走 partial mock —— **真 strict
 * schema、假 record**,schema 语义必须是被测实现本身。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import type * as DrizzleOrm from 'drizzle-orm'
import type * as LedgerService from '../src/services/tool-invocation-ledger-service.js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const { AI_SECRET_TEST, USER_UUID, LEGACY_NUMERIC_ID } = vi.hoisted(() => ({
  AI_SECRET_TEST: 'b04-ingest-test-secret-not-for-prod-0123456789',
  USER_UUID: '6b8cd0f6-546f-44c8-853a-5f96edbe08be',
  LEGACY_NUMERIC_ID: '123',
}))

/** 内存形态的 users 表:主体存在 + 活跃校验的替身(不触库)。 */
const { userTable } = vi.hoisted(() => ({
  userTable: new Map<string, { id: string; status: number; roleId: number }>(),
}))

const { mockRecord } = vi.hoisted(() => ({
  mockRecord: vi.fn(),
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://localhost:6379/0',
    JWT_SECRET: 'b04-test-jwt-secret-at-least-32-characters!!!',
    AI_CALLBACK_SECRET: AI_SECRET_TEST,
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

// internal-service-token.ts 静态依赖 db;桩成链式形态,where 取 eq 桩([col, value])的字面量。
vi.mock('../src/db/index.js', () => {
  const db = {
    select: (_cols?: unknown) => {
      const self = {
        _id: '',
        from: () => self,
        where: (cond: unknown) => {
          const arr = cond as unknown[]
          self._id = Array.isArray(arr) && typeof arr[1] === 'string' ? arr[1] : ''
          return self
        },
        limit: async () => {
          const u = userTable.get(self._id)
          return u ? [{ ...u }] : []
        },
      }
      return self
    },
  }
  return { db, dbRead: db, dbReader: db }
})

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof DrizzleOrm>()
  return {
    ...actual,
    eq: (a: unknown, b: unknown) => [a, b] as unknown as ReturnType<typeof actual.eq>,
  }
})

// ledger service:partial mock —— 保留**真 strict schema**(组一的 400 语义必须测实现本身),
// 只把落库出口 recordToolInvocationLedger 换成可编程桩(不触链/库)。
vi.mock('../src/services/tool-invocation-ledger-service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof LedgerService>()
  return { ...actual, recordToolInvocationLedger: mockRecord }
})

import internalToolInvocationLedgerRoutes from '../src/routes/internal-tool-invocation-ledger.js'
import csrfPlugin from '../src/plugins/csrf.js'

const LEDGER_PATH = '/api/internal/tool-ledger/invocation'
/** 同前缀兄弟诱饵:它不在任何清单里,必须被 CSRF 拦住(豁免不是前缀)。 */
const DECOY_PATH = '/api/internal/tool-ledger/invocation-twin'

const GOOD_BODY = {
  invocationId: 'inv-b04-0001',
  sessionId: 'sess-b04',
  toolName: 'shell',
  permissionDecision: 'approved',
  state: 'settled',
  ok: true,
  input: 'ls -la',
  output: 'total 3',
}

const GOOD_HEADERS = {
  'x-internal-service-token': AI_SECRET_TEST,
  'x-user-id': USER_UUID,
  'user-agent': 'pytest-b04-leg',
}

async function buildApp(withCsrf = false): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  if (withCsrf) {
    await app.register(cookie)
    await app.register(csrfPlugin)
    app.post(DECOY_PATH, async (_req, reply) => reply.send({ ok: true }))
  }
  await app.register(internalToolInvocationLedgerRoutes)
  await app.ready()
  return app
}

let savedAuthMode: string | undefined
let savedJwtSecret: string | undefined

beforeAll(() => {
  // 档位钉死 dual:老通道头是本夹具的机器凭据族(票族需要 redis 回放登记表,
  // 与路由语义无关,不在本文件覆盖面)。
  savedAuthMode = process.env.INTERNAL_SERVICE_AUTH_MODE
  process.env.INTERNAL_SERVICE_AUTH_MODE = 'dual'
  savedJwtSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'b04-test-jwt-secret-at-least-32-characters!!!'
})

afterAll(async () => {
  if (savedAuthMode === undefined) delete process.env.INTERNAL_SERVICE_AUTH_MODE
  else process.env.INTERNAL_SERVICE_AUTH_MODE = savedAuthMode
  if (savedJwtSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = savedJwtSecret
})

beforeEach(() => {
  mockRecord.mockReset()
  userTable.clear()
  userTable.set(USER_UUID, { id: USER_UUID, status: 1, roleId: 0 })
  userTable.set(LEGACY_NUMERIC_ID, { id: LEGACY_NUMERIC_ID, status: 1, roleId: 0 })
})

describe('组一 B04 摄入路由语义(不挂 CSRF,钉 handler 本体)', () => {
  it('A 无凭据 ⇒ 401,账 service 一次都不被调', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: LEDGER_PATH, payload: GOOD_BODY })
    expect(res.statusCode).toBe(401)
    expect(mockRecord).not.toHaveBeenCalled()
    await app.close()
  })

  it('B 错密钥 ⇒ 401,零写入(鉴权先于写)', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: LEDGER_PATH,
      payload: GOOD_BODY,
      headers: { 'x-internal-service-token': 'attacker-guess', 'x-user-id': USER_UUID },
    })
    expect(res.statusCode).toBe(401)
    expect(mockRecord).not.toHaveBeenCalled()
    await app.close()
  })

  it('C 请求体混入自报 userId ⇒ strict schema 400,零写入', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: LEDGER_PATH,
      payload: { ...GOOD_BODY, userId: 'user-victim' },
      headers: GOOD_HEADERS,
    })
    expect(res.statusCode).toBe(400)
    expect(mockRecord).not.toHaveBeenCalled()
    await app.close()
  })

  it('D 合法摄入 ⇒ 200;principal 取承载层主体,meta 带 ip/userAgent', async () => {
    mockRecord.mockResolvedValue({ status: 'recorded', ledgerId: 'l-1', chainEntryId: 'c-1' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: LEDGER_PATH,
      payload: GOOD_BODY,
      headers: GOOD_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ status: 'recorded', ledgerId: 'l-1' })
    expect(mockRecord).toHaveBeenCalledTimes(1)
    const [principal, payload, meta] = mockRecord.mock.calls[0] as [
      { userId: string },
      Record<string, unknown>,
      { ip?: string; userAgent?: string },
    ]
    expect(principal).toEqual({ userId: USER_UUID })
    expect(payload).not.toHaveProperty('userId')
    expect(payload).not.toHaveProperty('user_id')
    expect(payload.invocationId).toBe('inv-b04-0001')
    expect(meta.userAgent).toBe('pytest-b04-leg')
    await app.close()
  })

  it('E chain_failed ⇒ 如实 500(链不成则账不落,不演成已落账)', async () => {
    mockRecord.mockResolvedValue({ status: 'chain_failed' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: LEDGER_PATH,
      payload: GOOD_BODY,
      headers: GOOD_HEADERS,
    })
    expect(res.statusCode).toBe(500)
    await app.close()
  })

  it('F 落库异常 ⇒ 500(不吞成 200)', async () => {
    mockRecord.mockRejectedValue(new Error('db down'))
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: LEDGER_PATH,
      payload: GOOD_BODY,
      headers: GOOD_HEADERS,
    })
    expect(res.statusCode).toBe(500)
    await app.close()
  })

  it('G duplicate ⇒ 200(账行在位的诚实终态,重放不双计)', async () => {
    mockRecord.mockResolvedValue({ status: 'duplicate', ledgerId: 'l-0' })
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: LEDGER_PATH,
      payload: GOOD_BODY,
      headers: GOOD_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.status).toBe('duplicate')
    await app.close()
  })

  it('H 主体非 UUID(活跃数字主体)⇒ 归位 401,record 不被调', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: LEDGER_PATH,
      payload: GOOD_BODY,
      headers: { ...GOOD_HEADERS, 'x-user-id': LEGACY_NUMERIC_ID },
    })
    expect(res.statusCode).toBe(401)
    expect(res.json().message).toContain('UUID')
    expect(mockRecord).not.toHaveBeenCalled()
    await app.close()
  })

  it('I 权限词汇越界(自造 decision 值)⇒ strict schema 400,零写入', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: LEDGER_PATH,
      payload: { ...GOOD_BODY, permissionDecision: 'always_allow' },
      headers: GOOD_HEADERS,
    })
    expect(res.statusCode).toBe(400)
    expect(mockRecord).not.toHaveBeenCalled()
    await app.close()
  })
})

describe('组二 CSRF 豁免=凭据验真,不是路径白名单(真 CSRF 钩子)', () => {
  it('J 无凭据打本路由 ⇒ 403 CSRF(钩子先于路由,匿名写被拦)', async () => {
    const app = await buildApp(true)
    const res = await app.inject({ method: 'POST', url: LEDGER_PATH, payload: GOOD_BODY })
    expect(res.statusCode).toBe(403)
    expect(res.json().message).toContain('CSRF')
    expect(mockRecord).not.toHaveBeenCalled()
    await app.close()
  })

  it('K 同前缀兄弟诱饵路径无凭据 ⇒ 仍 403(没人给前缀开过洞)', async () => {
    const app = await buildApp(true)
    const res = await app.inject({ method: 'POST', url: DECOY_PATH, payload: { x: 1 } })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('L 伪造内部密钥(头名在场)⇒ 仍 403(旧 presence-only 写法在这一臂是放行)', async () => {
    const app = await buildApp(true)
    const res = await app.inject({
      method: 'POST',
      url: LEDGER_PATH,
      payload: GOOD_BODY,
      headers: { 'x-internal-service-token': 'attacker-guess', 'x-user-id': USER_UUID },
    })
    expect(res.statusCode).toBe(403)
    expect(mockRecord).not.toHaveBeenCalled()
    await app.close()
  })

  it('M 真密钥 ⇒ 豁免只免 CSRF,抵达路由并 200(路由侧鉴权照常跑)', async () => {
    mockRecord.mockResolvedValue({ status: 'recorded', ledgerId: 'l-2' })
    const app = await buildApp(true)
    const res = await app.inject({
      method: 'POST',
      url: LEDGER_PATH,
      payload: GOOD_BODY,
      headers: GOOD_HEADERS,
    })
    expect(res.statusCode).toBe(200)
    expect(mockRecord).toHaveBeenCalledTimes(1)
    await app.close()
  })
})

describe('组三 接线锁(源码面;行为断言拦不住的"换写法"由这一组拦)', () => {
  const src = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

  it('路由真实挂载在 routes/index.ts(挨着 D154/O64 内部路由组)', () => {
    expect(src('src/routes/index.ts')).toContain(
      'server.register(internalToolInvocationLedgerRoutes)',
    )
  })

  it('preHandler 钉内部验票出口 + scope=api-tools;sqliGuard 关闭在位', () => {
    const route = src('src/routes/internal-tool-invocation-ledger.ts')
    expect(route).toContain("checkInternalServiceToken(request, reply, { scope: 'api-tools' })")
    expect(route).toContain('sqliGuard: { enabled: false }')
  })

  it('裁决锁:csrf/tenant 两清单不得出现 tool-ledger 路径(豁免是凭据验真型,不是路径白名单)', () => {
    expect(src('src/plugins/csrf.ts')).not.toContain('tool-ledger')
    expect(src('src/plugins/tenant.ts')).not.toContain('tool-ledger')
  })

  it('内网限定由 server.ts 的 /api/internal/ 族前缀自动注入(无需逐路径登记)', () => {
    expect(src('src/server.ts')).toContain("'/api/internal/'")
  })
})
