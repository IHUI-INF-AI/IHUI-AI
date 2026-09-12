// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Gemini 协议入站转换层(2026-09-13 立,纯函数零依赖)。
 *
 * 职责:Gemini generateContent 格式 ↔ OpenAI chat 格式双向适配,
 * 供 routes/v1-gemini.ts 复用 v1 公开链路(渠道 failover + 两段式计费)。
 * 本模块只做协议转换,不做鉴权/计费/转发(那些在路由层与共享核内)。
 *
 * 覆盖面(对齐 Gemini API 常用子集):
 * - 入站:contents[].role(user/model)+parts[].text、systemInstruction、
 *   generationConfig{temperature,maxOutputTokens,topP,topK}
 * - 出站:candidates[].content.parts[].text、finishReason(STOP/MAX_TOKENS)、
 *   usageMetadata{promptTokenCount,candidatesTokenCount,totalTokenCount}
 * - 不支持部分:inlineData 多模态(跳过该 part)、functionCall/tools(忽略)
 */
import { z } from 'zod'
import type { V1ChatCompletionResponse } from '@ihui/types'

// =============================================================================
// 入站 schema
// =============================================================================

const geminiPartSchema = z
  .object({ text: z.string().optional(), inlineData: z.unknown().optional() })
  .passthrough()

const geminiContentSchema = z
  .object({
    role: z.string().optional(),
    parts: z
      .union([z.array(z.union([geminiPartSchema, z.string(), z.null()])), z.string(), z.null()])
      .optional(),
  })
  .passthrough()

export const geminiRequestSchema = z
  .object({
    contents: z.array(geminiContentSchema).optional(),
    systemInstruction: geminiContentSchema.optional(),
    generationConfig: z
      .object({
        temperature: z.number().min(0).max(2).optional(),
        maxOutputTokens: z.number().int().positive().optional(),
        topP: z.number().min(0).max(1).optional(),
        topK: z.number().int().positive().optional(),
      })
      .optional(),
  })
  .passthrough()

export type GeminiRequest = z.infer<typeof geminiRequestSchema>

/** Gemini → chat 转换后的请求体(与 v1-public chatCompletionSchema 形状对齐) */
export interface ChatCoreBody {
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  stream: boolean
  temperature?: number
  maxTokens?: number
  stream_options: undefined
  response_format: undefined
  seed: undefined
}

/** 单条 content 的 parts 提取文本(字符串/数组/null 容错;inlineData 多模态 part 跳过) */
function extractPartsText(content: z.infer<typeof geminiContentSchema>): string {
  const parts = content.parts
  if (typeof parts === 'string') return parts
  if (!Array.isArray(parts)) return ''
  const texts: string[] = []
  for (const part of parts) {
    if (typeof part === 'string') {
      texts.push(part)
    } else if (part && typeof part === 'object' && typeof part.text === 'string') {
      texts.push(part.text)
    }
    // inlineData / functionCall 等 part:本轮不支持,静默跳过
  }
  return texts.join('\n')
}

/**
 * Gemini generateContent 请求 → OpenAI chat 请求体。
 * 返回 { ok:false, message } 表示无法转换(如无任何有效内容)。
 */
export function geminiToChatBody(
  model: string,
  gemini: GeminiRequest,
): { ok: true; body: ChatCoreBody } | { ok: false; message: string } {
  const messages: ChatCoreBody['messages'] = []

  // systemInstruction → system message
  if (gemini.systemInstruction) {
    const sys = extractPartsText(gemini.systemInstruction).trim()
    if (sys) messages.push({ role: 'system', content: sys })
  }

  // contents → user/assistant 消息(role 'model' → 'assistant',缺省 'user')
  for (const content of gemini.contents ?? []) {
    const rawRole = (content.role ?? 'user').toLowerCase()
    const role: 'user' | 'assistant' = rawRole === 'model' ? 'assistant' : 'user'
    const text = extractPartsText(content)
    if (text.trim()) messages.push({ role, content: text })
  }

  if (messages.length === 0) {
    return { ok: false, message: 'contents is empty or has no text parts' }
  }

  const cfg = gemini.generationConfig
  return {
    ok: true,
    body: {
      model,
      messages,
      stream: false, // 由路由层按 action 覆写
      temperature: cfg?.temperature,
      maxTokens: cfg?.maxOutputTokens,
      stream_options: undefined,
      response_format: undefined,
      seed: undefined,
    },
  }
}

// =============================================================================
// 出站转换
// =============================================================================

/** OpenAI finish_reason → Gemini finishReason(其余一律 STOP) */
export function mapFinishReason(finishReason: string | null | undefined): string {
  if (finishReason === 'length') return 'MAX_TOKENS'
  if (finishReason === 'content_filter') return 'SAFETY'
  return 'STOP'
}

/** HTTP 状态 → Gemini error.status 字符串 */
export function mapGeminiErrorStatus(status: number): string {
  if (status === 400) return 'INVALID_ARGUMENT'
  if (status === 401 || status === 403) return 'PERMISSION_DENIED'
  if (status === 402 || status === 429) return 'RESOURCE_EXHAUSTED'
  if (status === 404) return 'NOT_FOUND'
  if (status === 503 || status === 504) return 'UNAVAILABLE'
  return 'INTERNAL'
}

/** OpenAI 错误响应体({code,message} 或 {error:{message}})→ Gemini error body */
export function openAiErrorToGemini(
  status: number,
  body: unknown,
): { error: { code: number; message: string; status: string } } {
  let message = 'upstream error'
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>
    if (typeof b['message'] === 'string') message = b['message']
    else if (b['error'] && typeof b['error'] === 'object') {
      const e = b['error'] as Record<string, unknown>
      if (typeof e['message'] === 'string') message = e['message']
    }
  }
  return { error: { code: status, message, status: mapGeminiErrorStatus(status) } }
}

/** Gemini 流式/非流式共用的 usageMetadata 形状 */
export interface GeminiUsageMetadata {
  promptTokenCount: number
  candidatesTokenCount: number
  totalTokenCount: number
}

/**
 * OpenAI chat.completion(非流式)→ Gemini generateContent 响应。
 * 文本取 choices[0].message.content;usage 缺失按 0 计(Gemini 客户端可容忍)。
 */
export function chatToGeminiResponse(result: V1ChatCompletionResponse): {
  candidates: Array<{
    content: { parts: Array<{ text: string }>; role: 'model' }
    finishReason: string
    index: number
  }>
  usageMetadata: GeminiUsageMetadata
  modelVersion: string
} {
  const choice = result.choices[0]
  const text = choice?.message?.content ?? ''
  const promptTokens = result.usage?.prompt_tokens ?? 0
  const completionTokens = result.usage?.completion_tokens ?? 0
  return {
    candidates: [
      {
        content: { parts: [{ text }], role: 'model' },
        finishReason: mapFinishReason(choice?.finish_reason),
        index: 0,
      },
    ],
    usageMetadata: {
      promptTokenCount: promptTokens,
      candidatesTokenCount: completionTokens,
      totalTokenCount: result.usage?.total_tokens ?? promptTokens + completionTokens,
    },
    modelVersion: result.model,
  }
}

/** Gemini 流式文本 chunk(SSE data 载荷) */
export function geminiStreamChunk(
  text: string,
  model: string,
): {
  candidates: Array<{ content: { parts: Array<{ text: string }>; role: 'model' }; index: number }>
  modelVersion: string
} {
  return {
    candidates: [{ content: { parts: [{ text }], role: 'model' }, index: 0 }],
    modelVersion: model,
  }
}

/** Gemini 流式收尾 chunk(空 content + finishReason + usageMetadata) */
export function geminiStreamFinalChunk(
  model: string,
  usage: GeminiUsageMetadata,
): {
  candidates: Array<{ content: { role: 'model' }; finishReason: string; index: number }>
  usageMetadata: GeminiUsageMetadata
  modelVersion: string
} {
  return {
    candidates: [{ content: { role: 'model' }, finishReason: 'STOP', index: 0 }],
    usageMetadata: usage,
    modelVersion: model,
  }
}

/** Gemini ListModels 条目(v1beta/models) */
export function toGeminiModelEntry(
  modelId: string,
  displayName: string,
): {
  name: string
  displayName: string
  supportedGenerationMethods: string[]
} {
  return {
    name: `models/${modelId}`,
    displayName,
    supportedGenerationMethods: ['generateContent', 'streamGenerateContent', 'countTokens'],
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
