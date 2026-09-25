// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D19 terminal_delta(命令执行期实时输出增量)cli 端消费测试。
 *
 * 覆盖:
 *   1. takeTerminalDeltaLines:整行才打印、半行留缓冲拼接、空帧丢弃、stderr 标记、超长截断
 *   2. createTerminalDeltaSink:跨帧行界的事件流 → noteLine 行的端到端小闭环
 *   3. runToolLoop 透传链:onTerminalDelta 逐字段传到 streamChat 回调并被上层承接
 *      (与 agent-steer-note.test.ts 同一 mock/断言形态)
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'

// ---- mock streamChat(避免真实网络调用)+ auditLog(避免写文件)----
type TerminalDeltaEvt = {
  terminalId: string
  command: string
  stream: 'stdout' | 'stderr'
  text: string
  iteration: number
  messageId?: string
}
type StreamChatOpts = {
  model: string
  messages: unknown[]
  signal?: AbortSignal
  onDelta: (delta: string) => void
  onTerminalDelta?: (event: TerminalDeltaEvt) => void
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

import {
  runToolLoop,
  takeTerminalDeltaLines,
  createTerminalDeltaSink,
  TERMINAL_LINE_MAX_CHARS,
} from '../src/commands/agent.js'

const evt = (over: Partial<TerminalDeltaEvt>): TerminalDeltaEvt => ({
  terminalId: 't1',
  command: 'pnpm build',
  stream: 'stdout',
  text: '',
  iteration: 1,
  ...over,
})

describe('takeTerminalDeltaLines(D19 整行才输出)', () => {
  it('含换行的完整行 → 逐行打印,尾半行留 pending 等下一帧', () => {
    const pending: Record<string, string> = {}
    const lines = takeTerminalDeltaLines(pending, evt({ text: 'bundling 42%\nincomplete ta' }))
    expect(lines).toEqual(['[terminal] pnpm build · bundling 42%'])
    expect(pending['t1']).toBe('incomplete ta')
    // 下一帧补完这行
    const lines2 = takeTerminalDeltaLines(pending, evt({ text: 'il end\n' }))
    expect(lines2).toEqual(['[terminal] pnpm build · incomplete tail end'])
    expect(pending['t1']).toBeUndefined()
  })

  it('空 terminalId / 空 text 整帧丢弃(与 web onTerminalDelta 守卫同口径)', () => {
    const pending: Record<string, string> = {}
    expect(takeTerminalDeltaLines(pending, evt({ terminalId: '', text: 'x\n' }))).toEqual([])
    expect(takeTerminalDeltaLines(pending, evt({ text: '' }))).toEqual([])
    expect(Object.keys(pending)).toHaveLength(0)
  })

  it('stderr 帧带 [terminal:err] 标记;空行(纯空白)不占行', () => {
    const pending: Record<string, string> = {}
    const lines = takeTerminalDeltaLines(pending, evt({ stream: 'stderr', text: 'warn: x\n   \n' }))
    expect(lines).toEqual(['[terminal:err] pnpm build · warn: x'])
  })

  it('超长行截到 200 字符加省略号(单帧可能带巨量输出,防打爆终端)', () => {
    const pending: Record<string, string> = {}
    const lines = takeTerminalDeltaLines(pending, evt({ text: `${'y'.repeat(500)}\n` }))
    const line = lines[0] ?? ''
    expect(line).toContain('…')
    expect(line.length).toBeLessThanOrEqual(TERMINAL_LINE_MAX_CHARS + '[terminal] pnpm build · '.length + 1)
  })
})

describe('createTerminalDeltaSink(D19 打印汇,repl 装车点)', () => {
  it('跨帧行界的事件流 → noteLine 恰一次收到拼接完成的整行', () => {
    const notes: string[] = []
    const sink = createTerminalDeltaSink((line) => notes.push(line))
    sink(evt({ text: 'hello ' }))
    sink(evt({ text: 'world' }))
    expect(notes).toEqual([]) // 还没有完整行,不打碎
    sink(evt({ text: '\n' }))
    expect(notes).toEqual(['[terminal] pnpm build · hello world'])
  })
})

describe('runToolLoop onTerminalDelta 透传链(D19)', () => {
  beforeEach(() => {
    streamChatMock.mockReset()
  })

  it('runToolLoop.onTerminalDelta → streamChat opts.onTerminalDelta 逐字段承接', async () => {
    const received: TerminalDeltaEvt[] = []
    streamChatMock.mockImplementationOnce(async (opts: StreamChatOpts) => {
      opts.onTerminalDelta?.({
        terminalId: 'term-7',
        command: 'git status',
        stream: 'stdout',
        text: 'On branch main\n',
        iteration: 2,
        messageId: 'assistant-9',
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
      onTerminalDelta: (event) => {
        received.push(event as TerminalDeltaEvt)
      },
    })
    expect(result.stopReason).toBe('end_turn')
    // onTerminalDelta 已注册进 streamChat 调用点(此前 cli 端对该帧 0 命中 = 静默丢帧)
    const passedOpts = streamChatMock.mock.calls[0]?.[0] as StreamChatOpts | undefined
    expect(typeof passedOpts?.onTerminalDelta).toBe('function')
    // 逐字段承接,不丢字段
    expect(received).toHaveLength(1)
    expect(received[0]?.terminalId).toBe('term-7')
    expect(received[0]?.command).toBe('git status')
    expect(received[0]?.stream).toBe('stdout')
    expect(received[0]?.text).toBe('On branch main\n')
    expect(received[0]?.iteration).toBe(2)
    expect(received[0]?.messageId).toBe('assistant-9')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
