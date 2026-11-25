// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 问数回归：语料必须来自库、引用必须可追溯、模型挂了要能降级。
 * 这里把 db 与 ai-service 都替换成桩，只校验编排逻辑本身。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => ({ select: vi.fn(), systemFetch: vi.fn() }))

vi.mock('../../db/index.js', () => ({ db: {}, dbRead: { select: hoisted.select } }))
vi.mock('../../utils/ai-service-fetch.js', () => ({
  aiServiceSystemFetch: hoisted.systemFetch,
}))
vi.mock('../wechat-hub/guards', () => ({
  assertAccountForUser: async () => ({ id: 'acc-1', label: '测试号' }),
}))

import { askMessages } from '../wechat-hub/ask'

const contacts = [{ displayName: '张三' }]
const messages = [
  {
    id: 'm1',
    conversationId: 'conv-1',
    direction: 'inbound',
    content: '预算这块下周再确认一下',
    senderName: '张三',
    senderId: 'wxid_a',
    sentAt: new Date('2026-11-24T02:00:00Z'),
  },
  {
    id: 'm2',
    conversationId: 'conv-1',
    direction: 'outbound',
    content: '好，我先把方案整理出来',
    senderName: null,
    senderId: null,
    sentAt: new Date('2026-11-24T02:05:00Z'),
  },
]
const conversations = [{ id: 'conv-1', title: '项目群' }]

function chain(result: unknown) {
  const node = {
    from: () => node,
    where: () => node,
    orderBy: () => node,
    limit: () => node,
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return node
}

function primeHappyPath() {
  hoisted.select
    .mockReturnValueOnce(chain(contacts))
    .mockReturnValueOnce(chain(messages))
    .mockReturnValueOnce(chain(conversations))
}

beforeEach(() => {
  hoisted.select.mockReset()
  hoisted.systemFetch.mockReset()
})

describe('askMessages', () => {
  it('模型成功：答案来自模型，引用指向检索到的消息', async () => {
    primeHappyPath()
    hoisted.systemFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '结论：预算需要下周确认 [1]' } }] }),
    })

    const result = await askMessages('u1', 'acc-1', { question: '张三说预算什么时候确认' })

    expect(result.generatedBy).toBe('llm')
    expect(result.answer).toContain('预算需要下周确认')
    expect(result.citations).toHaveLength(2)
    expect(result.citations[0]).toMatchObject({
      messageId: 'm1',
      conversationTitle: '项目群',
      senderName: '张三',
    })
    expect(result.plan.senderName).toBe('张三')
    // 送给模型的 user prompt 必须包含真实消息原文
    const body = JSON.parse(String(hoisted.systemFetch.mock.calls[0]?.[1]?.body)) as {
      messages: Array<{ role: string; content: string }>
    }
    expect(body.messages[1]?.content).toContain('预算这块下周再确认一下')
    expect(body.messages[0]?.content).toContain('只能依据给定消息回答')
  })

  it('模型失败：降级为本地检索摘要，仍给引用', async () => {
    primeHappyPath()
    hoisted.systemFetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })

    const result = await askMessages('u1', 'acc-1', { question: '预算怎么定的' })

    expect(result.generatedBy).toBe('local')
    expect(result.answer).toContain('本地检索结果')
    expect(result.answer).toContain('张三 1 条')
    expect(result.citations).toHaveLength(2)
  })

  it('空问题 400，超长问题 400', async () => {
    await expect(askMessages('u1', 'acc-1', { question: '  ' })).rejects.toMatchObject({
      errorCode: 'WECHAT_ASK_EMPTY',
    })
    await expect(askMessages('u1', 'acc-1', { question: 'x'.repeat(501) })).rejects.toMatchObject({
      errorCode: 'WECHAT_ASK_TOO_LONG',
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
