// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
const USER_ID = '00000000-0000-4000-8000-000000000001'

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
    expect(res.body).toContain('上游服务异常')
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
    expect(res.body).toContain('上游连接失败')
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
      buildSseResponse([{ event: 'permission', data: { toolName: 'Read', dangerLevel: 'read' } }]),
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

  // ==========================================================================
  // 归属校验(§5「认证不等于授权」,2026-10-31 收口)
  // 此前 /sessions、/sessions/:id、/execute(sessionId 来自 body)、/:id/status、
  // /:id/cancel 一律只按 sessionId 取数、从不比对主体 ⇒ 任一登录用户可读他人完整对话、
  // 往他人会话追加消息、并 cancel 别人正在跑的会话。
  // 每条越权断言都配正向对照(同一主体自己做得动),证明拦的是"跨用户"而不是把功能关掉。
  // ==========================================================================
  describe('跨用户访问一律 404(与"不存在"同形,不给出"这 id 属于别人"的信号)', () => {
    const VICTIM = '00000000-0000-4000-8000-000000000001'
    const ATTACKER = '00000000-0000-4000-8000-000000000099'

    async function createVictimSession(): Promise<string> {
      mockAuthed(VICTIM)
      const res = await server.inject({
        method: 'POST',
        url: `${PREFIX}/execute`,
        payload: { message: 'victim-secret-context' },
      })
      expect(res.statusCode).toBe(200)
      return res.json().data.sessionId as string
    }

    it('详情:他人 sessionId 读不到,且响应体不含其上下文', async () => {
      const sessionId = await createVictimSession()
      mockAuthed(ATTACKER)
      const res = await server.inject({ method: 'GET', url: `${PREFIX}/sessions/${sessionId}` })
      expect(res.statusCode).toBe(404)
      expect(res.body).not.toContain('victim-secret-context')
      // 正向对照:本人读得到
      mockAuthed(VICTIM)
      const own = await server.inject({ method: 'GET', url: `${PREFIX}/sessions/${sessionId}` })
      expect(own.statusCode).toBe(200)
      expect(JSON.stringify(own.json().data)).toContain('victim-secret-context')
    })

    it('execute 带他人 sessionId ⇒ 404 且消息没被追加进他人会话', async () => {
      const sessionId = await createVictimSession()
      mockAuthed(ATTACKER)
      const inject = await server.inject({
        method: 'POST',
        url: `${PREFIX}/execute`,
        payload: { sessionId, message: 'attacker-injected' },
      })
      expect(inject.statusCode).toBe(404)
      mockAuthed(VICTIM)
      const status = await server.inject({ method: 'GET', url: `${PREFIX}/${sessionId}/status` })
      expect(status.statusCode).toBe(200)
      // 副作用没发生:受害者会话仍只有受害者那 1 条消息
      expect(status.json().data.messageCount).toBe(1)
    })

    it('cancel 他人会话 ⇒ 404 且他人会话状态没被改写成终态', async () => {
      const sessionId = await createVictimSession()
      mockAuthed(ATTACKER)
      const kill = await server.inject({
        method: 'POST',
        url: `${PREFIX}/${sessionId}/cancel`,
        payload: {},
      })
      expect(kill.statusCode).toBe(404)
      mockAuthed(VICTIM)
      const status = await server.inject({ method: 'GET', url: `${PREFIX}/${sessionId}/status` })
      expect(status.json().data.status).toBe('active')
    })

    it('列表:只交本人会话(他人的既不在条目里,也不计入 total)', async () => {
      const sessionId = await createVictimSession()
      mockAuthed(ATTACKER)
      const attackerList = await server.inject({ method: 'GET', url: `${PREFIX}/sessions` })
      expect(attackerList.statusCode).toBe(200)
      const attackerIds = (attackerList.json().data.sessions as Array<{ id: string }>).map(
        (s) => s.id,
      )
      expect(attackerIds).not.toContain(sessionId)
      mockAuthed(VICTIM)
      const victimList = await server.inject({ method: 'GET', url: `${PREFIX}/sessions` })
      const victimIds = (victimList.json().data.sessions as Array<{ id: string }>).map((s) => s.id)
      expect(victimIds).toContain(sessionId)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
