import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const { mockAuthenticate, mockFetch } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockFetch: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

vi.stubGlobal('fetch', mockFetch)

function buildSseResponse(events: Array<Record<string, unknown>>): Response {
  const body = events.map((ev) => `event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`).join('')
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  })
}

import { frontendStubOtherRoutes } from '../src/routes/frontend-stub-other-routes.js'

const USER_ID = '00000000-0000-0000-0000-000000000001'
const PREFIX = '/api'

function mockAuthed(userId: string = USER_ID) {
  mockAuthenticate.mockImplementation(
    async (request: { userId?: string; jwtPayload?: unknown }) => {
      request.userId = userId
      request.jwtPayload = { userId, roleId: 0 }
    },
  )
}

function mockUnauthed() {
  const err = new Error('Authentication required')
  ;(err as Error & { statusCode: number }).statusCode = 401
  mockAuthenticate.mockRejectedValue(err)
}

describe('llm-stream route — /api/llm/complete/stream', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.setErrorHandler((err, _request, reply) => {
      const statusCode =
        err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
      reply.status(statusCode).send({
        code: statusCode,
        message: statusCode >= 500 ? '服务器错误' : err.message,
      })
    })
    await server.register(frontendStubOtherRoutes, { prefix: PREFIX })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    mockAuthenticate.mockReset()
    mockFetch.mockReset()
  })

  it('未登录 POST /llm/complete/stream 返回 401', async () => {
    mockUnauthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/llm/complete/stream`,
      payload: { messages: [{ role: 'user', content: 'hi' }] },
    })
    expect(res.statusCode).toBe(401)
  })

  it('缺 messages → 400 (Zod 校验失败)', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/llm/complete/stream`,
      payload: { model: 'gpt-4o-mini' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('messages 为空数组 → 400', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/llm/complete/stream`,
      payload: { messages: [] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('AI-service 返回 SSE 成功流 → 200 + text/event-stream + 透传 chunk/done', async () => {
    mockAuthed()
    mockFetch.mockResolvedValue(
      buildSseResponse([
        { type: 'chunk', content: '你好,' },
        { type: 'chunk', content: '世界' },
        {
          type: 'done',
          model: 'gpt-4o-mini',
          usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
          stub: false,
        },
      ]),
    )
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/llm/complete/stream`,
      payload: { messages: [{ role: 'user', content: '你好' }] },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/event-stream/)
    expect(res.body).toContain('event: chunk')
    expect(res.body).toContain('event: done')
    expect(res.body).toContain('你好,')
    expect(res.body).toContain('世界')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('AI-service 返回 500 → 透传 error 事件', async () => {
    mockAuthed()
    mockFetch.mockResolvedValue(new Response('upstream broken', { status: 500 }))
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/llm/complete/stream`,
      payload: { messages: [{ role: 'user', content: 'hi' }] },
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('"error"')
    expect(res.body).toContain('upstream 500')
  })
})
