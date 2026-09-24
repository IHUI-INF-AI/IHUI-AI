// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D106 onSteer 交代帧消费测试 — cli 端补上 steer 全链路的最后一环。
 *
 * 覆盖:
 *   1. steerNoteText:正常事件 → 输出含"引导已生效"与用户引导 text
 *   2. steerNoteText:空文本 / 纯空白 → 返回空串(调用方据此不渲染)
 *   3. steerNoteText:未知 phase(后端扩展预留)→ 返回空串
 *   4. runToolLoop 透传链:onSteer 逐字段传到 streamChat 回调并被上层承接
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'

// ---- mock streamChat(避免真实网络调用)+ auditLog(避免写文件)----
type StreamChatOpts = {
  model: string
  messages: unknown[]
  signal?: AbortSignal
  onDelta: (delta: string) => void
  onSteer?: (event: {
    phase: 'injected'
    text: string
    timestamp?: string
    messageId?: string
  }) => void
}
type StreamChatFn = (opts: StreamChatOpts) => Promise<void>

const { streamChatMock } = vi.hoisted(() => ({
  streamChatMock: vi.fn<StreamChatFn>(),
}))

vi.mock('@ihui/api-client', () => ({
  streamChat: streamChatMock,
  setBaseUrl: vi.fn(),
  setTokenProvider: vi.fn(),
  formatSSEError: (err: unknown) => ({
    severity: 'unknown' as const,
    title: 'error',
    message: err instanceof Error ? err.message : String(err),
    rawMessage: err instanceof Error ? err.message : String(err),
    requireReauth: false,
  }),
}))

vi.mock('../src/audit.js', () => ({
  auditLog: vi.fn(),
}))

import { runToolLoop } from '../src/commands/agent.js'
import { steerNoteText } from '../src/commands/task-status-line.js'

describe('steerNoteText(D106 引导交代文案)', () => {
  it('正常 steer 事件 → 输出含"引导已生效"提示与用户引导 text', () => {
    const note = steerNoteText({
      phase: 'injected',
      text: '只改 A 文件,别动 B',
      timestamp: '2026-09-24T00:00:00Z',
      messageId: 'assistant-1',
    })
    expect(note).toContain('引导已生效')
    expect(note).toContain('只改 A 文件,别动 B')
  })

  it('空文本 / 纯空白 text → 返回空串(不渲染)', () => {
    expect(steerNoteText({ phase: 'injected', text: '' })).toBe('')
    expect(steerNoteText({ phase: 'injected', text: '   \n\t ' })).toBe('')
  })

  it('未知 phase(预留扩展)→ 返回空串,不误报', () => {
    // @ts-expect-error 防御后端扩展新 phase 时终端误报
    expect(steerNoteText({ phase: 'queued', text: 'x' })).toBe('')
  })
})

describe('runToolLoop onSteer 透传链(D106)', () => {
  beforeEach(() => {
    streamChatMock.mockReset()
  })

  it('runToolLoop.onSteer → streamChat opts.onSteer 逐字段承接 phase/text/timestamp/messageId', async () => {
    const received: Array<{ phase: string; text: string; timestamp?: string; messageId?: string }> = []
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      opts.onSteer?.({
        phase: 'injected',
        text: '优先做第 2 步',
        timestamp: '2026-09-24T01:02:03Z',
        messageId: 'assistant-42',
      })
      opts.onDelta('收到。')
    })
    const result = await runToolLoop({
      modelId: 'test',
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'do task' },
      ],
      ctx: { workspacePath: '.' },
      maxIterations: 3,
      onSteer: (event) => {
        received.push(event)
      },
    })
    expect(result.stopReason).toBe('end_turn')
    // onSteer 已注册进 streamChat 调用点(此前全端 0 消费的缺口)
    const passedOpts = streamChatMock.mock.calls[0]?.[0] as StreamChatOpts | undefined
    expect(typeof passedOpts?.onSteer).toBe('function')
    // 逐字段承接,不丢字段
    expect(received).toHaveLength(1)
    expect(received[0]?.phase).toBe('injected')
    expect(received[0]?.text).toBe('优先做第 2 步')
    expect(received[0]?.timestamp).toBe('2026-09-24T01:02:03Z')
    expect(received[0]?.messageId).toBe('assistant-42')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
