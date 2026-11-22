// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 对话后续指令推荐(2026-11-14 立)。
 *
 * 环境建议条(D45 ambient suggestions)原先由前端按 planSteps/toolCalls 确定性推导,
 * 产出的是「就上述内容继续追问」这类元描述 —— 点击只是把标签原文填进输入框,用户
 * 拿不到任何可直接发送的真实 prompt。本模块改为让模型读最近对话,产出 2-4 条
 * 用户视角、可直接一键发送的完整指令。
 *
 * 设计约束(与 conversation-title.ts 同源):
 * - 非关键路径:8 秒超时;超时/失败/stub 一律静默返回空数组,前端不渲染建议条
 * - 输出必须是 JSON 字符串数组;模型偶发加代码块/编号/引号,由 parseFollowUpSuggestions 清洗
 * - 消耗计入 AI 成本(requestType: 'follow-up-suggestions')
 */

import type { FastifyRequest } from 'fastify'
import { aiServiceFetch } from './ai-service-fetch.js'
import { recordAiCost } from '../plugins/ai-cost.js'
import { resolveDefaultChatModel } from './retired-providers.js'

/** 建议条上限(与原 D45 的 ≤4 条一致) */
export const MAX_FOLLOW_UP_SUGGESTIONS = 4
/** 单条建议最大字符数(超长硬截断,防模型输出整段方案) */
export const MAX_FOLLOW_UP_CHARS = 120
/** 生成超时(ms):辅助路径,超时即放弃 */
const SUGGEST_TIMEOUT_MS = 8_000
/** 生成 tokens 上限(4 条 × 80 字 ≈ 240 tokens,留余量) */
const SUGGEST_MAX_TOKENS = 400
/** 喂给模型的最近消息条数与单条字符上限 */
const TRANSCRIPT_MAX_MESSAGES = 8
const TRANSCRIPT_MAX_CHARS_PER_MESSAGE = 1_200
/** 兜底模型(与 conversation-title.ts 同源,禁止写死 provider) */
const FALLBACK_MODEL = resolveDefaultChatModel()

export interface FollowUpSuggestionMessage {
  role: 'user' | 'assistant'
  content: string
}

/** 成对引号集合(码点转义,规避源文件直书 CJK 引号的编码风险) */
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

/** 列表前缀:"- " "* " "1. " "1) " "① " */
const LIST_PREFIX_RE = /^(?:[-*\u2022\u00b7]|\d{1,2}[.)\u3001]|[\u2460-\u2469])\s*/

function normalizeSuggestion(raw: string): string | null {
  let text = raw.replace(/\s+/g, ' ').trim()
  text = text.replace(LIST_PREFIX_RE, '').trim()
  if (text.length >= 2 && WRAP_QUOTES.includes(text[0]!) && WRAP_QUOTES.includes(text.at(-1)!)) {
    text = text.slice(1, -1).trim()
  }
  if (!text) return null
  if (text.length > MAX_FOLLOW_UP_CHARS) text = text.slice(0, MAX_FOLLOW_UP_CHARS)
  return text
}

/** 从模型输出里提取 JSON 数组(容忍 ```json 代码块与前后解释文本) */
function extractJsonArray(text: string): unknown[] | null {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end <= start) return null
  try {
    const value = JSON.parse(text.slice(start, end + 1)) as unknown
    return Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

/**
 * 清洗模型输出为可直接发送的指令列表。
 * 独立导出供单测锁定行为:解析失败即降级,绝不把脏文本渲染成"建议"。
 */
export function parseFollowUpSuggestions(raw: string): string[] {
  const source = raw.trim()
  if (!source) return []

  const candidates: string[] = []
  const jsonArray = extractJsonArray(source)
  if (jsonArray) {
    for (const item of jsonArray) {
      if (typeof item === 'string') candidates.push(item)
    }
  } else {
    // 兜底:模型没按 JSON 输出时按行取(常见形态是「1. xxx」逐行)。
    // 注意:识别到 JSON 数组(哪怕为空)就不再走行兜底 —— 否则 "{\"suggestions\": []}"
    // 会被整段当成一条建议,把空结果谎报成有建议。
    for (const line of source.replace(/```[a-zA-Z]*/g, '').split('\n')) {
      const normalized = normalizeSuggestion(line)
      if (normalized && normalized.length >= 4) candidates.push(normalized)
    }
  }

  const out: string[] = []
  const seen = new Set<string>()
  for (const candidate of candidates) {
    const normalized = normalizeSuggestion(candidate)
    if (!normalized || normalized.length < 4) continue
    const dedupeKey = normalized.toLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    out.push(normalized)
    if (out.length >= MAX_FOLLOW_UP_SUGGESTIONS) break
  }
  return out
}

function buildTranscript(messages: readonly FollowUpSuggestionMessage[]): string {
  return messages
    .slice(-TRANSCRIPT_MAX_MESSAGES)
    .map((m) => {
      const who = m.role === 'user' ? '用户' : '助手'
      const text = m.content.trim().slice(0, TRANSCRIPT_MAX_CHARS_PER_MESSAGE)
      return `${who}: ${text}`
    })
    .join('\n\n')
}

const SYSTEM_PROMPT = [
  '你是对话后续指令推荐器。阅读「最近对话」,从用户视角写出 2-4 条用户此刻最可能直接发送给助手的下一条完整指令。',
  '硬性要求:',
  '1. 每条必须是可直接发送的指令本身,8-80 字,具体到对象(文件名/模块/页面/问题/下一步动作),禁止空泛措辞(如"继续追问""详细说说""还有什么")。',
  '2. 条目角度互不重复:优先覆盖「继续未完成的动作」「验证/测试/检查结果」「完善或优化具体点」「解释或总结具体结论」。',
  '3. 使用最近对话的主要语言。',
  '4. 只输出 JSON 字符串数组,例如 ["检查 src/auth.ts 的登录校验并补单测","运行 pnpm test 验证本次改动"]。不要 Markdown 代码块、不要编号、不要解释。',
].join('\n')

/**
 * 生成后续指令建议。
 * @param request 当前 Fastify request(透传 traceparent + Authorization);null 时允许
 * @param messages 最近对话(user/assistant,已由调用方裁剪)
 * @param model 当前会话模型;空则用默认聊天模型兜底
 * @returns 2-4 条可直接发送的指令;任何失败返回空数组(前端不渲染建议条)
 */
export async function generateFollowUpSuggestions(
  request: FastifyRequest | null,
  messages: readonly FollowUpSuggestionMessage[],
  model?: string,
): Promise<string[]> {
  const transcript = buildTranscript(messages)
  if (!transcript) return []
  const usedModel = model || FALLBACK_MODEL
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), SUGGEST_TIMEOUT_MS)
    try {
      const res = await aiServiceFetch(request, '/api/llm/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: usedModel,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `最近对话:\n\n${transcript}` },
          ],
          temperature: 0.4,
          max_tokens: SUGGEST_MAX_TOKENS,
        }),
        signal: controller.signal,
      })
      if (!res.ok) {
        console.warn(`[FollowUpSuggestions] upstream HTTP ${res.status}, skip`)
        return []
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
          `[FollowUpSuggestions] stub=${json.stub} error=${json.error ?? ''}${json.error_message ?? ''}, skip`,
        )
        return []
      }
      const suggestions = parseFollowUpSuggestions(json.content ?? '')
      if (suggestions.length > 0) {
        await recordSuggestCost(request, usedModel, json.usage, transcript, suggestions.join('\n'))
      }
      return suggestions
    } finally {
      clearTimeout(timer)
    }
  } catch (e) {
    const reason =
      e instanceof Error && e.name === 'AbortError'
        ? `timeout(${SUGGEST_TIMEOUT_MS}ms)`
        : ((e as Error)?.message ?? String(e))
    console.warn(`[FollowUpSuggestions] failed: ${reason}, skip`)
    return []
  }
}

/**
 * 建议生成 LLM 消耗计入配额(与 conversation-title.recordTitleCost 同模式):
 * - userId 从 request.userId 取;request 为 null 或无归属用户时跳过计费
 * - tokens 优先透传上游 usage;缺失时按字符估算(建议条极短,估算仅供账单参考)
 */
async function recordSuggestCost(
  request: FastifyRequest | null,
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
  promptText: string,
  completionText: string,
): Promise<void> {
  const userId = request?.userId
  if (!userId) return
  const promptTokens = usage?.prompt_tokens ?? Math.ceil(promptText.length / 2)
  const completionTokens = usage?.completion_tokens ?? Math.ceil(completionText.length / 2)
  try {
    await recordAiCost({
      userId,
      model,
      provider: model.includes('/') ? model.split('/')[0]! : 'unknown',
      promptTokens,
      completionTokens,
      totalTokens: usage?.total_tokens ?? promptTokens + completionTokens,
      requestType: 'follow-up-suggestions',
      metadata: JSON.stringify({ source: 'follow-up-suggestions' }),
    })
  } catch (e) {
    console.warn(`[FollowUpSuggestions] recordAiCost failed: ${(e as Error)?.message ?? String(e)}`)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
