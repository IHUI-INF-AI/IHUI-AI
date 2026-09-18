// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * W1(2026-09-12)plan_updated / terminal_start / terminal_end SSE 解析单测。
 *
 * 覆盖 streamChat 的三条新增解析分支(routeLineByType → tryParsePlanUpdate / tryParseTerminal):
 *   - plan_updated  → onPlanUpdate(plan / explanation / messageId)
 *   - terminal_start → onTerminalStart(terminalId / command / status=running / messageId)
 *   - terminal_end   → onTerminalEnd(terminalId / status / output / exitCode / durationMs / messageId)
 *   - 缺 messageId / 缺 terminalId / status 非法 → 不触发回调(守护分支)
 *
 * 说明:本文件与 apps/web/e2e/ai-tool-loop.spec.ts 的 mock SSE body 保持字节级一致,
 * 用于在"e2e 失败"时快速区分「解析层 bug」与「渲染层 bug」。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { streamChat, setStreamBaseUrl, setBaseUrl } from '../src/client.js'

/** 构造一段 SSE 流的 Response mock(仅实现 streamChat 用到的字段) */
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return {
    ok: true,
    status: 200,
    body: stream,
    headers: { get: () => null },
    text: async () => '',
  } as unknown as Response
}

const MID = 'msg-w1-unit-001'
const NOW = '2026-09-12T00:00:00.000Z'

/** 与 e2e mock 同构的 SSE body(命名事件 + data JSON) */
const PLAN_TERMINAL_BODY = [
  `event: plan_updated\ndata: ${JSON.stringify({
    type: 'plan_updated',
    plan: [{ step: 'run_command: echo hi', status: 'in_progress' }],
    explanation: '开始执行工具 run_command',
    messageId: MID,
  })}\n\n`,
  `event: terminal_start\ndata: ${JSON.stringify({
    type: 'terminal_start',
    terminalId: 'e2e-term-1',
    command: 'echo hi',
    status: 'running',
    startedAt: NOW,
    messageId: MID,
  })}\n\n`,
  `event: plan_updated\ndata: ${JSON.stringify({
    type: 'plan_updated',
    plan: [{ step: 'run_command: echo hi', status: 'completed' }],
    explanation: '开始执行工具 run_command',
    messageId: MID,
  })}\n\n`,
  `event: terminal_end\ndata: ${JSON.stringify({
    type: 'terminal_end',
    terminalId: 'e2e-term-1',
    status: 'completed',
    output: 'hi',
    exitCode: 0,
    endedAt: NOW,
    durationMs: 12,
    messageId: MID,
  })}\n\n`,
  'event: chunk\ndata: {"content":"已完成"}\n\n',
  'event: done\ndata: {"content":"已完成"}\n\n',
].join('')

const baseOpts = {
  model: 'test-model',
  messages: [{ role: 'user', content: 'hi' }],
} as const

describe('W1 streamChat:plan_updated / terminal_start / terminal_end 解析', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setBaseUrl('http://localhost:8803')
    setStreamBaseUrl('http://localhost:8803')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('三类事件全部命中,字段与契约一致', async () => {
    fetchMock.mockResolvedValue(sseResponse([PLAN_TERMINAL_BODY]))
    const onPlanUpdate = vi.fn()
    const onTerminalStart = vi.fn()
    const onTerminalEnd = vi.fn()

    await expect(
      streamChat({ ...baseOpts, onPlanUpdate, onTerminalStart, onTerminalEnd }),
    ).resolves.toBeUndefined()

    // plan:两条 plan_updated(权威快照,整体替换)
    expect(onPlanUpdate).toHaveBeenCalledTimes(2)
    const firstPlan = onPlanUpdate.mock.calls[0][0]
    expect(firstPlan.messageId).toBe(MID)
    expect(firstPlan.plan).toHaveLength(1)
    expect(firstPlan.plan[0].step).toBe('run_command: echo hi')
    expect(firstPlan.plan[0].status).toBe('in_progress')
    expect(firstPlan.explanation).toBe('开始执行工具 run_command')
    expect(onPlanUpdate.mock.calls[1][0].plan[0].status).toBe('completed')

    // terminal_start
    expect(onTerminalStart).toHaveBeenCalledTimes(1)
    const start = onTerminalStart.mock.calls[0][0]
    expect(start.terminalId).toBe('e2e-term-1')
    expect(start.command).toBe('echo hi')
    expect(start.status).toBe('running')
    expect(start.startedAt).toBe(NOW)
    expect(start.messageId).toBe(MID)

    // terminal_end
    expect(onTerminalEnd).toHaveBeenCalledTimes(1)
    const end = onTerminalEnd.mock.calls[0][0]
    expect(end.terminalId).toBe('e2e-term-1')
    expect(end.status).toBe('completed')
    expect(end.output).toBe('hi')
    expect(end.exitCode).toBe(0)
    expect(end.endedAt).toBe(NOW)
    expect(end.durationMs).toBe(12)
    expect(end.messageId).toBe(MID)
  })

  it('未传 onTerminalStart/onTerminalEnd 时不解析 terminal(能力检测守护)', async () => {
    fetchMock.mockResolvedValue(sseResponse([PLAN_TERMINAL_BODY]))
    const onPlanUpdate = vi.fn()

    await expect(streamChat({ ...baseOpts, onPlanUpdate })).resolves.toBeUndefined()
    expect(onPlanUpdate).toHaveBeenCalledTimes(2)
  })

  it('缺 messageId → 回调仍触发但 payload 无 messageId(由渲染层决定是否落库)', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        `event: terminal_start\ndata: ${JSON.stringify({
          type: 'terminal_start',
          terminalId: 't-no-mid',
          command: 'ls',
        })}\n\n`,
      ]),
    )
    const onTerminalStart = vi.fn()
    const onTerminalEnd = vi.fn()

    await expect(
      streamChat({ ...baseOpts, onTerminalStart, onTerminalEnd }),
    ).resolves.toBeUndefined()

    expect(onTerminalStart).toHaveBeenCalledTimes(1)
    expect(onTerminalStart.mock.calls[0][0].messageId).toBeUndefined()
    expect(onTerminalStart.mock.calls[0][0].status).toBe('running')
  })

  it('terminal_start 缺 terminalId / terminal_end status 非法 → 不触发回调', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        `event: terminal_start\ndata: ${JSON.stringify({ type: 'terminal_start', command: 'ls' })}\n\n`,
        `event: terminal_end\ndata: ${JSON.stringify({
          type: 'terminal_end',
          terminalId: 't1',
          status: 'running',
        })}\n\n`,
      ]),
    )
    const onTerminalStart = vi.fn()
    const onTerminalEnd = vi.fn()

    await expect(
      streamChat({ ...baseOpts, onTerminalStart, onTerminalEnd }),
    ).resolves.toBeUndefined()

    expect(onTerminalStart).not.toHaveBeenCalled()
    expect(onTerminalEnd).not.toHaveBeenCalled()
  })
})

/**
 * W4(2026-09-18)terminal_delta / thinking 分流单测。
 *
 * 锁定三条不可回归的契约:
 *  1. `terminal_delta` → onTerminalDelta(终端实时输出),字段与后端契约一致
 *  2. `thinking` → onReasoning(与 reasoning 同走推理通道)
 *  3. **两者都绝不能落进正文 onDelta**(历史坑:未知 type 的 JSON 只要带 content 字段
 *     就会被兜底分支当作正文增量,把终端输出/思考过程喷进聊天正文)
 */
describe('W4 streamChat:terminal_delta / thinking 分流', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setBaseUrl('http://localhost:8803')
    setStreamBaseUrl('http://localhost:8803')
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** 后端契约帧:终端增量 + 思考增量 + 正常正文 chunk */
  const DELTA_BODY = [
    `event: terminal_delta\ndata: ${JSON.stringify({
      type: 'terminal_delta',
      terminalId: 'term-w4-1',
      command: 'npm run build',
      stream: 'stdout',
      text: 'compiling...',
      iteration: 2,
      messageId: MID,
    })}\n\n`,
    `event: thinking\ndata: ${JSON.stringify({
      type: 'thinking',
      content: '先看看依赖树',
    })}\n\n`,
    `event: reasoning\ndata: ${JSON.stringify({
      type: 'reasoning',
      content: '推理增量',
    })}\n\n`,
    'event: chunk\ndata: {"content":"正文"}\n\n',
    'event: done\ndata: {"content":"正文"}\n\n',
  ].join('')

  it('terminal_delta 走 onTerminalDelta 且字段与契约一致', async () => {
    fetchMock.mockResolvedValue(sseResponse([DELTA_BODY]))
    const onTerminalDelta = vi.fn()
    const onDelta = vi.fn()

    await expect(
      streamChat({ ...baseOpts, onTerminalDelta, onDelta }),
    ).resolves.toBeUndefined()

    expect(onTerminalDelta).toHaveBeenCalledTimes(1)
    const evt = onTerminalDelta.mock.calls[0][0]
    expect(evt.terminalId).toBe('term-w4-1')
    expect(evt.command).toBe('npm run build')
    expect(evt.stream).toBe('stdout')
    expect(evt.text).toBe('compiling...')
    expect(evt.iteration).toBe(2)
    expect(evt.messageId).toBe(MID)
  })

  it('thinking → onReasoning;reasoning 也 → onReasoning(同通道)', async () => {
    fetchMock.mockResolvedValue(sseResponse([DELTA_BODY]))
    const onReasoning = vi.fn()

    await expect(streamChat({ ...baseOpts, onReasoning })).resolves.toBeUndefined()
    expect(onReasoning).toHaveBeenCalledTimes(2)
    const texts = onReasoning.mock.calls.map((c) => c[0])
    expect(texts).toContain('先看看依赖树')
    expect(texts).toContain('推理增量')
  })

  it('terminal_delta / thinking 绝不落进正文 onDelta(核心守护)', async () => {
    fetchMock.mockResolvedValue(sseResponse([DELTA_BODY]))
    const onDelta = vi.fn()
    const onTerminalDelta = vi.fn()
    const onReasoning = vi.fn()

    await expect(
      streamChat({ ...baseOpts, onDelta, onTerminalDelta, onReasoning }),
    ).resolves.toBeUndefined()

    const joined = onDelta.mock.calls.map((c) => String(c[0])).join('')
    expect(joined).toContain('正文')
    expect(joined).not.toContain('compiling...')
    expect(joined).not.toContain('先看看依赖树')
    expect(joined).not.toContain('推理增量')
  })

  it('未传 onTerminalDelta / onReasoning 时静默丢弃,不回落正文', async () => {
    fetchMock.mockResolvedValue(sseResponse([DELTA_BODY]))
    const onDelta = vi.fn()

    await expect(streamChat({ ...baseOpts, onDelta })).resolves.toBeUndefined()

    const joined = onDelta.mock.calls.map((c) => String(c[0])).join('')
    expect(joined).not.toContain('compiling...')
    expect(joined).not.toContain('先看看依赖树')
  })

  it('terminal_delta 缺 terminalId → 不触发回调(守护分支)', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        `event: terminal_delta\ndata: ${JSON.stringify({
          type: 'terminal_delta',
          text: 'orphan',
          stream: 'stdout',
        })}\n\n`,
      ]),
    )
    const onTerminalDelta = vi.fn()
    const onDelta = vi.fn()

    await expect(
      streamChat({ ...baseOpts, onTerminalDelta, onDelta }),
    ).resolves.toBeUndefined()

    expect(onTerminalDelta).not.toHaveBeenCalled()
    expect(onDelta.mock.calls.map((c) => String(c[0])).join('')).not.toContain('orphan')
  })

  it('compaction 标准命名帧(event: compaction + type 字段)仍走 compaction 通道', async () => {
    fetchMock.mockResolvedValue(
      sseResponse([
        `event: compaction\ndata: ${JSON.stringify({
          type: 'compaction',
          compaction: {
            triggered: true,
            tokensBefore: 100,
            tokensAfter: 40,
            removedCount: 3,
            usageRatio: 0.9,
            trigger: 'ratio',
          },
        })}\n\n`,
      ]),
    )
    const onCompaction = vi.fn()
    const onDelta = vi.fn()

    await expect(
      streamChat({ ...baseOpts, onCompaction, onDelta }),
    ).resolves.toBeUndefined()

    // 新增的 type 字段不破坏既有 compaction 键的消费路径
    expect(onCompaction).toHaveBeenCalledTimes(1)
    expect(onCompaction.mock.calls[0][0]).toMatchObject({
      tokensBefore: 100,
      tokensAfter: 40,
      removedCount: 3,
      usageRatio: 0.9,
      trigger: 'ratio',
    })
    expect(onDelta.mock.calls.map((c) => String(c[0])).join('')).toBe('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
