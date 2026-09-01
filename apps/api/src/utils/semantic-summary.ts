// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * LLM 语义摘要(2026-09-01 立):上下文压缩触发前,对"将被压缩的旧消息"预生成中文语义摘要,
 * 通过 customSummary 传给共享包 @ihui/context-compaction,替代其内置规则摘要
 * (业界第一梯队做法,对标 Claude Code / Cursor 的 LLM 压缩摘要)。
 *
 * 设计约束:
 * - 压缩在对话请求关键路径上,摘要调用 3 秒超时;超时/失败/stub 一律静默降级
 *   (返回 null,不传 customSummary → 共享包走内置规则摘要,压缩绝不因摘要失败而中断)
 * - toCompress 范围与共享包 keepRecent=6 默认一致:除最近 6 条非 system 外的全部消息
 * - 复用 utils/ai-service-fetch.ts 调 ai-service /api/llm/complete(非流式),
 *   自动透传 traceparent + Authorization
 */

import type { FastifyRequest } from 'fastify'
import type { ChatMessage } from '@ihui/context-compaction'
import { aiServiceFetch } from './ai-service-fetch.js'

/** 与共享包 DEFAULT_KEEP_RECENT(6) 对齐:只摘要"除最近 6 条非 system 外"的消息 */
const KEEP_RECENT = 6
/** 摘要最大生成 tokens */
const SUMMARY_MAX_TOKENS = 300
/** 摘要 LLM 调用超时(ms):压缩在请求关键路径上,超时即降级 */
const SUMMARY_TIMEOUT_MS = 3_000
/** 兜底模型(与 services/crew-llm-adapter.ts DEFAULT_MODEL 同源:.env LITELLM_MODEL) */
const FALLBACK_MODEL = process.env.LITELLM_MODEL || 'stepfun/step-3.7-flash'

/**
 * 生成压缩用的 LLM 语义摘要。
 *
 * @param request 当前 Fastify request(透传 traceparent + Authorization);null 时新生成 trace
 * @param messages 已 repair 的完整消息列表
 * @param model 当前请求的 resolvedModel;空则用 LITELLM_MODEL 兜底
 * @returns 摘要正文(纯文本,`[上下文摘要 — ...]` 标记行由共享包自动加);任何失败返回 null(静默降级)
 */
export async function generateSemanticSummary(
  request: FastifyRequest | null,
  messages: ChatMessage[],
  model?: string,
): Promise<string | null> {
  try {
    // toCompress 与共享包 compressContextIfNeeded keepRecent=6 的压缩范围一致:
    // 非 system 消息中除最近 6 条外的全部(即"将被压缩成摘要"的部分)
    const nonSystem = messages.filter((m) => m.role !== 'system')
    if (nonSystem.length <= KEEP_RECENT) return null
    const toCompress = nonSystem.slice(0, nonSystem.length - KEEP_RECENT)
    if (toCompress.length === 0) return null

    const conversationText = toCompress
      .map((m) => {
        const roleLabel = m.role === 'user' ? '用户' : m.role === 'assistant' ? '助手' : '工具'
        return `${roleLabel}: ${m.content}`
      })
      .join('\n\n')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), SUMMARY_TIMEOUT_MS)
    try {
      const res = await aiServiceFetch(request, '/api/llm/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model || FALLBACK_MODEL,
          messages: [
            {
              role: 'system',
              content:
                '你是对话上下文摘要器。把下面的历史对话压缩为一段不超过 300 tokens 的中文语义摘要,必须保留:任务目标、关键决策、重要数据、未完成事项。只输出摘要正文,不要任何前缀、标题或解释。',
            },
            { role: 'user', content: conversationText },
          ],
          max_tokens: SUMMARY_MAX_TOKENS,
        }),
        signal: controller.signal,
      })
      if (!res.ok) {
        console.warn(`[SemanticSummary] upstream HTTP ${res.status}, degrade to rule summary`)
        return null
      }
      const json = (await res.json()) as {
        content?: string
        stub?: boolean
        error?: boolean
        error_message?: string
      }
      // stub 模式(未配置 LLM key)或上游报错:复用 batch-worker / callRealLlm 的 stub 判断,静默降级
      if (json.stub || json.error) {
        console.warn(
          `[SemanticSummary] stub=${json.stub} error=${json.error ?? ''}${json.error_message ?? ''}, degrade to rule summary`,
        )
        return null
      }
      const summary = (json.content ?? '').trim()
      return summary || null
    } finally {
      clearTimeout(timer)
    }
  } catch (e) {
    // 超时(AbortError)或任何异常:静默降级,不阻塞主对话链路
    const reason =
      e instanceof Error && e.name === 'AbortError'
        ? `timeout(${SUMMARY_TIMEOUT_MS}ms)`
        : ((e as Error)?.message ?? String(e))
    console.warn(`[SemanticSummary] failed: ${reason}, degrade to rule summary`)
    return null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
