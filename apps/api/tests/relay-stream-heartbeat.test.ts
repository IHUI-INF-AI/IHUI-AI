// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 流式空闲心跳 —— 判据测试(2026-11-17)。
 *
 * H1 上游静默满一个间隔 ⇒ 写一帧 `: ping`(SSE 注释帧,客户端必须忽略)。
 * H2 有真实输出时按「距上次写出」计时,不会额外插心跳。
 * H3 heartbeatMs=0 关闭心跳(逃生舱)。
 * H4 textMode(legacy completions)没有 verbatim 写口 ⇒ 不心跳。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { pipeChannelStream } from '../src/services/relay-upstream-forwarder.js'

function makeUpstream(): {
  response: Response
  push: (text: string) => void
  close: () => void
} {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  return {
    response: new Response(body, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    }),
    push: (text: string) => controller?.enqueue(new TextEncoder().encode(text)),
    close: () => controller?.close(),
  }
}

const PING = ': ping\n\n'
const countPing = (lines: string[]) => lines.filter((l) => l === PING).length

describe('pipeChannelStream 空闲心跳', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('H1 上游静默满一个间隔 ⇒ 写 : ping', async () => {
    vi.useFakeTimers()
    const up = makeUpstream()
    const lines: string[] = []
    const done = pipeChannelStream(up.response, {
      writeLine: (l) => lines.push(l),
      heartbeatMs: 5000,
    })

    await vi.advanceTimersByTimeAsync(5000)
    expect(countPing(lines)).toBeGreaterThanOrEqual(1)

    up.close()
    await done
  })

  it('H2 真实写出会刷新计时,间隔内不插心跳', async () => {
    vi.useFakeTimers()
    const up = makeUpstream()
    const lines: string[] = []
    const done = pipeChannelStream(up.response, {
      writeLine: (l) => lines.push(l),
      heartbeatMs: 5000,
    })

    up.push('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n')
    await vi.advanceTimersByTimeAsync(0)
    const pingBefore = countPing(lines)

    await vi.advanceTimersByTimeAsync(4000)
    expect(countPing(lines)).toBe(pingBefore)

    await vi.advanceTimersByTimeAsync(1000)
    expect(countPing(lines)).toBe(pingBefore + 1)

    up.close()
    await done
  })

  it('H3 heartbeatMs=0 关闭心跳', async () => {
    vi.useFakeTimers()
    const up = makeUpstream()
    const lines: string[] = []
    const done = pipeChannelStream(up.response, {
      writeLine: (l) => lines.push(l),
      heartbeatMs: 0,
    })

    await vi.advanceTimersByTimeAsync(20000)
    expect(countPing(lines)).toBe(0)

    up.close()
    await done
  })

  it('H4 textMode 不心跳(没有 verbatim 写口)', async () => {
    vi.useFakeTimers()
    const up = makeUpstream()
    const lines: string[] = []
    const texts: string[] = []
    const done = pipeChannelStream(up.response, {
      writeLine: (l) => lines.push(l),
      emitText: (t) => texts.push(t),
      heartbeatMs: 5000,
    })

    await vi.advanceTimersByTimeAsync(15000)
    expect(countPing(lines)).toBe(0)

    up.close()
    await done
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
