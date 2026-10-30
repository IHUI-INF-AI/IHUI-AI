// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GET /admin/relay/logs/:id 单条详情路由的 handler 测试(2026-10-29 立)。
 *
 * 这里证的是**四件事**,每件都对应一个真实失效型:
 *  ① 凭据不回吐:正文里嵌的 sk-/Bearer 与 metadata 里"键名就是凭据"的两种形态都要盖住
 *     (只按值打码看不见键名那一维,只按键名打码看不见正文里那一维);
 *  ② 读数真的读得到:全局 response-sanitizer 的 "token" 子串规则会把 camelCase 的
 *     promptTokens 整值洗成 "***"(SAFE_KEYS 只登记了 snake_case),本路由把计量收进
 *     usage 子块就是为了躲开它 —— 所以测试**必须真挂上那把全局钩子**,否则这一格测不到
 *     (2026-10-27 号池页 tokenExpiresAt 被洗成 '***' 导致整页崩溃是同一型事故);
 *  ③ 无正文 ≠ 读过:purged / never-written / absent / empty / unjudged 五态各归各的,
 *     取不到列时不许拿空串冒充(AGENTS.md §0.3);
 *  ④ 截断必须可见:写入侧 5000 字符截断标记与读取侧脱敏封顶是两件不同的事,都要如实标出。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const LOG_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'

const h = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.DATABASE_APP_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.CREDENTIALS_ENCRYPTION_KEY ??= 'unit-test-credentials-encryption-key-0123456789ab'
  process.env.NODE_ENV = 'test'
  return { rows: [] as unknown[] }
})

vi.mock('../src/db/index.js', () => {
  const chain = (): unknown => ({
    from: () => ({
      leftJoin: () => ({
        where: () => ({ limit: () => Promise.resolve(h.rows) }),
      }),
      where: () => ({
        orderBy: () => ({ limit: () => Promise.resolve(h.rows) }),
        limit: () => Promise.resolve(h.rows),
      }),
    }),
  })
  const root = {
    select: () => chain(),
    update: () => chain(),
    insert: () => chain(),
  }
  return { db: root, dbRead: root, dbClient: {} }
})

// 管理员闸门与本票机制无关,放行为 no-op(不加载 auth/rbac 链)
vi.mock('../src/plugins/require-permission.js', () => ({ requireAdmin: async () => {} }))

import relayLogsRoutes from '../src/routes/admin/relay-logs.js'
import responseSanitizerPlugin from '../src/plugins/response-sanitizer.js'

/** 一行"原文仍在表内、正文齐全"的基准行(逐态用例只覆盖它自己的那一维) */
function baseRow(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: LOG_ID,
    userId: USER_ID,
    model: 'gpt-4o',
    prompt: 'hello',
    response: 'world',
    promptTokens: 11,
    completionTokens: 22,
    totalTokens: 33,
    cacheReadTokens: 4,
    cacheCreationTokens: 5,
    latencyMs: 120,
    ttftMs: 40,
    status: 'success',
    errorMessage: null,
    retryable: 0,
    conversationId: 'conv-1',
    traceId: 'a'.repeat(32),
    metadata: { multiplier: 1 },
    createdAt: new Date('2026-10-29T00:00:00Z'),
    callerKeyId: null,
    apiKeyId: null,
    providerCode: 'openai',
    configId: 7,
    accountKeyPoolId: null,
    keyPoolId: null,
    clientIp: '203.0.113.9',
    costCents: 3,
    httpStatus: 200,
    callType: 'chat',
    refunded: false,
    rawRetentionDays: null,
    rawRetained: true,
    rawPurgedAt: null,
    username: 'tester',
    email: 'tester@example.com',
    ...over,
  }
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  // 全局脱敏钩子必须一起挂上:不挂它就测不到"字段名踩中 token 子串 ⇒ 读数变 ***"这一格
  await app.register(responseSanitizerPlugin)
  await app.register(relayLogsRoutes)
  await app.ready()
  return app
}

async function getDetail(over: Record<string, unknown> = {}) {
  const app = await buildApp()
  h.rows = [baseRow(over)]
  const res = await app.inject({ method: 'GET', url: `/admin/relay/logs/${LOG_ID}` })
  await app.close()
  return res
}

beforeEach(() => {
  h.rows = []
})

describe('GET /admin/relay/logs/:id — 参数与存在性', () => {
  it('非 UUID 的 id 走 400,不打到 PG(否则 uuid 列报错会变 500)', async () => {
    const app = await buildApp()
    h.rows = []
    const res = await app.inject({ method: 'GET', url: '/admin/relay/logs/not-a-uuid' })
    await app.close()
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('无效')
  })

  it('查无此行 ⇒ 404,不返回 200 + 空壳', async () => {
    const app = await buildApp()
    h.rows = []
    const res = await app.inject({ method: 'GET', url: `/admin/relay/logs/${LOG_ID}` })
    await app.close()
    expect(res.statusCode).toBe(404)
  })

  it('详情面恒定声明已脱敏(不提供 raw 旁路)', async () => {
    const res = await getDetail()
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-log-sanitized']).toBe('true')
    expect(res.json().data.sanitized).toBe(true)
  })
})

describe('详情面:凭据不回吐', () => {
  it('正文里嵌的 sk- / Bearer JWT 原文一律不出现', async () => {
    const secretKey = 'sk-ABCDEFGHIJKLMNOPQRSTUVWX0123'
    const jwt = 'eyJhbGciOiJIUzI1NiA.eyJzdWIiOiIxMjM0NTY3ODkw.YS0qZ3V0ZWQtc2ln'
    const res = await getDetail({
      prompt: `请用这把 key ${secretKey} 调一次`,
      response: `Authorization: Bearer ${jwt}`,
    })
    const data = res.json().data as { prompt: { text: string }; response: { text: string } }
    const body = res.body
    expect(body).not.toContain(secretKey)
    expect(body).not.toContain(jwt)
    // 这两条分别由两个既有出口盖住,标记形态照各自既有值(本测试断言的就是"谁盖住了哪一维")
    expect(data.prompt.text).toContain('sk-***')
    expect(data.response.text).toContain('Bearer ***')
  })

  it('PEM 私钥块:自有正则盖不住,由共享层 SECRET_RULES 那一维补上(证明两处出口都真在链上)', async () => {
    const pem =
      '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA0Z3h7q0kQ0vz2YjW9m1sTg==\n-----END RSA PRIVATE KEY-----'
    const res = await getDetail({ prompt: `上游回包带了这把私钥:\n${pem}` })
    const data = res.json().data as { prompt: { text: string } }
    expect(res.body).not.toContain('MIIEpAIBAAKCAQEA0Z3h7q0kQ0vz2YjW9m1sTg==')
    expect(data.prompt.text).toContain('[REDACTED_SECRET]')
  })

  it('metadata 里"键名本身就是凭据"的字段整值剥除,非凭据键保留(不整块抹平)', async () => {
    const res = await getDetail({
      metadata: {
        authorization: 'Bearer abc.def.ghi',
        apiKey: 'sk-ABCDEFGHIJKLMNOPQRSTUVWX',
        cookie: 'session=1234567890abcdef',
        pricingSource: 'catalog',
      },
    })
    const data = res.json().data as { metadata: Record<string, unknown> }
    expect(data.metadata.authorization).not.toBe('Bearer abc.def.ghi')
    expect(data.metadata.apiKey).not.toBe('sk-ABCDEFGHIJKLMNOPQRSTUVWX')
    expect(data.metadata.cookie).not.toBe('session=1234567890abcdef')
    // 判据只打码凭据键,不许把整块 metadata 洗空(洗空=运维读不到计费归因)
    expect(data.metadata.pricingSource).toBe('catalog')
  })

  it('用户邮箱按既有规则掩码,不回吐完整地址', async () => {
    const res = await getDetail()
    expect(res.body).not.toContain('tester@example.com')
  })
})

describe('详情面:计量读数不被全局钩子洗成 ***', () => {
  it('token 计数走 usage 子块后仍是数字(键名避开 token 子串的真实回报)', async () => {
    const res = await getDetail()
    const usage = (res.json().data as { usage: Record<string, unknown> }).usage
    expect(usage).toEqual({ prompt: 11, completion: 22, total: 33, cacheRead: 4, cacheCreation: 5 })
    // 反面对照:同一份响应里,键名含 token 的字段确实会被全局钩子洗掉 ——
    // 说明本用例的绿不是"钩子没跑"造成的假绿。
    expect(JSON.stringify(res.json())).not.toContain('"promptTokens"')
  })

  it('httpStatus / 延迟 / 成本读数原样可达(键名不含凭据子串)', async () => {
    const res = await getDetail()
    const data = res.json().data as Record<string, unknown>
    expect(data.httpStatus).toBe(200)
    expect(data.latencyMs).toBe(120)
    expect(data.costCents).toBe(3)
  })
})

describe('详情面:无正文的五态如实标注', () => {
  it('rawRetained=false ∧ rawPurgedAt 非空 ⇒ purged(到期清除)', async () => {
    const res = await getDetail({
      rawRetained: false,
      rawPurgedAt: new Date('2026-10-20T00:00:00Z'),
      prompt: '',
      response: null,
    })
    const data = res.json().data as {
      prompt: { state: string; text: string | null }
      response: { state: string }
      rawRetention: { purgedAt: string | null }
    }
    expect(data.prompt.state).toBe('purged')
    expect(data.prompt.text).toBeNull()
    expect(data.response.state).toBe('purged')
    expect(data.rawRetention.purgedAt).not.toBeNull()
  })

  it('rawRetained=false ∧ 无清除时刻 ⇒ never-written(写入侧就关了留存,从未落原文)', async () => {
    const res = await getDetail({
      rawRetained: false,
      rawPurgedAt: null,
      prompt: '',
      response: null,
    })
    const data = res.json().data as { prompt: { state: string; text: string | null } }
    expect(data.prompt.state).toBe('never-written')
    expect(data.prompt.text).toBeNull()
  })

  it('rawRetained=true ∧ response=null ⇒ absent(该调用没有文本产出)', async () => {
    const res = await getDetail({ response: null })
    const data = res.json().data as {
      prompt: { state: string }
      response: { state: string; text: string | null }
    }
    expect(data.prompt.state).toBe('present')
    expect(data.response.state).toBe('absent')
    expect(data.response.text).toBeNull()
  })

  it('rawRetained=true ∧ prompt="" ⇒ empty(空正文,与"已清除"不混为一谈)', async () => {
    const res = await getDetail({ prompt: '' })
    const data = res.json().data as { prompt: { state: string; storedChars: number } }
    expect(data.prompt.state).toBe('empty')
    expect(data.prompt.storedChars).toBe(0)
  })

  it('列没进投影(undefined) ⇒ unjudged,且不拿空串冒充读过', async () => {
    const res = await getDetail()
    const app = await buildApp()
    h.rows = [{ ...baseRow(), prompt: undefined }]
    const unjudged = await app.inject({ method: 'GET', url: `/admin/relay/logs/${LOG_ID}` })
    await app.close()
    const data = unjudged.json().data as { prompt: { state: string; text: unknown } }
    expect(data.prompt.state).toBe('unjudged')
    expect(data.prompt.text).toBeNull()
    // 基准行照旧可读(证明上一条不是全局性失效)
    expect((res.json().data as { prompt: { state: string } }).prompt.state).toBe('present')
  })
})

describe('详情面:截断必须可见', () => {
  it('正文长于读取侧封顶 ⇒ readSideCapped=true 且文本尾带 TRUNCATED 标记', async () => {
    const long = 'x'.repeat(9000)
    const res = await getDetail({ prompt: long })
    const data = res.json().data as {
      prompt: {
        state: string
        readSideCapped: boolean
        storedChars: number
        readerCap: number
        text: string
      }
    }
    expect(data.prompt.state).toBe('present')
    expect(data.prompt.readSideCapped).toBe(true)
    expect(data.prompt.storedChars).toBe(9000)
    expect(data.prompt.readerCap).toBeGreaterThan(0)
    expect(data.prompt.text).toContain('[TRUNCATED')
  })

  it('短正文不打截断标记(反向对照:封顶不是恒真判定)', async () => {
    const res = await getDetail({ prompt: '短正文' })
    const data = res.json().data as { prompt: { readSideCapped: boolean; text: string } }
    expect(data.prompt.readSideCapped).toBe(false)
    expect(data.prompt.text).not.toContain('[TRUNCATED')
  })

  it('库里存的正文自带写入侧 5000 截断标记 ⇒ writerTruncated=true 单独标出', async () => {
    const res = await getDetail({ prompt: 'a'.repeat(200) + '...[truncated]' })
    const data = res.json().data as { prompt: { writerTruncated: boolean } }
    expect(data.prompt.writerTruncated).toBe(true)
  })

  it('正常正文不带写入侧标记(反向对照)', async () => {
    const res = await getDetail({ prompt: '正常正文,没有截断' })
    const data = res.json().data as { prompt: { writerTruncated: boolean } }
    expect(data.prompt.writerTruncated).toBe(false)
  })
})

describe('详情面:失败档位读库里的判定列,不另立分类学', () => {
  it('status=error 行回吐 httpStatus + retryable + 脱敏后的 errorMessage', async () => {
    const res = await getDetail({
      status: 'error',
      httpStatus: 429,
      retryable: 1,
      response: null,
      errorMessage: '上游 429 too many requests, key sk-ABCDEFGHIJKLMNOPQRSTUVWX 被限流',
    })
    const data = res.json().data as {
      status: string
      httpStatus: number
      retryable: number
      errorMessage: string
    }
    expect(data.status).toBe('error')
    expect(data.httpStatus).toBe(429)
    expect(data.retryable).toBe(1)
    expect(data.errorMessage).not.toContain('sk-ABCDEFGHIJKLMNOPQRSTUVWX')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
