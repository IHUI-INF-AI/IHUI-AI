// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 L7648:非会话 401 被当成会话死亡 —— 上游凭据类失败的出栈映射。
 *
 * 契约(2026-10-25 代裁落地):
 *  1. 上游(ai-service/LiteLLM/第三方 LLM)回的 401/403 是"上游凭据错误",出栈映射
 *     502 + UPSTREAM_AUTH_FAILED,不得以 401 出栈(api-client 收 401 即弹"重新登录");
 *  2. api 自己的鉴权结论(缺 token/账号注销/账号不存在)保持 401;
 *  3. agent-extended preHandler 的兜底 catch:没标 statusCode 的异常 → 502(不再盖 401),
 *     AppError 的 errorCode 随响应体透传。
 *
 * Mock 策略(参照 agent-extended.test.ts 与 ai-chat-stream-tools.test.ts):
 *  - auth 模块整体 mock(authenticate/requireActiveUser 由用例注入行为);
 *  - chat/steer 端到端用 globalThis.fetch 返回上游 401。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'
import type { FastifyReply } from 'fastify'

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

const { mockAuthenticate, mockRequireActiveUser } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockRequireActiveUser: vi.fn(),
}))

// auth 模块整体 mock:agent-extended 用 authenticate/requireActiveUser,
// ai-chat-stream 用 checkAuth(工厂缺导出会让具名 import 直接抛错,必须补齐)。
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
  requireActiveUser: mockRequireActiveUser,
  checkAuth: vi.fn(async () => true),
}))

vi.mock('../src/db/rbac-queries.js', () => ({
  checkPermission: vi.fn().mockResolvedValue(false),
}))

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

vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {}, dbClient: {} }))

const { mockRecordAiCost } = vi.hoisted(() => ({ mockRecordAiCost: vi.fn() }))
vi.mock('../src/plugins/ai-cost.js', () => ({ recordAiCost: mockRecordAiCost }))

import { mapUpstreamOutbound, UPSTREAM_AUTH_FAILED_MESSAGE } from '../src/errors/upstream-status.js'
import { ErrorCode } from '../src/errors/codes.js'
import { error } from '../src/utils/response.js'
import { AppError } from '../src/errors/AppError.js'
import agentExtendedRoutes from '../src/routes/agent-extended.js'
import { aiChatStreamRoutes } from '../src/routes/ai-chat-stream.js'
import { createSession, findSession } from '../src/utils/sse-stream-registry.js'

const AGENT_PREFIX = '/api/agent-extended'

async function buildAgentApp() {
  const server = Fastify({ logger: false })
  await server.register(agentExtendedRoutes, { prefix: AGENT_PREFIX })
  await server.ready()
  return server
}

function mockRaw(): FastifyReply['raw'] {
  return {
    write: () => true,
    end: () => {},
    get ended() {
      return false
    },
  } as unknown as FastifyReply['raw']
}

beforeEach(() => {
  mockAuthenticate.mockImplementation(() => Promise.resolve({ userId: 'u-1', roleId: 0 }))
  mockRequireActiveUser.mockReset()
})

describe('mapUpstreamOutbound(L7648 出栈映射判据)', () => {
  it('上游 401 → 502 + remapped(不得以会话死亡出栈)', () => {
    const out = mapUpstreamOutbound(401)
    expect(out.status).toBe(ErrorCode.UPSTREAM_AUTH_FAILED.status)
    expect(out.status).toBe(502)
    expect(out.status).not.toBe(401)
    expect(out.remapped).toBe(true)
  })

  it('上游 403 → 502 + remapped(上游侧授权不足同族)', () => {
    const out = mapUpstreamOutbound(403)
    expect(out.status).toBe(502)
    expect(out.remapped).toBe(true)
  })

  it('上游业务语义状态保留原样(422 校验/404 不存在/429 限流)', () => {
    expect(mapUpstreamOutbound(422)).toEqual({ status: 422, remapped: false })
    expect(mapUpstreamOutbound(404)).toEqual({ status: 404, remapped: false })
    expect(mapUpstreamOutbound(429)).toEqual({ status: 429, remapped: false })
  })

  it('失败区间外(异常折叠值)兜底 502', () => {
    expect(mapUpstreamOutbound(600).status).toBe(502)
    expect(mapUpstreamOutbound(0).status).toBe(502)
  })
})

describe('error() errorCode 形状(L7648:手工 catch 出栈不剥错误码)', () => {
  it('两参调用不带 errorCode 键(形状逐字节不变)', () => {
    expect(error(401, 'x')).toEqual({ code: 401, message: 'x' })
  })

  it('三参调用带 errorCode 键', () => {
    expect(error(502, 'x', ErrorCode.UPSTREAM_AUTH_FAILED.code)).toEqual({
      code: 502,
      message: 'x',
      errorCode: 'UPSTREAM_AUTH_FAILED',
    })
  })
})

describe('agent-extended preHandler catch(L7648 票面点名位置)', () => {
  it('对照:requireActiveUser 的真会话结论(账号已注销)仍以 401 出栈', async () => {
    const err = new Error('账号已注销') as Error & { statusCode: number }
    err.statusCode = 401
    mockRequireActiveUser.mockRejectedValueOnce(err)
    const server = await buildAgentApp()
    const res = await server.inject({ method: 'GET', url: `${AGENT_PREFIX}/need-task/list` })
    expect(res.statusCode).toBe(401)
    expect(res.json()).toEqual({ code: 401, message: '账号已注销' })
  })

  it('AppError(502) 透传状态码并保留 errorCode(ACCOUNT_STATE_CHECK_FAILED)', async () => {
    mockRequireActiveUser.mockRejectedValueOnce(
      new AppError('操作失败,请稍后重试', 502, 'ACCOUNT_STATE_CHECK_FAILED'),
    )
    const server = await buildAgentApp()
    const res = await server.inject({ method: 'GET', url: `${AGENT_PREFIX}/need-task/list` })
    expect(res.statusCode).toBe(502)
    expect(res.json()).toMatchObject({
      code: 502,
      errorCode: 'ACCOUNT_STATE_CHECK_FAILED',
    })
  })

  it('核心:没标 statusCode 的无名异常不再被盖成 401(改判 502)', async () => {
    mockRequireActiveUser.mockRejectedValueOnce(new Error('驱动炸了: ECONNREFUSED'))
    const server = await buildAgentApp()
    const res = await server.inject({ method: 'GET', url: `${AGENT_PREFIX}/need-task/list` })
    expect(res.statusCode).toBe(502)
    expect(res.statusCode).not.toBe(401)
    expect(res.json()).toMatchObject({ code: 502 })
  })
})

describe('chat/steer 端到端:上游 401 ⇒ 502 + UPSTREAM_AUTH_FAILED(非 401)', () => {
  it('上游(ai-service→LiteLLM→第三方)凭据失效映射为 502', async () => {
    const replayKey = 'conv-l7648:msg-l7648'
    createSession(mockRaw(), new AbortController(), replayKey, 'upstream-session-1')
    expect(findSession(replayKey)).toBeDefined()

    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ code: 401, message: 'Unauthorized' }),
    }) as unknown as typeof globalThis.fetch

    try {
      const server = Fastify({ logger: false })
      await server.register(aiChatStreamRoutes, { prefix: '/api/ai' })
      await server.ready()
      const res = await server.inject({
        method: 'POST',
        url: '/api/ai/chat/steer',
        payload: { conversationId: 'conv-l7648', messageId: 'msg-l7648', text: '换个说法' },
      })
      expect(res.statusCode).toBe(502)
      expect(res.statusCode).not.toBe(401)
      const body = res.json() as { code: number; message: string; errorCode?: string }
      expect(body.errorCode).toBe('UPSTREAM_AUTH_FAILED')
      expect(body.message).toBe(UPSTREAM_AUTH_FAILED_MESSAGE)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
