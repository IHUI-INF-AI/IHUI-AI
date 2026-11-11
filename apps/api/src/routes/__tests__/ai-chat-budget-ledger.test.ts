// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 批次 3(2026-11-06):请求级预算硬停止(429)落一条 chat_budget_stops。
 *
 * 只挂 ai-chat-stream 路由,直接命中 checkTokenBudget 的 block 分支:
 *  - 响应契约不破坏:errorCode 仍是 BUDGET_EXHAUSTED,percent/usedTokens/limitTokens/resetAt 原样;
 *  - 增量 reasonCode='daily_token_limit' 说明判据(判定式只有 token 维度);
 *  - 账本写入是 fire-and-forget,即使 store 抛错 429 也照常返回。
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const mocks = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  findConversationById: vi.fn(),
  guardModelAdmission: vi.fn(),
  recordBudgetStop: vi.fn(),
  recordContextLedger: vi.fn(),
  recordCompactionBoundary: vi.fn(),
}))

vi.mock('../../config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://127.0.0.1:5399/test',
    REDIS_URL: 'redis://127.0.0.1:6399',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

vi.mock('@ihui/auth', () => ({ verifyAccessToken: vi.fn() }))

vi.mock('../../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn(),
  },
}))

vi.mock('../../db/chat-queries.js', () => ({
  bindConversationWorkspace: vi.fn(),
  createMessage: vi.fn(),
  findConversationById: mocks.findConversationById,
  patchConversationMetadata: vi.fn(),
  replaceMessages: vi.fn(),
  setConversationAdditionalDirectories: vi.fn(),
}))

vi.mock('../../plugins/auth.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  checkAuth: mocks.checkAuth,
}))

vi.mock('../../services/org-policy-service.js', () => ({
  guardModelAdmission: mocks.guardModelAdmission,
}))

vi.mock('../../services/chat-ledger-store.js', () => ({
  recordBudgetStop: mocks.recordBudgetStop,
  recordContextLedger: mocks.recordContextLedger,
  recordCompactionBoundary: mocks.recordCompactionBoundary,
}))

import { aiChatStreamRoutes } from '../ai-chat-stream.js'

const USER = 'aaaaaaaa-1111-4111-8111-111111111111'
const CONV = 'cccccccc-3333-4333-8333-333333333333'
const MSG = 'eeeeeeee-5555-4555-8555-555555555555'

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  app.decorateRequest('userId', '')
  // ai-cost 装饰器:checkTokenBudget 只读 getUserBudgetUsage。
  ;(app as unknown as { decorate: (name: string, value: unknown) => void }).decorate('aiCost', {
    getUserBudgetUsage: vi
      .fn()
      .mockResolvedValue({ usedTokens: 100, limitTokens: 100, tier: 'free' }),
  })
  await app.register(aiChatStreamRoutes, { prefix: '/api/ai' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  mocks.checkAuth.mockReset().mockImplementation(async (request: { userId?: string }) => {
    request.userId = USER
    return true
  })
  // F-03(2026-11-08):会话归属先于预算闸门,桩成"存在且属于当前用户"
  mocks.findConversationById.mockReset().mockResolvedValue({ id: CONV, userId: USER })
  mocks.guardModelAdmission.mockReset().mockResolvedValue(null)
  mocks.recordBudgetStop.mockReset().mockResolvedValue(true)
  mocks.recordContextLedger.mockReset().mockResolvedValue(true)
  mocks.recordCompactionBoundary.mockReset().mockResolvedValue(true)
})

describe('POST /api/ai/chat/stream 预算 429', () => {
  it('block 时落一条 daily_token_limit 的 stopped 证据,响应契约不变', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/chat/stream',
      headers: { authorization: 'Bearer mock-user-token' },
      payload: {
        messages: [{ role: 'user', content: 'hi' }],
        model: 'gpt-4o-mini',
        metadata: { conversationId: CONV, messageId: MSG },
      },
    })

    expect(res.statusCode).toBe(429)
    const body = res.json()
    expect(body.errorCode).toBe('BUDGET_EXHAUSTED')
    expect(body.percent).toBe(100)
    expect(body.usedTokens).toBe(100)
    expect(body.limitTokens).toBe(100)
    expect(body.reasonCode).toBe('daily_token_limit')
    expect(res.headers['retry-after']).toBe('60')

    expect(mocks.recordBudgetStop).toHaveBeenCalledTimes(1)
    expect(mocks.recordBudgetStop).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER,
        conversationId: CONV,
        messageId: MSG,
        level: 'stopped',
        reasonCode: 'daily_token_limit',
        scope: 'daily',
        usedTokens: 100,
        limitTokens: 100,
        usagePercent: 100,
        remainingTokens: 0,
      }),
      expect.anything(),
    )
    expect(mocks.guardModelAdmission).toHaveBeenCalled()
  })

  it('账本写失败(store 返回 false)不影响 429 返回', async () => {
    mocks.recordBudgetStop.mockReset().mockResolvedValue(false)
    const res = await app.inject({
      method: 'POST',
      url: '/api/ai/chat/stream',
      headers: { authorization: 'Bearer mock-user-token' },
      payload: {
        messages: [{ role: 'user', content: 'hi' }],
        model: 'gpt-4o-mini',
        metadata: { conversationId: CONV, messageId: MSG },
      },
    })
    expect(res.statusCode).toBe(429)
    expect(res.json().errorCode).toBe('BUDGET_EXHAUSTED')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
