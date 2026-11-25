// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 聊天记录自然语言问数（对齐 ChatLab 的「用一句话问聊天记录」）。
 *
 * 两段式：
 *  1. 本地检索：把问题解析成时间窗 / 关键词 / 发送人，先查出真实消息（语料永远来自库，不凭空生成）；
 *  2. 模型归纳：只把查到的消息喂给模型，要求带 [序号] 引用；模型不可用就退回本地摘要。
 *
 * 只读 wechat_hub_messages / conversations / contacts，不触发平台抓取，不写任何数据。
 */

import { and, desc, eq, gte, ilike, inArray, lte, or, type SQL } from 'drizzle-orm'
import { wechatHubConversations, wechatHubContacts, wechatHubMessages } from '@ihui/database'
import type { WechatAskCitation, WechatAskInput, WechatAskResult } from '@ihui/types'
import { dbRead } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import { aiServiceSystemFetch } from '../../utils/ai-service-fetch.js'
import { assertAccountForUser } from './guards.js'
import { computeAskStats, detectAskIntent } from './ask-stats.js'
import { dayKey, dayStartUtc, formatInZone, zoneOffsetMinutes } from './export-formats.js'

const DEFAULT_LIMIT = 40
const MAX_LIMIT = 100
/** 统计型问题的取数上限：排名/分布要按整窗算，40 条样本会算错 */
const STATS_LIMIT = 500
const MAX_CONTEXT_CHARS = 6_000
const DEFAULT_TZ = 'Asia/Shanghai'
const ASK_MODEL = process.env.WECHAT_HUB_AGENT_MODEL?.trim() || undefined

const TIME_WORDS =
  /(今天|昨天|前天|大前天|最近\s*\d+\s*天|近\s*\d+\s*天|这周|本周|上周|上上周|这个月|本月|上个月|今年|去年|\d{1,2}\s*月|\d{1,2}\s*号)/g

const QUESTION_NOISE =
  /(聊天记录|聊天内容|消息记录|记录|消息|我们|你们|他们|大家|帮我|请问|想知道|告诉我|一下|关于|有没有|是否|是不是|什么|哪些|哪个|怎么|为什么|如何|多少|几条|讨论|聊了|说了|提到|总结|概括|分析|回顾|情况|内容|相关|的|了|吗|呢|吧|啊|呀|？|\?|，|,|。|、|！|!)/g

/** 问题里的实词片段；滤掉时间词与疑问/代词后取前 4 个，每个不超过 20 字。 */
export function extractKeywords(question: string): string[] {
  const cleaned = question.replace(TIME_WORDS, ' ').replace(QUESTION_NOISE, ' ')
  const chunks = cleaned.match(/[\p{Script=Han}]{2,}|[A-Za-z][A-Za-z0-9_-]{2,}/gu) ?? []
  const unique: string[] = []
  for (const chunk of chunks) {
    const word = chunk.trim().slice(0, 20)
    if (!word || unique.includes(word)) continue
    unique.push(word)
    if (unique.length >= 4) break
  }
  return unique
}

/** 把「YYYY-MM-DD」换成该时区当天的 0 点，避免 new Date('2026-11-01') 被当成 UTC。 */
export function dayStartFromKey(key: string, timezone = DEFAULT_TZ): Date {
  const guess = new Date(`${key}T00:00:00Z`)
  const probe = new Date(`${key}T06:00:00Z`)
  return new Date(guess.getTime() - zoneOffsetMinutes(probe, timezone) * 60_000)
}

function monthStart(year: number, month: number, timezone: string): Date {
  const normalizedYear = year + Math.floor((month - 1) / 12)
  const normalizedMonth = ((((month - 1) % 12) + 12) % 12) + 1
  const key = `${normalizedYear}-${String(normalizedMonth).padStart(2, '0')}-01`
  return dayStartFromKey(key, timezone)
}

function startOfWeek(offsetWeeks: number, timezone: string, now: Date): Date {
  const key = dayKey(now, timezone)
  const date = new Date(`${key}T00:00:00Z`)
  const back = (date.getUTCDay() + 6) % 7
  return dayStartUtc(-back + offsetWeeks * 7, timezone, now)
}

export interface TimeWindow {
  since: Date | null
  until: Date | null
}

/** 解析中文相对时间；解析不出返回 null 边界，由调用方决定默认窗口。 */
export function parseTimeWindow(
  question: string,
  timezone = DEFAULT_TZ,
  now = new Date(),
): TimeWindow {
  const today = dayStartUtc(0, timezone, now)
  const tomorrow = dayStartUtc(1, timezone, now)
  const match = question.match(TIME_WORDS)?.[0]?.replace(/\s+/g, '')
  if (!match) return { since: null, until: null }
  if (match === '今天') return { since: today, until: tomorrow }
  if (match === '昨天') return { since: dayStartUtc(-1, timezone, now), until: today }
  if (match === '前天')
    return { since: dayStartUtc(-2, timezone, now), until: dayStartUtc(-1, timezone, now) }
  if (match === '大前天')
    return { since: dayStartUtc(-3, timezone, now), until: dayStartUtc(-2, timezone, now) }
  const recent = match.match(/(?:最近|近)(\d+)天/)
  if (recent) {
    const days = Math.min(Math.max(Number(recent[1]), 1), 90)
    return { since: dayStartUtc(-days + 1, timezone, now), until: tomorrow }
  }
  if (match === '这周' || match === '本周')
    return { since: startOfWeek(0, timezone, now), until: tomorrow }
  if (match === '上周')
    return { since: startOfWeek(-1, timezone, now), until: startOfWeek(0, timezone, now) }
  if (match === '上上周')
    return { since: startOfWeek(-2, timezone, now), until: startOfWeek(-1, timezone, now) }
  if (match === '这个月' || match === '本月') {
    const key = dayKey(now, timezone)
    return {
      since: monthStart(Number(key.slice(0, 4)), Number(key.slice(5, 7)), timezone),
      until: tomorrow,
    }
  }
  if (match === '上个月') {
    const key = dayKey(now, timezone)
    const year = Number(key.slice(0, 4))
    const month = Number(key.slice(5, 7))
    return {
      since: monthStart(year, month - 1, timezone),
      until: monthStart(year, month, timezone),
    }
  }
  if (match === '今年')
    return {
      since: monthStart(Number(dayKey(now, timezone).slice(0, 4)), 1, timezone),
      until: tomorrow,
    }
  if (match === '去年') {
    const year = Number(dayKey(now, timezone).slice(0, 4))
    return { since: monthStart(year - 1, 1, timezone), until: monthStart(year, 1, timezone) }
  }
  const month = match.match(/^(\d{1,2})月$/)
  if (month) {
    const value = Number(month[1])
    if (value >= 1 && value <= 12) {
      const year = Number(dayKey(now, timezone).slice(0, 4))
      return {
        since: monthStart(year, value, timezone),
        until:
          value === 12 ? monthStart(year + 1, 1, timezone) : monthStart(year, value + 1, timezone),
      }
    }
  }
  const day = match.match(/^(\d{1,2})号$/)
  if (day) {
    const value = Number(day[1])
    if (value >= 1 && value <= 31) {
      const key = `${dayKey(now, timezone).slice(0, 7)}-${String(value).padStart(2, '0')}`
      const since = dayStartFromKey(key, timezone)
      return { since, until: new Date(since.getTime() + 86_400_000) }
    }
  }
  return { since: null, until: null }
}

/** 从联系人里找问题中出现的名字，最长匹配优先，避免「小李」抢了「小李子」。 */
async function detectSender(accountId: string, question: string): Promise<string | null> {
  const rows = await dbRead
    .select({ displayName: wechatHubContacts.displayName })
    .from(wechatHubContacts)
    .where(eq(wechatHubContacts.accountId, accountId))
    .limit(500)
  let best: string | null = null
  for (const row of rows) {
    const name = row.displayName.trim()
    if (name.length < 2 || !question.includes(name)) continue
    if (!best || name.length > best.length) best = name
  }
  return best
}

function safeIlike(term: string): string {
  return `%${term.replace(/[%_\\]/g, '\\$&')}%`
}

async function searchMessages(
  accountId: string,
  conversationId: string | null,
  window: TimeWindow,
  keywords: string[],
  senderName: string | null,
  limit: number,
) {
  const conditions: SQL[] = [eq(wechatHubMessages.accountId, accountId)]
  if (conversationId) conditions.push(eq(wechatHubMessages.conversationId, conversationId))
  if (window.since) conditions.push(gte(wechatHubMessages.sentAt, window.since))
  if (window.until) conditions.push(lte(wechatHubMessages.sentAt, window.until))
  if (senderName) conditions.push(ilike(wechatHubMessages.senderName, safeIlike(senderName)))
  if (keywords.length > 0) {
    const clause = or(...keywords.map((word) => ilike(wechatHubMessages.content, safeIlike(word))))
    if (clause) conditions.push(clause)
  }
  return dbRead
    .select({
      id: wechatHubMessages.id,
      conversationId: wechatHubMessages.conversationId,
      direction: wechatHubMessages.direction,
      content: wechatHubMessages.content,
      senderName: wechatHubMessages.senderName,
      senderId: wechatHubMessages.senderId,
      sentAt: wechatHubMessages.sentAt,
    })
    .from(wechatHubMessages)
    .where(and(...conditions))
    .orderBy(desc(wechatHubMessages.sentAt))
    .limit(limit)
}

type MessageRow = Awaited<ReturnType<typeof searchMessages>>[number]

function snippet(text: string, max = 240): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

function localAnswer(rows: MessageRow[], keywords: string[]): string {
  if (rows.length === 0) {
    return '在指定范围内没有检索到相关消息。可以换个关键词，或者放宽时间范围再问一次。'
  }
  const senders = new Map<string, number>()
  for (const row of rows) {
    const name = row.direction === 'outbound' ? '我' : row.senderName?.trim() || '对方'
    senders.set(name, (senders.get(name) ?? 0) + 1)
  }
  const who = [...senders.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([name, count]) => `${name} ${count} 条`)
    .join('、')
  const samples = rows
    .slice(0, 5)
    .map(
      (row) =>
        `- ${formatInZone(row.sentAt, DEFAULT_TZ, false)} ${
          row.direction === 'outbound' ? '我' : row.senderName || '对方'
        }：${snippet(row.content, 120)}`,
    )
    .join('\n')
  const scope = keywords.length > 0 ? `「${keywords.join('、')}」` : '时间范围'
  return `按${scope}检索到 ${rows.length} 条消息，发言分布：${who}。\n最相关的几条：\n${samples}\n\n当前未接入模型，以上是本地检索结果，不做推断。`
}

function extractAnswer(payload: unknown): string {
  const record =
    typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : null
  if (!record) return ''
  const choices = Array.isArray(record.choices) ? record.choices : []
  const first = choices[0] as Record<string, unknown> | undefined
  const message = first?.message as Record<string, unknown> | undefined
  const candidates = [message?.content, first?.text, record.content, record.text]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    if (Array.isArray(candidate)) {
      const joined = candidate
        .map((part) =>
          typeof part === 'string' ? part : ((part as Record<string, unknown>)?.text as string),
        )
        .filter((part): part is string => typeof part === 'string' && part.length > 0)
        .join('')
      if (joined.trim()) return joined.trim()
    }
  }
  return ''
}

function parseBoundary(value: string | undefined, field: string): Date | null {
  if (!value) return null
  const text = value.trim()
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? dayStartFromKey(text, DEFAULT_TZ) : new Date(text)
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`${field} 不是合法时间`, 400, 'WECHAT_ASK_BAD_DATE')
  }
  return date
}

/**
 * 问一句，答一句。
 * 关键词 0 命中时自动放宽为「只按时间窗」重查一次，并在提示词里要求说明放宽。
 */
export async function askMessages(
  userId: string,
  accountId: string,
  input: WechatAskInput,
): Promise<WechatAskResult> {
  await assertAccountForUser(userId, accountId)
  const question = (input.question ?? '').trim()
  if (question.length === 0) throw new AppError('问题不能为空', 400, 'WECHAT_ASK_EMPTY')
  if (question.length > 500) throw new AppError('问题过长', 400, 'WECHAT_ASK_TOO_LONG')

  const timezone = DEFAULT_TZ
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT)
  const parsed = parseTimeWindow(question, timezone)
  const explicitSince = parseBoundary(input.since, 'since')
  const explicitUntil = parseBoundary(input.until, 'until')
  const since = explicitSince ?? parsed.since
  const until = explicitUntil ?? parsed.until
  const window: TimeWindow =
    since || until
      ? { since, until }
      : { since: dayStartUtc(-6, timezone), until: dayStartUtc(1, timezone) }

  if (input.conversationId) {
    const rows = await dbRead
      .select({ id: wechatHubConversations.id })
      .from(wechatHubConversations)
      .where(
        and(
          eq(wechatHubConversations.accountId, accountId),
          eq(wechatHubConversations.id, input.conversationId),
        ),
      )
      .limit(1)
    if (!rows[0]) throw new AppError('会话不存在', 404, 'WECHAT_CONVERSATION_NOT_FOUND')
  }

  // 先判统计意图：命中就按整窗取数、跳过关键词过滤，数字一律本地算，不经过模型
  const intent = detectAskIntent(question)
  const keywords = intent ? [] : extractKeywords(question)
  const senderName = await detectSender(accountId, question)
  const fetchLimit = intent ? Math.max(limit, STATS_LIMIT) : limit
  let rows = await searchMessages(
    accountId,
    input.conversationId ?? null,
    window,
    keywords,
    senderName,
    fetchLimit,
  )
  let relaxed = false
  if (rows.length === 0 && (keywords.length > 0 || senderName)) {
    rows = await searchMessages(accountId, input.conversationId ?? null, window, [], null, limit)
    relaxed = rows.length > 0
  }
  rows.reverse()

  const conversationIds = [...new Set(rows.map((row) => row.conversationId))]
  const titles = new Map<string, string>()
  if (conversationIds.length > 0) {
    const meta = await dbRead
      .select({ id: wechatHubConversations.id, title: wechatHubConversations.title })
      .from(wechatHubConversations)
      .where(inArray(wechatHubConversations.id, conversationIds))
    for (const row of meta) titles.set(row.id, row.title)
  }

  // 统计路径可能取了 500 条，引用只给最近 20 条样本，避免响应体失控
  const citationRows = intent ? rows.slice(-20) : rows
  const citations: WechatAskCitation[] = citationRows.map((row) => ({
    messageId: row.id,
    conversationTitle: titles.get(row.conversationId) ?? '',
    senderName: row.direction === 'outbound' ? '我' : row.senderName,
    sentAt: row.sentAt.toISOString(),
    snippet: snippet(row.content, 160),
  }))

  const plan = {
    since: window.since ? window.since.toISOString() : null,
    until: window.until ? window.until.toISOString() : null,
    keywords,
    senderName,
    intent: intent?.kind ?? null,
  }

  if (rows.length === 0) {
    return { answer: localAnswer([], keywords), citations: [], plan, generatedBy: 'local' }
  }

  // 统计型问题到此为止：数字已经算准，再让模型润色只会引入偏差
  if (intent) {
    const stats = computeAskStats(rows, intent, timezone)
    if (stats) {
      return { answer: stats.text, citations, plan, stats: stats.data, generatedBy: 'local' }
    }
  }

  const lines: string[] = []
  let chars = 0
  for (const row of rows) {
    const line = `[${lines.length + 1}] ${formatInZone(row.sentAt, timezone, false)} ${
      row.direction === 'outbound' ? '我' : row.senderName || '对方'
    }: ${snippet(row.content, 200)}`
    if (chars + line.length > MAX_CONTEXT_CHARS) break
    chars += line.length
    lines.push(line)
  }

  const systemPrompt = [
    '你是微信聊天记录分析助手，只能依据给定消息回答，不能补充消息里没有的事实。',
    '消息不足以回答时直接说“记录里没有足够信息”，不要推测。',
    '引用消息用方括号序号，例如 [3]，序号必须来自下面的消息列表。',
    relaxed ? '注意：原关键词没有命中，已放宽为按时间范围检索，请在回答里说明这一点。' : '',
    '中文回答，先结论后依据，不要复述整个列表，控制在 300 字以内。',
  ]
    .filter(Boolean)
    .join('\n')

  const userPrompt = `消息列表（共 ${lines.length} 条，时间正序）：\n${lines.join('\n')}\n\n用户问题：${question}`

  try {
    const response = await aiServiceSystemFetch(
      '/api/v1/ai/llm/complete',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(input.model || ASK_MODEL ? { model: input.model ?? ASK_MODEL } : {}),
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 700,
        }),
      },
      60_000,
    )
    if (!response.ok) throw new Error(`ai-service HTTP ${response.status}`)
    const answer = extractAnswer(await response.json())
    if (answer.length === 0) throw new Error('模型返回空内容')
    return { answer, citations, plan, generatedBy: 'llm' }
  } catch {
    return { answer: localAnswer(rows, keywords), citations, plan, generatedBy: 'local' }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
