// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

/**
 * sampleWithRetry 吞错修复回归测试(2026-09-04)。
 *
 * 背景:streamChat(api-client Fix B)对流内 error 事件耗尽内部重试后,
 * 调用方传了 onError 时只走回调并正常 resolve(不抛出)。修复前 sampleWithRetry
 * 虽然传了 onError 但不捕获回调错误,错误被彻底丢弃,上层把失败当"成功的空补全"
 * (如 provider 402 配额耗尽 → stopReason='end_turn' + 空文本)。
 * 修复后:streamErr 捕获回调错误转入 errMsg 路径 → formatSSEError 分类 → runToolLoop
 * 以 stopReason='error' 终止。
 *
 * sampleWithRetry 是 agent.ts 内部函数,通过导出的 runToolLoop 间接锁定行为。
 * mock 模式与 agent-integration.test.ts 保持一致(vi.mock @ihui/api-client + audit)。
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

vi.mock('@ihui/api-client', () => ({
  streamChat: streamChatMock,
  setBaseUrl: vi.fn(),
  setTokenProvider: vi.fn(),
  // severity='unknown' 不可重试 → sampleWithRetry 立即返回 { error: errMsg }
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

const QUOTA_ERROR = 'provider 402 quota exhausted (LLM_ERROR)'

const loopOpts = () => ({
  modelId: 'test',
  messages: [
    { role: 'system' as const, content: 'sys' },
    { role: 'user' as const, content: 'do task' },
  ],
  ctx: { workspacePath: '.' },
  maxIterations: 3,
})

describe('runToolLoop:流内 error 事件经 onError 回调后不得被吞(sampleWithRetry 修复)', () => {
  beforeEach(() => {
    streamChatMock.mockReset()
  })

  it('streamChat 调用 onError 后正常 resolve → runToolLoop 以 stopReason=error 终止(而非空 end_turn)', async () => {
    // 模拟 api-client 修复后的真实契约:耗尽内部重试后回调 onError 并正常 resolve
    streamChatMock.mockImplementation(async (opts: StreamChatOpts) => {
      opts.onError?.(QUOTA_ERROR)
    })

    const onError = vi.fn()
    const result = await runToolLoop({ ...loopOpts(), onError })

    // 错误不再被吞:修复前此处是 stopReason='end_turn' + 空文本
    expect(result.stopReason).toBe('error')
    expect(result.assistantText).toBe('')
    // runToolLoop 的 onError 收到含流内错误信息的格式化消息
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('402 quota'))
    // streamChat 恰好被调用一次(不可重试错误不触发 sampler 重试)
    expect(streamChatMock).toHaveBeenCalledTimes(1)
  })

  it('锁定修复接线:sampleWithRetry 必须给 streamChat 传 onError 捕获器', async () => {
    streamChatMock.mockImplementation(async (opts: StreamChatOpts) => {
      opts.onError?.(QUOTA_ERROR)
    })

    await runToolLoop(loopOpts())

    // 修复前 sampleWithRetry 不捕获回调错误;此处断言 opts.onError 已被注入
    const call = streamChatMock.mock.calls[0]?.[0] as StreamChatOpts | undefined
    expect(call).toBeDefined()
    expect(typeof call?.onError).toBe('function')
  })

  it('对照:streamChat 正常产出(无错误)→ stopReason=end_turn 不受修复影响', async () => {
    streamChatMock.mockImplementation(async (opts: StreamChatOpts) => {
      opts.onDelta('完成。')
    })

    const result = await runToolLoop(loopOpts())

    expect(result.stopReason).toBe('end_turn')
    expect(result.assistantText).toBe('完成。')
  })
})
