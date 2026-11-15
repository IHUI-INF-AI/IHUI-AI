// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-298 回归锁(2026-11-13)。
 *
 * 病灶:POST /api/chat/conversations/:id/compress 把上游非 2xx 的响应体原样拼进
 * 客户端 message,并把 fetch 异常/上游业务错误的原文直接回传 —— 普通登录用户
 * 可据此读到 provider 账号/组织/request-id/内部地址与 DB 约束文本。
 *
 * 本文件锁:
 *   ① 上游非 2xx:502 + 固定文案 + 错误码,响应体不含上游原文;原文进 warn(带状态码);
 *   ② 上游 200 但 body.error:同一脱敏纪律;
 *   ③ 网络异常:同一脱敏纪律(异常 message 不回客户端);
 *   ④ 日志里的响应体必须截断(512 字符上限,防整页错误页灌日志);
 *   ⑤ 成功路径响应结构逐字不变(正控,防脱敏改造误伤正常返回)。
 *
 * 只 mock authenticate / db / chat-queries 三个读函数 / aiServiceFetch,
 * 不触达真实 ai-service、PG、Redis。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify'

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'info',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
    COZE_API_KEY: '',
  },
}))

const {
  mockAuthenticate,
  mockFindConversationById,
  mockFindMessagesForExport,
  mockSaveCompressedContext,
  mockAiServiceFetch,
} = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockFindConversationById: vi.fn(),
  mockFindMessagesForExport: vi.fn(),
  mockSaveCompressedContext: vi.fn(),
  mockAiServiceFetch: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

// 路由文件与 chat-queries 的真实实现都会 import db/index;这里给空壳,
// 让离线用例不加载真实连接池(与 chat-fork-branch-endpoint.test.ts 同一手法)。
vi.mock('../src/db/index.js', () => {
  const makeChain = () => {
    const chain: Record<string, unknown> = {}
    for (const m of [
      'from',
      'where',
      'set',
      'returning',
      'values',
      'innerJoin',
      'orderBy',
      'limit',
      'offset',
      'groupBy',
      'for',
    ]) {
      chain[m] = vi.fn(() => chain)
    }
    chain.then = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve)
    return chain
  }
  return {
    db: {
      select: vi.fn(() => makeChain()),
      insert: vi.fn(() => makeChain()),
      update: vi.fn(() => makeChain()),
      delete: vi.fn(() => makeChain()),
      execute: vi.fn().mockResolvedValue([]),
      transaction: vi.fn(),
    },
    dbRead: { select: vi.fn(() => makeChain()) },
  }
})

// 只覆盖 /compress 这一路读写的三个函数,其余保留真实实现。
vi.mock('../src/db/chat-queries.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ChatQueries>()
  return {
    ...actual,
    findConversationById: mockFindConversationById,
    findMessagesForExport: mockFindMessagesForExport,
    saveCompressedContext: mockSaveCompressedContext,
  }
})

// /compress 的上游出口:直接替换成假件,不发真实 HTTP。
vi.mock('../src/utils/ai-service-fetch.js', async (importOriginal) => {
  const actual = await importOriginal<typeof AiServiceFetch>()
  return { ...actual, aiServiceFetch: mockAiServiceFetch }
})

import { chatRoutes } from '../src/routes/chat'
import type * as ChatQueries from '../src/db/chat-queries.js'
import type * as AiServiceFetch from '../src/utils/ai-service-fetch.js'
import type { ChatConversation } from '@ihui/database'

const CONV_ID = '11111111-1111-4111-8111-111111111111'
const SECRET_BODY = 'SECRET_UPSTREAM_BODY provider=acme-org request_id=req-42 /internal/path'
const FIXED_MESSAGE = '对话压缩失败,请稍后重试'
const ERROR_CODE = 'COMPRESS_UPSTREAM_ERROR'

interface CapturedLog {
  level: string
  obj: Record<string, unknown>
  msg: string
}

/** 假 logger:只为断言 warn 确实被调用,且载荷带截断后的上游原文。 */
function makeCaptureLogger(sink: CapturedLog[]): Record<string, unknown> {
  const emit = (level: string) => (obj: unknown, msg?: string) => {
    sink.push({ level, obj: (obj ?? {}) as Record<string, unknown>, msg: String(msg ?? '') })
  }
  const logger: Record<string, unknown> = {
    trace: emit('trace'),
    debug: emit('debug'),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
    fatal: emit('fatal'),
  }
  logger.child = () => logger
  return logger
}

const ownedConversation = {
  id: CONV_ID,
  userId: 'f298-user',
  title: '测试会话',
  model: 'test-model',
  systemPrompt: null,
  metadata: null,
  lastMessageAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  archivedAt: null,
  compressedAt: null,
  compressedContext: null,
  pinned: false,
  pinnedAt: null,
} as unknown as ChatConversation

describe('F-298 /compress 上游错误必须脱敏(固定文案 + 错误码,原文只进日志)', () => {
  let app: FastifyInstance
  const logs: CapturedLog[] = []

  beforeAll(async () => {
    app = Fastify({ loggerInstance: makeCaptureLogger(logs) as unknown as FastifyBaseLogger })
    await app.register(chatRoutes, { prefix: '/api/chat' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    logs.length = 0
    mockAuthenticate.mockImplementation(async (request: unknown) => {
      ;(request as { userId?: string }).userId = 'f298-user'
    })
    mockFindConversationById.mockResolvedValue(ownedConversation)
    mockFindMessagesForExport.mockResolvedValue([{ role: 'user', content: 'hi' }])
    mockSaveCompressedContext.mockResolvedValue(undefined)
  })

  const call = () =>
    app.inject({
      method: 'POST',
      url: `/api/chat/conversations/${CONV_ID}/compress`,
      headers: { authorization: 'Bearer f298-token' },
      payload: { targetChars: 200000 },
    })

  const warnLogs = () => logs.filter((l) => l.level === 'warn')
  const jsonBody = (body: string) =>
    JSON.parse(body) as { code: number; message: string; errorCode?: string; data?: unknown }

  it('① 上游非 2xx:502,客户端只拿固定文案 + 错误码,原文进 warn(含状态码)', async () => {
    mockAiServiceFetch.mockResolvedValueOnce(
      new Response(`{"error":"${SECRET_BODY}"}`, { status: 500 }),
    )

    const res = await call()

    expect(res.statusCode).toBe(502)
    const body = jsonBody(res.body)
    expect(body.code).toBe(502)
    expect(body.message).toBe(FIXED_MESSAGE)
    expect(body.errorCode).toBe(ERROR_CODE)
    expect(body.data).toBeUndefined()
    expect(res.body).not.toContain('SECRET_UPSTREAM_BODY')
    expect(res.body).not.toContain('/internal/path')
    expect(res.body).not.toContain('req-42')

    const warns = warnLogs()
    expect(warns).toHaveLength(1)
    expect(warns[0]!.msg).toContain('对话压缩')
    expect(warns[0]!.obj.upstreamStatus).toBe(500)
    expect(String(warns[0]!.obj.upstreamBody)).toContain('SECRET_UPSTREAM_BODY')
    expect(String(warns[0]!.obj.upstreamBody)).toContain('/internal/path')
    // 失败路径没有落库副作用
    expect(mockSaveCompressedContext).not.toHaveBeenCalled()
  })

  it('② 上游 200 但 body.error:同样只回固定文案,原文进 warn', async () => {
    mockAiServiceFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: SECRET_BODY }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const res = await call()

    expect(res.statusCode).toBe(502)
    const body = jsonBody(res.body)
    expect(body.message).toBe(FIXED_MESSAGE)
    expect(body.errorCode).toBe(ERROR_CODE)
    expect(res.body).not.toContain('SECRET_UPSTREAM_BODY')
    expect(res.body).not.toContain('/internal/path')

    const warns = warnLogs()
    expect(warns).toHaveLength(1)
    expect(String(warns[0]!.obj.upstreamError)).toContain('SECRET_UPSTREAM_BODY')
    expect(mockSaveCompressedContext).not.toHaveBeenCalled()
  })

  it('③ 网络异常:异常 message 不回客户端,warn 出声', async () => {
    mockAiServiceFetch.mockRejectedValueOnce(
      new TypeError(`fetch failed: connect ECONNREFUSED /internal/path (${SECRET_BODY})`),
    )

    const res = await call()

    expect(res.statusCode).toBe(502)
    const body = jsonBody(res.body)
    expect(body.message).toBe(FIXED_MESSAGE)
    expect(body.errorCode).toBe(ERROR_CODE)
    expect(res.body).not.toContain('SECRET_UPSTREAM_BODY')
    expect(res.body).not.toContain('/internal/path')
    expect(res.body).not.toContain('ECONNREFUSED')

    const warns = warnLogs()
    expect(warns).toHaveLength(1)
    expect(warns[0]!.obj.err).toBeInstanceOf(Error)
    expect(String((warns[0]!.obj.err as Error).message)).toContain('/internal/path')
  })

  it('④ 日志里的上游响应体必须截断到 512 字符(防整页错误页灌日志)', async () => {
    const longBody = `SECRET_UPSTREAM_BODY ${'X'.repeat(5000)}`
    mockAiServiceFetch.mockResolvedValueOnce(new Response(longBody, { status: 502 }))

    const res = await call()
    expect(res.statusCode).toBe(502)

    const logged = String(warnLogs()[0]!.obj.upstreamBody)
    expect(logged.startsWith(longBody.slice(0, 512))).toBe(true)
    expect(logged).toContain(`(truncated, total ${longBody.length} chars)`)
    expect(logged.length).toBeLessThan(longBody.length)
  })

  it('⑤ 成功路径:响应结构不变(正控),且不产生 warn', async () => {
    mockAiServiceFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ content: '压缩后的上下文', model: 'test-model', usage: { total: 3 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const res = await call()

    expect(res.statusCode).toBe(200)
    expect(jsonBody(res.body)).toEqual({
      code: 0,
      message: 'success',
      data: {
        content: '压缩后的上下文',
        model: 'test-model',
        usage: { total: 3 },
        // '[user] hi'
        originalChars: 9,
        compressedChars: '压缩后的上下文'.length,
      },
    })
    expect(mockSaveCompressedContext).toHaveBeenCalledWith(CONV_ID, '压缩后的上下文')
    expect(warnLogs()).toHaveLength(0)
  })
})
