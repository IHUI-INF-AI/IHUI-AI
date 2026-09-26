// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D19 派发真触发取证(运行时):chatStream 收到 terminal_delta 帧时,
 * onTerminalDelta **必须真的被调用**(阳性),且**同一条帧不得被计进正文 delta**
 * (反向对照,onChunk 只见正文帧内容)。
 *
 * 与 cards/__tests__/terminal-delta.test.ts 的分工:那份是纯逻辑 + 源码级接线;
 * 本份驱动**真实 chatStream**(仅 mock 传输层 streamSSE 与无关的 ui-control-tools),
 * 事件由**真实共享 parseSSEChunk** 解出后经真实 dispatch 分发 —— 证明的是接线本身,
 * 不是判据的复读。
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

import { chatStream, type StreamEventCallbacks } from '../index'

/** 正文帧 + 真实 terminal_delta 帧(与后端 mcp_server._emit_terminal_delta 同形态)混流 */
const MIXED_FRAMES =
  'data: {"type":"chunk","content":"正文开始"}\n\n' +
  'event: terminal_delta\n' +
  'data: {"type":"terminal_delta","terminalId":"tc-1","command":"pnpm test",' +
  '"stream":"stdout","text":"\\n✓ 7 passed\\n","iteration":3,"messageId":"m-1"}\n\n' +
  'data: {"type":"chunk","content":"正文结束"}\n\n'

type ChatStreamArgs = Parameters<typeof chatStream>

/** 把 mock 的 streamSSE 变成"真实解析器 → 真实 onEvent 分发"的管道 */
function armTransport() {
  mockStreamSSE.mockImplementation(async (opts: { onEvent: (evt: unknown) => void }) => {
    const { events } = parseSSEChunk(MIXED_FRAMES)
    for (const evt of events) opts.onEvent(evt)
  })
}

async function runStream(callbacks: StreamEventCallbacks, onChunk: (d: string) => void) {
  await (chatStream as unknown as (...args: unknown[]) => Promise<void>)(
    [] as ChatStreamArgs[0],
    'sess-1',
    {} as ChatStreamArgs[2],
    onChunk,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    callbacks,
  )
}

describe('D19 chatStream 运行时派发(terminal_delta)', () => {
  beforeEach(() => {
    mockStreamSSE.mockReset()
    armTransport()
  })

  it('阳性:一帧 terminal_delta 经真实 parse→dispatch 后,onTerminalDelta 被调用且载荷含 terminalId/text', async () => {
    const onTerminalDelta = vi.fn()
    await runStream({ onTerminalDelta }, vi.fn())
    expect(onTerminalDelta).toHaveBeenCalledTimes(1)
    expect(onTerminalDelta).toHaveBeenCalledWith(
      expect.objectContaining({
        terminalId: 'tc-1',
        command: 'pnpm test',
        text: '\n✓ 7 passed\n',
      }),
    )
  })

  it('反向对照:同一条 terminal_delta 帧不得混进正文 delta(onChunk 只见正文帧)', async () => {
    const onChunk = vi.fn()
    await runStream({ onTerminalDelta: vi.fn() }, onChunk)
    const body = onChunk.mock.calls.map((c) => String(c[0])).join('')
    expect(body).toBe('正文开始正文结束')
    expect(body).not.toContain('✓ 7 passed')
  })

  it('未注册 onTerminalDelta 时不炸流(dispatch 侧 callbacks?. 兜住)', async () => {
    const onChunk = vi.fn()
    await expect(runStream({}, onChunk)).resolves.toBeUndefined()
    expect(onChunk.mock.calls.map((c) => String(c[0])).join('')).toBe('正文开始正文结束')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
