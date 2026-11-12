// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-127 / F-128 回归钉。
 *
 * F-127:流式重试必须回滚上一次 attempt 已 emit 的 delta。
 *   修复前 sampleWithRetry 每次都把同一个 onDelta 透传下去,重试后渲染层/累积缓冲
 *   收到"旧前缀 + 新全文";修复后重发前先触发 onDeltaReset(可选回调),并清空本轮缓冲。
 *   本文件通过导出的 runToolLoop 间接锁定(与 agent-stream-swallow-fix.test.ts 同姿势)。
 *
 * F-128:SSE 收尾必须 flush TextDecoder 且派发无换行尾行。
 *   修复前最后一条 data 行(常含 finish_reason / tool_calls.arguments 尾段)被丢弃,
 *   多字节 UTF-8 残字节也不 flush。本文件直接打 streamOpenAiCompatible(mock fetch)。
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'

// ---- mock streamChat(避免真实网络调用)+ auditLog(避免写文件)----
type StreamChatOpts = {
  model: string
  messages: unknown[]
  signal?: AbortSignal
  onDelta: (delta: string) => void
  onError?: (err: string) => void
  onDone?: () => void
}
type StreamChatFn = (opts: StreamChatOpts) => Promise<void>

const { streamChatMock } = vi.hoisted(() => ({
  streamChatMock: vi.fn<StreamChatFn>(),
}))

import type * as ApiClient from '@ihui/api-client'
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>()
  return {
    ...actual,
    streamChat: streamChatMock,
    setBaseUrl: vi.fn(),
    setTokenProvider: vi.fn(),
    // NETWORK_GLITCH → 可重试(severity='network');其余按未知错误立即返回
    formatSSEError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      const retryable = message.includes('NETWORK_GLITCH')
      return {
        severity: retryable ? ('network' as const) : ('unknown' as const),
        title: 'error',
        message,
        rawMessage: message,
        requireReauth: false,
      }
    },
  }
})

vi.mock('../src/audit.js', () => ({
  auditLog: vi.fn(),
}))

import { runToolLoop } from '../src/commands/agent.js'
import { streamOpenAiCompatible } from '../src/provider/local.js'

const loopOpts = () => ({
  modelId: 'test',
  messages: [
    { role: 'system' as const, content: 'sys' },
    { role: 'user' as const, content: 'do task' },
  ],
  ctx: { workspacePath: '.' },
  maxIterations: 3,
})

describe('F-127:流式重试回滚已输出的 delta', () => {
  beforeEach(() => {
    streamChatMock.mockReset()
  })

  it('第一次 attempt 已 emit 前缀后失败重试 → onDeltaReset 先触发,最终文本只剩最后一次 attempt', async () => {
    let call = 0
    streamChatMock.mockImplementation(async (opts: StreamChatOpts) => {
      call++
      if (call === 1) {
        opts.onDelta('旧前缀')
        opts.onError?.('NETWORK_GLITCH: connection reset')
        return
      }
      opts.onDelta('新全文')
    })

    const events: string[] = []
    const onDeltaReset = vi.fn(() => {
      events.push('reset')
    })
    const result = await runToolLoop({
      ...loopOpts(),
      onDelta: (delta) => {
        events.push(`delta:${delta}`)
      },
      onDeltaReset,
    })

    expect(streamChatMock).toHaveBeenCalledTimes(2)
    // 回滚在第二次 attempt 之前、第一次 delta 之后
    expect(events).toEqual(['delta:旧前缀', 'reset', 'delta:新全文'])
    expect(onDeltaReset).toHaveBeenCalledTimes(1)
    // 落库/上交的最终文本不含旧前缀
    expect(result.assistantText).toBe('新全文')
    expect(result.stopReason).toBe('end_turn')
  })

  it('未传 onDeltaReset(可选回调)→ 不抛错,内部累积缓冲仍只保留最后一次 attempt', async () => {
    let call = 0
    streamChatMock.mockImplementation(async (opts: StreamChatOpts) => {
      call++
      if (call === 1) {
        opts.onDelta('半截')
        opts.onError?.('NETWORK_GLITCH: timeout')
        return
      }
      opts.onDelta('完整回答')
    })

    const result = await runToolLoop(loopOpts())

    expect(streamChatMock).toHaveBeenCalledTimes(2)
    expect(result.assistantText).toBe('完整回答')
  })

  it('不可重试错误不触发 onDeltaReset(没有下一次 attempt)', async () => {
    streamChatMock.mockImplementation(async (opts: StreamChatOpts) => {
      opts.onDelta('片段')
      opts.onError?.('auth failed')
    })

    const onDeltaReset = vi.fn()
    const result = await runToolLoop({ ...loopOpts(), onDeltaReset })

    expect(streamChatMock).toHaveBeenCalledTimes(1)
    expect(onDeltaReset).not.toHaveBeenCalled()
    expect(result.stopReason).toBe('error')
  })
})

// ==================== F-128:SSE 收尾 ====================

const encoder = new TextEncoder()

/** mock fetch:按给定字节块顺序投递,耗尽后 done:true */
function mockFetchChunks(chunks: Uint8Array[]): unknown {
  return {
    ok: true,
    status: 200,
    text: async () => '',
    body: {
      getReader: () => {
        let i = 0
        return {
          read: async () => {
            if (i >= chunks.length) return { value: undefined, done: true }
            return { value: chunks[i++], done: false }
          },
        }
      },
    },
  }
}

describe('F-128:SSE 收尾 flush 与无换行尾行', () => {
  it('最后一条 data 行无换行 → 仍被解析派发(末段文本 + finish_reason)', async () => {
    const body =
      'data: {"choices":[{"delta":{"content":"尾"}}]}\n' +
      'data: {"choices":[{"delta":{"content":"行"},"finish_reason":"length"}]}'
    const fetchMock = vi.fn(async () => mockFetchChunks([encoder.encode(body)])) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchMock)
    try {
      const deltas: string[] = []
      const r = await streamOpenAiCompatible({
        url: 'http://x/chat/completions',
        model: 'm',
        messages: [],
        onDelta: (d) => deltas.push(d),
      })
      expect(r.error).toBeFalsy()
      expect(deltas).toEqual(['尾', '行'])
      expect(r.text).toBe('尾行')
      // 修复前尾行丢弃,finish_reason 回落到默认 'stop'
      expect(r.finishReason).toBe('length')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('无换行尾行携带 tool_calls.arguments 尾段 → 聚合后 JSON 不截断', async () => {
    const body =
      'data: {"choices":[{"delta":{"content":"好"}}]}\n' +
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"read_file","arguments":"{\\"path\\":\\"a.ts\\"}"}}]},"finish_reason":"tool_calls"}]}'
    const fetchMock = vi.fn(async () => mockFetchChunks([encoder.encode(body)])) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchMock)
    try {
      const calls: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = []
      const r = await streamOpenAiCompatible({
        url: 'http://x/chat/completions',
        model: 'm',
        messages: [],
        onToolCall: (c) => calls.push(c),
      })
      expect(r.error).toBeFalsy()
      expect(r.toolCalls).toEqual([{ id: 'call_1', name: 'read_file', arguments: { path: 'a.ts' } }])
      expect(calls).toEqual(r.toolCalls)
      expect(r.finishReason).toBe('tool_calls')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('多字节 UTF-8 在 chunk 中间断开 + 流无换行收尾 → 最终 flush 后尾行完整', async () => {
    const body = 'data: {"choices":[{"delta":{"content":"你好"}}]}'
    const bytes = encoder.encode(body)
    // 在「你」的三个字节中间切开:前一块落在字符内部,后一块补齐且流不带换行结束
    const youByteIndex = body.indexOf('你')
    const cut = youByteIndex + 1
    const fetchMock = vi.fn(async () => mockFetchChunks([bytes.slice(0, cut), bytes.slice(cut)])) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchMock)
    try {
      const deltas: string[] = []
      const r = await streamOpenAiCompatible({
        url: 'http://x/chat/completions',
        model: 'm',
        messages: [],
        onDelta: (d) => deltas.push(d),
      })
      expect(r.error).toBeFalsy()
      expect(deltas).toEqual(['你好'])
      expect(r.text).toBe('你好')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
