// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// F-54 回归:coze_chat_history 无归属列 ⇒ 端点安全下线。
// mock 查询层保留旧行为(按 botId+conversationId 返回他人全文),确保旧 handler 会 200 泄露。
const mockFindCozeChatHistory = vi.hoisted(() =>
  vi.fn(async () => ({
    list: [{ id: 'm1', role: 'user', content: '他人会话机密内容' }],
    total: 1,
  })),
)
vi.mock('../../db/coze-chat-queries.js', () => ({
  findCozeChatHistory: mockFindCozeChatHistory,
}))
vi.mock('../../db/my-member-queries.js', () => ({
  findMyMember: vi.fn(async () => null),
}))

import memberRoutes from '../user/member-routes.js'

describe('F-54 Coze 聊天历史越权', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.addHook('onRequest', async (request) => {
      request.userId = 'user-a'
    })
    await app.register(memberRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('任意用户请求他人 conversationId 均返回 404,且不再触达历史查询', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/coze/chat/history/bot-1/conversation-of-user-b',
    })
    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe(404)
    expect(mockFindCozeChatHistory).not.toHaveBeenCalled()
  })

  it('即使查询层能返回数据,端点也不会泄露给任何登录用户', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/coze/chat/history/bot-1/conversation-mine',
    })
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain('他人会话机密内容')
  })
})
