// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-252:自动化对 agent SSE 无总超时/无空闲超时 —— 上游挂起即整轮调度停摆。
 * F-253:已收到内容后断流/收到 data.message 错误帧仍按成功结算 —— attempt 归零且不重试。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
})

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetchStream: vi.fn(),
}))

const streamMock = vi.mocked(
  (await import('../src/utils/ai-service-fetch.js')).aiServiceFetchStream,
)
const {
  consumeAgentStream,
  captureIsFailure,
  AGENT_STREAM_IDLE_TIMEOUT_MS,
  AGENT_STREAM_TOTAL_TIMEOUT_MS,
} = await import('../src/services/agent-automation-scheduler.js')

/** 拼一条 SSE 响应;给 error 则"先交付已入队 chunk、下一次 read 再 errored";给 hang 则永不 close。 */
function sseResponse(
  chunks: string[],
  mode: { error?: Error; hang?: boolean } = {},
): Response {
  const encoder = new TextEncoder()
  if (!mode.error && !mode.hang) {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
        controller.close()
      },
    })
    return new Response(body, { status: 200 })
  }
  // error() 会清空已入队数据,所以必须按需 pull:让 reader 先真正拿到 chunk,
  // 下一次 read 才收到错误 —— 这才对应"已收到部分内容后断流"的现实形态。
  let index = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]!))
        index += 1
        return
      }
      if (mode.error) controller.error(mode.error)
      // hang:不 enqueue 也不 close —— 读永远挂起,等待空闲超时。
    },
  })
  return new Response(body, { status: 200 })
}

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

const params = { message: '跑一下', sessionId: 's-1', botId: 'b-1' }

describe('F-252 超时常量与总 deadline', () => {
  it('空闲窗短于总时限,且两者都落在合理区间', () => {
    expect(AGENT_STREAM_IDLE_TIMEOUT_MS).toBe(120_000)
    expect(AGENT_STREAM_TOTAL_TIMEOUT_MS).toBe(10 * 60_000)
    expect(AGENT_STREAM_IDLE_TIMEOUT_MS).toBeLessThan(AGENT_STREAM_TOTAL_TIMEOUT_MS)
  })

  it('上游挂起(不再发 chunk)⇒ 空闲超时收尾,按失败返回而非永久等待', async () => {
    streamMock.mockResolvedValue(
      sseResponse(['data: {"content":"先到一段"}\n\n'], { hang: true }),
    )
    vi.useFakeTimers()
    const pending = consumeAgentStream(null, params)
    await vi.advanceTimersByTimeAsync(AGENT_STREAM_IDLE_TIMEOUT_MS)
    const capture = await pending

    expect(capture.streamFailed).toBe(true)
    expect(capture.errorMessage).toContain('等待上游数据超过')
    expect(capture.contentTail).toBe('先到一段')
    expect(captureIsFailure(capture)).toBe(true)
  })
})

describe('F-253 已收到内容后的失败不得被洗成成功', () => {
  it('流内 data.message 错误帧 ⇒ streamFailed(即使前面已有 content)', async () => {
    streamMock.mockResolvedValue(
      sseResponse([
        'data: {"content":"部分输出"}\n\n',
        'data: {"message":"模型配额不足"}\n\n',
      ]),
    )
    const capture = await consumeAgentStream(null, params)

    expect(capture.summary).toBeNull()
    expect(capture.contentTail).toBe('部分输出')
    expect(capture.errorMessage).toBe('模型配额不足')
    expect(capture.streamFailed).toBe(true)
    expect(captureIsFailure(capture)).toBe(true)
  })

  it('读流中途挂断 ⇒ streamFailed,保留已收到内容作为诊断', async () => {
    streamMock.mockResolvedValue(
      sseResponse(['data: {"content":"半截"}'], { error: new Error('socket hang up') }),
    )
    const capture = await consumeAgentStream(null, params)

    expect(capture.streamFailed).toBe(true)
    expect(capture.errorMessage).toContain('socket hang up')
    expect(capture.contentTail).toBe('半截')
    expect(captureIsFailure(capture)).toBe(true)
  })

  it('正常结束 ⇒ streamFailed=false,captureIsFailure=false', async () => {
    streamMock.mockResolvedValue(sseResponse(['data: {"summary":"完成"}\n\n']))
    const capture = await consumeAgentStream(null, params)

    expect(capture.streamFailed).toBe(false)
    expect(capture.upstreamStatus).toBeNull()
    expect(capture.summary).toBe('完成')
    expect(captureIsFailure(capture)).toBe(false)
  })

  it('成功分支与 goal 自评都走结构化判据,不再只看 upstreamStatus', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/services/agent-automation-scheduler.ts', import.meta.url)),
      'utf-8',
    )
    expect(src).toContain('if (captureIsFailure(capture))')
    expect(src).toContain('captureIsFailure(evalCapture)')
    // 传入 fetch 的 signal 必须在位(总 deadline 能真正断掉建连/读流)。
    expect(src).toContain('signal: controller.signal')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
