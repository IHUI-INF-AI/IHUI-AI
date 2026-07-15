import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { aiGcContent } from '@ihui/database'
import { shareContentRoutes } from '../src/routes/share-content.js'

async function createContent(data: {
  userUuid: string
  agentId?: string
  gcType?: string
  content?: string
  status?: number
}) {
  const [row] = await db
    .insert(aiGcContent)
    .values({
      userUuid: data.userUuid,
      agentId: data.agentId,
      gcType: data.gcType ?? 'text',
      content: data.content,
      status: data.status ?? 1,
    })
    .returning()
  return row
}

describe('share-content-routes — 路由层真实 DB 集成测试', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(shareContentRoutes, { prefix: '/api/share' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM ai_gc_content`)
  })

  it('GET /api/share/content/:code — 非法 code (空/dist/index.html 等) 返回 400', async () => {
    const invalidCodes = ['', 'dist', 'index.html', 'index', 'share', 'error']
    for (const code of invalidCodes) {
      const res = await server.inject({
        method: 'GET',
        url: `/api/share/content/${code}`,
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.code).toBe(400)
      expect(body.message).toBe('分享链接无效')
    }
  })

  it('GET /api/share/content/:code — 不存在的合法 UUID 返回 404', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/share/content/00000000-0000-0000-0000-000000000000',
    })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.code).toBe(404)
    expect(body.message).toBe('分享内容不存在或已下线')
  })

  it('GET /api/share/content/:code — status=0 (已下线) 返回 404', async () => {
    const content = await createContent({
      userUuid: 'user-1',
      content: '已下线内容',
      status: 0,
    })
    const res = await server.inject({
      method: 'GET',
      url: `/api/share/content/${content.id}`,
    })
    expect(res.statusCode).toBe(404)
  })

  it('GET /api/share/content/:code — 正常 JSON content 返回 question + answer', async () => {
    const payload = JSON.stringify({
      question: '什么是 AI?',
      answer: { text: '人工智能是计算机科学的分支' },
    })
    const content = await createContent({
      userUuid: 'user-1',
      agentId: 'agent-1',
      gcType: 'text',
      content: payload,
    })
    const res = await server.inject({
      method: 'GET',
      url: `/api/share/content/${content.id}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.code).toBe(content.id)
    expect(body.data.gcType).toBe('text')
    expect(body.data.question).toBe('什么是 AI?')
    expect(body.data.answer).toEqual({ text: '人工智能是计算机科学的分支' })
    expect(body.data.agentId).toBe('agent-1')
    expect(body.data.userUuid).toBe('user-1')
    expect(body.data.modelName).toBe('')
    expect(body.data.modelIcon).toBe('')
  })

  it('GET /api/share/content/:code — 非 JSON content 降级为 { text: content }', async () => {
    const content = await createContent({
      userUuid: 'user-1',
      content: '这是纯文本内容,不是 JSON',
    })
    const res = await server.inject({
      method: 'GET',
      url: `/api/share/content/${content.id}`,
    })
    const body = res.json()
    expect(body.data.question).toBe('')
    expect(body.data.answer).toEqual({ text: '这是纯文本内容,不是 JSON' })
    expect(body.data.content).toBe('这是纯文本内容,不是 JSON')
  })

  it('GET /api/share/content/:code — content 为 null 时返回空字符串', async () => {
    const content = await createContent({
      userUuid: 'user-1',
      content: null,
    })
    const res = await server.inject({
      method: 'GET',
      url: `/api/share/content/${content.id}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.question).toBe('')
    expect(body.data.answer).toEqual({ text: '' })
    expect(body.data.content).toBeNull()
  })

  it('GET /api/share/content/:code — createdAt 字段为 ISO 字符串', async () => {
    const content = await createContent({
      userUuid: 'user-1',
      content: '内容',
    })
    const res = await server.inject({
      method: 'GET',
      url: `/api/share/content/${content.id}`,
    })
    const body = res.json()
    expect(body.data.createdAt).toBe(content.createdAt.toISOString())
    expect(() => new Date(body.data.createdAt).toISOString()).not.toThrow()
  })

  it('GET /api/share/content/:code — 不同 gcType (image/audio/video) 均可获取', async () => {
    for (const gcType of ['image', 'audio', 'video']) {
      const content = await createContent({
        userUuid: 'user-1',
        gcType,
        content: JSON.stringify({ answer: { url: `https://example.com/${gcType}` } }),
      })
      const res = await server.inject({
        method: 'GET',
        url: `/api/share/content/${content.id}`,
      })
      const body = res.json()
      expect(body.data.gcType).toBe(gcType)
      expect(body.data.answer).toEqual({ url: `https://example.com/${gcType}` })
    }
  })

  it('GET /api/share/content/:code — 响应格式符合 { code, message, data } 规范', async () => {
    const content = await createContent({
      userUuid: 'user-1',
      content: '内容',
    })
    const res = await server.inject({
      method: 'GET',
      url: `/api/share/content/${content.id}`,
    })
    const body = res.json()
    expect(body).toHaveProperty('code')
    expect(body).toHaveProperty('message')
    expect(body).toHaveProperty('data')
    expect(body.code).toBe(0)
    expect(body.message).toBe('success')
    expect(body.data).toHaveProperty('code')
    expect(body.data).toHaveProperty('gcType')
    expect(body.data).toHaveProperty('question')
    expect(body.data).toHaveProperty('answer')
    expect(body.data).toHaveProperty('content')
    expect(body.data).toHaveProperty('createdAt')
  })
})
