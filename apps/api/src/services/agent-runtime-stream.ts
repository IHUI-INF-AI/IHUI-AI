// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

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
}

const CONTENT_TAIL_LIMIT = 2000

/** 消费 agent-runtime SSE 流直到结束,摘取最终摘要(失败不抛错,返回捕获信息)。 */
export async function captureAgentRuntimeStream(
  prompt: string,
  request: FastifyRequest | null,
  opts: { mode?: string; sessionId?: string; botId?: string } = {},
): Promise<AgentStreamCapture> {
  const capture: AgentStreamCapture = { summary: null, contentTail: '', errorMessage: null }
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
    if (typeof data.summary === 'string' && data.summary.trim()) {
      capture.summary = data.summary
    }
    if (typeof data.content === 'string' && data.content) {
      capture.contentTail = (capture.contentTail + data.content).slice(-CONTENT_TAIL_LIMIT)
    }
    if (typeof data.message === 'string' && data.message) {
      capture.errorMessage = data.message
    }
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
    capture.errorMessage = capture.errorMessage ?? String(err)
  }

  return capture
}
// ⁠[IHUI-AI-PROVENANCE] agent-runtime-stream · IHUI AI (智汇AI) · 李春川 · aizhs.top
