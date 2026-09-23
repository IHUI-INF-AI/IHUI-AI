// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O2(2026-09-21)API Key 配额强制与凭据形态收紧测试。
 *
 * 覆盖 7 项交付判据:
 * 1. rateLimit5h / 1d / 7d 打满 → 429 + Retry-After + X-RateLimit-*(code 1010)
 * 2. blockedIps 命中 → 403,且优先于 allowedIps
 * 3. 缺 X-Api-Secret → 401 SECRET_REQUIRED(API_KEY_REQUIRE_SECRET 默认 true)
 * 4. Redis / 计数读源不可用 + fail-close → billable/高危 503 RATE_BACKEND_UNAVAILABLE,
 *    低危只读放行(判据来自能力目录 risk/billable,不硬编码路由名);FAIL_MODE=open 维持历史放行
 * 5. `'*'` 通配不放行 platform 域 / thirdPartyEligible=false 的 scope
 * 6. IPv6 + IPv4-mapped 归一(命中与不命中)
 * 7. share_ token 的 scope 收窄(不继承源 Key 的 `'*'` 与 platform scope)
 *
 * 全部 mock DB / Redis / config,不连生产 PostgreSQL(8810)/ Redis(8811)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { AuthenticatedApiKey, ApiKeyPermission } from '@ihui/types'

/** developer_api_keys 行的测试替身(字段与 schema 对齐)。 */
interface FakeKeyRow {
  id: string
  userId: string
  name: string
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
}

/** 分享 token 记录的测试替身(getShareByToken 返回值 + sourceKey)。 */
interface FakeShareRow {
  id: string
  sourceApiKeyId: string
  revokedAt: Date | null
  expiresAt: Date
  scopeModels: string[] | null
  scopeEndpoints: string[] | null
  rateLimitRpm: number | null
  rateLimitTpm: number | null
  sourceKey: FakeKeyRow
}

/** 窗口类型 → developer_api_keys 限额列名。 */
const WINDOW_COLUMN = { '5h': 'rateLimit5h', '1d': 'rateLimit1d', '7d': 'rateLimit7d' } as const

// ----------------------------------------------------------------------------
// 可变夹具(vi.hoisted:mock 工厂提升后仍可引用)
// ----------------------------------------------------------------------------
const fixture = vi.hoisted(() => ({
  state: {
    keyRow: null as unknown as FakeKeyRow | null,
    /** checkKeyRateWindows 的计数读源结果 */
    windowRows: [] as Array<{ windowType: string; windowStart: Date; requestCount: number }>,
    /** true → 计数读源抛异常(模拟 DB 副本故障) */
    windowReadThrows: false,
    /** true → Redis eval 抛异常(模拟 Redis 故障) */
    redisThrows: false,
    /** Redis eval 返回值:[allowed(0|1), retryAfter] */
    redisEvalResult: [1, 0] as [number, number],
    tpmAllowed: true,
    /** true → checkTpmQuota 抛异常(模拟 TPM 后端故障) */
    tpmThrows: false,
    share: null as FakeShareRow | null,
    config: {
      REDIS_URL: 'redis://127.0.0.1:1/0',
      API_KEY_RATE_LIMIT_FAIL_MODE: 'close' as 'close' | 'open',
      API_KEY_REQUIRE_SECRET: true,
    },
  },
}))

function fakeKeyRow(over: Partial<FakeKeyRow> = {}): FakeKeyRow {
  return {
    id: 'key-1',
    userId: 'user-1',
    name: '测试密钥',
    key: 'ihui_test_key',
    secret: 'hashed-secret',
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
    ...over,
  }
}

/** 只设某一条窗口限额的 Key(其余两列保持 NULL = 不限)。 */
function keyRowWithWindow(windowType: keyof typeof WINDOW_COLUMN, limit: number): FakeKeyRow {
  const limits: Partial<FakeKeyRow> = {}
  limits[WINDOW_COLUMN[windowType]] = limit
  return fakeKeyRow(limits)
}

function fakeShareRow(sourceKey: FakeKeyRow, over: Partial<FakeShareRow> = {}): FakeShareRow {
  return {
    id: 'share-1',
    sourceApiKeyId: 'src-key-1',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 3_600_000),
    scopeModels: null,
    scopeEndpoints: null,
    rateLimitRpm: 60,
    rateLimitTpm: 100_000,
    sourceKey,
    ...over,
  }
}

// ----------------------------------------------------------------------------
// 模块 mock(必须早于被测模块 import)
// ----------------------------------------------------------------------------
vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => (fixture.state.keyRow ? [fixture.state.keyRow] : [])),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ catch: vi.fn() })) })),
    })),
  },
  dbRead: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => {
          if (fixture.state.windowReadThrows) throw new Error('read replica down')
          return fixture.state.windowRows
        }),
      })),
    })),
  },
}))

vi.mock('@ihui/database', () => ({
  developerApiKeys: { id: 'id', key: 'key', userId: 'user_id' },
  keyRateWindowCounts: {
    keyId: 'key_id',
    windowType: 'window_type',
    windowStart: 'window_start',
    requestCount: 'request_count',
  },
}))

// ioredis:默认 eval 放行;fixture.state.redisThrows=true 时模拟 Redis 完全不可用。
vi.mock('ioredis', () => {
  class FakeRedis {
    async eval(): Promise<[number, number]> {
      if (fixture.state.redisThrows) throw new Error('READONLY: Redis is down')
      return fixture.state.redisEvalResult
    }
    on(): void {
      /* noop:错误事件由被测模块自行静默 */
    }
  }
  return { default: FakeRedis }
})

vi.mock('../src/config/index.js', () => ({ config: fixture.state.config }))

vi.mock('../src/utils/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('../src/utils/api-key-hash.js', () => ({
  verifySecret: vi.fn(() => true),
  generateApiKey: vi.fn(() => ({ key: 'ihui_test', secret: 'sk_test' })),
  hashSecret: vi.fn(() => 'hashed'),
}))

vi.mock('../src/utils/api-key-quota.js', () => ({
  ApiKeyQuota: vi.fn(() => ({
    checkAndConsume: vi.fn(async () => ({ allowed: true, resetAt: new Date() })),
  })),
}))

vi.mock('../src/services/api-key-tpm-service.js', () => ({
  checkTpmQuota: vi.fn(async () => {
    if (fixture.state.tpmThrows) throw new Error('TPM_BACKEND_DOWN')
    return fixture.state.tpmAllowed
      ? { allowed: true, remaining: 1000, resetAt: new Date() }
      : { allowed: false, remaining: 0, resetAt: new Date(Date.now() + 60_000) }
  }),
  recordTpmUsage: vi.fn(async () => {}),
}))

vi.mock('../src/services/api-key-share-service.js', () => ({
  getShareByToken: vi.fn(async () => fixture.state.share),
}))

// ----------------------------------------------------------------------------
// 被测模块
// ----------------------------------------------------------------------------
import {
  authenticateApiKey,
  checkPerModelRateLimit,
  ipInList,
  isScopeThirdPartyEligible,
  narrowSharePermissions,
  requireApiKeyAuth,
  requireApiKeyPermission,
} from '../src/plugins/api-key-auth.js'
import { getKeyWindowStart } from '../src/services/key-rate-window-service.js'
import { verifySecret } from '../src/utils/api-key-hash.js'
import { getShareByToken } from '../src/services/api-key-share-service.js'

// ----------------------------------------------------------------------------
// Fastify request / reply 测试替身
// ----------------------------------------------------------------------------
function makeRequest(
  over: {
    /** Bearer token;缺省用夹具主 Key,null = 完全不带头 */
    key?: string | null
    /** X-Api-Secret;缺省随主 Key 一起带上,null = 不带 */
    secret?: string | null
    ip?: string
    url?: string
    method?: string
    body?: Record<string, unknown>
  } = {},
): FastifyRequest {
  const headers: Record<string, string> = {}
  const key = over.key === undefined ? 'ihui_test_key' : over.key
  const secret = over.secret === undefined ? 'sk_test' : over.secret
  if (key) headers.authorization = `Bearer ${key}`
  if (secret) headers['x-api-secret'] = secret
  return {
    headers,
    ip: over.ip ?? '203.0.113.10',
    method: over.method ?? 'POST',
    url: over.url ?? '/v1/chat/completions',
    body: over.body ?? {},
    apiKey: undefined,
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    server: {},
  } as unknown as FastifyRequest
}

/** 鉴权 + 配额全通过时注入的 request.apiKey 替身。 */
function apiKeyCtx(permissions: ApiKeyPermission[]): AuthenticatedApiKey {
  return {
    id: 'key-1',
    userId: 'user-1',
    key: 'ihui_test_key',
    permissions,
    rateLimit: 60,
    expiresAt: null,
    allowedIps: null,
    allowedModels: null,
    maxTokensPerReq: null,
    blockedIps: null,
    rateLimit5h: null,
    rateLimit1d: null,
    rateLimit7d: null,
  }
}

interface CapturedReply {
  reply: FastifyReply
  status: number | undefined
  headers: Record<string, string>
  payload: Record<string, unknown> | undefined
}

function makeReply(): CapturedReply {
  const captured: CapturedReply = {
    reply: undefined as unknown as FastifyReply,
    status: undefined,
    headers: {},
    payload: undefined,
  }
  const api = {
    status(code: number) {
      captured.status = code
      return api
    },
    header(k: string, v: string) {
      captured.headers[k] = v
      return api
    },
    send(payload: unknown) {
      captured.payload = payload as Record<string, unknown>
      return api
    },
    statusCode: 200,
    raw: { on: () => api },
  }
  captured.reply = api as unknown as FastifyReply
  return captured
}

/** 断言 authenticateApiKey 抛出鉴权异常并返回之。 */
async function expectAuthError(request: FastifyRequest): Promise<{
  statusCode: number
  message: string
  errorCode?: string
}> {
  try {
    await authenticateApiKey(request)
  } catch (e) {
    return e as { statusCode: number; message: string; errorCode?: string }
  }
  throw new Error('预期鉴权失败,但实际通过了')
}

beforeEach(() => {
  fixture.state.keyRow = fakeKeyRow()
  fixture.state.windowRows = []
  fixture.state.windowReadThrows = false
  fixture.state.redisThrows = false
  fixture.state.redisEvalResult = [1, 0]
  fixture.state.tpmAllowed = true
  fixture.state.tpmThrows = false
  fixture.state.share = null
  fixture.state.config.API_KEY_RATE_LIMIT_FAIL_MODE = 'close'
  fixture.state.config.API_KEY_REQUIRE_SECRET = true
  vi.mocked(verifySecret).mockReset().mockReturnValue(true)
  vi.mocked(getShareByToken).mockImplementation(async () => fixture.state.share)
})

// ============================================================================
// 1. 5h / 1d / 7d 窗口接入 requireApiKeyAuth 主链路
// ============================================================================
describe('O2-1 Key 级 5h/1d/7d 窗口接入 requireApiKeyAuth 主链路', () => {
  const windowTypes = ['5h', '1d', '7d'] as const

  it.each(windowTypes)('%s 窗口打满 → 429 + Retry-After + X-RateLimit-*(code 1010)', async (w) => {
    fixture.state.keyRow = keyRowWithWindow(w, 100)
    fixture.state.windowRows = [
      { windowType: w, windowStart: getKeyWindowStart(w), requestCount: 100 },
    ]

    const res = makeReply()
    await requireApiKeyAuth(makeRequest(), res.reply, vi.fn())

    expect(res.status).toBe(429)
    expect(Number(res.headers['Retry-After'])).toBeGreaterThan(0)
    expect(res.headers['X-RateLimit-Limit']).toBe('100')
    expect(res.headers['X-RateLimit-Remaining']).toBe('0')
    expect(res.headers['X-RateLimit-Window']).toBe(w)
    expect(res.payload?.code).toBe(1010)
    expect(String(res.payload?.message)).toContain(w)
  })

  it.each(windowTypes)('%s 窗口未打满 → 放行且不写响应', async (w) => {
    fixture.state.keyRow = keyRowWithWindow(w, 100)
    fixture.state.windowRows = [
      { windowType: w, windowStart: getKeyWindowStart(w), requestCount: 99 },
    ]

    const res = makeReply()
    const request = makeRequest()
    await requireApiKeyAuth(request, res.reply, vi.fn())

    expect(res.status).toBeUndefined()
    expect(request.apiKey?.id).toBe('key-1')
  })

  it('三个窗口同时配置时,先命中的窗口决定 429', async () => {
    fixture.state.keyRow = fakeKeyRow({ rateLimit5h: 100, rateLimit1d: 100, rateLimit7d: 5 })
    fixture.state.windowRows = [
      { windowType: '5h', windowStart: getKeyWindowStart('5h'), requestCount: 10 },
      { windowType: '1d', windowStart: getKeyWindowStart('1d'), requestCount: 20 },
      { windowType: '7d', windowStart: getKeyWindowStart('7d'), requestCount: 5 },
    ]
    const res = makeReply()
    await requireApiKeyAuth(makeRequest(), res.reply, vi.fn())
    expect(res.status).toBe(429)
    expect(res.headers['X-RateLimit-Window']).toBe('7d')
    expect(res.headers['X-RateLimit-Limit']).toBe('5')
  })

  it('三列全 NULL 的存量 Key:零窗口查询,行为完全不变', async () => {
    fixture.state.windowReadThrows = true // 一旦被查询即抛 → 反证根本没发起查询
    const res = makeReply()
    await requireApiKeyAuth(makeRequest(), res.reply, vi.fn())
    expect(res.status).toBeUndefined()
  })

  it('TPM 超限仍走 429(code 1008)', async () => {
    fixture.state.tpmAllowed = false
    const res = makeReply()
    await requireApiKeyAuth(makeRequest(), res.reply, vi.fn())
    expect(res.status).toBe(429)
    expect(res.payload?.code).toBe(1008)
    expect(Number(res.headers['Retry-After'])).toBeGreaterThan(0)
  })
})

// ============================================================================
// 2. blockedIps → 403(优先于 allowedIps)
// ============================================================================
describe('O2-2 blockedIps 命中 403 且优先于白名单', () => {
  it('黑名单精确命中 → 403', async () => {
    fixture.state.keyRow = fakeKeyRow({ blockedIps: ['203.0.113.10'] })
    const err = await expectAuthError(makeRequest())
    expect(err.statusCode).toBe(403)
    expect(err.message).toBe('IP 在黑名单')
  })

  it('黑名单 CIDR 命中 → 403,即使白名单同时命中', async () => {
    fixture.state.keyRow = fakeKeyRow({
      blockedIps: ['203.0.113.0/24'],
      allowedIps: ['203.0.113.0/24'],
    })
    const err = await expectAuthError(makeRequest({ ip: '203.0.113.66' }))
    expect(err.statusCode).toBe(403)
    expect(err.message).toBe('IP 在黑名单')
  })

  it('黑名单未命中 + 白名单命中 → 放行,且 blockedIps 注入 ctx', async () => {
    fixture.state.keyRow = fakeKeyRow({
      blockedIps: ['198.51.100.0/24'],
      allowedIps: ['203.0.113.0/24'],
    })
    const ctx = await authenticateApiKey(makeRequest({ ip: '203.0.113.7' }))
    expect(ctx.blockedIps).toEqual(['198.51.100.0/24'])
  })

  it('白名单未命中 → 403 IP 不在白名单', async () => {
    fixture.state.keyRow = fakeKeyRow({ allowedIps: ['198.51.100.0/24'] })
    const err = await expectAuthError(makeRequest())
    expect(err.statusCode).toBe(403)
    expect(err.message).toBe('IP 不在白名单')
  })

  it('窗口限额注入 ctx(供主链路强制使用)', async () => {
    fixture.state.keyRow = fakeKeyRow({ rateLimit5h: 10, rateLimit1d: 50, rateLimit7d: 200 })
    const ctx = await authenticateApiKey(makeRequest())
    expect([ctx.rateLimit5h, ctx.rateLimit1d, ctx.rateLimit7d]).toEqual([10, 50, 200])
  })
})

// ============================================================================
// 3. X-Api-Secret 默认必须
// ============================================================================
describe('O2-3 X-Api-Secret 凭据形态收紧(API_KEY_REQUIRE_SECRET 默认 true)', () => {
  it('缺失 X-Api-Secret → 401 SECRET_REQUIRED', async () => {
    const err = await expectAuthError(makeRequest({ secret: null }))
    expect(err.statusCode).toBe(401)
    expect(err.errorCode).toBe('SECRET_REQUIRED')
  })

  it('preHandler 渲染 401 + errorCode=SECRET_REQUIRED', async () => {
    const res = makeReply()
    await requireApiKeyAuth(makeRequest({ secret: null }), res.reply, vi.fn())
    expect(res.status).toBe(401)
    expect(res.payload?.errorCode).toBe('SECRET_REQUIRED')
  })

  it('携带 secret → 通过并调用 verifySecret', async () => {
    const ctx = await authenticateApiKey(makeRequest({ secret: 'sk_test' }))
    expect(ctx.id).toBe('key-1')
    expect(verifySecret).toHaveBeenCalledWith('sk_test', 'hashed-secret')
  })

  it('API_KEY_REQUIRE_SECRET=false → 回退历史"不带即跳过"', async () => {
    fixture.state.config.API_KEY_REQUIRE_SECRET = false
    const ctx = await authenticateApiKey(makeRequest({ secret: null }))
    expect(ctx.id).toBe('key-1')
    expect(verifySecret).not.toHaveBeenCalled()
  })

  it('带 secret 但校验不通过 → 401', async () => {
    vi.mocked(verifySecret).mockReturnValueOnce(false)
    const err = await expectAuthError(makeRequest({ secret: 'sk_wrong' }))
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Invalid API key secret')
  })
})

// ============================================================================
// 4. fail-open → 可配置(API_KEY_RATE_LIMIT_FAIL_MODE)
// ============================================================================
describe('O2-4 限流后端不可用的降级形态(默认 close)', () => {
  /** per-model RPM 已配置 + Redis 不可用。 */
  function breakRedis(): void {
    fixture.state.keyRow = fakeKeyRow({ perModelRpmLimit: { 'gpt-4o': 1 } })
    fixture.state.redisThrows = true
  }

  it('Redis 挂 + close + billable(chat:write / POST /v1/chat/completions)→ 503', async () => {
    breakRedis()
    const err = await expectAuthError(makeRequest({ body: { model: 'gpt-4o' } }))
    expect(err.statusCode).toBe(503)
    expect(err.errorCode).toBe('RATE_BACKEND_UNAVAILABLE')
  })

  it('Redis 挂 + close + 低危只读(GET /v1/models → risk=low)→ 放行', async () => {
    breakRedis()
    const ctx = await authenticateApiKey(
      makeRequest({ method: 'GET', url: '/v1/models', body: { model: 'gpt-4o' } }),
    )
    expect(ctx.id).toBe('key-1')
  })

  it('Redis 挂 + open → 维持历史放行', async () => {
    fixture.state.config.API_KEY_RATE_LIMIT_FAIL_MODE = 'open'
    breakRedis()
    const ctx = await authenticateApiKey(makeRequest({ body: { model: 'gpt-4o' } }))
    expect(ctx.id).toBe('key-1')
  })

  it('目录未登记且非 /v1 的路径 → 按低危放行(不硬编码路由名)', async () => {
    breakRedis()
    const ctx = await authenticateApiKey(
      makeRequest({ url: '/api/not-in-catalog', body: { model: 'gpt-4o' } }),
    )
    expect(ctx.id).toBe('key-1')
  })

  it('checkPerModelRateLimit:Redis 异常 → allowed 但标记 backendUnavailable', async () => {
    fixture.state.redisThrows = true
    const result = await checkPerModelRateLimit('key-1', 'gpt-4o', 100, 1, null)
    expect(result.allowed).toBe(true)
    expect(result.backendUnavailable).toBe(true)
  })

  it('checkPerModelRateLimit:Redis 正常且未超限 → 不标记', async () => {
    const result = await checkPerModelRateLimit('key-1', 'gpt-4o', 100, 60, null)
    expect(result).toEqual({ allowed: true })
  })

  it('窗口计数读源故障 + close + billable → 503', async () => {
    fixture.state.keyRow = fakeKeyRow({ rateLimit1d: 100 })
    fixture.state.windowReadThrows = true
    const res = makeReply()
    await requireApiKeyAuth(makeRequest(), res.reply, vi.fn())
    expect(res.status).toBe(503)
    expect(res.payload?.errorCode).toBe('RATE_BACKEND_UNAVAILABLE')
    expect(Number(res.headers['Retry-After'])).toBeGreaterThan(0)
  })

  it('窗口计数读源故障 + close + 低危只读 → 放行', async () => {
    fixture.state.keyRow = fakeKeyRow({ rateLimit1d: 100 })
    fixture.state.windowReadThrows = true
    const res = makeReply()
    await requireApiKeyAuth(makeRequest({ method: 'GET', url: '/v1/models' }), res.reply, vi.fn())
    expect(res.status).toBeUndefined()
  })

  it('TPM 后端故障 + close + billable → 503', async () => {
    fixture.state.tpmThrows = true
    const res = makeReply()
    await requireApiKeyAuth(makeRequest(), res.reply, vi.fn())
    expect(res.status).toBe(503)
    expect(res.payload?.errorCode).toBe('RATE_BACKEND_UNAVAILABLE')
  })

  it('TPM 后端故障 + open → 放行', async () => {
    fixture.state.config.API_KEY_RATE_LIMIT_FAIL_MODE = 'open'
    fixture.state.tpmThrows = true
    const res = makeReply()
    await requireApiKeyAuth(makeRequest(), res.reply, vi.fn())
    expect(res.status).toBeUndefined()
  })

  it('未配置任何限额的 Key:Redis 挂也无需探针 → 正常放行(close 不误伤)', async () => {
    fixture.state.redisThrows = true
    const res = makeReply()
    await requireApiKeyAuth(makeRequest({ body: { model: 'gpt-4o' } }), res.reply, vi.fn())
    expect(res.status).toBeUndefined()
  })
})

// ============================================================================
// 4b. per-model 限流列落地(死分支删除后 Lua 窗口真正生效)
// ============================================================================
describe('O2-4b per-model RPM/TPM 限流生效(migration 20260921100000)', () => {
  it('perModelRpmLimit 命中 + Redis 判超限 → 429 code 1007', async () => {
    fixture.state.keyRow = fakeKeyRow({ perModelRpmLimit: { 'gpt-4o': 60 } })
    fixture.state.redisEvalResult = [0, 12]
    const err = await expectAuthError(makeRequest({ body: { model: 'gpt-4o' } }))
    expect(err.statusCode).toBe(429)
    expect(String(err.message)).toContain('RPM')
  })

  it('perModelTpmLimit 命中 + Redis 判超限 → 429 code 1008', async () => {
    fixture.state.keyRow = fakeKeyRow({ perModelTpmLimit: { 'gpt-4o': 100_000 } })
    fixture.state.redisEvalResult = [0, 30]
    const err = await expectAuthError(makeRequest({ body: { model: 'gpt-4o' } }))
    expect(err.statusCode).toBe(429)
    expect(String(err.message)).toContain('TPM')
  })

  it('映射里没有该模型 → 跳过限流(逐模型粒度)', async () => {
    fixture.state.keyRow = fakeKeyRow({ perModelRpmLimit: { 'gpt-4o': 60 } })
    fixture.state.redisEvalResult = [0, 12]
    const ctx = await authenticateApiKey(makeRequest({ body: { model: 'claude-sonnet' } }))
    expect(ctx.id).toBe('key-1')
  })

  it('schema 列已落地:行对象上的 perModel* 映射可直读(不再 as 断言)', async () => {
    fixture.state.keyRow = fakeKeyRow({
      perModelRpmLimit: { 'gpt-4o': 60 },
      perModelTpmLimit: null,
    })
    const ctx = await authenticateApiKey(makeRequest({ body: { model: 'gpt-4o' } }))
    expect(fixture.state.keyRow.perModelRpmLimit).toEqual({ 'gpt-4o': 60 })
    expect(ctx.id).toBe('key-1')
  })
})

// ============================================================================
// 5. `'*'` 通配语义收窄
// ============================================================================
describe('O2-5 `*` 通配只覆盖已登记且 thirdPartyEligible 的 scope', () => {
  it('已登记 + 可申请 → 通配覆盖', () => {
    expect(isScopeThirdPartyEligible('chat:write')).toBe(true)
    expect(isScopeThirdPartyEligible('models:read')).toBe(true)
  })

  it('platform 域(dataClass=platform)→ 通配不放行', () => {
    expect(isScopeThirdPartyEligible('publish:operate')).toBe(false)
    expect(isScopeThirdPartyEligible('computer:operate')).toBe(false)
  })

  it('thirdPartyEligible=false 的高危 scope → 不放行', () => {
    expect(isScopeThirdPartyEligible('sandbox:run')).toBe(false)
    expect(isScopeThirdPartyEligible('im:send')).toBe(false)
  })

  it('未登记 scope → 不放行(目录漂移默认拒绝)', () => {
    expect(isScopeThirdPartyEligible('definitely:not-registered')).toBe(false)
  })

  it("preHandler:key 持 '*' 请求 platform scope → 403", async () => {
    const request = makeRequest()
    request.apiKey = apiKeyCtx(['*'] as ApiKeyPermission[])
    const res = makeReply()
    await requireApiKeyPermission('publish:operate' as ApiKeyPermission)(
      request,
      res.reply,
      vi.fn(),
    )
    expect(res.status).toBe(403)
    expect(String(res.payload?.message)).toContain('publish:operate')
  })

  it("preHandler:key 持 '*' 请求已登记可申请 scope → 放行", async () => {
    const request = makeRequest()
    request.apiKey = apiKeyCtx(['*'] as ApiKeyPermission[])
    const res = makeReply()
    await requireApiKeyPermission('chat:write')(request, res.reply, vi.fn())
    expect(res.status).toBeUndefined()
  })

  it('preHandler:显式持有 → 放行;缺失 → 403;无 apiKey → 401', async () => {
    const granted = makeRequest()
    granted.apiKey = apiKeyCtx(['chat:write'])
    const okRes = makeReply()
    await requireApiKeyPermission('chat:write')(granted, okRes.reply, vi.fn())
    expect(okRes.status).toBeUndefined()

    const denied = makeRequest()
    denied.apiKey = apiKeyCtx(['models:read'])
    const denyRes = makeReply()
    await requireApiKeyPermission('chat:write')(denied, denyRes.reply, vi.fn())
    expect(denyRes.status).toBe(403)

    const anon = makeRequest()
    const anonRes = makeReply()
    await requireApiKeyPermission('chat:write')(anon, anonRes.reply, vi.fn())
    expect(anonRes.status).toBe(401)
  })
})

// ============================================================================
// 6. IPv6 与 IPv4-mapped 归一
// ============================================================================
describe('O2-6 IPv6 / IPv4-mapped IP 匹配', () => {
  it('IPv6 精确命中与不命中', () => {
    expect(ipInList('2001:db8::1', ['2001:db8::1'])).toBe(true)
    expect(ipInList('2001:db8::2', ['2001:db8::1'])).toBe(false)
  })

  it('IPv6 CIDR /32 命中与不命中', () => {
    expect(ipInList('2001:db8:abcd::1', ['2001:db8::/32'])).toBe(true)
    expect(ipInList('2001:db9::1', ['2001:db8::/32'])).toBe(false)
  })

  it('IPv6 CIDR /128 等价精确匹配', () => {
    expect(ipInList('2001:db8::1', ['2001:db8::1/128'])).toBe(true)
    expect(ipInList('2001:db8::2', ['2001:db8::1/128'])).toBe(false)
  })

  it('零压缩 + 大小写 + 十六进制分组写法等价', () => {
    expect(ipInList('::FFFF:0A00:0001', ['::ffff:10.0.0.1'])).toBe(true)
    expect(ipInList('2001:0DB8:0000:0000:0000:0000:0000:0001', ['2001:db8::1'])).toBe(true)
  })

  it('IPv4-mapped 归一:请求 ::ffff:10.0.0.5 命中 IPv4 条目与 CIDR', () => {
    expect(ipInList('::ffff:10.0.0.5', ['10.0.0.5'])).toBe(true)
    expect(ipInList('::ffff:10.0.0.5', ['10.0.0.0/24'])).toBe(true)
    expect(ipInList('::ffff:10.0.9.5', ['10.0.0.0/24'])).toBe(false)
  })

  it('IPv4-mapped 归一:条目与请求同为 ::ffff: 形态时按 IPv4 语义比较', () => {
    expect(ipInList('::ffff:10.0.0.5', ['::ffff:10.0.0.0/24'])).toBe(true)
    expect(ipInList('::ffff:10.0.200.5', ['::ffff:10.0.0.0/24'])).toBe(false)
  })

  it('CIDR 前缀按各自地址族计算(防"128-bit 空间退化恒真"白名单绕过)', () => {
    // IPv4 前缀只覆盖本族位:10.0.0.0/24 = 10.0.0.0-10.0.0.255
    expect(ipInList('10.0.1.1', ['10.0.0.0/24'])).toBe(false)
    expect(ipInList('192.168.5.5', ['10.0.0.0/8'])).toBe(false)
    // 越界前缀(IPv4 侧写 /64、/120)一律不匹配 —— fail-closed,不做隐式换算
    expect(ipInList('8.8.8.8', ['10.0.0.0/64'])).toBe(false)
    expect(ipInList('10.0.0.5', ['::ffff:10.0.0.0/120'])).toBe(false)
    // IPv6 原生前缀在 128-bit 空间内合法
    expect(ipInList('2001:db8:ff::1', ['2001:db8::/24'])).toBe(true)
    expect(ipInList('2002:db8::1', ['2001:db8::/24'])).toBe(false)
    // 族不同(IPv6 网段 vs 纯 IPv4 请求)不匹配
    expect(ipInList('8.8.8.8', ['2001:db8::/32'])).toBe(false)
  })

  it('IPv6 前缀匹配(尾冒号)', () => {
    expect(ipInList('2001:db8:1::5', ['2001:db8:'])).toBe(true)
    expect(ipInList('2001:db9:1::5', ['2001:db8:'])).toBe(false)
  })

  it('IPv4 语义不回退:非法前缀/非法地址一律不匹配(防白名单绕过)', () => {
    expect(ipInList('2001:db8::1', ['2001:db8::/999'])).toBe(false)
    expect(ipInList('2001:db8::1', ['2001:db8::/-1'])).toBe(false)
    expect(ipInList('2001:db8::1', ['2001:db8::/33/44'])).toBe(false)
    expect(ipInList('not-an-ip', ['10.0.0.0/8'])).toBe(false)
    expect(ipInList('10.0.0.1', ['10.0.0.999/32'])).toBe(false)
  })

  it('鉴权主链路:IPv6 请求命中 IPv6 黑名单 → 403', async () => {
    fixture.state.keyRow = fakeKeyRow({ blockedIps: ['2001:db8:dead::/48'] })
    const err = await expectAuthError(makeRequest({ ip: '2001:db8:dead:0:0:0:0:9' }))
    expect(err.statusCode).toBe(403)
    expect(err.message).toBe('IP 在黑名单')
  })

  it('鉴权主链路:IPv6 请求在 IPv6 白名单内 → 放行', async () => {
    fixture.state.keyRow = fakeKeyRow({ allowedIps: ['2001:db8:cafe::/48'] })
    const ctx = await authenticateApiKey(makeRequest({ ip: '2001:db8:cafe:1::7' }))
    expect(ctx.id).toBe('key-1')
  })

  it('鉴权主链路:IPv4-mapped 请求命中 IPv4 黑名单 → 403', async () => {
    fixture.state.keyRow = fakeKeyRow({ blockedIps: ['203.0.113.0/24'] })
    const err = await expectAuthError(makeRequest({ ip: '::ffff:203.0.113.9' }))
    expect(err.statusCode).toBe(403)
    expect(err.message).toBe('IP 在黑名单')
  })
})

// ============================================================================
// 7. share_ token scope 收窄
// ============================================================================
describe('O2-7 share token 不继承源 Key 的 * 与 platform scope', () => {
  it("源 Key '*' → 展开为全部 M2M scope,不含 '*' / platform / 不可申请项", () => {
    const narrowed = narrowSharePermissions(['*'])
    expect(narrowed.length).toBeGreaterThan(0)
    expect(narrowed).not.toContain('*')
    expect(narrowed).not.toContain('publish:operate')
    expect(narrowed).not.toContain('computer:operate')
    expect(narrowed).not.toContain('sandbox:run')
    expect(narrowed).toContain('chat:write')
    // 展开结果必须与"逐 scope 判定"一致(单一判据,无第二套规则)
    expect(narrowed.every((s) => isScopeThirdPartyEligible(s))).toBe(true)
  })

  it('源 Key 显式 scopes → 只保留 thirdPartyEligible 交集', () => {
    expect(narrowSharePermissions(['chat:write', 'publish:operate', 'sandbox:run'])).toEqual([
      'chat:write',
    ])
  })

  it('未登记 scope 被剔除;非数组入参安全返回空', () => {
    expect(narrowSharePermissions(['ghost:scope' as ApiKeyPermission])).toEqual([])
    expect(narrowSharePermissions(null as unknown as string[])).toEqual([])
  })

  it('share 鉴权链路:注入 permissions 已收窄,窗口限额不随 share 继承', async () => {
    fixture.state.share = fakeShareRow(
      fakeKeyRow({
        id: 'src-key-1',
        permissions: ['chat:write', 'publish:operate'],
        rateLimit1d: 500,
      }),
    )
    const ctx = await authenticateApiKey(makeRequest({ key: 'share_abc123' }))
    expect(ctx.permissions).toEqual(['chat:write'])
    expect(ctx.id).toBe('src-key-1')
    expect(ctx.rateLimit5h).toBeNull()
    expect(ctx.rateLimit1d).toBeNull()
    expect(ctx.rateLimit7d).toBeNull()
  })

  it('share 鉴权链路:源 Key ' * ' 展开后不含 platform scope', async () => {
    fixture.state.share = fakeShareRow(fakeKeyRow({ permissions: ['*'] }))
    const ctx = await authenticateApiKey(makeRequest({ key: 'share_wild' }))
    expect(ctx.permissions).not.toContain('*')
    expect(ctx.permissions).not.toContain('publish:operate')
    expect(ctx.permissions.length).toBeGreaterThan(0)
  })

  it('share 鉴权链路:源 Key 黑名单优先(IPv6 同样生效)→ 403', async () => {
    fixture.state.share = fakeShareRow(
      fakeKeyRow({ permissions: ['chat:write'], blockedIps: ['2001:db8:dead::/48'] }),
    )
    const err = await expectAuthError(makeRequest({ key: 'share_abc123', ip: '2001:db8:dead::1' }))
    expect(err.statusCode).toBe(403)
    expect(err.message).toBe('IP 在黑名单')
  })

  it('share token 不受 API_KEY_REQUIRE_SECRET 影响(单因子自包含凭据)', async () => {
    fixture.state.share = fakeShareRow(fakeKeyRow({ permissions: ['chat:write'] }))
    const ctx = await authenticateApiKey(makeRequest({ key: 'share_abc123', secret: null }))
    expect(ctx.id).toBe('src-key-1')
  })

  it('share 已过期 / 已撤销 → 401', async () => {
    fixture.state.share = fakeShareRow(fakeKeyRow(), { expiresAt: new Date(Date.now() - 1000) })
    expect((await expectAuthError(makeRequest({ key: 'share_exp' }))).statusCode).toBe(401)

    fixture.state.share = fakeShareRow(fakeKeyRow(), { revokedAt: new Date() })
    expect((await expectAuthError(makeRequest({ key: 'share_rev' }))).statusCode).toBe(401)
  })

  it('token 不存在 / share 服务不可用 → 401(不降级放行)', async () => {
    fixture.state.share = null
    expect((await expectAuthError(makeRequest({ key: 'share_unknown' }))).statusCode).toBe(401)

    vi.mocked(getShareByToken).mockRejectedValueOnce(new Error('DB down'))
    const err = await expectAuthError(makeRequest({ key: 'share_boom' }))
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Share token verification failed')
  })

  it('源 Key 已过期 → 401(继承主链路过期检查)', async () => {
    fixture.state.share = fakeShareRow(
      fakeKeyRow({ permissions: ['chat:write'], expiresAt: new Date(Date.now() - 1000) }),
    )
    const err = await expectAuthError(makeRequest({ key: 'share_src' }))
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Source API key expired')
  })
})

// ============================================================================
// 8. 废弃字段 rateLimit 的语义锁定 + 生效旋钮在第 N+1 次请求 429(2026-09-21)
//    背景:实跑用 rateLimit:1 连打 GET /v1/models 两次都 200,排查确认
//    `developer_api_keys.rate_limit` 在鉴权/配额链上零读取点(仅
//    v1-knowledge-tools 小时/天配额展示兜底),已在 routes/developer.ts 正式废弃。
// ============================================================================
describe('O2-8 rateLimit 已废弃(不参与判定);第 N+1 次 429 由窗口列给出', () => {
  /** 模拟"请求打完 → 窗口计数 +1"的读源形态(真实链路由 incrKeyRateWindows 写库)。 */
  function seedWindowUsage(w: keyof typeof WINDOW_COLUMN, used: number): void {
    fixture.state.windowRows = [
      { windowType: w, windowStart: getKeyWindowStart(w), requestCount: used },
    ]
  }

  it('rateLimit:1 且三窗口 NULL:连打 3 次 GET /v1/models 全放行(死配置锁定)', async () => {
    // 三窗口全 NULL → checkKeyRateWindows 直接放行且**不发起**计数查询;
    // 让读源一被查询就抛,反证 rateLimit 没有任何"按分钟计数"的读取点。
    fixture.state.keyRow = fakeKeyRow({ rateLimit: 1 })
    fixture.state.windowReadThrows = true

    for (let i = 1; i <= 3; i++) {
      const res = makeReply()
      const request = makeRequest({ method: 'GET', url: '/v1/models' })
      await requireApiKeyAuth(request, res.reply, vi.fn())
      expect(res.status, `第 ${i} 次请求不应被限流`).toBeUndefined()
      expect(request.apiKey?.rateLimit).toBe(1) // 仅注入,不判定
    }
  })

  it('替代旋钮 rateLimit5h:1 → 第 2 次请求 429 + Retry-After + 业务码 1010', async () => {
    fixture.state.keyRow = keyRowWithWindow('5h', 1)

    // 第 1 次:窗口用量 0 < 1 → 放行
    fixture.state.windowRows = []
    const first = makeReply()
    const firstRequest = makeRequest({ method: 'GET', url: '/v1/models' })
    await requireApiKeyAuth(firstRequest, first.reply, vi.fn())
    expect(first.status).toBeUndefined()
    expect(firstRequest.apiKey?.id).toBe('key-1')

    // 第 1 次结束后计数落 1(reply finish 的 incrKeyRateWindows)
    seedWindowUsage('5h', 1)

    // 第 2 次:used(1) >= limit(1) → 429
    const second = makeReply()
    await requireApiKeyAuth(
      makeRequest({ method: 'GET', url: '/v1/models' }),
      second.reply,
      vi.fn(),
    )
    expect(second.status).toBe(429)
    expect(second.payload?.code).toBe(1010)
    expect(Number(second.headers['Retry-After'])).toBeGreaterThan(0)
    expect(second.headers['X-RateLimit-Limit']).toBe('1')
    expect(second.headers['X-RateLimit-Remaining']).toBe('0')
    expect(second.headers['X-RateLimit-Window']).toBe('5h')
  })

  it('perModelRpmLimit 才是"每分钟"旋钮:打满 → 429 code 1007(非 1010)', async () => {
    fixture.state.keyRow = fakeKeyRow({ rateLimit: 1, perModelRpmLimit: { 'gpt-test': 1 } })
    // Redis eval 返回 [allowed=0, retryAfter=7]
    fixture.state.redisEvalResult = [0, 7]
    const res = makeReply()
    await requireApiKeyAuth(
      makeRequest({ method: 'POST', body: { model: 'gpt-test' } }),
      res.reply,
      vi.fn(),
    )
    expect(res.status).toBe(429)
    expect(res.payload?.code).toBe(1007)
    expect(Number(res.headers['Retry-After'])).toBe(7)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
