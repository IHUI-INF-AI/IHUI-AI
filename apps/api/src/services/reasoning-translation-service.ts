// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 思维链(CoT)翻译服务 —— 2026-11-13 立
 *
 * 对标 DSH 的 `dsh-client-ui-cot-translation`,并判据上收紧三处:
 *
 *  1) **原文只读**:本服务只产出译文,响应体里没有原文回传字段。客户端无法"用译文覆盖原文",
 *     因为覆盖所需的原文根本不在响应里 —— 这是结构性保证,不是纪律要求。
 *  2) **内容哈希缓存**:同一段思考重复展开(折叠/展开、切语言再切回)不再打模型。
 *     缓存键 = sha256(targetLang + 原文),用 LRU + TTL 双向淘汰,不会无限涨。
 *  3) **语言自检**:目标语言与原文同语时直接 `skipped`,不消耗 token、不产生无意义译文。
 *
 * 非关键路径纪律(与 utils/conversation-title.ts 同源):失败只向上抛结构化错误,
 * UI 侧静默降级为"只有原文",绝不影响思考内容本身的展示。
 */

import { createHash } from 'node:crypto'
import type { FastifyRequest } from 'fastify'

import type { ReasoningTranslationLang, ReasoningTranslationResponse } from '@ihui/types'
import { REASONING_TRANSLATION_MAX_CHARS } from '@ihui/types'

import { aiServiceFetch } from '../utils/ai-service-fetch.js'
import { resolveDefaultChatModel } from '../utils/retired-providers.js'
import { recordAiCost } from '../plugins/ai-cost.js'

/** 翻译调用超时(ms):思考是长文本,给到 20s;超时即失败,由 UI 降级 */
const TRANSLATE_TIMEOUT_MS = 20_000
/** 缓存条数上限(LRU) */
const CACHE_LIMIT = 200
/** 缓存存活时间(ms) */
const CACHE_TTL_MS = 30 * 60 * 1000

const FALLBACK_MODEL = resolveDefaultChatModel()

interface CacheEntry {
  translated: string
  model: string
  at: number
}

const cache = new Map<string, CacheEntry>()

/** 仅供单测:清空缓存,避免用例间互相污染。 */
export function clearReasoningTranslationCache(): void {
  cache.clear()
}

/** 仅供单测/观测:当前缓存条数。 */
export function reasoningTranslationCacheSize(): number {
  return cache.size
}

export function reasoningTranslationCacheKey(
  text: string,
  targetLang: ReasoningTranslationLang,
): string {
  return createHash('sha256').update(targetLang).update('\u0000').update(text).digest('hex')
}

/** 剥掉不必翻译、也不该参与语言判定的片段(代码块、行内代码、URL、路径、模型输出的 JSON)。 */
function stripUntranslatable(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b[\w./-]*\/[\w./-]+\b/g, ' ')
}

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff]/g
const KANA_RE = /[\u3040-\u30ff]/g
const HANGUL_RE = /[\uac00-\ud7af\u1100-\u11ff]/g
const LETTER_RE = /[A-Za-z\u00c0-\u024f]/g

function ratioOf(re: RegExp, text: string): number {
  if (text.length === 0) return 0
  const hits = text.match(re)
  return (hits ? hits.length : 0) / text.length
}

/**
 * 目标语言与原文同语时无需翻译。
 *
 * 判定只看"主体文字"的字符占比,不看停用词表 —— 思考文本天生混排(变量名/路径/命令),
 * 词表判定的误判率比字符占比高一个量级。阈值取 0.2(中文)/0.1(假名/谚文)是刻意保守的:
 * 宁可多翻一次,也不要把"已经是要的语言"翻成四不像。
 */
export function shouldSkipReasoningTranslation(
  text: string,
  targetLang: ReasoningTranslationLang,
): boolean {
  const body = stripUntranslatable(text).trim()
  if (body.length < 2) return true
  const cjk = ratioOf(CJK_RE, body)
  const kana = ratioOf(KANA_RE, body)
  const hangul = ratioOf(HANGUL_RE, body)
  const latin = ratioOf(LETTER_RE, body)
  switch (targetLang) {
    case 'zh-CN':
    case 'zh-TW':
      return cjk >= 0.2
    case 'ja':
      return kana >= 0.1 || cjk >= 0.4
    case 'ko':
      return hangul >= 0.1
    case 'en':
      return cjk < 0.05 && latin >= 0.5
    default:
      return false
  }
}

const LANG_LABEL: Record<ReasoningTranslationLang, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁体中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
}

const SYSTEM_PROMPT_TAIL = [
  '把下面的模型思维链翻译成目标语言。',
  '硬性要求:',
  '1. 只输出译文本身,不要解释、不要总结、不要补充原文没有的内容。',
  '2. 保留原有段落结构与换行;每个段落对应一个段落。',
  '3. 代码、命令、文件路径、URL、变量名、函数名、专有名词、数学公式原样保留,不要翻译。',
  '4. 不要添加"以下是译文"之类的开场白。',
]

export type ReasoningTranslationFailureCode =
  'too_long' | 'empty_input' | 'upstream' | 'empty_output'

export class ReasoningTranslationError extends Error {
  readonly code: ReasoningTranslationFailureCode
  constructor(code: ReasoningTranslationFailureCode, message: string) {
    super(message)
    this.name = 'ReasoningTranslationError'
    this.code = code
  }
}

interface CompleteJson {
  content?: string
  stub?: boolean
  error?: boolean
  error_message?: string
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

export async function translateReasoning(
  request: FastifyRequest | null,
  input: { text: string; targetLang: ReasoningTranslationLang },
): Promise<ReasoningTranslationResponse> {
  const text = input.text.trim()
  const { targetLang } = input
  if (!text) throw new ReasoningTranslationError('empty_input', '没有可翻译的思考内容')
  if (text.length > REASONING_TRANSLATION_MAX_CHARS) {
    throw new ReasoningTranslationError(
      'too_long',
      `思考内容超过 ${REASONING_TRANSLATION_MAX_CHARS} 字符上限`,
    )
  }
  if (shouldSkipReasoningTranslation(text, targetLang)) {
    return { translated: '', targetLang, model: FALLBACK_MODEL, cached: false, skipped: true }
  }

  const key = reasoningTranslationCacheKey(text, targetLang)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    // LRU:命中即刷新位置
    cache.delete(key)
    cache.set(key, hit)
    return {
      translated: hit.translated,
      targetLang,
      model: hit.model,
      cached: true,
      skipped: false,
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TRANSLATE_TIMEOUT_MS)
  let json: CompleteJson
  try {
    const res = await aiServiceFetch(request, '/api/llm/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: FALLBACK_MODEL,
        messages: [
          {
            role: 'system',
            content: `${SYSTEM_PROMPT_TAIL.join('\n')}\n目标语言:${LANG_LABEL[targetLang]}`,
          },
          { role: 'user', content: text },
        ],
        max_tokens: Math.min(3_000, Math.max(512, Math.ceil(text.length / 1.5))),
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new ReasoningTranslationError('upstream', `上游 HTTP ${res.status}`)
    }
    json = (await res.json()) as CompleteJson
  } catch (err) {
    if (err instanceof ReasoningTranslationError) throw err
    const reason =
      err instanceof Error && err.name === 'AbortError'
        ? `timeout(${TRANSLATE_TIMEOUT_MS}ms)`
        : ((err as Error)?.message ?? String(err))
    throw new ReasoningTranslationError('upstream', reason)
  } finally {
    clearTimeout(timer)
  }

  if (json.stub || json.error) {
    throw new ReasoningTranslationError(
      'upstream',
      `翻译上游未就绪(stub=${String(json.stub)}${json.error_message ? `, ${json.error_message}` : ''})`,
    )
  }
  const translated = (json.content ?? '').trim()
  if (!translated) throw new ReasoningTranslationError('empty_output', '翻译结果为空')

  cache.set(key, { translated, model: FALLBACK_MODEL, at: Date.now() })
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }

  // 计费与标题生成同一模式:失败只 warn,不影响返回
  if (request?.userId) {
    const promptTokens = json.usage?.prompt_tokens ?? Math.ceil(text.length / 2)
    const completionTokens = json.usage?.completion_tokens ?? Math.ceil(translated.length / 2)
    try {
      await recordAiCost({
        userId: request.userId,
        model: FALLBACK_MODEL,
        provider: FALLBACK_MODEL.includes('/') ? FALLBACK_MODEL.split('/')[0]! : 'unknown',
        promptTokens,
        completionTokens,
        totalTokens: json.usage?.total_tokens ?? promptTokens + completionTokens,
        requestType: 'reasoning-translation',
        metadata: JSON.stringify({ source: 'reasoning-translation', targetLang }),
      })
    } catch (err) {
      console.warn(`[ReasoningTranslation] recordAiCost failed: ${(err as Error)?.message ?? err}`)
    }
  }

  return { translated, targetLang, model: FALLBACK_MODEL, cached: false, skipped: false }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
