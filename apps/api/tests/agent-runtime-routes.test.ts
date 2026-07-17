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

function buildSseResponse(events: Array<{ event: string; data: unknown }>): Response {
  const body = events
    .map((ev) => `event: ${ev.event}\ndata: ${JSON.stringify(ev.data)}\n\n`)
    .join('')
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

function createChainableMock() {
  const thenFn = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve)
  const make = (): Record<string, unknown> => {
    const proxy = new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        if (prop === 'then') return thenFn
        return vi.fn().mockReturnValue(make())
      },
    })
    return proxy
  }
  return make()
}

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => createChainableMock()),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoNothing: vi.fn() })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
    execute: vi.fn().mockResolvedValue([]),
  },
}))

import { agentRuntimeRoutes } from '../src/routes/agent-runtime.js'

const PREFIX = '/api/agent-runtime'
const USER_ID = '00000000-0000-0000-0000-000000000001'

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

describe('agent-runtime routes — /api/agent-runtime/*', () => {
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
    await server.register(agentRuntimeRoutes, { prefix: PREFIX })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    mockAuthenticate.mockReset()
    mockFetch.mockReset()
  })

  it('POST /execute 返回 200 + code 0 + sessionId/mode/received', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/execute`,
      payload: { message: '你好', mode: 'default' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.sessionId).toMatch(/^sess_/)
    expect(body.data.mode).toBe('default')
    expect(body.data.received).toBe('你好')
  })

  it('POST /execute body 缺 message → 400', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/execute`,
      payload: { mode: 'default' },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.code).toBe(400)
  })

  it('POST /execute/stream 上游 200 + 正常 SSE 流 → 透传 session/permission/done 事件', async () => {
    mockAuthed()
    mockFetch.mockResolvedValueOnce(
      buildSseResponse([
        { event: 'session', data: { sessionId: 'upstream-sess-1' } },
        { event: 'permission', data: { toolName: 'Read', dangerLevel: 'read' } },
        { event: 'done', data: { sessionId: 'upstream-sess-1', status: 'completed' } },
      ]),
    )
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/execute/stream`,
      payload: { message: '流式测试', mode: 'default' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/event-stream/)
    expect(res.body).toContain('event: session')
    expect(res.body).toContain('event: permission')
    expect(res.body).toContain('event: done')
    expect(res.body).toContain('"mode":"default"')
    expect(res.body).toContain('"decision":"allow"')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('POST /execute/stream 上游 500 → 转发为 error 事件 + message 含 upstream error: 500', async () => {
    mockAuthed()
    mockFetch.mockResolvedValueOnce(new Response('upstream broken', { status: 500 }))
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/execute/stream`,
      payload: { message: 'test', mode: 'default' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('event: error')
    expect(res.body).toContain('upstream error: 500')
  })

  it('POST /execute/stream 上游连接失败(fetch reject) → 转发为 error 事件 + message upstream connection failed', async () => {
    mockAuthed()
    mockFetch.mockRejectedValueOnce(new Error('network down'))
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/execute/stream`,
      payload: { message: 'test', mode: 'default' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('event: error')
    expect(res.body).toContain('upstream connection failed')
  })

  it('POST /execute/stream permission 事件 toolName=Write + dangerLevel=write + mode=plan → decision=deny', async () => {
    mockAuthed()
    mockFetch.mockResolvedValueOnce(
      buildSseResponse([
        { event: 'permission', data: { toolName: 'Write', dangerLevel: 'write' } },
      ]),
    )
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/execute/stream`,
      payload: { message: 'test', mode: 'plan' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('event: permission')
    expect(res.body).toContain('"decision":"deny"')
    expect(res.body).toContain('"mode":"plan"')
  })

  it('POST /execute/stream permission 事件 toolName=Read + dangerLevel=read + mode=default → decision=allow', async () => {
    mockAuthed()
    mockFetch.mockResolvedValueOnce(
      buildSseResponse([
        { event: 'permission', data: { toolName: 'Read', dangerLevel: 'read' } },
      ]),
    )
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/execute/stream`,
      payload: { message: 'test', mode: 'default' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('event: permission')
    expect(res.body).toContain('"decision":"allow"')
  })

  it('POST /execute/stream 上游 SSE 含多个事件 → 全部透传且顺序保持', async () => {
    mockAuthed()
    mockFetch.mockResolvedValueOnce(
      buildSseResponse([
        { event: 'session', data: { sessionId: 's1' } },
        { event: 'permission', data: { toolName: 'Read', dangerLevel: 'read' } },
        { event: 'chunk', data: { content: 'hello' } },
        { event: 'chunk', data: { content: 'world' } },
        { event: 'done', data: { sessionId: 's1', status: 'completed' } },
      ]),
    )
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/execute/stream`,
      payload: { message: 'test', mode: 'default' },
    })
    expect(res.statusCode).toBe(200)
    const sessionIdx = res.body.indexOf('event: session')
    const permissionIdx = res.body.indexOf('event: permission')
    const chunkIdx = res.body.indexOf('event: chunk')
    const doneIdx = res.body.indexOf('event: done')
    expect(sessionIdx).toBeGreaterThan(-1)
    expect(sessionIdx).toBeLessThan(permissionIdx)
    expect(permissionIdx).toBeLessThan(chunkIdx)
    expect(chunkIdx).toBeLessThan(doneIdx)
  })

  it('GET /:sessionId/status 返回 200 + code 0 + status/messageCount', async () => {
    mockAuthed()
    const create = await server.inject({
      method: 'POST',
      url: `${PREFIX}/execute`,
      payload: { message: 'prepare' },
    })
    const sessionId = create.json().data.sessionId
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/${sessionId}/status`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.sessionId).toBe(sessionId)
    expect(body.data.status).toBe('active')
    expect(body.data.messageCount).toBeGreaterThanOrEqual(1)
  })

  it('GET /:sessionId/status 不存在 sessionId → 404', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/sess_nonexistent/status`,
    })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.code).toBe(404)
  })

  it('POST /:sessionId/cancel 返回 200 + status cancelled', async () => {
    mockAuthed()
    const create = await server.inject({
      method: 'POST',
      url: `${PREFIX}/execute`,
      payload: { message: 'to-cancel' },
    })
    const sessionId = create.json().data.sessionId
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/${sessionId}/cancel`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.status).toBe('cancelled')
  })

  it('GET /sessions 返回 200 + sessions 数组', async () => {
    mockAuthed()
    await server.inject({
      method: 'POST',
      url: `${PREFIX}/execute`,
      payload: { message: 'for-list' },
    })
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/sessions`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(Array.isArray(body.data.sessions)).toBe(true)
    expect(body.data.total).toBeGreaterThanOrEqual(1)
  })

  it('GET /sessions/:sessionId 返回 200 + session 对象', async () => {
    mockAuthed()
    const create = await server.inject({
      method: 'POST',
      url: `${PREFIX}/execute`,
      payload: { message: 'for-detail' },
    })
    const sessionId = create.json().data.sessionId
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/sessions/${sessionId}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.id).toBe(sessionId)
    expect(body.data.botId).toBe('default')
  })

  it('POST /sessions/:sessionId/resume 返回 200 + status running', async () => {
    mockAuthed()
    const create = await server.inject({
      method: 'POST',
      url: `${PREFIX}/execute`,
      payload: { message: 'for-resume' },
    })
    const sessionId = create.json().data.sessionId
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/sessions/${sessionId}/resume`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.status).toBe('running')
  })

  it('GET /permission/check?toolName=Read&mode=default&dangerLevel=read → decision allow', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/permission/check?toolName=Read&mode=default&dangerLevel=read`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.toolName).toBe('Read')
    expect(body.data.mode).toBe('default')
    expect(body.data.decision).toBe('allow')
  })

  it('GET /permission/check?toolName=Write&mode=plan&dangerLevel=write → decision deny', async () => {
    mockAuthed()
    const res = await server.inject({
      method: 'GET',
      url: `${PREFIX}/permission/check?toolName=Write&mode=plan&dangerLevel=write`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.decision).toBe('deny')
  })

  it('未带 auth token → 401', async () => {
    mockUnauthed()
    const res = await server.inject({
      method: 'POST',
      url: `${PREFIX}/execute`,
      payload: { message: 'no-auth' },
    })
    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.code).toBe(401)
  })
})
