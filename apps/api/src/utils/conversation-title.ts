// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话标题自动生成(2026-09-15 立,四竞品对标第二轮 V2 #15):
 * 首轮回复完成后,由前端触发 POST /chat/conversations/:id/auto-title,
 * 本模块调 ai-service /api/llm/complete(非流式)生成 ≤24 字标题并回写。
 *
 * 设计约束(与 semantic-summary.ts 同源):
 * - 非关键路径:3 秒超时;超时/失败/stub 一律静默返回 null(前端保持默认标题,绝不报错打扰)
 * - 仅当会话标题仍为默认值「新对话」时才覆盖(schema 默认值),用户手动重命名后不再自动改
 * - 标题语言跟随首条用户消息语言(不指定输出语言,LLM 跟随输入)
 */

import type { FastifyRequest } from 'fastify'
import { aiServiceFetch } from './ai-service-fetch.js'
import { recordAiCost } from '../plugins/ai-cost.js'

/** 标题最大生成 tokens(24 个中文字符 ≈ 40 tokens,留余量) */
const TITLE_MAX_TOKENS = 60
/** 标题 LLM 调用超时(ms):后台非关键路径,超时即静默放弃 */
const TITLE_TIMEOUT_MS = 3_000
/** 标题最大字符数(硬截断防御,防 LLM 输出超长) */
export const TITLE_MAX_CHARS = 24
/** chat_conversations.title 的 schema 默认值(packages/database/src/schema/chat.ts) */
export const DEFAULT_CONVERSATION_TITLE = '新对话'
/** 兜底模型(与 utils/semantic-summary.ts FALLBACK_MODEL 同源:.env LITELLM_MODEL) */
const FALLBACK_MODEL = process.env.LITELLM_MODEL || 'stepfun/step-3.7-flash'

/**
 * 包裹引号集合(码点转义,规避源文件直书 CJK 引号的编码风险):
 * " ' “ ” « » 『 』 「 」
 */
const WRAP_QUOTES = [
  '"',
  "'",
  '\u201c',
  '\u201d',
  '\u00ab',
  '\u00bb',
  '\u300e',
  '\u300f',
  '\u300c',
  '\u300d',
]

/**
 * 清洗 LLM 输出的标题:去包裹引号/空白/换行 + 硬截断。
 * 独立导出供单测锁定行为(清洗失败即静默降级,绝不写脏标题入库)。
 */
export function sanitizeGeneratedTitle(raw: string): string | null {
  let title = raw.trim()
  // 去一行化:LLM 偶发输出多行,只取首行
  const firstLine = title.split('\n')[0]?.trim() ?? ''
  title = firstLine
  // 去成对包裹引号:首尾字符均为引号集合成员时剥离(中英直角弯引号 + ASCII 直引号)
  if (title.length >= 2 && WRAP_QUOTES.includes(title[0]!) && WRAP_QUOTES.includes(title.at(-1)!)) {
    title = title.slice(1, -1).trim()
  }
  // 去常见前缀(如「标题:」)
  title = title.replace(/^(标题|Title)\s*[:：]\s*/i, '')
  if (!title) return null
  if (title.length > TITLE_MAX_CHARS) title = title.slice(0, TITLE_MAX_CHARS)
  return title
}

/**
 * 生成会话标题。
 * @param request 当前 Fastify request(透传 traceparent + Authorization);null 时允许(后台任务)
 * @param userText 首条用户消息文本(已由调用方截断到合理长度)
 * @param model 当前会话模型;空则用 LITELLM_MODEL 兜底
 * @returns 标题文本;任何失败返回 null(调用方静默跳过,保持默认标题)
 */
export async function generateConversationTitle(
  request: FastifyRequest | null,
  userText: string,
  model?: string,
): Promise<string | null> {
  const trimmed = userText.trim()
  if (!trimmed) return null
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TITLE_TIMEOUT_MS)
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
                '你是会话标题生成器。根据用户的第一条消息生成一个不超过 24 个字符的标题,概括用户的意图或话题。标题必须与用户消息使用相同语言,只输出标题正文本身:不要引号、不要标点结尾、不要"标题:"等前缀、不要任何解释。',
            },
            { role: 'user', content: trimmed.slice(0, 2_000) },
          ],
          max_tokens: TITLE_MAX_TOKENS,
        }),
        signal: controller.signal,
      })
      if (!res.ok) {
        console.warn(`[ConversationTitle] upstream HTTP ${res.status}, keep default title`)
        return null
      }
      const json = (await res.json()) as {
        content?: string
        stub?: boolean
        error?: boolean
        error_message?: string
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      }
      if (json.stub || json.error) {
        console.warn(
          `[ConversationTitle] stub=${json.stub} error=${json.error ?? ''}${json.error_message ?? ''}, keep default title`,
        )
        return null
      }
      const title = sanitizeGeneratedTitle(json.content ?? '')
      if (title) {
        // 标题 LLM 消耗计入配额(与 semantic-summary 同模式;失败只 warn 不影响主流程)
        await recordTitleCost(request, model, json.usage, trimmed, title)
      }
      return title
    } finally {
      clearTimeout(timer)
    }
  } catch (e) {
    const reason =
      e instanceof Error && e.name === 'AbortError'
        ? `timeout(${TITLE_TIMEOUT_MS}ms)`
        : ((e as Error)?.message ?? String(e))
    console.warn(`[ConversationTitle] failed: ${reason}, keep default title`)
    return null
  }
}

/**
 * 标题生成 LLM 消耗计入配额(与 semantic-summary.recordSummaryCost 同模式):
 * - userId 从 request.userId 取;request 为 null 或无归属用户时跳过计费
 * - tokens 优先透传上游 usage;缺失时按字符估算(标题极短,估算仅供账单参考)
 * - metadata 标注 source: 'conversation-title',便于 admin 成本账单按来源区分
 */
async function recordTitleCost(
  request: FastifyRequest | null,
  model: string | undefined,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
  promptText: string,
  completionText: string,
): Promise<void> {
  const userId = request?.userId
  if (!userId) return
  const usedModel = model || FALLBACK_MODEL
  const promptTokens = usage?.prompt_tokens ?? Math.ceil(promptText.length / 2)
  const completionTokens = usage?.completion_tokens ?? Math.ceil(completionText.length / 2)
  try {
    await recordAiCost({
      userId,
      model: usedModel,
      provider: usedModel.includes('/') ? usedModel.split('/')[0]! : 'unknown',
      promptTokens,
      completionTokens,
      totalTokens: usage?.total_tokens ?? promptTokens + completionTokens,
      requestType: 'conversation-title',
      metadata: JSON.stringify({ source: 'conversation-title' }),
    })
  } catch (e) {
    console.warn(`[ConversationTitle] recordAiCost failed: ${(e as Error)?.message ?? String(e)}`)
  }
}
