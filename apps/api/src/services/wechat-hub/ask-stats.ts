// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 问数的「结构化查询」分支（对标 ChatLab 的 SQL 问数，但更安全）。
 *
 * 为什么不做真 SQL：本地库上执行模型生成的任意 SQL，等于把库的完整读写面授权给一次
 * 自然语言输入，注入、越权、误删都无法兜底。这里改成三段确定性流程：
 *   自然语言 → 识别统计意图（规则，零成本零幻觉）→ 在内存里做聚合 → 直接给出数字。
 *
 * 好处是可复算：同一批消息，答案永远一样，不需要模型参与，也不会把数字编出来。
 * 叙述型问题（「他们到底在争什么」）仍然交给模型归纳，走 ask.ts 原来的路径。
 */

import { dayKey } from './export-formats.js'

const TOP_N_DEFAULT = 5
const TOP_N_MAX = 20

export type AskIntentKind = 'sender-rank' | 'day-peak' | 'hour-peak' | 'reply-latency' | 'count'

export interface AskIntent {
  kind: AskIntentKind
  topN: number
}

/** 统计意图优先级：先判更具体的（哪天/几点/回复速度），再判「谁最多」，最后才是总数。 */
const INTENT_RULES: Array<[AskIntentKind, RegExp]> = [
  ['day-peak', /(哪天|哪一天|哪日|最高峰|峰值|最忙那天|消息最多那天)/],
  ['hour-peak', /(几点|哪个小时|什么时段|时段分布|什么时间点|时间段|最热闹)/],
  ['reply-latency', /(回复速度|回复时间|响应速度|回得慢|回得快|多久回|平均回复)/],
  [
    'sender-rank',
    /(谁|哪位|哪个人|谁最|排行榜|排名|最活跃|话最多|发得最多|说得最多|发言最多|top\s*\d+|前三|前五|top)/i,
  ],
  ['count', /(几条|多少条|一共|总共|发了多少|多少消息|消息量|统计一下)/],
]

const CN_DIGITS: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
}

/**
 * 从问题里读「前 N / top N / 前三」，没写就用默认 5。
 * 中文数字要单独认，否则「排个前三名」会退回默认 5，排行榜长度就不对。
 */
function readTopN(question: string): number {
  const arabic = question.match(/(?:前|top)\s*(\d{1,2})/i)
  if (arabic) {
    const value = Number(arabic[1])
    if (Number.isFinite(value) && value >= 1) return Math.min(value, TOP_N_MAX)
  }
  const chinese = question.match(/(?:前|top)?([一二两三四五六七八九十])名/)
  if (chinese) {
    const value = CN_DIGITS[chinese[1] ?? '']
    if (value) return Math.min(value, TOP_N_MAX)
  }
  return TOP_N_DEFAULT
}

/**
 * 识别统计意图。
 * 只认强信号：出现「哪天」「几点」「几条」「谁最」这类明确统计词才接管，
 * 避免把「预算最晚什么时候确认」这种叙述问题误判成统计问题。
 */
export function detectAskIntent(question: string): AskIntent | null {
  for (const [kind, pattern] of INTENT_RULES) {
    if (pattern.test(question)) return { kind, topN: readTopN(question) }
  }
  return null
}

/** 聚合只需要这四列，单独定义避免和 ask.ts 互相引用成环。 */
export interface AskRow {
  direction: string
  content: string
  senderName: string | null
  sentAt: Date
}

export interface AskStatsResult {
  text: string
  /** 结构化结果，前端可拿去画图，也方便排查「为什么是这个答案」 */
  data: Record<string, unknown>
}

function displayName(row: AskRow): string {
  return row.direction === 'outbound' ? '我' : row.senderName?.trim() || '对方'
}

function percent(part: number, total: number): string {
  if (total <= 0) return '0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

function senderRank(rows: AskRow[], topN: number): AskStatsResult {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const name = displayName(row)
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  const rank = [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, topN)
  const lines = rank.map(([name, count]) => `${name} ${count} 条（${percent(count, rows.length)}）`)
  return {
    text: `按条数排：${lines.join('、')}。合计 ${rows.length} 条，涉及 ${counts.size} 人。`,
    data: {
      total: rows.length,
      participants: counts.size,
      rank: rank.map(([name, count]) => ({ name, count })),
    },
  }
}

function dayPeak(rows: AskRow[], timezone: string, topN: number): AskStatsResult {
  const byDay = new Map<string, number>()
  for (const row of rows) {
    const key = dayKey(row.sentAt, timezone)
    byDay.set(key, (byDay.get(key) ?? 0) + 1)
  }
  const sorted = [...byDay.entries()].sort((left, right) => right[1] - left[1]).slice(0, topN)
  const first = sorted[0]
  const rest = sorted.slice(1).map(([day, count]) => `${day} ${count} 条`)
  const tail = rest.length > 0 ? `；其次是 ${rest.join('、')}` : ''
  return {
    text: `最集中的一天是 ${first?.[0] ?? '—'}，${first?.[1] ?? 0} 条（${percent(first?.[1] ?? 0, rows.length)}）${tail}。区间内共 ${byDay.size} 个活跃日。`,
    data: { days: sorted.map(([day, count]) => ({ day, count })), activeDays: byDay.size },
  }
}

/** 只取「时」，必须用 Intl 单独取：formatInZone 返回的是带日期的整串，切前两位会得到年份。 */
function hourOf(date: Date, timezone: string): number {
  const label = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
  }).format(date)
  const hour = Number(label)
  return Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : 0
}

function hourPeak(rows: AskRow[], timezone: string): AskStatsResult {
  const buckets = new Array<number>(24).fill(0)
  for (const row of rows) {
    const index = hourOf(row.sentAt, timezone)
    buckets[index] = (buckets[index] ?? 0) + 1
  }
  let peakHour = 0
  for (let index = 1; index < 24; index += 1) {
    if ((buckets[index] ?? 0) > (buckets[peakHour] ?? 0)) peakHour = index
  }
  const peak = buckets[peakHour] ?? 0
  const night = buckets.slice(0, 6).reduce((sum, value) => sum + value, 0)
  const daytime = buckets.slice(9, 19).reduce((sum, value) => sum + value, 0)
  return {
    text: `最集中的时段是 ${String(peakHour).padStart(2, '0')}:00–${String(peakHour + 1).padStart(2, '0')}:00，${peak} 条（${percent(peak, rows.length)}）；0–6 点 ${night} 条，9–19 点 ${daytime} 条。`,
    data: { hourly: buckets, peakHour, night, daytime },
  }
}

/**
 * 回复速度：相邻异向消息对。
 * 窗口取 6 小时而不是 24 小时——「隔了二十小时才回」在微信里已经是另一次对话，
 * 把它算进回复中位数会把数字拉得毫无参考价值。
 */
const REPLY_WINDOW_SECONDS = 6 * 3_600

function replyLatency(rows: AskRow[]): AskStatsResult | null {
  const gaps: number[] = []
  for (let index = 1; index < rows.length; index += 1) {
    const prev = rows[index - 1]
    const next = rows[index]
    if (!prev || !next) continue
    if (prev.direction === next.direction) continue
    const seconds = (next.sentAt.getTime() - prev.sentAt.getTime()) / 1_000
    if (seconds <= 0 || seconds > REPLY_WINDOW_SECONDS) continue
    gaps.push(seconds)
  }
  if (gaps.length === 0) return null
  const sorted = [...gaps].sort((left, right) => left - right)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 1 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
  return {
    text: `按 ${gaps.length} 次一进一出配对：中位回复 ${Math.round(median)} 秒，最快 ${Math.round(sorted[0] ?? 0)} 秒，最慢 ${Math.round(sorted[sorted.length - 1] ?? 0)} 秒（间隔超过 6 小时视为另一次对话，不计）。`,
    data: {
      pairs: gaps.length,
      medianSeconds: Math.round(median),
      minSeconds: Math.round(sorted[0] ?? 0),
      maxSeconds: Math.round(sorted[sorted.length - 1] ?? 0),
    },
  }
}

function totalCount(rows: AskRow[], timezone: string): AskStatsResult {
  const inbound = rows.filter((row) => row.direction === 'inbound').length
  const outbound = rows.length - inbound
  const days = new Set(rows.map((row) => dayKey(row.sentAt, timezone)))
  return {
    text: `共 ${rows.length} 条：发出 ${outbound} 条、收到 ${inbound} 条，覆盖 ${days.size} 个活跃日，人均 ${(rows.length / Math.max(days.size, 1)).toFixed(1)} 条/天。`,
    data: { total: rows.length, inbound, outbound, activeDays: days.size },
  }
}

/**
 * 按意图算数。rows 必须是时间正序（ask.ts 里已经 reverse 过）。
 * 返回 null 表示这批数据不足以支撑该意图（例如没有配对就无法算回复速度）。
 */
export function computeAskStats(
  rows: AskRow[],
  intent: AskIntent,
  timezone: string,
): AskStatsResult | null {
  if (rows.length === 0) return null
  switch (intent.kind) {
    case 'sender-rank':
      return senderRank(rows, intent.topN)
    case 'day-peak':
      return dayPeak(rows, timezone, intent.topN)
    case 'hour-peak':
      return hourPeak(rows, timezone)
    case 'reply-latency':
      return replyLatency(rows)
    case 'count':
      return totalCount(rows, timezone)
    default:
      return null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
