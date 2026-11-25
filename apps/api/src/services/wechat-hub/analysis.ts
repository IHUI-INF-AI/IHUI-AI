// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信会话分析：本地规则 + 可选 LLM 增强。
 *
 * 设计取舍：
 *  - 未配置模型时也必须有结果（本地统计/关键词/待办/风险），不能把"没配 key"变成不可用；
 *  - 配了模型时先算本地基线，再让模型补 summary/highlights/todos/risks，
 *    模型返回缺字段时回落到基线，避免整段结果被一次坏输出清空；
 *  - 输入只取最近 N 条并截断，防止把整个群历史塞进上下文。
 */

import { createHash } from 'node:crypto'
import type { WechatAnalysisKind, WechatAnalysisResult, WechatMessageView } from '@ihui/types'
import { isVoicePlaceholder } from './voice-placeholder.js'

const STOPWORDS = new Set([
  '的',
  '了',
  '是',
  '在',
  '我',
  '你',
  '他',
  '她',
  '它',
  '我们',
  '你们',
  '他们',
  '这个',
  '那个',
  '什么',
  '怎么',
  '可以',
  '不是',
  '没有',
  '一个',
  '一下',
  '现在',
  '今天',
  '明天',
  '然后',
  '因为',
  '所以',
  '但是',
  '如果',
  '已经',
  '这样',
  '那样',
  '大家',
  '群里',
  '消息',
  '就是',
  '还是',
  '可能',
  '需要',
  '进行',
  '问题',
  '情况',
  '时候',
  '这边',
  '那边',
  '的话',
  '感觉',
  '觉得',
  '知道',
  '看看',
  '麻烦',
  '谢谢',
  '好的',
  '收到',
  '嗯',
  '啊',
  '吧',
  '呢',
  '吗',
])

const TODO_PATTERN =
  /(待办|todo|跟进|记得|需要|安排|截止|deadline|明天|后天|下周|本周|月底|尽快|确认一下|麻烦|请协助|负责人)/i
const RISK_PATTERN =
  /(投诉|退款|事故|故障|风险|紧急|逾期|违约|起诉|差评|泄露|安全问题|报警|纠纷|赔付)/i
const HAN_PATTERN = /\p{Script=Han}/u

export function hashAnalysisInput(
  kind: WechatAnalysisKind,
  conversationId: string | null,
  messageIds: string[],
): string {
  return createHash('sha256')
    .update(`${kind}:${conversationId ?? 'all'}:${messageIds.join(',')}`)
    .digest('hex')
}

function countBy<T>(items: T[], keyOf: (item: T) => string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = keyOf(item)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

function extractKeywords(texts: string[], limit = 20): Array<{ word: string; count: number }> {
  const counts = new Map<string, number>()
  for (const text of texts) {
    const segments = text.split(/[^\p{Script=Han}A-Za-z0-9]+/u)
    for (const segment of segments) {
      if (!segment) continue
      if (HAN_PATTERN.test(segment)) {
        const chars = Array.from(segment)
        for (const size of [2, 3, 4]) {
          for (let i = 0; i + size <= chars.length; i += 1) {
            const word = chars.slice(i, i + size).join('')
            if (STOPWORDS.has(word)) continue
            counts.set(word, (counts.get(word) ?? 0) + 1)
          }
        }
      } else if (/^[A-Za-z][A-Za-z0-9_-]{1,}$/.test(segment)) {
        const word = segment.toLowerCase()
        if (!STOPWORDS.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1)
      }
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }))
}

function clip(text: string, max: number): string {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`
}

function buildLocalResult(
  kind: WechatAnalysisKind,
  conversationTitle: string | null,
  messages: WechatMessageView[],
): WechatAnalysisResult {
  const participants = Array.from(
    countBy(messages, (message) => message.senderId ?? 'unknown').entries(),
  )
    .map(([id, messageCount]) => ({
      id,
      name: messages.find((message) => (message.senderId ?? 'unknown') === id)?.senderName ?? null,
      messageCount,
    }))
    .sort((a, b) => b.messageCount - a.messageCount)

  // 占位语音（`[语音]` 这类）没有文本可算：混进语料会把关键词/摘要带偏，
  // 判空口径与转写层共用 voice-placeholder，不另抄一份列表。
  const texts = messages
    .map((message) => message.content)
    .filter((text) => text.length > 0 && !isVoicePlaceholder(text))
  const keywords = extractKeywords(texts)
  const todos = messages
    .filter((message) => TODO_PATTERN.test(message.content))
    .slice(-20)
    .map((message) => ({
      text: clip(message.content, 160),
      owner: message.senderName ?? message.senderId ?? null,
      due: null,
      messageId: message.platformMessageId,
    }))
  const risks = messages
    .filter((message) => RISK_PATTERN.test(message.content))
    .slice(-10)
    .map((message) => clip(message.content, 160))

  const highlights = messages
    .filter((message) => message.content.length >= 40 || message.content.includes('@'))
    .sort((a, b) => b.content.length - a.content.length)
    .slice(0, 5)
    .map((message) => clip(message.content, 200))

  const relations = kind === 'relations' ? buildRelations(messages) : undefined

  const startAt = messages[0]?.sentAt ?? null
  const endAt = messages.at(-1)?.sentAt ?? null
  const topKeywords = keywords
    .slice(0, 5)
    .map((item) => item.word)
    .join('、')
  const summaryBase =
    `共 ${messages.length} 条消息，${participants.length} 位参与者` +
    (startAt && endAt ? `，时间范围 ${clip(startAt, 16)} ~ ${clip(endAt, 16)}` : '') +
    (topKeywords ? `。主要话题：${topKeywords}` : '') +
    `。待办 ${todos.length} 条，风险 ${risks.length} 条。`

  const summary =
    kind === 'todos'
      ? `共识别 ${todos.length} 条待办：${
          todos
            .slice(0, 3)
            .map((item) => item.text)
            .join('；') || '暂无'
        }`
      : kind === 'keywords'
        ? `高频词：${
            keywords
              .slice(0, 10)
              .map((item) => `${item.word}(${item.count})`)
              .join('、') || '暂无'
          }`
        : kind === 'relations'
          ? `${summaryBase} 互动关系已按相邻发言统计。`
          : summaryBase

  return {
    title: conversationTitle,
    summary,
    highlights,
    todos,
    keywords,
    participants,
    relations,
    risks,
    stats: {
      messageCount: messages.length,
      participantCount: participants.length,
      startAt,
      endAt,
    },
    generatedBy: 'local',
  }
}

function buildRelations(
  messages: WechatMessageView[],
): Array<{ from: string; to: string; count: number }> {
  const counts = new Map<string, number>()
  let previous: string | null = null
  for (const message of messages) {
    const sender = message.senderName ?? message.senderId ?? 'unknown'
    if (previous && previous !== sender) {
      const key = `${previous}\u0000${sender}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    previous = sender
  }
  return Array.from(counts.entries())
    .map(([key, count]) => {
      const [from, to] = key.split('\u0000')
      return { from: from ?? 'unknown', to: to ?? 'unknown', count }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 30)
}

interface LlmPayload {
  summary?: unknown
  highlights?: unknown
  todos?: unknown
  risks?: unknown
  keywords?: unknown
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice(0, 20)
    : []
}

function asTodoArray(value: unknown): WechatAnalysisResult['todos'] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      text: typeof item.text === 'string' ? clip(item.text, 200) : '',
      owner: typeof item.owner === 'string' ? item.owner : null,
      due: typeof item.due === 'string' ? item.due : null,
      messageId: typeof item.messageId === 'string' ? item.messageId : null,
    }))
    .filter((item) => item.text.length > 0)
    .slice(0, 30)
}

async function tryLlm(
  kind: WechatAnalysisKind,
  conversationTitle: string | null,
  messages: WechatMessageView[],
  base: WechatAnalysisResult,
): Promise<{ result: WechatAnalysisResult; model: string; tokens: number | null } | null> {
  const url = process.env.WECHAT_HUB_LLM_URL
  if (!url) return null
  const model = process.env.WECHAT_HUB_LLM_MODEL ?? 'gpt-4o-mini'
  const apiKey = process.env.WECHAT_HUB_LLM_KEY ?? ''
  const transcript = messages
    .slice(-200)
    .map((message) => {
      const who = message.senderName ?? message.senderId ?? 'unknown'
      return `[${message.sentAt}] ${who}: ${clip(message.content, 300)}`
    })
    .join('\n')
    .slice(0, 16_000)

  const prompt = [
    `你是企业微信/微信群聊分析助手。请对以下会话做「${kind}」分析。`,
    conversationTitle ? `会话名称：${conversationTitle}` : '',
    '只输出 JSON，字段：summary(string)、highlights(string[])、todos({text,owner,due,messageId}[])、risks(string[])、keywords({word,count}[])。',
    '不要编造未出现在记录里的事实；没有内容的字段给空数组。',
    '--- 聊天记录 ---',
    transcript,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: '你是严谨的群聊分析助手，只输出 JSON。' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!response.ok) return null
    const json: unknown = await response.json()
    const root =
      typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : null
    const choices = Array.isArray(root?.choices) ? root.choices : []
    const first = choices[0] as Record<string, unknown> | undefined
    const message = first?.message as Record<string, unknown> | undefined
    const content = typeof message?.content === 'string' ? message.content : null
    if (!content) return null
    const parsed: unknown = JSON.parse(content)
    const payload = typeof parsed === 'object' && parsed !== null ? (parsed as LlmPayload) : null
    if (!payload) return null
    const usage = root?.usage as Record<string, unknown> | undefined
    const tokens = typeof usage?.total_tokens === 'number' ? usage.total_tokens : null
    const llmKeywords = Array.isArray(payload.keywords)
      ? payload.keywords
          .filter(
            (item): item is Record<string, unknown> => typeof item === 'object' && item !== null,
          )
          .map((item) => ({
            word: typeof item.word === 'string' ? item.word : '',
            count: typeof item.count === 'number' ? item.count : 0,
          }))
          .filter((item) => item.word.length > 0)
          .slice(0, 20)
      : []

    return {
      result: {
        ...base,
        summary: typeof payload.summary === 'string' ? payload.summary : base.summary,
        highlights: asStringArray(payload.highlights).length
          ? asStringArray(payload.highlights)
          : base.highlights,
        todos: asTodoArray(payload.todos).length ? asTodoArray(payload.todos) : base.todos,
        risks: asStringArray(payload.risks).length ? asStringArray(payload.risks) : base.risks,
        keywords: llmKeywords.length ? llmKeywords : base.keywords,
        generatedBy: 'llm',
      },
      model,
      tokens,
    }
  } catch {
    return null
  }
}

export async function analyzeMessages(
  kind: WechatAnalysisKind,
  conversationTitle: string | null,
  messages: WechatMessageView[],
): Promise<{ result: WechatAnalysisResult; model: string | null; tokens: number | null }> {
  const base = buildLocalResult(kind, conversationTitle, messages)
  const llm = await tryLlm(kind, conversationTitle, messages, base)
  if (llm) return llm
  return { result: base, model: null, tokens: null }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
