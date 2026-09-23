// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /v1/messages* ↔ ai-service /api/message-bus/* 跨服务契约测试(2026-09-23 立)。
 *
 * 守两类漂移:
 *  A. 出站形状 —— 拦截 globalThis.fetch,逐字段断言真正发给 ai-service 的 body / method / path,
 *     而不是只断言网关响应;并把出站键集合与从
 *     apps/ai-service/app/api/message_bus.py 解析出的 pydantic 字段直接比对(单一真相源,
 *     不在本文件手抄第二份字段清单):任一侧改名即红。
 *  B. 入站通道取值域 —— 从 apps/ai-service/app/services/message_bus.py 解析 ChannelType,
 *     与 api 侧 MESSAGE_BUS_CHANNELS 源文本做集合相等比对,再用真实请求证明路由确实
 *     按该集合放行(每个合法值 200、已删除的 email 400 且不打下游)。
 *
 * 为什么新开一个文件(而不是并进 tests/v1-messages.test.ts):
 * tests/v1-messages.test.ts 名字里的 "v1/messages" 测的是 src/routes/v1-messages.ts
 * (Anthropic 适配层,生产挂在 /v1/anthropic),而 POST /v1/messages 的处理器在
 * src/routes/v1-knowledge-tools.ts —— 同名不同体,正是"有测试却没人发现这条对外能力
 * 一直坏着"的直接成因。文件名带上 message-bus 消除歧义;且本文件要注册的插件与
 * mock 面与那个文件不同(vitest 的 vi.mock 工厂是文件级的,合并只会互相干扰)。
 *
 * 取向参照 apps/api/tests/o5-nginx-edge-ratelimit.test.ts:本机无 Python 运行时、
 * 不连库、不联网,靠"静态读源码 + fetch mock"做对账。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.AI_SERVICE_URL ??= 'http://test-ai-service:8802'
})

// mock db:本文件只验 HTTP 契约,任何用例都不得触库(§5 测试隔离铁律)
vi.mock('../src/db/index.js', () => ({
  db: {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  dbRead: { select: vi.fn() },
}))

// mock 鉴权插件:注入 apiKey 上下文并放行配额闸(真实 requireCapability 读 request.apiKey.permissions)
const MOCK_API_KEY = {
  id: 'ak_test_msgbus',
  userId: 'user_test_msgbus',
  key: 'ihui_test_key',
  permissions: ['*'],
  rateLimit: 100,
}
vi.mock('../src/plugins/api-key-auth.js', () => ({
  requireApiKeyAuth: vi.fn(async (request: { apiKey?: typeof MOCK_API_KEY }) => {
    request.apiKey = MOCK_API_KEY
  }),
  requireApiKeyPermission: vi.fn(() => async () => {}),
  requireApiKeyQuota: vi.fn(() => async () => {}),
}))

import v1KnowledgeToolsRoutes from '../src/routes/v1-knowledge-tools'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const AI_API_FILE = resolve(REPO_ROOT, 'apps/ai-service/app/api/message_bus.py')
const AI_SERVICE_FILE = resolve(REPO_ROOT, 'apps/ai-service/app/services/message_bus.py')
const API_ROUTE_FILE = resolve(REPO_ROOT, 'apps/api/src/routes/v1-knowledge-tools.ts')

// =============================================================================
// Python 侧真相源解析(只读文本,不起 Python 进程)
// =============================================================================

interface PyModelFields {
  required: string[]
  optional: string[]
}

/**
 * 解析 `class <Name>(BaseModel):` 体内的字段声明。
 * 认三种形态:`name: T`(必填)、`name: T = Field(...`(首参为 ... 即必填)、
 * `name: T = Field(<非 ...>` 或 `= 字面量`(有默认值即选填)。
 * 缩进 4 空格才算类成员,遇到首个顶格非空行即结束 —— 不靠注释/文档字符串取字段。
 */
function parsePydanticFields(source: string, modelName: string): PyModelFields {
  const lines = source.split('\n')
  const header = `class ${modelName}(BaseModel):`
  const start = lines.findIndex((l) => l.startsWith(header))
  if (start === -1) throw new Error(`ai-service 源码里找不到 ${modelName}(类名或文件漂移)`)

  const required: string[] = []
  const optional: string[] = []
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (line.trim() === '') continue
    if (!/^\s/.test(line)) break // 顶格 → 类结束
    if (line.trimStart().startsWith('#') || line.trimStart().startsWith('"""')) continue
    const m = /^ {4}(?<name>[a-z_][a-z0-9_]*)\s*:\s*(?<rest>.+)$/.exec(line)
    if (!m?.groups?.name) continue
    const rest = m.groups.rest ?? ''
    const hasDefault = rest.includes('=')
    const requiredFieldCall = /=\s*Field\(\s*\.\.\./.test(rest)
    if (!hasDefault || requiredFieldCall) required.push(m.groups.name)
    else optional.push(m.groups.name)
  }
  return { required, optional }
}

/** 解析 `class ChannelType(...)` 里的 `MEMBER = "value"` 取值集合。 */
function parseChannelTypeValues(source: string): string[] {
  const start = source.search(/^class ChannelType\(/m)
  if (start === -1) throw new Error('ai-service 源码里找不到 ChannelType')
  const rest = source.slice(start)
  const end = rest.indexOf('\n\n', rest.indexOf('\n', rest.indexOf('\n') + 1) + 1)
  const body = end === -1 ? rest : rest.slice(0, end)
  const values: string[] = []
  for (const m of body.matchAll(/^ {4}[A-Z][A-Z0-9_]* = "(?<v>[^"]+)"/gm)) {
    if (typeof m.groups?.v === 'string') values.push(m.groups.v)
  }
  if (values.length === 0) throw new Error('ChannelType 解析到 0 个取值(解析器失效,不是枚举真的空)')
  return values
}

/** 解析 api 侧 `const MESSAGE_BUS_CHANNELS = [...] as const` 的字面量集合。 */
function parseTsChannelLiterals(source: string): string[] {
  const m = /const MESSAGE_BUS_CHANNELS = \[(?<list>[^\]]*)\]/.exec(source)
  const list = m?.groups?.list
  if (!list) throw new Error('api 侧找不到 MESSAGE_BUS_CHANNELS 常量')
  const values: string[] = []
  for (const item of list.matchAll(/'([^']+)'/g)) {
    if (typeof item[1] === 'string') values.push(item[1])
  }
  return values
}

const aiApiSource = readFileSync(AI_API_FILE, 'utf8')
const aiServiceSource = readFileSync(AI_SERVICE_FILE, 'utf8')
const apiRouteSource = readFileSync(API_ROUTE_FILE, 'utf8')

const PUBLISH_FIELDS = parsePydanticFields(aiApiSource, 'PublishRequest')
const MESSAGE_PAYLOAD_FIELDS = parsePydanticFields(aiApiSource, 'MessagePayload')
const SUBSCRIBE_FIELDS = parsePydanticFields(aiApiSource, 'SubscribeRequest')
const PY_CHANNELS = parseChannelTypeValues(aiServiceSource)

/** 出站键集合必须覆盖全部必填字段、且不得出现模型里没有的键(多余键 pydantic 静默丢弃 = 假成功)。 */
function expectMatchesPyModel(
  body: Record<string, unknown>,
  fields: PyModelFields,
  label: string,
): void {
  const keys = Object.keys(body)
  expect(keys, `${label}: 缺少 ai-service 必填字段`).toEqual(
    expect.arrayContaining([...fields.required]),
  )
  for (const key of keys) {
    expect(
      [...fields.required, ...fields.optional],
      `${label}: 出站键 ${key} 不在 ai-service 模型里(会被静默丢弃)`,
    ).toContain(key)
  }
}

// =============================================================================
// fetch 拦截层
// =============================================================================

interface CapturedRequest {
  url: string
  method: string
  body: unknown
}

let captured: CapturedRequest[] = []

function fakeResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response
}

/** 让 ai-service 返回给定响应,并把每一跳出站请求记录进 captured。 */
function stubAiService(status: number, payload: unknown): void {
  globalThis.fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
    const raw = init?.body
    captured.push({
      url: String(url),
      method: init?.method ?? 'GET',
      body: typeof raw === 'string' ? (JSON.parse(raw) as unknown) : null,
    })
    return fakeResponse(status, payload)
  }) as unknown as typeof globalThis.fetch
}

function onlyRequest(): CapturedRequest {
  expect(captured).toHaveLength(1)
  const first = captured[0]
  if (!first) throw new Error('没有捕获到出站请求')
  return first
}

function asBody(req: CapturedRequest): Record<string, unknown> {
  expect(typeof req.body).toBe('object')
  return req.body as Record<string, unknown>
}

// =============================================================================
// 用例
// =============================================================================

describe('通道取值域:ai-service ChannelType 是唯一真相源', () => {
  it('api 侧 MESSAGE_BUS_CHANNELS 与 Python ChannelType 集合相等', () => {
    expect([...parseTsChannelLiterals(apiRouteSource)].sort()).toEqual([...PY_CHANNELS].sort())
  })

  it('email 已从枚举删除,不得回升', () => {
    expect(PY_CHANNELS).not.toContain('email')
    expect(parseTsChannelLiterals(apiRouteSource)).not.toContain('email')
  })
})

describe('POST /v1/messages → ai-service PublishRequest', () => {
  let server: ReturnType<typeof Fastify>

  beforeEach(async () => {
    captured = []
    server = Fastify({ logger: false })
    server.setErrorHandler((err, _req, reply) => {
      const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500
      reply.status(statusCode).send({ code: statusCode, message: err.message })
    })
    await server.register(v1KnowledgeToolsRoutes, { prefix: '/v1' })
    await server.ready()
  })

  afterEach(async () => {
    await server.close()
    globalThis.fetch = vi.fn()
  })

  it('出站体逐字段满足 PublishRequest(channel 单值 → channels 数组 + message 嵌套)', async () => {
    stubAiService(200, {
      code: 0,
      message: 'ok',
      data: {
        messageId: 'msg_1',
        deliveredChannels: ['im'],
        failedChannels: [],
        fallbackUsed: false,
        error: null,
      },
    })

    const res = await server.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: { channel: 'im', content: 'hello', metadata: { userId: 'u1' } },
    })
    expect(res.statusCode).toBe(200)

    const req = onlyRequest()
    expect(req.url).toBe('http://test-ai-service:8802/api/message-bus/publish')
    expect(req.method).toBe('POST')

    const body = asBody(req)
    // 反向对照的锚点:任何一键名改名(如 channels → channel)都会同时撞上下两条断言
    expect(body).toEqual({
      message: { content: 'hello', metadata: { userId: 'u1' } },
      channels: ['im'],
      priority: 'normal',
    })
    expectMatchesPyModel(body, PUBLISH_FIELDS, 'PublishRequest')
    expectMatchesPyModel(
      body.message as Record<string, unknown>,
      MESSAGE_PAYLOAD_FIELDS,
      'MessagePayload',
    )
    // v1 契约无 priority 入参,固定用 ai-service 自己的默认档位
    expect(String(body.priority)).toBe('normal')
  })

  it('metadata 省略时出站补空对象(recipients 一律不透传,ai-service 无该字段)', async () => {
    stubAiService(200, { code: 0, message: 'ok', data: { messageId: 'msg_2' } })

    const res = await server.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: {
        channel: 'sms',
        content: 'hi',
        recipients: ['+8613800000000'],
      },
    })
    expect(res.statusCode).toBe(200)

    const body = asBody(onlyRequest())
    const message = body.message as Record<string, unknown>
    expect(message.metadata).toEqual({})
    expect(Object.keys(message).sort()).toEqual(['content', 'metadata'])
    expect(body.recipients).toBeUndefined()
    expect(Object.keys(body).sort()).toEqual(['channels', 'message', 'priority'])
  })

  it.each(PY_CHANNELS)(
    'ai-service 的每个合法通道 %s 都能放行并原样进 channels',
    async (channel) => {
      stubAiService(200, { code: 0, message: 'ok', data: { messageId: 'msg_ok' } })

      const res = await server.inject({
        method: 'POST',
        url: '/v1/messages',
        headers: { 'x-api-key': 'ihui_test_key' },
        payload: { channel, content: 'x' },
      })
      expect(res.statusCode).toBe(200)
      expect(asBody(onlyRequest()).channels).toEqual([channel])
    },
  )

  it('非法通道名(含已删除的 email)本地 400,且完全不打下游', async () => {
    stubAiService(200, { code: 0, message: 'ok', data: { messageId: 'should_not_be_used' } })

    for (const channel of ['email', 'carrier-pigeon', '']) {
      captured = []
      const res = await server.inject({
        method: 'POST',
        url: '/v1/messages',
        headers: { 'x-api-key': 'ihui_test_key' },
        payload: { channel, content: 'x' },
      })
      expect(res.statusCode, `channel=${channel} 应被本地拦下`).toBe(400)
      expect(res.json()).toMatchObject({ code: 400 })
      expect(typeof res.json().message).toBe('string')
      expect(String(res.json().message).length).toBeGreaterThan(0)
      expect(captured, '非法通道不得透传给 ai-service').toEqual([])
    }
  })

  it('缺 content 仍是 400(入参契约未变)', async () => {
    stubAiService(200, { code: 0, message: 'ok', data: { messageId: 'x' } })
    const res = await server.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: { channel: 'im' },
    })
    expect(res.statusCode).toBe(400)
    expect(captured).toEqual([])
  })

  it('响应拆 ai-service 的 { code, message, data } 壳后回填 messageId', async () => {
    stubAiService(200, { code: 0, message: 'ok', data: { messageId: 'msg_nested' } })

    const res = await server.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: { channel: 'webhook', content: 'x' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ messageId: 'msg_nested', status: 'published', subscriberCount: 0 })
  })

  it('HTTP 200 + code=500 是业务失败,必须 502 带上游文案(不得当成功返回空 id)', async () => {
    stubAiService(200, { code: 500, message: '发布失败: channel down', data: null })

    const res = await server.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: { channel: 'im', content: 'x' },
    })
    expect(res.statusCode).toBe(502)
    expect(String(res.json().message)).toContain('channel down')
  })

  it('上游响应不再是 { code } 壳时 502,不静默返回空 messageId', async () => {
    stubAiService(200, { messageId: 'no-envelope' })

    const res = await server.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: { channel: 'im', content: 'x' },
    })
    expect(res.statusCode).toBe(502)
  })

  it('ai-service 非 2xx 仍是 503(对外错误通道未变)', async () => {
    stubAiService(422, { detail: 'validation error' })

    const res = await server.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: { channel: 'im', content: 'x' },
    })
    expect(res.statusCode).toBe(503)
  })
})

describe('POST /v1/messages/subscribe → ai-service SubscribeRequest', () => {
  let server: ReturnType<typeof Fastify>

  beforeEach(async () => {
    captured = []
    server = Fastify({ logger: false })
    await server.register(v1KnowledgeToolsRoutes, { prefix: '/v1' })
    await server.ready()
  })

  afterEach(async () => {
    await server.close()
    globalThis.fetch = vi.fn()
  })

  it('callbackUrl 必须映射成 webhook_url(否则订阅静默不带回调地址)', async () => {
    stubAiService(200, {
      code: 0,
      message: 'ok',
      data: { subscriptionId: 'sub_1', channel: 'webhook' },
    })

    const res = await server.inject({
      method: 'POST',
      url: '/v1/messages/subscribe',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: { channel: 'webhook', callbackUrl: 'https://example.com/hook' },
    })
    expect(res.statusCode).toBe(200)

    const req = onlyRequest()
    expect(req.url).toBe('http://test-ai-service:8802/api/message-bus/subscribe')
    const body = asBody(req)
    expect(body).toEqual({ channel: 'webhook', webhook_url: 'https://example.com/hook' })
    expectMatchesPyModel(body, SUBSCRIBE_FIELDS, 'SubscribeRequest')
    expect(res.json()).toEqual({ subscriptionId: 'sub_1', status: 'subscribed' })
  })

  it('非法通道 400 且不打下游', async () => {
    stubAiService(200, { code: 0, message: 'ok', data: { subscriptionId: 'x' } })
    const res = await server.inject({
      method: 'POST',
      url: '/v1/messages/subscribe',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: { channel: 'email', callbackUrl: 'https://example.com/hook' },
    })
    expect(res.statusCode).toBe(400)
    expect(captured).toEqual([])
  })
})

describe('DELETE /v1/messages/subscribe/:id + GET /v1/messages/:id/status', () => {
  let server: ReturnType<typeof Fastify>

  beforeEach(async () => {
    captured = []
    server = Fastify({ logger: false })
    await server.register(v1KnowledgeToolsRoutes, { prefix: '/v1' })
    await server.ready()
  })

  afterEach(async () => {
    await server.close()
    globalThis.fetch = vi.fn()
  })

  it('取消订阅:路径带 id、方法 DELETE、响应拆壳后只回内层对象', async () => {
    stubAiService(200, { code: 0, message: 'ok', data: { unsubscribed: true } })

    const res = await server.inject({
      method: 'DELETE',
      url: '/v1/messages/subscribe/sub%201',
      headers: { 'x-api-key': 'ihui_test_key' },
    })
    expect(res.statusCode).toBe(200)

    const req = onlyRequest()
    expect(req.method).toBe('DELETE')
    expect(req.url).toBe('http://test-ai-service:8802/api/message-bus/subscribe/sub%201')
    // 此前整壳 { code, message, data } 被直接回给 v1 调用方,与同族端点形态不一致
    expect(res.json()).toEqual({ unsubscribed: true })
  })

  it('状态查询:perChannel 聚合成 v1 的单一 status + 成功/失败计数', async () => {
    stubAiService(200, {
      code: 0,
      message: 'ok',
      data: {
        messageId: 'msg_9',
        perChannel: { im: 'delivered', webhook: 'failed', sms: 'pending' },
        totalAttempts: 3,
        lastAttempt: '2026-09-23T00:00:00',
      },
    })

    const res = await server.inject({
      method: 'GET',
      url: '/v1/messages/msg_9/status',
      headers: { 'x-api-key': 'ihui_test_key' },
    })
    expect(res.statusCode).toBe(200)
    expect(onlyRequest().url).toBe('http://test-ai-service:8802/api/message-bus/status/msg_9')
    expect(res.json()).toEqual({
      messageId: 'msg_9',
      status: 'delivered',
      deliveredCount: 1,
      failedCount: 1,
    })
  })

  it('全通道未投递时 status 为 pending(不凭 totalAttempts 猜测)', async () => {
    stubAiService(200, {
      code: 0,
      message: 'ok',
      data: { messageId: 'msg_10', perChannel: { sms: 'rate_limited' }, totalAttempts: 1 },
    })

    const res = await server.inject({
      method: 'GET',
      url: '/v1/messages/msg_10/status',
      headers: { 'x-api-key': 'ihui_test_key' },
    })
    expect(res.json()).toEqual({
      messageId: 'msg_10',
      status: 'pending',
      deliveredCount: 0,
      failedCount: 0,
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
