/**
 * 直播聊天客户端测试
 *
 * 覆盖:
 * - connect 建立 WebSocket 连接,URL 含 roomId + token
 * - 收到 { type: 'chat', data: msg } 推送给订阅者
 * - 收到裸 ChatMessage(无外壳) 也能识别
 * - 收到 { type: 'history', data: [...] } 触发 onHistory
 * - send 转发到 WS.send(readyState=OPEN)
 * - 关闭触发重连(status=reconnecting)
 * - disconnect 不触发重连(status=closed)
 * - 多订阅者都收到回调
 * - 无 token 时 status=error,不连接
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

/** 简易可控 WebSocket mock(支持手动 open / message / close) */
class FakeWebSocket {
  static OPEN = 1
  static CLOSED = 3
  readyState = 0 // CONNECTING
  url: string
  sent: string[] = []
  onopen: (() => void) | null = null
  // 与 WebSocketLike 接口保持一致(shared 层 @ihui/api-client 定义)
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: ((err: unknown) => void) | null = null
  constructor(url: string) {
    this.url = url
  }
  send(data: string): void {
    this.sent.push(data)
  }
  close(): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }
  /** 模拟服务端 open */
  simulateOpen(): void {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }
  /** 模拟服务端推送 */
  simulateMessage(payload: unknown): void {
    this.onmessage?.({ data: typeof payload === 'string' ? payload : JSON.stringify(payload) })
  }
  /** 模拟服务端断连 */
  simulateClose(): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }
  /** 模拟服务端错误 */
  simulateError(err: unknown = 'fake error'): void {
    this.onerror?.(err)
  }
}

describe('lib/ws/chat-client', () => {
  let instances: FakeWebSocket[] = []
  const factory = (url: string): FakeWebSocket => {
    const ws = new FakeWebSocket(url)
    instances.push(ws)
    return ws
  }

  beforeEach(() => {
    instances = []
    vi.useRealTimers()
  })

  it('connect 建立 WS,URL 含 roomId + token,status 变化被订阅者收到', async () => {
    const { LiveChatClient } = await import('../src/lib/ws/chat-client')
    const client = new LiveChatClient({
      baseUrl: 'http://localhost:8801',
      tokenProvider: () => 'tk-123',
      webSocketFactory: factory,
    })
    const statuses: string[] = []
    const unsub = client.subscribe({ onStatusChange: (s) => statuses.push(s) })
    // 立即推送当前状态
    expect(statuses[0]).toBe('idle')
    client.connect('room-A')
    // 异步探测 token + 创建 WS
    await new Promise((r) => setTimeout(r, 0))
    expect(instances).toHaveLength(1)
    expect(instances[0]!.url).toContain('roomId=room-A')
    expect(instances[0]!.url).toContain('token=tk-123')
    expect(instances[0]!.url).toMatch(/^ws:\/\//)
    expect(statuses).toContain('connecting')
    instances[0]!.simulateOpen()
    expect(statuses).toContain('open')
    unsub()
    client.disconnect()
  })

  it('baseUrl 用 https 时切换为 wss', async () => {
    const { LiveChatClient } = await import('../src/lib/ws/chat-client')
    const client = new LiveChatClient({
      baseUrl: 'https://api.example.com',
      tokenProvider: () => 'tk',
      webSocketFactory: factory,
    })
    client.connect('r1')
    await new Promise((r) => setTimeout(r, 0))
    expect(instances[0]!.url.startsWith('wss://')).toBe(true)
    client.disconnect()
  })

  it('收到 { type: "chat", data } 推送给 onMessage', async () => {
    const { LiveChatClient } = await import('../src/lib/ws/chat-client')
    const client = new LiveChatClient({
      baseUrl: 'http://localhost:8801',
      tokenProvider: () => 'tk',
      webSocketFactory: factory,
    })
    const messages: Array<{ id: string; nickname: string; content: string }> = []
    client.subscribe({ onMessage: (m) => messages.push(m) })
    client.connect('room-X')
    await new Promise((r) => setTimeout(r, 0))
    instances[0]!.simulateOpen()
    instances[0]!.simulateMessage({
      type: 'chat',
      data: { id: 'm1', nickname: 'alice', content: 'hi', createdAt: '2026-07-20T10:00:00Z' },
    })
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({ id: 'm1', nickname: 'alice', content: 'hi' })
    client.disconnect()
  })

  it('收到裸 ChatMessage(无外壳)也能识别', async () => {
    const { LiveChatClient } = await import('../src/lib/ws/chat-client')
    const client = new LiveChatClient({
      baseUrl: 'http://localhost:8801',
      tokenProvider: () => 'tk',
      webSocketFactory: factory,
    })
    const messages: unknown[] = []
    client.subscribe({ onMessage: (m) => messages.push(m) })
    client.connect('r')
    await new Promise((r) => setTimeout(r, 0))
    instances[0]!.simulateOpen()
    instances[0]!.simulateMessage({ id: 'm2', nickname: 'bob', content: 'yo', createdAt: '2026-07-20T10:01:00Z' })
    expect(messages).toHaveLength(1)
    client.disconnect()
  })

  it('收到 { type: "history", data: [...] } 触发 onHistory(单次)', async () => {
    const { LiveChatClient } = await import('../src/lib/ws/chat-client')
    const client = new LiveChatClient({
      baseUrl: 'http://localhost:8801',
      tokenProvider: () => 'tk',
      webSocketFactory: factory,
    })
    const histories: unknown[] = []
    client.subscribe({ onHistory: (h) => histories.push(h) })
    client.connect('r')
    await new Promise((r) => setTimeout(r, 0))
    instances[0]!.simulateOpen()
    instances[0]!.simulateMessage({
      type: 'history',
      data: [
        { id: 'h1', nickname: 'a', content: 'old-1', createdAt: '2026-07-20T09:00:00Z' },
        { id: 'h2', nickname: 'b', content: 'old-2', createdAt: '2026-07-20T09:01:00Z' },
      ],
    })
    expect(histories).toHaveLength(1)
    expect((histories[0] as unknown[]).length).toBe(2)
    client.disconnect()
  })

  it('非法消息(JSON.parse 失败 / 缺字段)被忽略,不抛错', async () => {
    const { LiveChatClient } = await import('../src/lib/ws/chat-client')
    const client = new LiveChatClient({
      baseUrl: 'http://localhost:8801',
      tokenProvider: () => 'tk',
      webSocketFactory: factory,
    })
    const messages: unknown[] = []
    client.subscribe({ onMessage: (m) => messages.push(m) })
    client.connect('r')
    await new Promise((r) => setTimeout(r, 0))
    instances[0]!.simulateOpen()
    // 非法 JSON
    instances[0]!.onmessage?.({ data: 'not-json' })
    // 缺字段
    instances[0]!.simulateMessage({ type: 'chat', data: { id: 1, content: 2 } })
    // type 不匹配
    instances[0]!.simulateMessage({ type: 'other', data: { id: 'x' } })
    expect(messages).toHaveLength(0)
    client.disconnect()
  })

  it('send 仅在 OPEN 状态成功,关闭后返回 false', async () => {
    const { LiveChatClient } = await import('../src/lib/ws/chat-client')
    const client = new LiveChatClient({
      baseUrl: 'http://localhost:8801',
      tokenProvider: () => 'tk',
      webSocketFactory: factory,
    })
    client.connect('r')
    await new Promise((r) => setTimeout(r, 0))
    // CONNECTING 状态下 send 应返回 false
    expect(client.send('hi')).toBe(false)
    instances[0]!.simulateOpen()
    expect(client.send('hi')).toBe(true)
    expect(instances[0]!.sent).toEqual([JSON.stringify({ type: 'send', content: 'hi' })])
    instances[0]!.simulateClose()
    // 关闭后 status=reconnecting(底层 WS 已被置 null 前),send 必返 false
    // (close 内部会清理 client,这里直接断开 disconnect)
    client.disconnect()
    expect(client.send('later')).toBe(false)
  })

  it('服务端 close 触发重连(status=reconnecting),1s 内自动重连', async () => {
    vi.useFakeTimers()
    const { LiveChatClient } = await import('../src/lib/ws/chat-client')
    const client = new LiveChatClient({
      baseUrl: 'http://localhost:8801',
      tokenProvider: () => 'tk',
      webSocketFactory: factory,
      maxReconnectDelay: 5000,
    })
    const statuses: string[] = []
    client.subscribe({ onStatusChange: (s) => statuses.push(s) })
    client.connect('r')
    await vi.runOnlyPendingTimersAsync()
    instances[0]!.simulateOpen()
    expect(instances).toHaveLength(1)
    // 模拟服务端关闭
    instances[0]!.simulateClose()
    expect(statuses).toContain('reconnecting')
    // 推进到下一次重连定时器(初始 1s)
    await vi.advanceTimersByTimeAsync(1500)
    expect(instances.length).toBeGreaterThanOrEqual(2)
    client.disconnect()
    vi.useRealTimers()
  })

  it('disconnect 后不再重连(status=closed),定时器不触发', async () => {
    vi.useFakeTimers()
    const { LiveChatClient } = await import('../src/lib/ws/chat-client')
    const client = new LiveChatClient({
      baseUrl: 'http://localhost:8801',
      tokenProvider: () => 'tk',
      webSocketFactory: factory,
    })
    const statuses: string[] = []
    client.subscribe({ onStatusChange: (s) => statuses.push(s) })
    client.connect('r')
    await vi.runOnlyPendingTimersAsync()
    instances[0]!.simulateOpen()
    client.disconnect()
    expect(statuses[statuses.length - 1]).toBe('closed')
    const countBefore = instances.length
    // 推进 60s 不应再创建新连接
    await vi.advanceTimersByTimeAsync(60_000)
    expect(instances.length).toBe(countBefore)
    vi.useRealTimers()
  })

  it('无 token 时 status=error 并 onError 回调', async () => {
    const { LiveChatClient } = await import('../src/lib/ws/chat-client')
    const client = new LiveChatClient({
      baseUrl: 'http://localhost:8801',
      tokenProvider: () => null,
      webSocketFactory: factory,
    })
    const statuses: string[] = []
    const errors: string[] = []
    client.subscribe({
      onStatusChange: (s) => statuses.push(s),
      onError: (e) => errors.push(e),
    })
    client.connect('r')
    await new Promise((r) => setTimeout(r, 0))
    expect(instances).toHaveLength(0)
    expect(statuses[statuses.length - 1]).toBe('error')
    expect(errors.length).toBeGreaterThan(0)
  })

  it('多订阅者都收到消息和状态变化', async () => {
    const { LiveChatClient } = await import('../src/lib/ws/chat-client')
    const client = new LiveChatClient({
      baseUrl: 'http://localhost:8801',
      tokenProvider: () => 'tk',
      webSocketFactory: factory,
    })
    const a1: string[] = []
    const a2: string[] = []
    const a3: string[] = []
    client.subscribe({ onMessage: (m) => a1.push(m.content) })
    client.subscribe({ onMessage: (m) => a2.push(m.content) })
    client.subscribe({ onStatusChange: (s) => a3.push(s) })
    client.connect('r')
    await new Promise((r) => setTimeout(r, 0))
    instances[0]!.simulateOpen()
    instances[0]!.simulateMessage({ id: 'x', nickname: 'a', content: 'hello', createdAt: 't' })
    expect(a1).toEqual(['hello'])
    expect(a2).toEqual(['hello'])
    expect(a3).toContain('open')
    client.disconnect()
  })

  it('重复 connect 同一 roomId 不创建新连接', async () => {
    const { LiveChatClient } = await import('../src/lib/ws/chat-client')
    const client = new LiveChatClient({
      baseUrl: 'http://localhost:8801',
      tokenProvider: () => 'tk',
      webSocketFactory: factory,
    })
    client.connect('r')
    await new Promise((r) => setTimeout(r, 0))
    client.connect('r')
    await new Promise((r) => setTimeout(r, 0))
    expect(instances).toHaveLength(1)
    client.disconnect()
  })
})
