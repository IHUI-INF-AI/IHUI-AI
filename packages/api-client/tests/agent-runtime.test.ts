import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  executeAgentRuntime,
  executeAgentRuntimeStream,
  listAgentRuntimeSessions,
  getAgentRuntimeSession,
  resumeAgentRuntimeSession,
  getAgentRuntimeStatus,
  cancelAgentRuntime,
  checkAgentRuntimePermission,
} from '../src/endpoints/agent-runtime.js'

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ code: 0, message: 'ok', data }),
    text: async () => JSON.stringify({ code: 0, message: 'ok', data }),
    body: null,
  } as unknown as Response
}

function errorResponse(message: string, status = 400): Response {
  return {
    ok: false,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ code: status, message, data: null }),
    text: async () => JSON.stringify({ code: status, message, data: null }),
    body: null,
  } as unknown as Response
}

function sseResponse(events: Array<{ event: string; data: unknown }>): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const e of events) {
        controller.enqueue(
          encoder.encode(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`),
        )
      }
      controller.close()
    },
  })
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
    body: stream,
    json: async () => {
      throw new Error('not json')
    },
    text: async () => '',
  } as unknown as Response
}

describe('agent-runtime endpoints — /api/agent-runtime/*', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('executeAgentRuntime — 正常调用返回 sessionId/mode/received', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ sessionId: 'sess_1', mode: 'default', received: 'hi' }),
    )
    const result = await executeAgentRuntime({ message: 'hi', mode: 'default' })
    expect(result).toEqual({ sessionId: 'sess_1', mode: 'default', received: 'hi' })
    expect(fetchMock).toHaveBeenCalledOnce()
    const call = fetchMock.mock.calls[0]!
    const url = String(call[0])
    const opts = call[1] as RequestInit
    expect(url).toContain('/api/agent-runtime/execute')
    expect(opts.method).toBe('POST')
    expect(opts.body).toBe(JSON.stringify({ message: 'hi', mode: 'default' }))
  })

  it('executeAgentRuntime — 默认 mode=default(后端填充)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ sessionId: 'sess_2', mode: 'default', received: 'hello' }),
    )
    const result = await executeAgentRuntime({ message: 'hello' })
    expect(result.mode).toBe('default')
    expect(result.sessionId).toBe('sess_2')
    expect(result.received).toBe('hello')
  })

  it('executeAgentRuntime — 失败抛错', async () => {
    fetchMock.mockResolvedValue(errorResponse('invalid body', 400))
    await expect(executeAgentRuntime({ message: '' })).rejects.toThrow()
  })

  it('executeAgentRuntimeStream — 正常 SSE 流触发 onSession/onPermission/onPlan/onDelta/onDone', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        { event: 'session', data: { sessionId: 'sess_s1' } },
        { event: 'permission', data: { mode: 'default', decision: 'allow' } },
        { event: 'plan', data: { plan: 'step1' } },
        { event: 'delta', data: { content: 'hello' } },
        { event: 'done', data: { sessionId: 'sess_s1', status: 'completed' } },
      ]),
    )
    const onSession = vi.fn()
    const onPermission = vi.fn()
    const onPlan = vi.fn()
    const onDelta = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()
    const onEvent = vi.fn()
    await executeAgentRuntimeStream(
      { message: 'stream test' },
      { onSession, onPermission, onPlan, onDelta, onDone, onError, onEvent },
    )
    expect(onSession).toHaveBeenCalledWith({ sessionId: 'sess_s1' })
    expect(onPermission).toHaveBeenCalledWith({ mode: 'default', decision: 'allow' })
    expect(onPlan).toHaveBeenCalledWith({ plan: 'step1' })
    expect(onDelta).toHaveBeenCalledWith({ content: 'hello' })
    expect(onDone).toHaveBeenCalledWith({ sessionId: 'sess_s1', status: 'completed' })
    expect(onError).not.toHaveBeenCalled()
    expect(onEvent).toHaveBeenCalledTimes(5)
  })

  it('executeAgentRuntimeStream — error 事件触发 onError', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([{ event: 'error', data: { message: 'something broke' } }]),
    )
    const onError = vi.fn()
    await executeAgentRuntimeStream({ message: 'x' }, { onError })
    expect(onError).toHaveBeenCalledWith({ message: 'something broke' })
  })

  it('executeAgentRuntimeStream — Last-Event-ID 断线重连 header', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([{ event: 'done', data: { sessionId: 's', status: 'done' } }]),
    )
    await executeAgentRuntimeStream(
      { message: 'resume' },
      { onDone: vi.fn() },
      { lastEventId: 'evt_42' },
    )
    const call = fetchMock.mock.calls[0]!
    const opts = call[1] as RequestInit
    const headers = opts.headers as Record<string, string>
    expect(headers['Last-Event-ID']).toBe('evt_42')
    expect(headers['Accept']).toBe('text/event-stream')
  })

  it('executeAgentRuntimeStream — AbortSignal 取消触发 onDone 不抛错', async () => {
    const abortErr = new DOMException('Aborted', 'AbortError')
    fetchMock.mockRejectedValue(abortErr)
    const onDone = vi.fn()
    const onError = vi.fn()
    await executeAgentRuntimeStream(
      { message: 'cancel' },
      { onDone, onError },
      { signal: AbortSignal.abort() },
    )
    expect(onDone).toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('listAgentRuntimeSessions — limit/offset 参数透传', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ sessions: [], total: 0 }))
    await listAgentRuntimeSessions({ limit: 5, offset: 10 })
    const url = String(fetchMock.mock.calls[0]![0])
    expect(url).toContain('/api/agent-runtime/sessions')
    expect(url).toContain('limit=5')
    expect(url).toContain('offset=10')
  })

  it('listAgentRuntimeSessions — 无参数也正常调用', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ sessions: [], total: 0 }))
    const result = await listAgentRuntimeSessions()
    expect(result).toEqual({ sessions: [], total: 0 })
    const url = String(fetchMock.mock.calls[0]![0])
    expect(url).toContain('/api/agent-runtime/sessions')
    expect(url).not.toContain('limit=')
  })

  it('getAgentRuntimeSession — 返回 session 对象', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ id: 'sess_9', botId: 'default', status: 'running' }),
    )
    const result = await getAgentRuntimeSession('sess_9')
    expect(result).toEqual({ id: 'sess_9', botId: 'default', status: 'running' })
    const url = String(fetchMock.mock.calls[0]![0])
    expect(url).toContain('/api/agent-runtime/sessions/sess_9')
  })

  it('resumeAgentRuntimeSession — 返回 sessionId + status', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ sessionId: 'sess_r', status: 'running' }),
    )
    const result = await resumeAgentRuntimeSession('sess_r')
    expect(result).toEqual({ sessionId: 'sess_r', status: 'running' })
    const call = fetchMock.mock.calls[0]!
    const url = String(call[0])
    const opts = call[1] as RequestInit
    expect(url).toContain('/api/agent-runtime/sessions/sess_r/resume')
    expect(opts.method).toBe('POST')
  })

  it('getAgentRuntimeStatus — 返回 status + messageCount', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ sessionId: 'sess_st', status: 'active', messageCount: 3 }),
    )
    const result = await getAgentRuntimeStatus('sess_st')
    expect(result).toEqual({ sessionId: 'sess_st', status: 'active', messageCount: 3 })
    const url = String(fetchMock.mock.calls[0]![0])
    expect(url).toContain('/api/agent-runtime/sess_st/status')
  })

  it('cancelAgentRuntime — 返回 cancelled 状态', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ sessionId: 'sess_c', status: 'cancelled' }),
    )
    const result = await cancelAgentRuntime('sess_c')
    expect(result).toEqual({ sessionId: 'sess_c', status: 'cancelled' })
    const call = fetchMock.mock.calls[0]!
    const url = String(call[0])
    const opts = call[1] as RequestInit
    expect(url).toContain('/api/agent-runtime/sess_c/cancel')
    expect(opts.method).toBe('POST')
  })

  it('checkAgentRuntimePermission — toolName/mode/dangerLevel 透传 + decision 返回', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        toolName: 'Read',
        mode: 'default',
        dangerLevel: 'read',
        decision: 'allow',
      }),
    )
    const result = await checkAgentRuntimePermission({
      toolName: 'Read',
      mode: 'default',
      dangerLevel: 'read',
    })
    expect(result).toEqual({
      toolName: 'Read',
      mode: 'default',
      dangerLevel: 'read',
      decision: 'allow',
    })
    const url = String(fetchMock.mock.calls[0]![0])
    expect(url).toContain('/api/agent-runtime/permission/check')
    expect(url).toContain('toolName=Read')
    expect(url).toContain('mode=default')
    expect(url).toContain('dangerLevel=read')
  })
})
