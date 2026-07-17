import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { AddressInfo } from 'node:net'

const { mockWsAuth } = vi.hoisted(() => ({
  mockWsAuth: vi.fn(),
}))

vi.mock('../src/plugins/ws-helpers.js', () => ({
  wsAuth: mockWsAuth,
}))

vi.mock('../src/config/index.js', () => ({
  config: { AI_SERVICE_URL: 'http://ai-service.test' },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('../src/routes/ai-vendors.js', () => ({
  cloneTimbre: vi.fn().mockResolvedValue(undefined),
}))

const mockFetch = vi.fn()

import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import { wsAi } from '../src/plugins/ws-ai.js'

const USER_ID = '00000000-0000-0000-0000-000000000001'

/** 构造 mock Response(基于 Node 24 内置 Response),模拟 AI service 的 SSE 响应 */
function sseResponse(chunks: Array<{ event: string; data: unknown }>): Response {
  const encoder = new TextEncoder()
  const sseText = chunks
    .map((c) => `event: ${c.event}\ndata: ${JSON.stringify(c.data)}\n\n`)
    .join('')
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(sseText))
      controller.close()
    },
  })
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

function sseResponseWithBytes(bytes: Array<Uint8Array>): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const b of bytes) controller.enqueue(b)
      controller.close()
    },
  })
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

function jsonErrorResponse(status: number, body: string): Response {
  return new Response(body, { status })
}

describe('ws-ai — /v1/ai/capabilities/ws/stream 端到端', () => {
  const server = Fastify({ logger: false })
  let url: string

  beforeAll(async () => {
    vi.stubGlobal('fetch', mockFetch)
    await server.register(websocket)
    await server.register(wsAi)
    await server.listen({ port: 0, host: '127.0.0.1' })
    const port = (server.server.address() as AddressInfo).port
    url = `ws://127.0.0.1:${port}/v1/ai/capabilities/ws/stream`
    // 默认 mock:任意 token 都通过鉴权
    mockWsAuth.mockImplementation(async () => USER_ID)
  })

  afterAll(async () => {
    vi.unstubAllGlobals()
    await server.close()
  })

  it('连接成功 → 立即收到 ready 事件', async () => {
    const ws = new WebSocket(`${url}?token=ok`)
    const events: unknown[] = []
    ws.onmessage = (ev) => events.push(JSON.parse(ev.data as string))
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), 3000)
      ws.onopen = () => clearTimeout(t)
      ws.onerror = (e) => {
        clearTimeout(t)
        reject(e)
      }
      // 等待 ready 事件
      const interval = setInterval(() => {
        if (events.some((e) => (e as { event?: string }).event === 'ready')) {
          clearInterval(interval)
          resolve()
        }
      }, 50)
    })
    const ready = events.find((e) => (e as { event?: string }).event === 'ready') as
      { event: string; user: string } | undefined
    expect(ready).toBeDefined()
    expect(ready?.user).toBe(USER_ID)
    ws.close()
  })

  it('发送 capability.start → 收到 start / delta / done 事件', async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([
        { event: 'chunk', data: { type: 'chunk', content: '你好,' } },
        { event: 'chunk', data: { type: 'chunk', content: '世界' } },
        {
          event: 'done',
          data: {
            type: 'done',
            model: 'step-3.7-flash',
            usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
            stub: false,
          },
        },
      ]),
    )

    const ws = new WebSocket(`${url}?token=ok`)
    const events: Array<{ event: string; content?: string; data?: { fullContent?: string } }> = []
    ws.onmessage = (ev) => events.push(JSON.parse(ev.data as string) as never)

    await new Promise<void>((resolve) => {
      ws.onopen = () => resolve()
    })
    // 等待 ready 后再发送
    await new Promise((r) => setTimeout(r, 50))
    ws.send(
      JSON.stringify({
        type: 'capability.start',
        prompt: '你好',
        capabilityName: 'test-cap',
        model: 'step-3.7-flash',
      }),
    )

    // 等待 done 事件
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout waiting done')), 3000)
      const interval = setInterval(() => {
        if (events.some((e) => e.event === 'capability.done')) {
          clearInterval(interval)
          clearTimeout(t)
          resolve()
        }
      }, 50)
    })

    const startEv = events.find((e) => e.event === 'capability.start')
    const deltas = events.filter((e) => e.event === 'capability.delta')
    const doneEv = events.find((e) => e.event === 'capability.done')

    expect(startEv).toBeDefined()
    expect(deltas.length).toBe(2)
    expect(deltas[0]?.content).toBe('你好,')
    expect(deltas[1]?.content).toBe('世界')
    expect(doneEv).toBeDefined()
    expect((doneEv as { model?: string }).model).toBe('step-3.7-flash')
    expect(doneEv?.data?.fullContent).toBe('你好,世界')

    // 验证 fetch 调用
    expect(mockFetch).toHaveBeenCalledOnce()
    const fetchArgs = mockFetch.mock.calls[0]!
    expect(fetchArgs[0]).toBe('http://ai-service.test/api/llm/complete/stream')
    const fetchBody = JSON.parse(fetchArgs[1].body as string)
    expect(fetchBody.messages).toEqual([{ role: 'user', content: '你好' }])
    expect(fetchBody.model).toBe('step-3.7-flash')

    ws.close()
  })

  it('发送 capability.start 但缺 prompt → 收到 capability.error', async () => {
    const ws = new WebSocket(`${url}?token=ok`)
    const events: Array<{ event: string; message?: string }> = []
    ws.onmessage = (ev) => events.push(JSON.parse(ev.data as string) as never)

    await new Promise<void>((resolve) => {
      ws.onopen = () => resolve()
    })
    await new Promise((r) => setTimeout(r, 50))
    ws.send(JSON.stringify({ type: 'capability.start' }))

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), 3000)
      const interval = setInterval(() => {
        if (events.some((e) => e.event === 'capability.error')) {
          clearInterval(interval)
          clearTimeout(t)
          resolve()
        }
      }, 50)
    })

    const errEv = events.find((e) => e.event === 'capability.error') as
      { event: string; message: string } | undefined
    expect(errEv).toBeDefined()
    expect(errEv?.message).toMatch(/prompt/)
    ws.close()
  })

  it('AI service 返回 5xx → 透传为 capability.error', async () => {
    mockFetch.mockResolvedValueOnce(jsonErrorResponse(502, 'upstream bad gateway'))

    const ws = new WebSocket(`${url}?token=ok`)
    const events: Array<{ event: string; message?: string }> = []
    ws.onmessage = (ev) => events.push(JSON.parse(ev.data as string) as never)

    await new Promise<void>((resolve) => {
      ws.onopen = () => resolve()
    })
    await new Promise((r) => setTimeout(r, 50))
    ws.send(JSON.stringify({ type: 'capability.start', prompt: '测试 5xx' }))

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), 3000)
      const interval = setInterval(() => {
        if (events.some((e) => e.event === 'capability.error')) {
          clearInterval(interval)
          clearTimeout(t)
          resolve()
        }
      }, 50)
    })

    const errEv = events.find((e) => e.event === 'capability.error') as
      { event: string; message: string } | undefined
    expect(errEv).toBeDefined()
    expect(errEv?.message).toMatch(/502/)
    ws.close()
  })

  it('AI service 流中包含 error 事件 → 推送 capability.error', async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([
        { event: 'chunk', data: { type: 'chunk', content: '片段1' } },
        { event: 'error', data: { type: 'error', message: 'upstream rate limit' } },
      ]),
    )

    const ws = new WebSocket(`${url}?token=ok`)
    const events: Array<{ event: string; message?: string }> = []
    ws.onmessage = (ev) => events.push(JSON.parse(ev.data as string) as never)

    await new Promise<void>((resolve) => {
      ws.onopen = () => resolve()
    })
    await new Promise((r) => setTimeout(r, 50))
    ws.send(JSON.stringify({ type: 'capability.start', prompt: '测试 error 事件' }))

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), 3000)
      const interval = setInterval(() => {
        if (events.some((e) => e.event === 'capability.error')) {
          clearInterval(interval)
          clearTimeout(t)
          resolve()
        }
      }, 50)
    })

    const errEv = events.find((e) => e.event === 'capability.error') as
      { event: string; message: string } | undefined
    expect(errEv).toBeDefined()
    expect(errEv?.message).toContain('upstream rate limit')
    ws.close()
  })

  it('发送 capability.cancel → 收到 cancelled 事件', async () => {
    // 模拟一个 pending 状态的 fetch,等待 abort 触发
    let cancelObserver: AbortSignal | null = null
    mockFetch.mockImplementationOnce(
      (_url: string, opts: { signal: AbortSignal }) =>
        new Promise<Response>((resolve) => {
          cancelObserver = opts.signal
          // 故意保持 pending,直到 abort 后再 resolve 一个错误 Response
          opts.signal.addEventListener('abort', () => {
            resolve(new Response('aborted', { status: 499 }))
          })
        }),
    )

    const ws = new WebSocket(`${url}?token=ok`)
    const events: Array<{ event: string }> = []
    ws.onmessage = (ev) => events.push(JSON.parse(ev.data as string) as never)

    await new Promise<void>((resolve) => {
      ws.onopen = () => resolve()
    })
    await new Promise((r) => setTimeout(r, 50))
    ws.send(JSON.stringify({ type: 'capability.start', prompt: 'long running' }))
    await new Promise((r) => setTimeout(r, 100)) // 给 fetch 调用时间
    ws.send(JSON.stringify({ type: 'capability.cancel' }))

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), 3000)
      const interval = setInterval(() => {
        if (events.some((e) => e.event === 'cancelled')) {
          clearInterval(interval)
          clearTimeout(t)
          resolve()
        }
      }, 50)
    })

    const cancelEv = events.find((e) => e.event === 'cancelled')
    expect(cancelEv).toBeDefined()
    expect(cancelObserver?.aborted).toBe(true)
    ws.close()
  })

  it('发送 ping → 收到 pong 字符串', async () => {
    const ws = new WebSocket(`${url}?token=ok`)
    let pongReceived = false
    ws.onmessage = (ev) => {
      if (ev.data === 'pong') pongReceived = true
    }

    await new Promise<void>((resolve) => {
      ws.onopen = () => resolve()
    })
    await new Promise((r) => setTimeout(r, 50))
    ws.send('ping')
    await new Promise((r) => setTimeout(r, 200))
    expect(pongReceived).toBe(true)
    ws.close()
  })

  it('非 JSON 消息 → 静默忽略,不抛错', async () => {
    const ws = new WebSocket(`${url}?token=ok`)
    const events: unknown[] = []
    ws.onmessage = (ev) => events.push(ev.data)

    await new Promise<void>((resolve) => {
      ws.onopen = () => resolve()
    })
    await new Promise((r) => setTimeout(r, 50))
    ws.send('not-json-{')
    ws.send(JSON.stringify({ type: 'unknown.type' }))
    await new Promise((r) => setTimeout(r, 200))

    // 应该只收到 ready,没有任何 error 事件
    const errEvents = events.filter((e) => typeof e === 'string' && JSON.parse(e).event === 'error')
    expect(errEvents.length).toBe(0)
    ws.close()
  })

  it('分块接收 SSE 字节(非完整 UTF-8 边界) → 仍能正确解析', async () => {
    const encoder = new TextEncoder()
    // 故意把 SSE 切成 3 块,验证 buffer 拼接逻辑
    const sseText =
      `event: chunk\ndata: ${JSON.stringify({ type: 'chunk', content: '分' })}\n\n` +
      `event: chunk\ndata: ${JSON.stringify({ type: 'chunk', content: '块' })}\n\n` +
      `event: done\ndata: ${JSON.stringify({ type: 'done', model: 'm', usage: {} })}\n\n`
    const bytes = encoder.encode(sseText)
    const chunks = [bytes.slice(0, 30), bytes.slice(30, 80), bytes.slice(80)]
    mockFetch.mockResolvedValueOnce(sseResponseWithBytes(chunks))

    const ws = new WebSocket(`${url}?token=ok`)
    const events: Array<{ event: string; content?: string }> = []
    ws.onmessage = (ev) => events.push(JSON.parse(ev.data as string) as never)

    await new Promise<void>((resolve) => {
      ws.onopen = () => resolve()
    })
    await new Promise((r) => setTimeout(r, 50))
    ws.send(JSON.stringify({ type: 'capability.start', prompt: '分块测试' }))

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), 3000)
      const interval = setInterval(() => {
        if (events.some((e) => e.event === 'capability.done')) {
          clearInterval(interval)
          clearTimeout(t)
          resolve()
        }
      }, 50)
    })

    const deltas = events.filter((e) => e.event === 'capability.delta')
    expect(deltas.length).toBe(2)
    expect(deltas.map((d) => d.content).join('')).toBe('分块')
    ws.close()
  })
})
