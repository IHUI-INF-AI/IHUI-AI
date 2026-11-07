// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 批次 3(2026-11-06):三个账本查询端点。
 *
 * 验收口径:
 *  - 归属:他人会话 / 不存在 / 非 UUID 一律 404,且**不调用查询函数**(副作用未发生);
 *  - limit:缺省 20/10/20,上限 50 截断,非法值回落默认;
 *  - 字段:响应 items 全 camelCase,percentage / usagePercent 是 number(不是 numeric 字符串),
 *    createdAt 是 ISO 8601。
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const mocks = vi.hoisted(() => ({
  listContextLedgers: vi.fn(),
  listBudgetStops: vi.fn(),
  listCompactionBoundaries: vi.fn(),
  findConversationById: vi.fn(),
}))

vi.mock('../../services/chat-ledger-store.js', () => ({
  listContextLedgers: mocks.listContextLedgers,
  listBudgetStops: mocks.listBudgetStops,
  listCompactionBoundaries: mocks.listCompactionBoundaries,
}))

vi.mock('../../db/chat-queries.js', () => ({
  findConversationById: mocks.findConversationById,
}))

import chatLedgerRoutes from '../user/chat-ledger-routes.js'

const USER_A = 'aaaaaaaa-1111-4111-8111-111111111111'
const USER_B = 'bbbbbbbb-2222-4222-8222-222222222222'
const CONV = 'cccccccc-3333-4333-8333-333333333333'
const OTHER_CONV = 'dddddddd-4444-4444-8444-444444444444'
const MSG = 'eeeeeeee-5555-4555-8555-555555555555'

const CREATED_AT = new Date('2026-11-06T02:00:00.000Z')

const LEDGER_ROW = {
  id: 'ffffffff-6666-4666-8666-666666666666',
  userId: USER_A,
  conversationId: CONV,
  messageId: MSG,
  turnIndex: 2,
  model: 'gpt-4o-mini',
  contextLimit: 10_000,
  usedTokens: 4500,
  percentage: '45.0',
  categories: [{ category: 'system_prompt', tokens: 1000, percent: 10 }],
  tokenizer: 'heuristic',
  compacted: false,
  createdAt: CREATED_AT,
}

const BUDGET_ROW = {
  id: '99999999-7777-4777-8777-777777777777',
  userId: USER_A,
  conversationId: CONV,
  messageId: MSG,
  level: 'stopped',
  reasonCode: 'daily_token_limit',
  scope: 'daily',
  pillar: null,
  usedTokens: 1200,
  limitTokens: 1000,
  usagePercent: '120.0',
  remainingTokens: 0,
  stoppedAtIteration: null,
  createdAt: CREATED_AT,
}

const BOUNDARY_ROW = {
  id: '88888888-8888-4888-8888-888888888888',
  conversationId: CONV,
  messageId: MSG,
  trigger: 'llm',
  tokensBefore: 8800,
  tokensAfter: 3200,
  messagesSummarized: 12,
  durationMs: 480,
  preservedSegment: { head: null, anchor: null, tail: null },
  removedRange: { startIndex: 1, endIndex: 16 },
  createdAt: CREATED_AT,
}

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  app.decorateRequest('userId', '')
  app.addHook('preHandler', async (request) => {
    request.userId = USER_A
  })
  await app.register(chatLedgerRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  mocks.listContextLedgers.mockReset().mockResolvedValue([])
  mocks.listBudgetStops.mockReset().mockResolvedValue([])
  mocks.listCompactionBoundaries.mockReset().mockResolvedValue([])
  mocks.findConversationById.mockReset()
})

describe('GET /ai/chat/conversations/:id/context-ledger', () => {
  it('属主可读,字段 camelCase 且 percentage 为 number', async () => {
    mocks.findConversationById.mockResolvedValue({ id: CONV, userId: USER_A })
    mocks.listContextLedgers.mockResolvedValue([LEDGER_ROW])

    const res = await app.inject({
      method: 'GET',
      url: `/api/ai/chat/conversations/${CONV}/context-ledger`,
    })
    expect(res.statusCode).toBe(200)
    const item = res.json().data.items[0]
    expect(item).toMatchObject({
      id: LEDGER_ROW.id,
      conversationId: CONV,
      messageId: MSG,
      turnIndex: 2,
      model: 'gpt-4o-mini',
      contextLimit: 10_000,
      usedTokens: 4500,
      percentage: 45,
      tokenizer: 'heuristic',
      compacted: false,
      createdAt: '2026-11-06T02:00:00.000Z',
    })
    expect(Array.isArray(item.categories)).toBe(true)
    expect(typeof item.percentage).toBe('number')
    expect(mocks.listContextLedgers).toHaveBeenCalledWith(CONV, 20)
  })

  it('他人会话返回 404 且不触发查询', async () => {
    mocks.findConversationById.mockResolvedValue({ id: CONV, userId: USER_B })
    const res = await app.inject({
      method: 'GET',
      url: `/api/ai/chat/conversations/${CONV}/context-ledger`,
    })
    expect(res.statusCode).toBe(404)
    expect(mocks.listContextLedgers).not.toHaveBeenCalled()
  })

  it('不存在与非 UUID 均为 404,且不泄露存在性', async () => {
    mocks.findConversationById.mockResolvedValue(undefined)
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/ai/chat/conversations/${OTHER_CONV}/context-ledger`,
        })
      ).statusCode,
    ).toBe(404)

    mocks.findConversationById.mockClear()
    const bad = await app.inject({
      method: 'GET',
      url: '/api/ai/chat/conversations/not-a-uuid/context-ledger',
    })
    expect(bad.statusCode).toBe(404)
    expect(mocks.findConversationById).not.toHaveBeenCalled()
  })

  it('limit 上限 50、非法值回落默认 20', async () => {
    mocks.findConversationById.mockResolvedValue({ id: CONV, userId: USER_A })

    await app.inject({
      method: 'GET',
      url: `/api/ai/chat/conversations/${CONV}/context-ledger?limit=999`,
    })
    expect(mocks.listContextLedgers).toHaveBeenLastCalledWith(CONV, 50)

    await app.inject({
      method: 'GET',
      url: `/api/ai/chat/conversations/${CONV}/context-ledger?limit=abc`,
    })
    expect(mocks.listContextLedgers).toHaveBeenLastCalledWith(CONV, 20)

    await app.inject({
      method: 'GET',
      url: `/api/ai/chat/conversations/${CONV}/context-ledger?limit=0`,
    })
    expect(mocks.listContextLedgers).toHaveBeenLastCalledWith(CONV, 20)
  })
})

describe('GET /ai/chat/conversations/:id/budget-stops', () => {
  it('默认 limit=10,usagePercent 转 number', async () => {
    mocks.findConversationById.mockResolvedValue({ id: CONV, userId: USER_A })
    mocks.listBudgetStops.mockResolvedValue([BUDGET_ROW])

    const res = await app.inject({
      method: 'GET',
      url: `/api/ai/chat/conversations/${CONV}/budget-stops`,
    })
    expect(res.statusCode).toBe(200)
    const item = res.json().data.items[0]
    expect(item).toMatchObject({
      level: 'stopped',
      reasonCode: 'daily_token_limit',
      scope: 'daily',
      usedTokens: 1200,
      limitTokens: 1000,
      usagePercent: 120,
      remainingTokens: 0,
      stoppedAtIteration: null,
      createdAt: '2026-11-06T02:00:00.000Z',
    })
    expect(typeof item.usagePercent).toBe('number')
    expect(mocks.listBudgetStops).toHaveBeenCalledWith(CONV, 10)
  })

  it('他人会话 404', async () => {
    mocks.findConversationById.mockResolvedValue({ id: CONV, userId: USER_B })
    expect(
      (await app.inject({ method: 'GET', url: `/api/ai/chat/conversations/${CONV}/budget-stops` }))
        .statusCode,
    ).toBe(404)
    expect(mocks.listBudgetStops).not.toHaveBeenCalled()
  })

  it('limit 截断到 50', async () => {
    mocks.findConversationById.mockResolvedValue({ id: CONV, userId: USER_A })
    await app.inject({
      method: 'GET',
      url: `/api/ai/chat/conversations/${CONV}/budget-stops?limit=80`,
    })
    expect(mocks.listBudgetStops).toHaveBeenCalledWith(CONV, 50)
  })
})

describe('GET /ai/chat/conversations/:id/compaction-boundaries', () => {
  it('默认 limit=20,边界字段透传', async () => {
    mocks.findConversationById.mockResolvedValue({ id: CONV, userId: USER_A })
    mocks.listCompactionBoundaries.mockResolvedValue([BOUNDARY_ROW])

    const res = await app.inject({
      method: 'GET',
      url: `/api/ai/chat/conversations/${CONV}/compaction-boundaries`,
    })
    expect(res.statusCode).toBe(200)
    const item = res.json().data.items[0]
    expect(item).toMatchObject({
      trigger: 'llm',
      tokensBefore: 8800,
      tokensAfter: 3200,
      messagesSummarized: 12,
      durationMs: 480,
      removedRange: { startIndex: 1, endIndex: 16 },
      createdAt: '2026-11-06T02:00:00.000Z',
    })
    expect(mocks.listCompactionBoundaries).toHaveBeenCalledWith(CONV, 20)
  })

  it('他人会话 404', async () => {
    mocks.findConversationById.mockResolvedValue({ id: CONV, userId: USER_B })
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/api/ai/chat/conversations/${CONV}/compaction-boundaries`,
        })
      ).statusCode,
    ).toBe(404)
    expect(mocks.listCompactionBoundaries).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
