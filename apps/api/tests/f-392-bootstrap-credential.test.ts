// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-392 回归锁(2026-11-13)。
 *
 * 病灶:bootstrap 生成接入配置时只写入公开 key,而 requireApiKeyAuth 默认要求
 * key + secret 双因子(API_KEY_REQUIRE_SECRET=true)⇒ 引导产出的配置必然 401。
 *
 * 本文件锁:
 *   ① 显式 `?rotateSecret=1` 时 bootstrap 一次性返回 secret,配置写入 `<key>.<secret>`
 *     组合凭据(单 Key 输入框即可携带双因子),响应含「仅显示一次」提示;
 *   ② 落库只写 sha256 哈希,明文 secret 不入库;
 *   ③ 用 bootstrap 产出的凭据(组合形态 / X-Api-Key + X-Api-Secret)能通过
 *      authenticateApiKey 校验(闭环);
 *   ④ 应用日志不含明文 secret;
 *   ⑤ 默认(不带 rotateSecret)不轮换、不下发明文,并返回放置指引。
 *
 * 只 mock db / auth / step-up / logger,不触达真实 PG、Redis。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: vi.fn(async (request: { headers: Record<string, unknown>; userId?: string }) => {
    if (!request.headers.authorization) {
      const err = new Error('Authentication required') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    request.userId = 'f392-user'
  }),
  requireActiveUser: vi.fn(),
}))

vi.mock('../src/services/two-factor-step-up-store.js', () => ({
  requireStepUpForTwoFactorUser: vi.fn(async () => ({ ok: true, enforced: false })),
}))

vi.mock('../src/config/index.js', () => ({
  config: { API_KEY_REQUIRE_SECRET: true, API_KEY_RATE_LIMIT_FAIL_MODE: 'close' },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const h = vi.hoisted(() => {
  type KeyRow = {
    id: string
    userId: string
    key: string
    secret: string
    status: string
    permissions: string[]
    rateLimit: number
    expiresAt: Date | null
    allowedIps: string[] | null
    allowedModels: string[] | null
    maxTokensPerReq: number | null
    blockedIps: string[] | null
    rateLimit5h: number | null
    rateLimit1d: number | null
    rateLimit7d: number | null
    perModelRpmLimit: Record<string, number> | null
    perModelTpmLimit: Record<string, number> | null
    lastUsedAt: Date | null
  }
  type UserRow = { id: string; status: number }

  const keyRow: KeyRow = {
    id: '11111111-1111-4111-8111-111111111111',
    userId: 'f392-user',
    key: 'ihui_0123456789abcdef01234567',
    secret: 'sha256:' + 'a'.repeat(64),
    status: 'active',
    permissions: ['chat:write'],
    rateLimit: 60,
    expiresAt: null,
    allowedIps: null,
    allowedModels: null,
    maxTokensPerReq: null,
    blockedIps: null,
    rateLimit5h: null,
    rateLimit1d: null,
    rateLimit7d: null,
    perModelRpmLimit: null,
    perModelTpmLimit: null,
    lastUsedAt: null,
  }

  return {
    keyId: keyRow.id,
    baseSecret: keyRow.secret,
    keyValue: keyRow.key,
    state: {
      keys: [keyRow] as KeyRow[],
      users: [{ id: 'f392-user', status: 1 }] as UserRow[],
      updateSets: [] as Record<string, unknown>[],
    },
  }
})

vi.mock('../src/db/index.js', async () => {
  const { getTableName } = await import('drizzle-orm')
  const { PgDialect } = await import('drizzle-orm/pg-core')
  const dialect = new PgDialect()
  const tableOf = (t: unknown) => getTableName(t as Parameters<typeof getTableName>[0])
  const paramsOf = (where: unknown): unknown[] =>
    dialect.sqlToQuery(where as Parameters<typeof dialect.sqlToQuery>[0]).params as unknown[]

  const rowsFor = (shape: string[], table: string, where: unknown): unknown[] => {
    const params = where ? paramsOf(where) : []
    const s = h.state
    // 鉴权联表查询:{ key, userStatus }
    if (shape.includes('userStatus')) {
      const row = s.keys.find((k) => k.key === params[0])
      if (!row) return []
      const user = s.users.find((u) => u.id === row.userId)
      if (!user) return []
      return [{ key: { ...row }, userStatus: user.status }]
    }
    // bootstrap 归属读:{ id, userId, key }
    if (table === 'developer_api_keys') {
      const row = s.keys.find((k) => k.id === params[0])
      return row ? [{ id: row.id, userId: row.userId, key: row.key }] : []
    }
    return []
  }

  const select = (fields: Record<string, unknown>) => {
    const shape = Object.keys(fields)
    let table = ''
    let where: unknown
    const builder = {
      from(t: unknown) {
        table = tableOf(t)
        return builder
      },
      innerJoin() {
        return builder
      },
      where(w: unknown) {
        where = w
        return builder
      },
      limit() {
        return builder
      },
      // thenable:支持 await 直接取行,也支持 .limit(1)
      then(resolve: (v: unknown[]) => unknown, reject?: (e: unknown) => unknown) {
        return Promise.resolve(rowsFor(shape, table, where)).then(resolve, reject)
      },
    }
    return builder
  }

  const update = (t: unknown) => {
    const table = tableOf(t)
    return {
      set(values: Record<string, unknown>) {
        return {
          where(where: unknown) {
            const params = paramsOf(where)
            let touched: string[] = []
            if (table === 'developer_api_keys') {
              const row = h.state.keys.find(
                (k) => k.id === params[0] && (params[1] === undefined || k.userId === params[1]),
              )
              if (row) {
                h.state.updateSets.push(values)
                Object.assign(row, values)
                touched = [row.id]
              }
            }
            return {
              returning: async () => touched.map((id) => ({ id })),
              // lastUsedAt 异步更新是 fire-and-forget(`void ... .catch()`)
              then(resolve: (v: unknown[]) => unknown) {
                return Promise.resolve([]).then(resolve)
              },
              catch: () => Promise.resolve([]),
            }
          },
        }
      },
    }
  }

  const db = { select, update }
  return { db, dbRead: { select }, dbClient: {} }
})

import developerRelayBootstrapRoutes from '../src/routes/developer-relay-bootstrap.js'
import { authenticateApiKey } from '../src/plugins/api-key-auth.js'
import { hashSecret } from '../src/utils/api-key-hash.js'

const BOOTSTRAP_URL = `/api/developer/relay/keys/${h.keyId}/bootstrap`

function fakeApiRequest(headers: Record<string, string>): FastifyRequest {
  return {
    headers,
    body: {},
    url: '/v1/chat/completions',
    ip: '127.0.0.1',
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
  } as unknown as FastifyRequest
}

describe('F-392 bootstrap 配置必须可直接通过双因子鉴权', () => {
  let app: FastifyInstance
  const logLines: string[] = []

  beforeAll(async () => {
    app = Fastify({
      logger: {
        level: 'info',
        stream: { write: (line: string) => void logLines.push(line) },
      },
    })
    await app.register(developerRelayBootstrapRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    const row = h.state.keys[0]!
    row.secret = h.baseSecret
    row.lastUsedAt = null
    h.state.updateSets.length = 0
    logLines.length = 0
  })

  const bootstrap = (query: string) =>
    app.inject({
      method: 'GET',
      url: `${BOOTSTRAP_URL}?client=codex${query}`,
      headers: { authorization: 'Bearer f392-jwt' },
    })

  it('rotateSecret=1:一次性返回 secret,配置写入 key+secret 组合凭据', async () => {
    const res = await bootstrap('&rotateSecret=1')
    expect(res.statusCode).toBe(200)
    const data = res.json().data as {
      secret?: string
      credential?: string
      secretRotated?: boolean
      secretNotice?: string
      config: Array<{ content: string }>
    }

    expect(data.secretRotated).toBe(true)
    expect(data.secret).toMatch(/^sk_[0-9a-f]{32}$/)
    expect(data.secretNotice).toContain('仅显示一次')
    expect(data.credential).toBe(`${h.keyValue}.${data.secret}`)
    // 配置块实际引用了组合凭据(而非只有公开 key)
    expect(data.config.length).toBeGreaterThan(0)
    for (const block of data.config) {
      expect(block.content).toContain(data.credential!)
    }
  })

  it('落库只存 hash:明文 secret 不写入库', async () => {
    const res = await bootstrap('&rotateSecret=true')
    const data = res.json().data as { secret: string }
    const set = h.state.updateSets.find((v) => typeof v.secret === 'string')
    expect(set).toBeDefined()
    expect(set!.secret).toBe(hashSecret(data.secret))
    expect(set!.secret).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(JSON.stringify(set)).not.toContain(data.secret)
    expect(h.state.keys[0]!.secret).toBe(hashSecret(data.secret))
  })

  it('用 bootstrap 产出的凭据可通过 authenticateApiKey 校验(闭环)', async () => {
    const res = await bootstrap('&rotateSecret=1')
    const data = res.json().data as { secret: string; credential: string }

    // 形态一:单凭据组合 `<key>.<secret>` 走 Bearer(单 Key 输入框场景)
    const ctx1 = await authenticateApiKey(
      fakeApiRequest({ authorization: `Bearer ${data.credential}` }),
    )
    expect(ctx1.id).toBe(h.keyId)
    expect(ctx1.key).toBe(h.keyValue)

    // 形态二:原双因子口径 X-Api-Key + X-Api-Secret
    const ctx2 = await authenticateApiKey(
      fakeApiRequest({ 'x-api-key': h.keyValue, 'x-api-secret': data.secret }),
    )
    expect(ctx2.id).toBe(h.keyId)
  })

  it('日志不含明文 secret', async () => {
    const res = await bootstrap('&rotateSecret=1')
    const data = res.json().data as { secret: string }
    expect(logLines.join('\n')).not.toContain(data.secret)
  })

  it('默认不轮换、不下发明文 secret,并返回轮换指引', async () => {
    const res = await bootstrap('')
    expect(res.statusCode).toBe(200)
    const data = res.json().data as {
      secret?: string
      credential?: string
      secretNotice?: string
      config: Array<{ content: string }>
    }
    expect(data.secret).toBeUndefined()
    expect(data.credential).toBeUndefined()
    expect(data.secretNotice).toContain('rotateSecret')
    // 未轮换时只给公开 key,不伪造 secret
    for (const block of data.config) {
      expect(block.content).not.toContain('sk_')
    }
    expect(h.state.keys[0]!.secret).toBe(h.baseSecret)
    expect(h.state.updateSets.length).toBe(0)
  })
})
