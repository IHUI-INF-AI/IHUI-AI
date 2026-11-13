// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-345:agent-runtime SSE 解析不识别上游 done 帧真实协议(success/stop_reason/output/goal_status)。
 * 锁四件事:① output 成为摘要;② success=false 结构化失败;③ goal_status 被解析;④ 旧帧兼容。
 */
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
const { parseAgentRuntimeSseText } = await import('../src/services/agent-runtime-stream.js')
const { consumeAgentStream, captureIsFailure } =
  await import('../src/services/agent-automation-scheduler.js')

/** 一次性交付全部 chunk 的 200 响应(模拟正常结束的 SSE 流)。 */
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(body, { status: 200 })
}

afterEach(() => {
  vi.clearAllMocks()
})

const params = { message: '跑一下', sessionId: 's-345', botId: 'b-345' }

describe('F-345 ① done 帧 output 成为摘要', () => {
  it('{success:true, output:"..."} ⇒ summary 取 output,且优先于旧 summary 字段', () => {
    const capture = parseAgentRuntimeSseText(
      'data: {"type":"done","success":true,"output":"日报正文","summary":"旧摘要"}\n\n',
    )

    expect(capture.summary).toBe('日报正文')
    expect(capture.ok).toBe(true)
    expect(capture.success).toBe(true)
  })

  it('output 为数组时按元素归一为文本', () => {
    const capture = parseAgentRuntimeSseText(
      'data: {"type":"done","success":true,"output":[{"text":"第一段"},{"content":"第二段"}]}\n\n',
    )

    expect(capture.summary).toBe('第一段\n第二段')
  })
})

describe('F-345 ② done 帧 success=false ⇒ 结构化失败,不再当成功', () => {
  it('解析结果带 ok=false 与失败原因,不落成功摘要', () => {
    const capture = parseAgentRuntimeSseText(
      'data: {"type":"done","success":false,"output":"","stop_reason":"max_iterations"}\n\n',
    )

    expect(capture.ok).toBe(false)
    expect(capture.success).toBe(false)
    expect(capture.summary).toBeNull()
    expect(capture.stopReason).toBe('max_iterations')
    expect(capture.errorMessage).toContain('上游执行失败')
  })

  it('consumeAgentStream 侧 captureIsFailure 为 true(不会按成功结算)', async () => {
    streamMock.mockResolvedValue(
      sseResponse([
        'data: {"type":"chunk","content":"半截输出"}\n\n',
        'data: {"type":"done","success":false,"output":"","stop_reason":"max_iterations"}\n\n',
      ]),
    )
    const capture = await consumeAgentStream(null, params)

    expect(capture.doneSuccess).toBe(false)
    expect(capture.stopReason).toBe('max_iterations')
    expect(capture.errorMessage).toContain('上游执行失败')
    expect(captureIsFailure(capture)).toBe(true)
  })
})

describe('F-345 ③ goal_status 被解析进结果', () => {
  it('done 帧 goal_status/stop_reason 落到结构化字段', () => {
    const capture = parseAgentRuntimeSseText(
      'data: {"type":"done","success":true,"output":"达成","goal_status":"achieved","stop_reason":"completed"}\n\n',
    )

    expect(capture.goalStatus).toBe('achieved')
    expect(capture.stopReason).toBe('completed')
    expect(capture.summary).toBe('达成')
  })
})

describe('F-345 ④ 旧帧(content/message/summary)仍兼容', () => {
  it('旧协议帧:content 累积、summary 取旧字段、不误判失败', () => {
    const capture = parseAgentRuntimeSseText(
      'data: {"type":"chunk","content":"片段A"}\n\ndata: {"summary":"旧摘要"}\n\ndata: {"message":"旧协议消息"}\n\n',
    )

    expect(capture.contentTail).toBe('片段A')
    expect(capture.summary).toBe('旧摘要')
    expect(capture.ok).toBe(true)
    expect(capture.success).toBeNull()
    expect(capture.errorMessage).toBe('旧协议消息')
  })

  it('consumeAgentStream 对旧格式正常流仍判成功', async () => {
    streamMock.mockResolvedValue(
      sseResponse(['data: {"content":"旧内容"}\n\ndata: {"summary":"完成"}\n\n']),
    )
    const capture = await consumeAgentStream(null, params)

    expect(capture.summary).toBe('完成')
    expect(capture.contentTail).toBe('旧内容')
    expect(captureIsFailure(capture)).toBe(false)
  })
})
