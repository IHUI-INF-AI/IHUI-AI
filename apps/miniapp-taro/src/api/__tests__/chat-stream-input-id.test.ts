// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node
/**
 * 批次 4(2026-11-06 立):小程序 chatStream 必须上行稳定 inputId。
 *
 * 判三件事:
 *  ① 请求体带非空 inputId(`@ihui/shared/chat` 的 createInputId 产出);
 *  ② 同一个 streamSSE 调用只拿到**一份** body 对象 —— 重连/续传在原对象上换游标,
 *     不会重建 body,所以 id 天然不随重连翻新;
 *  ③ 两次逻辑发送各自换新 id(不是模块级常量)。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockStreamSSE } = vi.hoisted(() => ({ mockStreamSSE: vi.fn() }))

vi.mock('@/lib/sse', () => ({ streamSSE: mockStreamSSE }))
vi.mock('@/lib/ui-control-tools', () => ({ resolveAgentTools: (tools: unknown) => tools }))
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

import { chatStream } from '../index'

type ChatStreamArgs = Parameters<typeof chatStream>

async function runStream() {
  await (chatStream as unknown as (...args: unknown[]) => Promise<void>)(
    [{ role: 'user', content: '你好' }] as ChatStreamArgs[0],
    'sess-1',
    {} as ChatStreamArgs[2],
    vi.fn(),
  )
}

describe('小程序 chatStream inputId 幂等键', () => {
  beforeEach(() => {
    mockStreamSSE.mockReset()
    mockStreamSSE.mockResolvedValue(undefined)
  })

  it('请求体上行非空 inputId', async () => {
    await runStream()
    const call = mockStreamSSE.mock.calls[0]!
    const opts = call[0] as { body: Record<string, unknown> }
    expect(typeof opts.body.inputId).toBe('string')
    expect((opts.body.inputId as string).length).toBeGreaterThan(0)
  })

  it('一次逻辑发送只构造一份 body(重连复用同一对象 ⇒ id 不翻新)', async () => {
    await runStream()
    const call = mockStreamSSE.mock.calls[0]!
    const opts = call[0] as {
      body: Record<string, unknown>
      onReconnect: (attempt?: number, delayMs?: number) => void
    }
    const before = opts.body.inputId
    opts.onReconnect(1, 100)
    expect(opts.body.inputId).toBe(before)
    // 传输层拿到的就是这一个对象,没有第二份 body 可换 id
    expect(call[0].body).toBe(opts.body)
  })

  it('两次逻辑发送各生成新 id(不是模块级常量)', async () => {
    await runStream()
    const first = (mockStreamSSE.mock.calls[0]![0] as { body: Record<string, unknown> }).body
      .inputId
    await runStream()
    const second = (mockStreamSSE.mock.calls[1]![0] as { body: Record<string, unknown> }).body
      .inputId
    expect(second).not.toBe(first)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
