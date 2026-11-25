// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信报告引擎：年度 / 双人 / 群聊三份报告。
 *
 * 对齐 WeFlow 的「年度报告、双人报告、群聊报告」三类产出，但落到我们自己的表：
 *  - 只读 wechat_hub_messages / wechat_hub_conversations，不触发平台抓取
 *  - 全部统计在本地算完，LLM 只在可选的地方润色，不参与数字
 *  - 输出一份结构化 JSON + 一份 Markdown（Markdown 可直接发微信或存文档）
 */

import { and, asc, eq, gte, lt } from 'drizzle-orm'
import { wechatHubConversations, wechatHubMessages } from '@ihui/database'
import type {
  WechatReportBucket,
  WechatReportInput,
  WechatReportParticipant,
  WechatReportResult,
} from '@ihui/types'
import { dbRead } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import { assertAccountForUser } from './guards.js'
import { dayKey, formatInZone, zoneOffsetMinutes } from './export-formats.js'

const MAX_REPORT_MESSAGES = 20_000
const INITIATION_GAP_MS = 30 * 60 * 1000
const REPLIES_MAX_GAP_MS = 24 * 60 * 60 * 1000
const HAN = /\p{Script=Han}/u
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
  '现在',
  '然后',
  '因为',
  '所以',
  '但是',
  '如果',
  '已经',
  '这样',
  '那样',
  '大家',
  '就是',
  '还是',
  '可能',
  '需要',
  '就是',
  '一下',
  '知道',
  '看看',
  '谢谢',
  '好的',
  '收到',
  '嗯',
  '啊',
  '吧',
  '呢',
  '吗',
])

interface ReportMessage {
  conversationId: string
  direction: string
  kind: string
  content: string
  senderId: string | null
  senderName: string | null
  sentAt: Date
}

export function zonedYearRange(year: number, timezone: string): { start: Date; end: Date } {
  const startGuess = Date.UTC(year, 0, 1, 0, 0, 0)
  const first = new Date(startGuess - zoneOffsetMinutes(new Date(startGuess), timezone) * 60_000)
  const settled = new Date(startGuess - zoneOffsetMinutes(first, timezone) * 60_000)
  const endGuess = Date.UTC(year + 1, 0, 1, 0, 0, 0)
  const next = new Date(endGuess - zoneOffsetMinutes(new Date(endGuess), timezone) * 60_000)
  return { start: settled, end: next }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
  }
  return sorted[mid] ?? null
}

function topKeywords(texts: string[], limit = 20): Array<{ word: string; count: number }> {
  const counts = new Map<string, number>()
  for (const text of texts) {
    for (const segment of text.split(/[^\p{Script=Han}A-Za-z0-9]+/u)) {
      if (!segment) continue
      if (HAN.test(segment)) {
        const chars = Array.from(segment)
        for (const size of [2, 3]) {
          for (let i = 0; i + size <= chars.length; i += 1) {
            const word = chars.slice(i, i + size).join('')
            if (STOPWORDS.has(word) || STOPWORDS.has(chars.slice(i, i + 1).join(''))) continue
            counts.set(word, (counts.get(word) ?? 0) + 1)
          }
        }
      } else if (/^[A-Za-z][A-Za-z0-9_-]{1,}$/.test(segment)) {
        const word = segment.toLowerCase()
        if (word.length < 3) continue
        counts.set(word, (counts.get(word) ?? 0) + 1)
      }
    }
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((left, right) => right.count - left.count || left.word.localeCompare(right.word))
    .slice(0, limit)
}

function participantKey(message: ReportMessage): string {
  if (message.direction === 'outbound') return 'self'
  return message.senderId?.trim() || message.senderName?.trim() || 'unknown'
}

function participantName(message: ReportMessage): string {
  if (message.direction === 'outbound') return '我'
  return message.senderName?.trim() || message.senderId?.trim() || '未知成员'
}

function buildParticipants(messages: ReportMessage[]): WechatReportParticipant[] {
  const map = new Map<string, WechatReportParticipant>()
  let previousAt: Date | null = null
  for (const message of messages) {
    const id = participantKey(message)
    const entry = map.get(id) ?? {
      id,
      name: participantName(message),
      messageCount: 0,
      charCount: 0,
      initiations: 0,
    }
    entry.messageCount += 1
    entry.charCount += message.content.length
    if (!previousAt || message.sentAt.getTime() - previousAt.getTime() > INITIATION_GAP_MS) {
      entry.initiations += 1
    }
    map.set(id, entry)
    previousAt = message.sentAt
  }
  return [...map.values()].sort(
    (left, right) => right.messageCount - left.messageCount || right.charCount - left.charCount,
  )
}

function buildDaily(messages: ReportMessage[], timezone: string): WechatReportBucket[] {
  const counts = new Map<string, number>()
  for (const message of messages) {
    const key = dayKey(message.sentAt, timezone)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((left, right) => left.day.localeCompare(right.day))
}

function longestStreak(daily: WechatReportBucket[]): number {
  let best = 0
  let current = 0
  let previous: Date | null = null
  for (const bucket of daily) {
    const date = new Date(`${bucket.day}T00:00:00Z`)
    if (previous && date.getTime() - previous.getTime() === 86_400_000) current += 1
    else current = 1
    best = Math.max(best, current)
    previous = date
  }
  return best
}

/** 相邻「别人说完 → 我回」/「我说完 → 别人回」的间隔，取中位数（只算 24 小时内的）。 */
function replyMedian(messages: ReportMessage[]): number | null {
  const gaps: number[] = []
  for (let index = 1; index < messages.length; index += 1) {
    const prev = messages[index - 1]
    const next = messages[index]
    if (!prev || !next) continue
    if (prev.direction === next.direction) continue
    const gap = next.sentAt.getTime() - prev.sentAt.getTime()
    if (gap > 0 && gap <= REPLIES_MAX_GAP_MS) gaps.push(Math.round(gap / 1000))
  }
  return median(gaps)
}

function hourlyOf(messages: ReportMessage[], timezone: string): number[] {
  const buckets = new Array<number>(24).fill(0)
  for (const message of messages) {
    const hour = Number(formatInZone(message.sentAt, timezone, false).slice(11, 13))
    if (Number.isFinite(hour) && hour >= 0 && hour < 24) buckets[hour] = (buckets[hour] ?? 0) + 1
  }
  return buckets
}

function weekdayOf(daily: WechatReportBucket[]): number[] {
  const buckets = new Array<number>(7).fill(0)
  for (const bucket of daily) {
    const index = new Date(`${bucket.day}T00:00:00Z`).getUTCDay()
    buckets[index] = (buckets[index] ?? 0) + bucket.count
  }
  return buckets
}

function percent(part: number, total: number): string {
  if (total <= 0) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

function bar(value: number, max: number, width = 20): string {
  if (max <= 0) return ''
  const filled = Math.round((value / max) * width)
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(width - filled, 0))}`
}

function buildHighlights(
  result: Omit<WechatReportResult, 'highlights' | 'markdown' | 'title' | 'kind'>,
): string[] {
  const highlights: string[] = []
  if (result.range.startAt && result.range.endAt) {
    highlights.push(
      `时间跨度：${result.range.startAt.slice(0, 10)} ~ ${result.range.endAt.slice(0, 10)}，共 ${result.stats.activeDays} 天有聊天`,
    )
  }
  if (result.stats.peakDay) {
    highlights.push(
      `最热闹的一天是 ${result.stats.peakDay.day}，单日 ${result.stats.peakDay.count} 条消息`,
    )
  }
  const top = result.participants[0]
  if (top) {
    highlights.push(
      `${top.name} 发言最多：${top.messageCount} 条，占 ${percent(top.messageCount, result.stats.messageCount)}，主动发起 ${top.initiations} 次`,
    )
  }
  const peakHour = result.hourly.indexOf(Math.max(...result.hourly))
  const peakHourCount = result.hourly[peakHour] ?? 0
  if (peakHourCount > 0) {
    highlights.push(`最活跃的时段是 ${peakHour}:00，共 ${peakHourCount} 条`)
  }
  if (result.stats.medianReplySeconds !== null) {
    highlights.push(
      `回复间隔中位数 ${result.stats.medianReplySeconds} 秒，属于「${replySpeedLabel(result.stats.medianReplySeconds)}」`,
    )
  }
  if (result.stats.longestStreakDays > 1) {
    highlights.push(`最长连续聊了 ${result.stats.longestStreakDays} 天没断`)
  }
  return highlights
}

function replySpeedLabel(seconds: number): string {
  if (seconds <= 60) return '秒回型'
  if (seconds <= 600) return '很快'
  if (seconds <= 3_600) return '正常节奏'
  if (seconds <= 21_600) return '隔几小时'
  return '慢回型'
}

function renderMarkdown(title: string, result: Omit<WechatReportResult, 'markdown'>): string {
  const maxHourly = Math.max(...result.hourly)
  const maxDaily = result.stats.peakDay?.count ?? 0
  const lines: string[] = [
    `# ${title}`,
    '',
    `- 消息总数：**${result.stats.messageCount}**（收到 ${result.stats.inboundCount} / 发出 ${result.stats.outboundCount}）`,
    `- 参与者：${result.stats.participantCount} 人 · 有聊天天数：${result.stats.activeDays} 天`,
    `- 时间范围：${
      result.range.startAt && result.range.endAt
        ? `${result.range.startAt.slice(0, 10)} ~ ${result.range.endAt.slice(0, 10)}`
        : '无'
    }`,
    `- 回复间隔中位数：${
      result.stats.medianReplySeconds === null
        ? '无成对消息'
        : `${result.stats.medianReplySeconds} 秒`
    }`,
    '',
    '## 活跃榜',
    '',
    '| 成员 | 消息 | 字数 | 主动发起 | 占比 |',
    '| --- | --- | --- | --- | --- |',
  ]
  for (const participant of result.participants.slice(0, 10)) {
    lines.push(
      `| ${participant.name} | ${participant.messageCount} | ${participant.charCount} | ${participant.initiations} | ${percent(participant.messageCount, result.stats.messageCount)} |`,
    )
  }
  lines.push('', '## 24 小时分布', '', '```text')
  for (let hour = 0; hour < 24; hour += 1) {
    const count = result.hourly[hour] ?? 0
    lines.push(`${String(hour).padStart(2, '0')}:00 ${bar(count, maxHourly)} ${count}`)
  }
  lines.push('```', '')
  if (result.daily.length > 0) {
    const topDays = [...result.daily].sort((left, right) => right.count - left.count).slice(0, 10)
    lines.push('## 最热闹的 10 天', '', '| 日期 | 消息 | 占比 |', '| --- | --- | --- |')
    for (const day of topDays) {
      lines.push(`| ${day.day} | ${day.count} | ${percent(day.count, result.stats.messageCount)} |`)
    }
    lines.push('')
  }
  if (result.keywords.length > 0) {
    lines.push(
      '## 高频词',
      '',
      result.keywords
        .slice(0, 20)
        .map((item) => `${item.word}(${item.count})`)
        .join(' · '),
      '',
    )
  }
  lines.push('## 报告摘要', '')
  for (const highlight of result.highlights) lines.push(`- ${highlight}`)
  lines.push('')
  if (maxDaily > 0) lines.push(`> 单日峰值 ${maxDaily} 条`)
  return lines.join('\n')
}

async function resolveConversation(
  accountId: string,
  conversationId: string,
): Promise<{ id: string; title: string; kind: string }> {
  const rows = await dbRead
    .select({
      id: wechatHubConversations.id,
      title: wechatHubConversations.title,
      kind: wechatHubConversations.kind,
    })
    .from(wechatHubConversations)
    .where(
      and(
        eq(wechatHubConversations.accountId, accountId),
        eq(wechatHubConversations.id, conversationId),
      ),
    )
    .limit(1)
  const row = rows[0]
  if (!row) throw new AppError('会话不存在', 404, 'WECHAT_CONVERSATION_NOT_FOUND')
  return row
}

/**
 * 生成报告。annual 覆盖账号全年全部会话；pair/group 必须指定会话。
 * 超过 2 万条时只统计最近的 2 万条，保证接口不会被单账号历史拖垮。
 */
export async function buildReport(
  userId: string,
  accountId: string,
  input: WechatReportInput,
): Promise<WechatReportResult> {
  const account = await assertAccountForUser(userId, accountId)
  const timezone = (input.timezone ?? '').trim() || 'Asia/Shanghai'
  const year = Number.isFinite(input.year)
    ? Math.trunc(Number(input.year))
    : new Date().getFullYear()
  if (year < 2000 || year > 2100) {
    throw new AppError('year 超出可统计范围', 400, 'WECHAT_REPORT_BAD_YEAR')
  }
  const { start, end } = zonedYearRange(year, timezone)

  let conversation: { id: string; title: string; kind: string } | null = null
  if (input.kind === 'pair' || input.kind === 'group') {
    if (!input.conversationId) {
      throw new AppError(
        'pair/group 报告必须指定 conversationId',
        400,
        'WECHAT_REPORT_NO_CONVERSATION',
      )
    }
    conversation = await resolveConversation(accountId, input.conversationId)
  }

  const conditions = [
    eq(wechatHubMessages.accountId, accountId),
    gte(wechatHubMessages.sentAt, start),
    lt(wechatHubMessages.sentAt, end),
  ]
  if (conversation) conditions.push(eq(wechatHubMessages.conversationId, conversation.id))

  const rows = await dbRead
    .select({
      conversationId: wechatHubMessages.conversationId,
      direction: wechatHubMessages.direction,
      kind: wechatHubMessages.kind,
      content: wechatHubMessages.content,
      senderId: wechatHubMessages.senderId,
      senderName: wechatHubMessages.senderName,
      sentAt: wechatHubMessages.sentAt,
    })
    .from(wechatHubMessages)
    .where(and(...conditions))
    .orderBy(asc(wechatHubMessages.sentAt))
    .limit(MAX_REPORT_MESSAGES)

  const messages: ReportMessage[] = rows
  const daily = buildDaily(messages, timezone)
  const participants = buildParticipants(messages)
  const charCount = messages.reduce((sum, message) => sum + message.content.length, 0)
  const inboundCount = messages.filter((message) => message.direction === 'inbound').length
  const peakDay = daily.reduce<WechatReportBucket | null>(
    (best, bucket) => (best === null || bucket.count > best.count ? bucket : best),
    null,
  )

  const base: Omit<WechatReportResult, 'highlights' | 'markdown' | 'title'> = {
    kind: input.kind,
    accountId,
    conversationId: conversation?.id ?? null,
    year,
    timezone,
    range: {
      startAt: messages[0]?.sentAt.toISOString() ?? null,
      endAt: messages[messages.length - 1]?.sentAt.toISOString() ?? null,
    },
    stats: {
      messageCount: messages.length,
      inboundCount,
      outboundCount: messages.length - inboundCount,
      charCount,
      participantCount: participants.length,
      activeDays: daily.length,
      longestStreakDays: longestStreak(daily),
      peakDay,
      medianReplySeconds: replyMedian(messages),
    },
    participants,
    hourly: hourlyOf(messages, timezone),
    weekday: weekdayOf(daily),
    daily,
    keywords: topKeywords(messages.map((message) => message.content)),
  }

  const title =
    input.kind === 'annual'
      ? `${account.label} ${year} 年度微信报告`
      : input.kind === 'pair'
        ? `与「${conversation?.title || '对方'}」的 ${year} 年对话报告`
        : `「${conversation?.title || '群聊'}」${year} 年群聊报告`

  const highlights = buildHighlights(base)
  return {
    ...base,
    title,
    highlights,
    markdown: renderMarkdown(title, { ...base, highlights, title }),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
