// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 批次1 契约锁:SSE 注释帧心跳是客户端读环眼里的"活跃字节"。
 *
 * 立因(2026-11-06):服务端在主聊天流静默期(工具执行/长推理/压缩)此前一个字节
 * 都不发,而 `runResumableSSEStream` 的读超时是"单次 read() 之间的空闲窗口"(30s)。
 * 两侧一旦对齐不上,长任务会被判成断线 ⇒ 重连(带 Last-Event-ID)或重跑上游
 * (重复生成 + 重复计费)。本轮网关补 `: ping` 周期心跳,本文件钉住消费侧的两条
 * 行为,保证"补了心跳真的有用":
 *
 *  1. 注释帧(以及任意字节)都重置空闲窗口 —— 心跳按时到 ⇒ 绝不重连;
 *  2. 真静默(一拍也没有)⇒ 仍旧按读超时断线,并以 Last-Event-ID 续传,
 *     不会把"服务端坏了"伪装成"一直活着"。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  getStreamTransport,
  setStreamTransport,
  type StreamBodyReader,
  type StreamTransportResponse,
} from '../src/stream-transport.js'
import { runResumableSSEStream } from '../src/client.js'

function bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

/** 一次 read 的脚本:延迟 delayMs 吐 text;hang=true 表示永不应答(真静默)。 */
interface ReadStep {
  text?: string
  delayMs?: number
  hang?: boolean
}

/** 按脚本逐次应答的 reader;脚本耗尽 ⇒ done。cancel 记一次,用于证明超时确实取消了挂起读。 */
function scriptedReader(steps: ReadStep[]): StreamBodyReader & { cancels: number } {
  let i = 0
  let cancels = 0
  return {
    get cancels() {
      return cancels
    },
    read(): Promise<{ done: boolean; value?: Uint8Array }> {
      const step = steps[i++]
      if (!step) return Promise.resolve({ done: true, value: undefined })
      if (step.hang) return new Promise(() => {})
      return new Promise((resolve) => {
        setTimeout(() => resolve({ done: false, value: bytes(step.text ?? '') }), step.delayMs ?? 0)
      })
    },
    cancel: async () => {
      cancels++
    },
  }
}

function streamOf(reader: StreamBodyReader): StreamTransportResponse {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => '',
    body: { getReader: () => reader },
  }
}

let originalStreamTransport = getStreamTransport()

beforeEach(() => {
  originalStreamTransport = getStreamTransport()
})

afterEach(() => {
  setStreamTransport(originalStreamTransport)
})

describe('SSE 注释帧心跳与客户端空闲看门狗', () => {
  it('连续 `: ping` 心跳(间隔小于读超时)⇒ 窗口反复重置,全程不重连且注释帧原样递出', async () => {
    const lines: string[] = []
    const reconnects: number[] = []
    // 每 45ms 一拍、共 6 拍(总时长 270ms)**故意超过** 200ms 读超时 ——
    // 只有"注释帧算字节、每次到达都重置窗口"才能全程不断;若窗口不重置,
    // 总量超过超时值就必然重连。单拍 45ms 对 200ms 有 4 倍余量,重负载下的事件
    // 循环抖动不会把这条用例变成偶发红。
    setStreamTransport(async () =>
      streamOf(
        scriptedReader([
          { text: ': ping\n\n', delayMs: 45 },
          { text: ': ping\n\n', delayMs: 45 },
          { text: ': ping\n\n', delayMs: 45 },
          { text: ': ping\n\n', delayMs: 45 },
          { text: ': ping\n\n', delayMs: 45 },
          { text: ': ping\n\n', delayMs: 45 },
          { text: 'id: 1\ndata: {"type":"chunk","content":"hi"}\n\n', delayMs: 0 },
        ]),
      ),
    )

    await runResumableSSEStream({
      url: 'https://example.test/ai/chat/stream',
      headers: {},
      readTimeoutMs: 200,
      initialRetryDelayMs: 10,
      onLine: (line) => {
        lines.push(line)
      },
      onReconnect: (attempt) => {
        reconnects.push(attempt)
      },
    })

    expect(reconnects).toEqual([])
    expect(lines.filter((line) => line === ': ping')).toHaveLength(6)
    expect(lines).toContain('id: 1')
    expect(lines).toContain('data: {"type":"chunk","content":"hi"}')
  })

  it('真静默超过读超时 ⇒ 取消挂起读、断线重连并回带 Last-Event-ID', async () => {
    const seenHeaders: Record<string, string>[] = []
    const reconnects: Array<{ attempt: number; delayMs: number }> = []
    // 用数组而不是 let 变量接 reader:闭包内赋值的 `let` 在 TS 控制流里会被窄化成
    // 初值 null,取 `.cancels` 会报 never;数组元素不做这种窄化。
    const readers: Array<StreamBodyReader & { cancels: number }> = []
    let call = 0

    setStreamTransport(async (_url, init) => {
      seenHeaders.push({ ...(init.headers ?? {}) })
      call++
      if (call === 1) {
        const reader = scriptedReader([
          { text: 'id: 7\ndata: {"type":"chunk","content":"a"}\n\n', delayMs: 0 },
          { hang: true },
        ])
        readers.push(reader)
        return streamOf(reader)
      }
      return streamOf(scriptedReader([{ text: 'data: {"type":"done"}\n\n', delayMs: 0 }]))
    })

    await runResumableSSEStream({
      url: 'https://example.test/ai/chat/stream',
      headers: {},
      readTimeoutMs: 50,
      initialRetryDelayMs: 10,
      maxRetries: 2,
      onLine: () => {},
      onReconnect: (attempt, delayMs) => {
        reconnects.push({ attempt, delayMs })
      },
    })

    expect(call).toBe(2)
    expect(reconnects).toEqual([{ attempt: 1, delayMs: 10 }])
    // 超时必须停掉第一路的挂起读,否则 reader 会一直吊着内存与连接
    expect(readers[0]?.cancels).toBe(1)
    // 续传游标来自第一路收到的 id: 7 —— 第二路请求头必须回带,不能从头重放
    expect(seenHeaders[1]?.['Last-Event-ID']).toBe('7')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
