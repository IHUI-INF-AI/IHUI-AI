// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池 WS 流式客户端(2026-11-12 立)。
 *
 * 判据面:
 * ① 上行帧形状与服务端协议逐字对齐(type/model/messages/stream/conversationId);
 * ② chunk.data 的 OpenAI delta 能落进 onDelta,usage 能落进 onUsage;
 * ③ done 收束;error / 异常断连必须给 onError;用户 abort 静默收束(不报错);
 * ④ 未登录不发连接;tool 角色与非字符串正文不喂号池。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { vi } from 'vitest'
import { useAuthStore } from '@/stores/auth'
import { streamRelayChat } from '../relay-chat-stream'

class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: FakeWebSocket[] = []
  readyState = FakeWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  readonly sent: string[] = []
  constructor(public readonly url: string) {
    FakeWebSocket.instances.push(this)
  }
  send(data: string): void {
    this.sent.push(data)
  }
  close(): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }
  /** 测试驱动:模拟连接建立 */
  openSelf(): void {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }
  /** 测试驱动:模拟服务端下行帧 */
  emit(frame: unknown): void {
    this.onmessage?.({ data: JSON.stringify(frame) })
  }
  /** 测试驱动:模拟异常断连 */
  drop(): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }
}

/** 从上行帧里取本轮 id */
function sentId(sock: FakeWebSocket): string {
  const first = sock.sent[0]
  if (!first) throw new Error('没有上行帧')
  return (JSON.parse(first) as { id: string }).id
}

beforeEach(() => {
  FakeWebSocket.instances = []
  useAuthStore.setState({ token: 'tok-1' })
  vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('streamRelayChat', () => {
  it('ready/start/chunk×2/done ⇒ 正文增量按序回调,收束时 onDone', async () => {
    const deltas: string[] = []
    let done = false
    const p = streamRelayChat({
      model: 'doubao/doubao-seed',
      messages: [{ role: 'user', content: '你好' }],
      conversationId: 'conv-1',
      onDelta: (d) => deltas.push(d),
      onDone: () => {
        done = true
      },
    })

    const sock = FakeWebSocket.instances[0]!
    expect(sock.url).toContain('/ws/relay/chat?token=tok-1')
    sock.openSelf()
    const id = sentId(sock)
    const sent = JSON.parse(sock.sent[0]!) as Record<string, unknown>
    expect(sent).toMatchObject({
      type: 'chat',
      model: 'doubao/doubao-seed',
      stream: true,
      conversationId: 'conv-1',
    })

    sock.emit({ type: 'ready', userId: 'u-1' })
    sock.emit({ type: 'start', id })
    sock.emit({
      type: 'chunk',
      id,
      data: JSON.stringify({ choices: [{ delta: { content: '你' } }] }),
    })
    sock.emit({
      type: 'chunk',
      id,
      data: JSON.stringify({ choices: [{ delta: { content: '好' } }] }),
    })
    sock.emit({ type: 'done', id })

    await p
    expect(deltas).toEqual(['你', '好'])
    expect(done).toBe(true)
  })

  it('tool 角色与非字符串正文不喂号池;conversationId 缺席时不上行该键', async () => {
    const p = streamRelayChat({
      model: 'm',
      messages: [
        { role: 'user', content: 'a' },
        { role: 'tool', content: 'b' },
        { role: 'assistant', content: 'c' },
      ],
      onDelta: () => {},
    })
    const sock = FakeWebSocket.instances[0]!
    sock.openSelf()
    const sent = JSON.parse(sock.sent[0]!) as Record<string, unknown>
    expect(sent.messages).toEqual([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'c' },
    ])
    expect('conversationId' in sent).toBe(false)
    // 收束,避免悬挂
    sock.emit({ type: 'done', id: sent.id })
    await p
  })

  it('chunk 带 usage ⇒ onUsage 按 camelCase 回调', async () => {
    const usages: Array<{ totalTokens: number }> = []
    const p = streamRelayChat({
      model: 'm',
      messages: [{ role: 'user', content: 'a' }],
      onDelta: () => {},
      onUsage: (u) => usages.push(u),
    })
    const sock = FakeWebSocket.instances[0]!
    sock.openSelf()
    const id = sentId(sock)
    sock.emit({
      type: 'chunk',
      id,
      data: JSON.stringify({
        choices: [{ delta: { content: 'x' } }],
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      }),
    })
    sock.emit({ type: 'done', id })
    await p
    expect(usages).toEqual([{ promptTokens: 3, completionTokens: 2, totalTokens: 5 }])
  })

  it('服务端 error 帧 ⇒ onError 且收束(不抛)', async () => {
    const onError = vi.fn()
    const p = streamRelayChat({
      model: 'm',
      messages: [{ role: 'user', content: 'a' }],
      onDelta: () => {},
      onError,
    })
    const sock = FakeWebSocket.instances[0]!
    sock.openSelf()
    const id = sentId(sock)
    sock.emit({ type: 'error', id, message: '无可用渠道或账号池候选' })
    await p
    expect(onError).toHaveBeenCalledWith('无可用渠道或账号池候选')
  })

  it('用户 abort ⇒ 上行 cancel、静默收束不报错', async () => {
    const onError = vi.fn()
    const ctrl = new AbortController()
    const p = streamRelayChat({
      model: 'm',
      messages: [{ role: 'user', content: 'a' }],
      signal: ctrl.signal,
      onDelta: () => {},
      onError,
    })
    const sock = FakeWebSocket.instances[0]!
    sock.openSelf()
    ctrl.abort()
    await p
    expect(onError).not.toHaveBeenCalled()
    const frames = sock.sent.map((s) => JSON.parse(s) as { type: string })
    expect(frames.some((f) => f.type === 'cancel')).toBe(true)
  })

  it('异常断连(未收到 done)⇒ onError 给结局', async () => {
    const onError = vi.fn()
    const p = streamRelayChat({
      model: 'm',
      messages: [{ role: 'user', content: 'a' }],
      onDelta: () => {},
      onError,
    })
    const sock = FakeWebSocket.instances[0]!
    sock.openSelf()
    sock.drop()
    await p
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('断'))
  })

  it('未登录 ⇒ 不建连,直接 onError', async () => {
    useAuthStore.setState({ token: null })
    const onError = vi.fn()
    await streamRelayChat({
      model: 'm',
      messages: [{ role: 'user', content: 'a' }],
      onDelta: () => {},
      onError,
    })
    expect(FakeWebSocket.instances).toHaveLength(0)
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('未登录'))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
