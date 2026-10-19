// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-425 小程序腿(2026-10-19 收口):"输出被 max_tokens 截断"的可见提示。
 *
 * 两份取证(与 chat-stream-terminal-delta.test.ts 同一分工纪律):
 * ① 判据行为 —— api/index 的 isMaxTokensTruncatedFinishReason:
 *    阳性 length/MAX_TOKENS(小写归一)、阴性 stop/tool_calls/SAFETY、
 *    缺席(undefined/null)一律 false(缺席 = 上游没给,绝不折成"正常结束")。
 * ② 运行时派发真触发 —— chatStream 收到带 finishReason 的 done 帧时
 *    onFinishReason **必须真的被调用**(阳性)、done 帧缺席 finishReason 时
 *    **不得被调用**(反向对照,缺席绝不折成 stop);事件由真实共享 parseSSEChunk
 *    解出后经真实 dispatch 分发 —— 证明的是接线本身,不是判据的复读。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { parseSSEChunk } from '@ihui/shared/utils/sse-parse'

const { mockStreamSSE } = vi.hoisted(() => ({ mockStreamSSE: vi.fn() }))

vi.mock('@/lib/sse', () => ({ streamSSE: mockStreamSSE }))
// resolveAgentTools 与本判据无关(ui-control 预筛),桩掉以免拉进无关模块图
vi.mock('@/lib/ui-control-tools', () => ({
  resolveAgentTools: (tools: unknown) => tools,
}))
// api-bridge 在模块作用域 import Taro/i18n(node 环境下无真实实现),按仓内既有测试口径最小桩
vi.mock('@tarojs/taro', () => ({
  default: {
    getEnv: () => 'WEB',
    ENV_TYPE: { WEB: 'WEB' },
    request: vi.fn(),
    getStorageSync: () => '',
    setStorageSync: () => undefined,
  },
  getEnv: () => 'WEB',
  ENV_TYPE: { WEB: 'WEB' },
  request: vi.fn(),
  getStorageSync: () => '',
  setStorageSync: () => undefined,
}))
vi.mock('@/i18n', () => ({ t: (k: string) => k }))

import { chatStream, isMaxTokensTruncatedFinishReason, type StreamEventCallbacks } from '../index'

/** done 帧(上游 finish/stop reason 原样透传,含大小写两形态) */
const doneFrame = (finishReason?: string): string => {
  const body: Record<string, unknown> = { type: 'done', model: 'gpt-x' }
  if (finishReason !== undefined) body.finishReason = finishReason
  return `data: ${JSON.stringify(body)}\n\n`
}

type ChatStreamArgs = Parameters<typeof chatStream>

/** 把 mock 的 streamSSE 变成"真实解析器 → 真实 onEvent 分发"的管道 */
function armTransport(frames: string) {
  mockStreamSSE.mockImplementation(async (opts: { onEvent: (evt: unknown) => void }) => {
    const { events } = parseSSEChunk(frames)
    for (const evt of events) opts.onEvent(evt)
  })
}

async function runStream(callbacks: StreamEventCallbacks) {
  await (chatStream as unknown as (...args: unknown[]) => Promise<void>)(
    [] as ChatStreamArgs[0],
    'sess-1',
    {} as ChatStreamArgs[2],
    () => {},
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    callbacks,
  )
}

describe('G-425 isMaxTokensTruncatedFinishReason(阳性)', () => {
  it.each(['length', 'LENGTH', 'Length', 'max_tokens', 'MAX_TOKENS', 'Max_Tokens'])(
    'finishReason=%s ⇒ true(小写归一)',
    (reason) => {
      expect(isMaxTokensTruncatedFinishReason(reason)).toBe(true)
    },
  )
})

describe('G-425 isMaxTokensTruncatedFinishReason(阴性:其余 reason 绝不折成截断)', () => {
  it.each(['stop', 'tool_calls', 'SAFETY', 'RECITATION', 'stop_sequence', ''])(
    'finishReason=%s ⇒ false',
    (reason) => {
      expect(isMaxTokensTruncatedFinishReason(reason)).toBe(false)
    },
  )
  it('缺席(undefined/null)⇒ false,不提示', () => {
    expect(isMaxTokensTruncatedFinishReason(undefined)).toBe(false)
    expect(isMaxTokensTruncatedFinishReason(null)).toBe(false)
  })
})

describe('G-425 chatStream 运行时派发(onFinishReason)', () => {
  beforeEach(() => {
    mockStreamSSE.mockReset()
  })

  it('阳性:done 帧 finishReason=length ⇒ 通道真触发,值原样透传', async () => {
    armTransport(doneFrame('length'))
    const onFinishReason = vi.fn()
    await runStream({ onFinishReason })
    expect(onFinishReason).toHaveBeenCalledTimes(1)
    expect(onFinishReason).toHaveBeenCalledWith({ finishReason: 'length' })
  })

  it('阳性(大小写不归一透传):done 帧 finishReason=MAX_TOKENS ⇒ 原样透传,归一在判据层', async () => {
    armTransport(doneFrame('MAX_TOKENS'))
    const onFinishReason = vi.fn()
    await runStream({ onFinishReason })
    expect(onFinishReason).toHaveBeenCalledWith({ finishReason: 'MAX_TOKENS' })
  })

  it('阴性:done 帧其余 reason(stop/tool_calls/SAFETY)⇒ 通道照触发,消费侧判据判 false', async () => {
    armTransport(doneFrame('stop') + doneFrame('tool_calls') + doneFrame('SAFETY'))
    const onFinishReason = vi.fn()
    await runStream({ onFinishReason })
    expect(onFinishReason).toHaveBeenCalledTimes(3)
    for (const reason of ['stop', 'tool_calls', 'SAFETY']) {
      expect(isMaxTokensTruncatedFinishReason(reason)).toBe(false)
    }
  })

  it('反向对照:done 帧缺席 finishReason ⇒ 通道一次都不触发(缺席绝不折成 stop)', async () => {
    armTransport(doneFrame())
    const onFinishReason = vi.fn()
    await runStream({ onFinishReason })
    expect(onFinishReason).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
