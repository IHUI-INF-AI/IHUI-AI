// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 差距①(2026-10-30 立)网关侧两格:inputId 上行透传 + admission 帧下行透传。
 *
 * ① 请求侧:网关 body 构造是**字段白名单**(chatStreamSchema zod strip + streamToClient
 *    显式 JSON.stringify),inputId 不声明就被静默剥离 —— 与 workspaceContext/mode/
 *    permissionMode/sandboxMode 同型断链(每条都有"前端发了、界面看着正常、上游收不到"
 *    的先例)。本文件锁死:声明了、解构了、到达上游 body 同名键;不带时不注入 key。
 * ② 响应侧:上游 admission 帧(`event: admission` + data {type,inputId,disposition,...})
 *    的事件名**不在**网关命名帧配对白名单(usage|steer|fallback)里,走通用逐行透传路径;
 *    本文件证明它不被吞、不被改名(首帧只被有意注入 openTiming,additive 字段)。
 *
 * Mock 策略照抄 ai-chat-stream-tools.test.ts(同一网关路由、同一 global.fetch 捕获面)。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'

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
vi.mock('@ihui/types', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    repairMessages: (msgs: unknown[]) => ({ repaired: msgs, removed: 0 }),
  }
})
vi.mock('@ihui/context-compaction', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, compressContextIfNeeded: vi.fn() }
})
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
const { mockRecordAiCost } = vi.hoisted(() => ({ mockRecordAiCost: vi.fn() }))
vi.mock('../src/plugins/ai-cost.js', () => ({ recordAiCost: mockRecordAiCost }))

import { aiChatStreamRoutes } from '../src/routes/ai-chat-stream.js'

const USER_TOKEN = 'Bearer user-token'
const INPUT_ID = 'input-019cfe1234567890abcdef'

function mockUser() {
  mockVerifyAccessToken.mockResolvedValue({
    userId: '00000000-0000-4000-8000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-4000-8000-000000000002',
    roleId: 0,
  })
}

/** 上游 admission 帧载荷(send-admission.ts 帧形状:事件名 admission,data 顶层平铺) */
const ADMISSION_DATA = {
  type: 'admission',
  inputId: INPUT_ID,
  disposition: 'accepted',
  messageId: 'msg-admission-1',
}

/** mock ai-service SSE 流:admission(首帧)→ chunk → done */
const UPSTREAM_SSE = [
  `event: admission\ndata: ${JSON.stringify(ADMISSION_DATA)}\n\n`,
  `event: chunk\ndata: ${JSON.stringify({ type: 'chunk', content: '你好' })}\n\n`,
  `event: done\ndata: ${JSON.stringify({ type: 'done' })}\n\n`,
].join('')

function mockAIServiceSSE() {
  const capturedBodies: Record<string, unknown>[] = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
    const body = JSON.parse((init as RequestInit).body as string) as Record<string, unknown>
    capturedBodies.push(body)
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
  return {
    capturedBodies,
    restore: () => {
      globalThis.fetch = originalFetch
    },
  }
}

describe('差距① 网关侧:inputId 上行 + admission 帧下行(/chat/stream)', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(aiChatStreamRoutes, { prefix: '/api/ai' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  it('inputId 原样到达 ai-service 请求体(白名单已放行,不被 zod strip)', async () => {
    mockUser()
    const { capturedBodies, restore } = mockAIServiceSSE()
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai/chat/stream',
        headers: { authorization: USER_TOKEN },
        body: {
          messages: [{ role: 'user', content: 'hi' }],
          model: 'gpt-4o',
          inputId: INPUT_ID,
          metadata: { conversationId: 'conv-i1', messageId: 'msg-i1' },
        },
      })
      expect(res.statusCode).toBe(200)
      expect(capturedBodies).toHaveLength(1)
      expect(capturedBodies[0]!.inputId).toBe(INPUT_ID)
    } finally {
      restore()
    }
  })

  it('不带 inputId 时不注入 key(undefined 经 JSON.stringify 省略,旧客户端零变化)', async () => {
    mockUser()
    const { capturedBodies, restore } = mockAIServiceSSE()
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai/chat/stream',
        headers: { authorization: USER_TOKEN },
        body: {
          messages: [{ role: 'user', content: 'hi' }],
          model: 'gpt-4o',
        },
      })
      expect(res.statusCode).toBe(200)
      expect(capturedBodies).toHaveLength(1)
      expect('inputId' in capturedBodies[0]!).toBe(false)
    } finally {
      restore()
    }
  })

  it('admission 帧不被网关吞掉:事件名与 data 字段原样到达客户端', async () => {
    mockUser()
    const { restore } = mockAIServiceSSE()
    try {
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai/chat/stream',
        headers: { authorization: USER_TOKEN },
        body: {
          messages: [{ role: 'user', content: 'hi' }],
          inputId: INPUT_ID,
          metadata: { conversationId: 'conv-i2', messageId: 'msg-i2' },
        },
      })
      expect(res.statusCode).toBe(200)
      // 事件名行原样透传(admission 不在 usage|steer|fallback 配对白名单里,走通用逐行路径)
      expect(res.body).toContain('event: admission')
      const dataLine = res.body
        .split('\n')
        .find((l) => l.startsWith('data:') && l.includes('"type":"admission"'))
      expect(dataLine, 'admission data 行必须到场(不许被帧级过滤吞掉)').toBeDefined()
      const frame = JSON.parse((dataLine as string).slice(5).trim()) as Record<string, unknown>
      // 契约字段逐字保留;首帧只允许被有意注入 openTiming(additive,见 G-998168 票5)
      expect(frame.type).toBe('admission')
      expect(frame.inputId).toBe(INPUT_ID)
      expect(frame.disposition).toBe('accepted')
      expect(frame.messageId).toBe('msg-admission-1')
      expect(Object.keys(frame).sort()).toEqual(
        [...Object.keys(ADMISSION_DATA), 'openTiming'].sort(),
      )
      // 主流不被 admission 帧截断:后续 chunk/done 同样到场
      expect(res.body).toContain('event: chunk')
      expect(res.body).toContain('event: done')
    } finally {
      restore()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
