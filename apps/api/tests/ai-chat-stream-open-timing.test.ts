// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-998168 票5 + 机主拍板⑥:首帧耗时分段归因(openTiming)随首帧回传测试
 *
 * 契约锁定:
 * 1. 首帧(客户端看到的第一个上游 JSON data 行)出现 { version: 1, prepareMs,
 *    upstreamConnectMs, firstByteMs, storageReadMs, coldStart } **完整字段集**,
 *    且**仅首帧**携带(后续帧/done 帧不重复注入)
 * 2. 时钟回退(负差值)⇒ 各段为 **null 而不是夹成 0**,且 elapsedClockStats
 *    的 negativeDelta/untrustworthy 计数同步 +1(计时全部走 elapsed-ms 唯一出口)
 * 3. 纯透传不落库(拍板⑥):除首帧多出的 openTiming 字段外逐字节等同上游;
 *    全流程零 DB/指标写入(总时长 TTFT 仍由 business-metrics 既有口径承载)
 *
 * Mock 策略(参照 ai-chat-stream-tools.test.ts):
 * - config / @ihui/auth / @ihui/types / @ihui/context-compaction / chat-queries 全 mock
 * - repo-wiki-context / knowledge-chat-context mock(null)⇒ storage 段测的是读完成耗时
 * - elapsed-ms **partial mock**:happy path 透传真实时钟;negative 模式注入"每次调用
 *   都倒退"的假时钟(起表 0 → 停表 -1000 ⇒ 负差值),**保留真实 elapsedClockStats 计数器**
 *   (包装 actual.startStopwatch 而非整个替换,计数面语义不失真)
 */
import { describe, it, expect, afterAll, beforeAll, afterEach, vi } from 'vitest'
import Fastify from 'fastify'

// 1. Mock config 避免 env 校验触发 process.exit(1);SignJWT 摘要链 stub
vi.mock('jose', () => ({
  decodeJwt: () => ({}),
  SignJWT: class {
    setProtectedHeader() {
      return this
    }
    setIssuer() {
      return this
    }
    setAudience() {
      return this
    }
    setSubject() {
      return this
    }
    setIssuedAt() {
      return this
    }
    setExpirationTime() {
      return this
    }
    async sign() {
      return 'mock-system-access-token'
    }
  },
}))
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
    AI_SERVICE_URL: 'http://mock-ai-service:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

// 2. Mock @ihui/auth + getUserStatus
const { mockVerifyAccessToken } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
}))
vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))
vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))

// 3. Mock @ihui/types message-repair
vi.mock('@ihui/types', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    repairMessages: (msgs: unknown[]) => ({ repaired: msgs, removed: 0 }),
  }
})

// 4. Mock @ihui/context-compaction(默认不压缩)
const { mockCompressContextIfNeeded } = vi.hoisted(() => ({
  mockCompressContextIfNeeded: vi.fn(),
}))
vi.mock('@ihui/context-compaction', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, compressContextIfNeeded: mockCompressContextIfNeeded }
})

// 5. Mock chat-queries + db(断言"纯透传不落库":这些 mock 全程零调用)
vi.mock('../src/db/chat-queries.js', () => ({
  createMessage: vi.fn().mockResolvedValue({ id: 'mock-msg-id' }),
  patchConversationMetadata: vi.fn().mockResolvedValue(undefined),
  replaceMessages: vi.fn().mockResolvedValue(undefined),
  createConversation: vi.fn(),
  findConversationsByUser: vi.fn(),
  findConversationById: vi.fn(),
  updateConversation: vi.fn(),
  deleteConversation: vi.fn(),
  deleteConversationsBatch: vi.fn(),
  favoriteConversationsBatch: vi.fn(),
  unfavoriteConversationsBatch: vi.fn(),
  setConversationsArchivedBatch: vi.fn(),
  findMessages: vi.fn(),
  findMessageById: vi.fn(),
  deleteMessage: vi.fn(),
  clearMessages: vi.fn(),
  favoriteConversation: vi.fn(),
  unfavoriteConversation: vi.fn(),
  findFavoriteConversations: vi.fn(),
  archiveConversation: vi.fn(),
  unarchiveConversation: vi.fn(),
  findMessagesForExport: vi.fn().mockResolvedValue([]),
  findMessagesForShare: vi.fn(),
  saveCompressedContext: vi.fn(),
  setConversationShareToken: vi.fn(),
  findConversationByShareToken: vi.fn(),
  regenerateConversationMessages: vi.fn(),
  branchConversationFrom: vi.fn(),
}))
vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {} }))

// 6. Mock ai-cost + 归档落库(拉起真实模块链会碰 db;归档由内部 try/catch 降级,直接 mock 干净)
const { mockRecordAiCost, mockPersistMessageArchive } = vi.hoisted(() => ({
  mockRecordAiCost: vi.fn(),
  mockPersistMessageArchive: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../src/plugins/ai-cost.js', () => ({ recordAiCost: mockRecordAiCost }))
vi.mock('../src/utils/conversation-archive.js', () => ({
  persistMessageArchive: mockPersistMessageArchive,
}))

// 7. Mock 存储读服务(段计时语义下"读完成"即可,返回 null 不注入 citations)
vi.mock('../src/services/repo-wiki-context.js', () => ({
  loadRepoWikiContext: vi.fn().mockResolvedValue(null),
}))
vi.mock('../src/services/knowledge-chat-context.js', () => ({
  loadKnowledgeContext: vi.fn().mockResolvedValue(null),
}))

// 8. elapsed-ms partial mock:clockModeRef 控制 fake 时钟形态;
//    negative 模式下 perfNow/wallNow 每次调用倒退 1000 ⇒ stop() 得负差值
//    (negative-delta 优先判定 ⇒ trustworthy=false ⇒ elapsedMs=null),
//    且**包装真实 startStopwatch** ⇒ elapsedClockStats 计数器照常 +1(测试②的断言面)。
const { clockModeRef } = vi.hoisted(() => ({
  clockModeRef: { current: 'real' as 'real' | 'negative' },
}))
vi.mock('../src/utils/elapsed-ms.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const { performance } = await import('node:perf_hooks')
  const realStartStopwatch = actual.startStopwatch as (opts?: unknown) => unknown
  let negPerf = 1_000_000
  let negWall = 1_000_000
  const negativeClocks = {
    // 每次调用都倒退:起表值 > 停表值 ⇒ 差值为负(时钟回退型不可信样本)
    perfNow: () => (negPerf -= 1000),
    wallNow: () => (negWall -= 1000),
  }
  return {
    ...actual,
    startStopwatch: (opts?: unknown) =>
      realStartStopwatch({
        ...(typeof opts === 'object' && opts !== null ? opts : {}),
        ...(clockModeRef.current === 'negative'
          ? { clocks: negativeClocks }
          : { clocks: { perfNow: () => performance.now(), wallNow: () => Date.now() } }),
      }),
  }
})

import {
  aiChatStreamRoutes,
  __resetAiServiceStreamColdStartForTests,
} from '../src/routes/ai-chat-stream.js'
import { elapsedClockStats } from '../src/utils/elapsed-ms.js'
import {
  createMessage,
  patchConversationMetadata,
  replaceMessages,
} from '../src/db/chat-queries.js'

// 9. **半致态隔离(已向委托方报告,非绕行)**:packages/shared 处于他人在飞半致态 ——
//    families.ts 顶层断言要求 contract.ts SSE_EVENTS 含 partial_done 而当前未含 ⇒
//    任何 import '@ihui/shared' 主入口的模块(require-permission.ts:10)在 import 期即崩,
//    既有 ai-chat-stream-tools.test.ts 亦同样崩(已复现,非本次改动引入)。本文件不消费
//    shared 主入口的任何具名导出,用文件级 mock 隔离该崩溃:不改 vitest 配置、不碰 shared 文件。
vi.mock('@ihui/shared', () => ({
  toUserFriendlyMessage: vi.fn((e: unknown) => (e instanceof Error ? e.message : 'error')),
  redactSecrets: vi.fn((s: string) => s),
  redactUserHomePathLiterals: vi.fn((s: string) => s),
}))

const USER_TOKEN = 'Bearer user-token'

function mockUser() {
  mockVerifyAccessToken.mockResolvedValue({
    userId: '00000000-0000-4000-8000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-4000-8000-000000000002',
    roleId: 0,
  })
}

/** 上游首帧 data(纯 JSON chunk;网关会在其上注入 openTiming) */
const UPSTREAM_FIRST_FRAME = { type: 'chunk', content: '首帧正文' }
const UPSTREAM_SSE = [
  `data: ${JSON.stringify(UPSTREAM_FIRST_FRAME)}\n\n`,
  `data: ${JSON.stringify({ type: 'chunk', content: '第二帧' })}\n\n`,
  `data: ${JSON.stringify({ type: 'done' })}\n\n`,
].join('')

/** mock fetch:返回上述 SSE 流 */
function mockAIServiceSSE() {
  const originalFetch = globalThis.fetch
  globalThis.fetch = vi.fn().mockImplementation(() => {
    return Promise.resolve({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(UPSTREAM_SSE))
          controller.close()
        },
      }),
    })
  }) as unknown as typeof globalThis.fetch
  return () => {
    globalThis.fetch = originalFetch
  }
}

/** 注入一条 /chat/stream 请求,返回 SSE 帧列表(data: 行解析后的 JSON)与原始 body */
async function injectStream(server: ReturnType<typeof Fastify>) {
  const res = await server.inject({
    method: 'POST',
    url: '/api/ai/chat/stream',
    headers: { authorization: USER_TOKEN },
    body: { messages: [{ role: 'user', content: 'hi' }], model: 'gpt-4o' },
  })
  expect(res.statusCode, res.body).toBe(200)
  const dataFrames = res.body
    .split('\n')
    .filter((l: string) => l.startsWith('data: '))
    .map((l: string) => JSON.parse(l.slice('data: '.length)) as Record<string, unknown>)
  return { res, dataFrames }
}

/** 固定字段集(验收硬判据:字段集固定且 versioned) */
const OPEN_TIMING_KEYS = [
  'version',
  'prepareMs',
  'upstreamConnectMs',
  'firstByteMs',
  'storageReadMs',
  'coldStart',
]

describe('首帧耗时分段归因 openTiming(G-998168 票5,回传不落库 · 拍板⑥)', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(aiChatStreamRoutes, { prefix: '/api/ai' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  afterEach(() => {
    clockModeRef.current = 'real'
    vi.restoreAllMocks()
  })

  it('① 首帧出现 {version:1,...} 完整字段集,仅注入一次,正文透传不受影响', async () => {
    mockUser()
    __resetAiServiceStreamColdStartForTests()
    clockModeRef.current = 'real'
    const restore = mockAIServiceSSE()
    const before = elapsedClockStats()
    try {
      const { dataFrames } = await injectStream(server)
      // 首帧:上游首帧 + 且仅 + openTiming 一个新字段(纯透传判据见测试③)
      const first = dataFrames[0]!
      expect(first.type).toBe('chunk')
      expect(first.content).toBe(UPSTREAM_FIRST_FRAME.content)
      const ot = first.openTiming as Record<string, unknown> | undefined
      expect(ot).toBeDefined()
      // 字段集固定:六个字段一个不少、一个不多
      expect(Object.keys(ot!).sort()).toEqual([...OPEN_TIMING_KEYS].sort())
      expect(ot!.version).toBe(1)
      for (const key of ['prepareMs', 'upstreamConnectMs', 'firstByteMs', 'storageReadMs']) {
        const v = ot![key]
        expect(v === null || (typeof v === 'number' && Number.isInteger(v))).toBe(true)
      }
      // 进程首连(cold-start 复位后第一次)⇒ 冷启
      expect(ot!.coldStart).toBe(true)
      // 仅首帧携带:第二帧 / done 帧不重复注入
      expect(dataFrames[1]!.openTiming).toBeUndefined()
      expect(dataFrames[2]!.openTiming).toBeUndefined()
      expect(dataFrames[2]!.type).toBe('done')
      // 计时走 elapsed-ms 出口:真实时钟 ⇒ 4 段全部可信,计数器同步增长
      const after = elapsedClockStats()
      expect(after.total - before.total).toBe(4) // prepare + storage + connect + firstByte
      expect(after.untrustworthy - before.untrustworthy).toBe(0)
      expect(after.negativeDelta - before.negativeDelta).toBe(0)
    } finally {
      restore()
    }
  })

  it('② 时钟回退(负差值)⇒ 各段为 null 而非夹成 0,且 elapsedClockStats.negativeDelta 同步 +4', async () => {
    mockUser()
    __resetAiServiceStreamColdStartForTests()
    clockModeRef.current = 'negative'
    const restore = mockAIServiceSSE()
    const before = elapsedClockStats()
    try {
      const { dataFrames } = await injectStream(server)
      const ot = dataFrames[0]!.openTiming as Record<string, unknown> | undefined
      expect(ot).toBeDefined()
      expect(ot!.version).toBe(1)
      // **为负 ⇒ null,而不是 Math.max(0,…) 夹成 0**:null 是"测量不可信/缺席"语义,
      // 夹成 0 会把"这段测量不可信"谎报成"这段零耗时"(肯定结论)
      for (const key of ['prepareMs', 'upstreamConnectMs', 'firstByteMs', 'storageReadMs']) {
        expect(ot![key]).toBe(null)
      }
      expect(typeof ot!.coldStart).toBe('boolean')
      // 不可信样本计入 elapsedClockStats(观测面可回答"标了几条"):4 段全标
      const after = elapsedClockStats()
      expect(after.total - before.total).toBe(4)
      expect(after.negativeDelta - before.negativeDelta).toBe(4)
      expect(after.untrustworthy - before.untrustworthy).toBe(4)
      // 正文透传不受分段 null 影响
      expect(dataFrames[0]!.content).toBe(UPSTREAM_FIRST_FRAME.content)
    } finally {
      restore()
    }
  })

  it('③ 纯透传不落库:除首帧 openTiming 外逐字段等同上游,全程零 DB 写入', async () => {
    mockUser()
    __resetAiServiceStreamColdStartForTests()
    clockModeRef.current = 'real'
    const restore = mockAIServiceSSE()
    try {
      const { dataFrames } = await injectStream(server)
      // 首帧 = 上游首帧 + openTiming(仅此一个新增 key);其余帧逐字节等同上游
      const first = dataFrames[0]!
      expect(Object.keys(first).sort()).toEqual(['content', 'openTiming', 'type'])
      expect(first.type).toBe(UPSTREAM_FIRST_FRAME.type)
      expect(first.content).toBe(UPSTREAM_FIRST_FRAME.content)
      expect(dataFrames[1]!).toEqual({ type: 'chunk', content: '第二帧' })
      expect(dataFrames[2]!).toEqual({ type: 'done' })
      // 不落库(拍板⑥):/chat/stream 全流程零持久化调用 —— 网关侧不写消息表、
      // 不写归档、不写会话元数据;分段计时只回传、只进内存观测面(elapsedClockStats)
      expect(createMessage).not.toHaveBeenCalled()
      expect(replaceMessages).not.toHaveBeenCalled()
      expect(patchConversationMetadata).not.toHaveBeenCalled()
      expect(mockPersistMessageArchive).not.toHaveBeenCalled()
      expect(mockRecordAiCost).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
