// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SSE 代理的出站生命周期(票:chat-models streamSSE 拿到响应头后自废超时)。
 *
 * 现读缺陷:旧实现 `clearTimeout(timer)` 紧跟在 fetch 之后 ⇒ 主体阶段没有任何期限,
 * 上游发完 header 就 stall 会永久占住一条 reply + 一个 undici 连接;并且从不监听
 * 连接关闭 ⇒ 客户端早已离开仍在继续读上游。对照仓内正确实现 ai-chat-stream.ts:591-602。
 *
 * 夹具如实建模 undici 的一条语义:**响应头之后 abort 会让 body 流报错**
 * (signal 上挂 abort 监听 → controller.error)。不这么写就量不到"中止有没有真生效",
 * 只会量到我方自造的假绿。三条各配对照:正常流必须照旧逐帧转发。
 */
import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { __test__ as chatModelsTest } from '../src/routes/chat-models.js'

const { streamSSE } = chatModelsTest
const enc = new TextEncoder()

interface Harness {
  reply: Parameters<typeof streamSSE>[0]
  frames: () => string
  endCalls: () => number
  emitClose: () => void
}

function makeHarness(): Harness {
  const frames: string[] = []
  const raw = Object.assign(new EventEmitter(), {
    writeHead: vi.fn(),
    write: vi.fn((s: string) => {
      frames.push(s)
      return true
    }),
    end: vi.fn(),
  })
  const reply = { hijack: () => undefined, raw } as unknown as Harness['reply']
  return {
    reply,
    frames: () => frames.join(''),
    endCalls: () => raw.end.mock.calls.length,
    emitClose: () => raw.emit('close'),
  }
}

/**
 * 造一个"头已到、体待定"的上游。
 * mode='stall' 永不 enqueue 也不 close;'chunks' 给两行后正常收尾。
 * 记录 abort 是否打到流上(aborted)与 reader 是否被归还(cancelled)。
 */
function stubUpstream(mode: 'stall' | 'chunks') {
  const state = { aborted: 0, cancelled: 0, signalSeen: false }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      const signal = init?.signal
      state.signalSeen = Boolean(signal)
      let ctrl: ReadableStreamDefaultController<Uint8Array> | undefined
      const onAbort = (): void => {
        state.aborted += 1
        ctrl?.error(new DOMException('This operation was aborted', 'AbortError'))
      }
      signal?.addEventListener('abort', onAbort)
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          ctrl = c
          if (mode === 'chunks') {
            c.enqueue(enc.encode('data: a\ndata: b\n'))
            c.close()
          }
        },
        cancel() {
          state.cancelled += 1
          signal?.removeEventListener('abort', onAbort)
        },
      })
      return { ok: true, status: 200, body } as unknown as Response
    }) as unknown as typeof fetch,
  )
  return state
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('streamSSE 出站生命周期', () => {
  it('deadline 必须在主体阶段仍然有效(旧实现拿到头就把定时器拆了)', async () => {
    const state = stubUpstream('stall')
    const h = makeHarness()

    await streamSSE(h.reply, 'https://upstream.test/sse', {}, { q: 1 }, 30)

    expect(state.signalSeen).toBe(true)
    // 中止真的打到了上游流上(而不是只有我方本地记了一笔)
    expect(state.aborted).toBeGreaterThan(0)
    expect(h.frames()).toContain('请求超时')
    expect(h.endCalls()).toBe(1)
  }, 5_000)

  it('客户端断开 ⇒ 立刻中止出站读,且不往已关的连接写错误帧', async () => {
    const state = stubUpstream('stall')
    const h = makeHarness()

    const done = streamSSE(h.reply, 'https://upstream.test/sse', {}, { q: 1 }, 60_000)
    // 定时器给到 60s:证明结束是 close 触发的,不是超时兜出来的
    await vi.waitFor(() => expect(state.signalSeen).toBe(true))
    h.emitClose()
    await done

    expect(state.aborted).toBeGreaterThan(0)
    expect(h.frames()).not.toContain('error')
    expect(h.endCalls()).toBe(1)
  }, 5_000)

  it('正向对照:正常流逐帧转发、正常收尾,不产生错误帧', async () => {
    stubUpstream('chunks')
    const h = makeHarness()

    await streamSSE(h.reply, 'https://upstream.test/sse', {}, { q: 1 }, 5_000)

    expect(h.frames()).toContain('data: a\n\n')
    expect(h.frames()).toContain('data: b\n\n')
    expect(h.frames()).not.toContain('error')
    expect(h.endCalls()).toBe(1)
  }, 5_000)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
