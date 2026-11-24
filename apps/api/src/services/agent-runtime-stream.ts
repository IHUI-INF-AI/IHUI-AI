// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * agent-runtime 流式执行消费器(2026-09-08 立,从 agent-automation-scheduler
 * 的 consumeAgentStream 提取为共享单源)。
 *
 * 这是"创建一次 agent 运行"的真实执行器调用路径:向 ai-service
 * /api/agent-runtime/execute/stream 发 POST,消费整段 SSE 流,摘取最终摘要。
 * automations 定时调度与事件唤醒 webhook 共用同一执行器(事件源不同:时钟 vs webhook),
 * 因此抽成共享函数,避免两处重复实现 SSE 解析逻辑。
 *
 * 仅消费流、摘取摘要,不负责落库/重试 —— 落库与重试策略由各自的调用方决定。
 */

import type { FastifyRequest } from 'fastify'
import { aiServiceFetchStream } from '../utils/ai-service-fetch.js'

/** SSE 流中摘取的执行结果 */
export interface AgentStreamCapture {
  summary: string | null
  contentTail: string
  errorMessage: string | null
  /** F-345:整次执行是否成功(done 帧 success=false、上游异常、断流 ⇒ false) */
  ok?: boolean
  /** F-345:done 帧 success 原始值;null = 未收到 done 帧 */
  success?: boolean | null
  /** F-345:done 帧 goal_status(Goal 自评结论) */
  goalStatus?: string | null
  /** F-345:done 帧 stop_reason */
  stopReason?: string | null
}

const CONTENT_TAIL_LIMIT = 2000

/** 把 done 帧的 output 归一为文本(上游为字符串;数组按元素 text/content/output 取) */
function normalizeOutputText(value: unknown): string {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  const parts: string[] = []
  for (const item of value) {
    if (typeof item === 'string') {
      parts.push(item)
      continue
    }
    if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>
      const text = rec.text ?? rec.content ?? rec.output
      if (typeof text === 'string') parts.push(text)
    }
  }
  return parts.filter((part) => part).join('\n')
}

/** 新建一份空的捕获结果(流消费与单测共用) */
export function createAgentStreamCapture(): AgentStreamCapture {
  return {
    summary: null,
    contentTail: '',
    errorMessage: null,
    ok: true,
    success: null,
    goalStatus: null,
    stopReason: null,
  }
}

/**
 * F-345:解析单条 SSE data 事件。
 * 上游 done 帧真实字段为 success/stop_reason/output/goal_status(旧帧仍有 summary/content/message)。
 */
export function applyAgentStreamEvent(
  capture: AgentStreamCapture,
  data: Record<string, unknown>,
): void {
  const isDoneFrame = data.type === 'done' || typeof data.success === 'boolean'
  if (typeof data.success === 'boolean') {
    capture.success = data.success
    if (data.success === false) {
      // done 帧明确失败:结构化置失败,不得再当成功结算。
      capture.ok = false
      capture.summary = null
      const stopReason =
        typeof data.stop_reason === 'string' && data.stop_reason ? data.stop_reason : null
      if (stopReason) capture.stopReason = stopReason
      capture.errorMessage =
        capture.errorMessage ?? `上游执行失败${stopReason ? `(${stopReason})` : '(success=false)'}`
    }
  }
  if (typeof data.stop_reason === 'string' && data.stop_reason) {
    capture.stopReason = data.stop_reason
  }
  if (typeof data.goal_status === 'string' && data.goal_status) {
    capture.goalStatus = data.goal_status
  }
  // 摘要优先级:output > message > summary > content(done 帧才用 message/content 兜底,
  // 避免把错误帧的 message 当摘要)。
  const summaryCandidate =
    normalizeOutputText(data.output) ||
    (isDoneFrame && typeof data.message === 'string' ? data.message : '') ||
    (typeof data.summary === 'string' ? data.summary : '') ||
    (isDoneFrame && typeof data.content === 'string' ? data.content : '')
  if (summaryCandidate.trim() && data.success !== false) {
    capture.summary = summaryCandidate
  }
  if (typeof data.content === 'string' && data.content) {
    capture.contentTail = (capture.contentTail + data.content).slice(-CONTENT_TAIL_LIMIT)
  }
  if (typeof data.message === 'string' && data.message) {
    capture.errorMessage = data.message
  }
}

/** 解析整段 SSE 文本(单测可直接喂文本;不抛错,坏帧忽略) */
export function parseAgentRuntimeSseText(text: string): AgentStreamCapture {
  const capture = createAgentStreamCapture()
  for (const block of text.split(/\n\n/)) {
    if (!block.trim()) continue
    let dataStr = ''
    for (const rawLine of block.split('\n')) {
      const line = rawLine.replace(/\r$/, '')
      if (line.startsWith('data:')) dataStr += line.slice(5).replace(/^\s/, '')
    }
    if (!dataStr) continue
    try {
      const data = JSON.parse(dataStr) as Record<string, unknown>
      if (data && typeof data === 'object') applyAgentStreamEvent(capture, data)
    } catch {
      // 不完整 JSON 忽略
    }
  }
  return capture
}

/** 消费 agent-runtime SSE 流直到结束,摘取最终摘要(失败不抛错,返回捕获信息)。 */
export async function captureAgentRuntimeStream(
  prompt: string,
  request: FastifyRequest | null,
  opts: { mode?: string; sessionId?: string; botId?: string } = {},
): Promise<AgentStreamCapture> {
  const capture = createAgentStreamCapture()
  const upstream = await aiServiceFetchStream(request, '/api/agent-runtime/execute/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      message: prompt,
      mode: opts.mode ?? 'auto',
      sessionId: opts.sessionId,
      botId: opts.botId,
    }),
  })

  if (!upstream.ok || !upstream.body) {
    capture.errorMessage = `上游服务异常(状态码 ${upstream.status})`
    capture.ok = false
    return capture
  }

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const handleBlock = (block: string): void => {
    let dataStr = ''
    for (const rawLine of block.split('\n')) {
      const line = rawLine.replace(/\r$/, '')
      if (line.startsWith('data:')) dataStr += line.slice(5).replace(/^\s/, '')
    }
    if (!dataStr) return
    let data: Record<string, unknown>
    try {
      data = JSON.parse(dataStr) as Record<string, unknown>
    } catch {
      return
    }
    applyAgentStreamEvent(capture, data)
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        if (block.trim()) handleBlock(block)
      }
    }
    if (buffer.trim()) handleBlock(buffer)
  } catch (err) {
    capture.ok = false
    capture.errorMessage = capture.errorMessage ?? String(err)
  }

  return capture
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
