// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 用户侧 Agent 定时自动化调度器(2026-09-07 立)。
 *
 * 职责:每 60s tick 轮询 user_automations 表中到期(active 且 once 未跑过 /
 * recurring nextRunAt<=now)的自动化,逐条调用 ai-service agent-runtime 执行,
 * 结果摘要写回 last_result;recurring 执行后重算 next_run_at,rrule 解析失败
 * 自动置 paused 防死循环。
 *
 * 执行入口 executeAutomation 同时暴露给 POST /api/automations/:id/run-now
 * (立即运行一次),两处共用同一实现。
 *
 * MVP rrule 子集:FREQ=HOURLY/DAILY/WEEKLY + BYHOUR/BYMINUTE/BYDAY。
 * 不支持 INTERVAL/BYMONTHDAY/COUNT/UNTIL 等,解析失败一律返回 null。
 *
 * 时区(2026-09-29 立,修"宿主时区被改 ⇒ 全体用户定时任务改点"):
 * RRULE 的 BYHOUR/BYMINUTE 语义是**用户时区的墙钟时刻**,不是宿主时区的。
 * 此前 atTime 走 Date#setHours(宿主本地),而行上明明带 timezone 列
 * (user_automations.ts:33 / patrol.ts:43,default 'Asia/Shanghai')却没被读——
 * 宿主从 CST 被切成 UTC 的 25 天里,"09:00" 全部在 Beijing 17:00 触发。
 * 现所有墙钟运算走 Intl 显式时区(不依赖宿主),缺失/非法值兜底
 * DEFAULT_SCHEDULE_TIMEZONE 且**只喊一次**(不抛错、不把整条自动化判死)。
 *
 * 失败分流(G-669,2026-10-01 立):执行失败过去只有两种下场,而且两种都错 ——
 *  ① catch 只 `log.warn` + `return null`,**不写任何时间戳** ⇒ 到期查询下一轮必然再命中
 *     同一行 ⇒ 抛穿路径每 60 秒无限重放;
 *  ② 上游非 2xx(401/403/400 = 缺凭据形状)被 consumeAgentStream 吞成 errorMessage 后
 *     **正常返回** ⇒ 调用方按成功落 lastRunAt 并重排、status 留 active,缺凭据根本走不到 catch。
 * 现在两条都进同一个分类器(services/automations/failure-class.ts,与 D30 编排器共用一份实现):
 *  - permanent ⇒ status='paused' + last_error,并停止重排(next_run_at 置 null);
 *  - transient ⇒ attempt+1,next_run_at = now + min(2^(attempt-1) × 基数, 上限) 回队;
 *                连续 transient 超 MAX_TRANSIENT_ATTEMPTS 同样落 paused —— 只退避不收口
 *                等于另一种无限重放。
 * 两支都落 last_run_at / updated_at,且一次执行只结算一次(唯一写库出口 settleAutomationRun;
 * 调用侧用 settled 闸门挡住"结算本身抛穿后再补一次写")。
 */

import type { FastifyRequest } from 'fastify'
import { and, eq, gt, isNotNull, isNull, lte, or } from 'drizzle-orm'
import { db } from '../db/index.js'
import { createSingleFlightTick } from './automations/index.js'
import { describeAutomationFailure, type AutomationFailureInput } from './automations/failure-class.js'
import {
  userAutomations,
  type AutomationLastResult,
  type UserAutomation,
} from '@ihui/database'
import { aiServiceFetchStream } from '../utils/ai-service-fetch.js'

// =============================================================================
// rrule MVP 解析器(纯函数,可单测)
// =============================================================================

const WEEKDAY_MAP: Record<string, number> = {
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  SU: 0,
}

interface RruleParts {
  freq: 'HOURLY' | 'DAILY' | 'WEEKLY'
  byHour: number
  byMinute: number
  byDays: number[] | null
}

/** 解析 rrule 字符串为结构化部件,非法返回 null(调用方置 paused 防死循环)。 */
function parseRruleParts(rrule: string): RruleParts | null {
  const parts: Record<string, string> = {}
  for (const seg of rrule.split(';')) {
    const idx = seg.indexOf('=')
    if (idx <= 0) continue
    parts[seg.slice(0, idx).trim().toUpperCase()] = seg.slice(idx + 1).trim()
  }

  const freqRaw = parts.FREQ?.toUpperCase()
  if (freqRaw !== 'HOURLY' && freqRaw !== 'DAILY' && freqRaw !== 'WEEKLY') return null

  let byHour = 0
  if (parts.BYHOUR !== undefined) {
    const h = Number(parts.BYHOUR)
    if (!Number.isInteger(h) || h < 0 || h > 23) return null
    byHour = h
  }
  let byMinute = 0
  if (parts.BYMINUTE !== undefined) {
    const m = Number(parts.BYMINUTE)
    if (!Number.isInteger(m) || m < 0 || m > 59) return null
    byMinute = m
  }

  let byDays: number[] | null = null
  if (parts.BYDAY !== undefined) {
    const tokens = parts.BYDAY.split(',').map((s) => s.trim().toUpperCase())
    if (tokens.length === 0) return null
    const days: number[] = []
    for (const token of tokens) {
      const wd = WEEKDAY_MAP[token]
      if (wd === undefined) return null
      days.push(wd)
    }
    byDays = days
  }

  // WEEKLY 必须显式给出 BYDAY(MVP 不支持"默认与 from 同星期几"的隐式语义)
  if (freqRaw === 'WEEKLY' && byDays === null) return null

  return { freq: freqRaw, byHour, byMinute, byDays }
}

/** 墙钟日期(只到"日"这一维;时刻由 RRULE 的 BYHOUR/BYMINUTE 给)。 */
interface ZoneDate {
  year: number
  month: number
  day: number
}

/**
 * 行上 timezone 缺失/非法时的兜底档。
 * 与 user_automations.timezone / patrol_tasks.timezone 的列默认值同值,
 * 也与 AGENTS §4 那句"强制 Asia/Shanghai 时区"同值 —— 不得在别处再抄一个字面量。
 */
export const DEFAULT_SCHEDULE_TIMEZONE = 'Asia/Shanghai'

/** 已喊过的非法时区值:每个值只喊一次,免得 60s tick × N 行把日志刷满。 */
const warnedInvalidZones = new Set<string>()

/**
 * 把行上的 timezone 归一成可用 IANA 名:空/null/非法一律兜底 DEFAULT_SCHEDULE_TIMEZONE。
 * 非法值不抛错(抛错会把整条自动化打成 paused,那比"按默认档跑"更响地伤用户),
 * 但必须被喊出来 —— 静默兜底等于伪造"按用户设定执行"。
 */
function resolveScheduleZone(timezone: string | null | undefined): string {
  const raw = typeof timezone === 'string' ? timezone.trim() : ''
  if (!raw) return DEFAULT_SCHEDULE_TIMEZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: raw }).format(0)
    return raw
  } catch {
    if (!warnedInvalidZones.has(raw)) {
      warnedInvalidZones.add(raw)
      console.warn(
        `[agent-automation] timezone "${raw}" 不是合法 IANA 名称,已兜底 ${DEFAULT_SCHEDULE_TIMEZONE}` +
          `(该非法值只喊一次)`,
      )
    }
    return DEFAULT_SCHEDULE_TIMEZONE
  }
}

const wallClockFormatters = new Map<string, Intl.DateTimeFormat>()

function wallClockFormatter(zone: string): Intl.DateTimeFormat {
  let fmt = wallClockFormatters.get(zone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    wallClockFormatters.set(zone, fmt)
  }
  return fmt
}

/** 墙钟六要素。缺一个就没法换算,宁可炸也不要拿 undefined 去算时刻。 */
interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/** 某个绝对时刻在 zone 里的墙钟读数(en-US 的 24 小时制在部分 ICU 上给 "24",归一到 "0")。 */
function zonedWallClock(epochMs: number, zone: string): WallClock {
  let year: number | undefined
  let month: number | undefined
  let day: number | undefined
  let hour: number | undefined
  let minute: number | undefined
  let second: number | undefined
  for (const part of wallClockFormatter(zone).formatToParts(new Date(epochMs))) {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
      const value = Number(part.value)
      if (part.type === 'year') year = value
      else if (part.type === 'month') month = value
      else day = value
    } else if (part.type === 'hour' || part.type === 'minute' || part.type === 'second') {
      // 只有 hour 需要取模("24" → 0);month 一律原样,否则 12 月会被 12 化掉。
      const value = Number(part.value) % (part.type === 'hour' ? 24 : 60)
      if (part.type === 'hour') hour = value
      else if (part.type === 'minute') minute = value
      else second = value
    }
  }
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    throw new Error(`[agent-automation] Intl 未能给出 ${zone} 的完整墙钟字段`)
  }
  return { year, month, day, hour, minute, second }
}

/** zone 在指定时刻相对 UTC 的偏移(ms):把墙钟读数当 UTC 算出的时刻再减回真实时刻。 */
function zoneOffsetMs(epochMs: number, zone: string): number {
  const w = zonedWallClock(epochMs, zone)
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - epochMs
}

/** 绝对时刻 → 该时刻在 zone 里的墙钟日期。 */
function zoneDateOf(instant: Date, zone: string): ZoneDate {
  const w = zonedWallClock(instant.getTime(), zone)
  return { year: w.year, month: w.month, day: w.day }
}

/** 墙钟日期推进 N 天(跨月/跨年由 Date.UTC 归一;取中午读回避开任何时刻边界)。 */
function addZoneDays(date: ZoneDate, days: number): ZoneDate {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + days, 12))
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  }
}

/** 墙钟日期是星期几(0=周日)—— 按日期算,与宿主时区无关。 */
function weekdayOfZoneDate(date: ZoneDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()
}

/**
 * 墙钟日期 + hh:mm(zone) → 绝对时刻。
 * 两次修正覆盖 DST:第一次按"猜出来的时刻"的偏移换算,再按换算结果的偏移复算,
 * 使跨夏令时日界的"下一天 09:00"仍落在当地 09:00(即当地可能只有 23/25 小时的那天)。
 */
function zonedTimeToUtc(zone: string, date: ZoneDate, hour: number, minute: number): Date {
  const wallAsUtc = Date.UTC(date.year, date.month - 1, date.day, hour, minute, 0, 0)
  const firstGuess = wallAsUtc - zoneOffsetMs(wallAsUtc, zone)
  return new Date(wallAsUtc - zoneOffsetMs(firstGuess, zone))
}

/**
 * base 所在墙钟日(可推进 dayOffset 天)的 hh:mm,在 zone 里的绝对时刻。
 * 本模块**唯一**产出执行时刻的地方 —— 之前它是 `new Date(base).setHours(...)`,
 * 即宿主本地时区,这就是那次 25 天错点事故的根因。
 */
function atTime(base: Date, hour: number, minute: number, zone: string, dayOffset = 0): Date {
  return zonedTimeToUtc(zone, addZoneDays(zoneDateOf(base, zone), dayOffset), hour, minute)
}

/**
 * 计算 rrule 下一次执行时间(严格晚于 from),**按 from 所属的 timezone 墙钟**解释
 * BYHOUR/BYMINUTE/BYDAY,与宿主时区无关。
 *
 * - HOURLY:from + 1h(绝对时间,无墙钟语义;MVP 忽略 BYHOUR)
 * - DAILY:明天(或今天未到点时今天)BYHOUR:BYMINUTE
 * - WEEKLY:下一个匹配 BYDAY 的 BYHOUR:BYMINUTE(最多向后看 8 天)
 *
 * timezone 缺失/非法 ⇒ 兜底 DEFAULT_SCHEDULE_TIMEZONE 并喊一次(不抛错)。
 * 解析失败返回 null(调用方记 warn 并把 automation 置 paused 防死循环)。
 */
export function parseNextRun(
  rrule: string,
  from: Date,
  timezone: string | null | undefined,
): Date | null {
  const parts = parseRruleParts(rrule)
  if (!parts) return null

  if (parts.freq === 'HOURLY') {
    return new Date(from.getTime() + 60 * 60 * 1000)
  }

  const zone = resolveScheduleZone(timezone)

  if (parts.freq === 'DAILY') {
    const today = atTime(from, parts.byHour, parts.byMinute, zone)
    if (today.getTime() > from.getTime()) return today
    return atTime(from, parts.byHour, parts.byMinute, zone, 1)
  }

  // WEEKLY:从 from 当天起向后找第一个匹配 BYDAY 且时刻晚于 from 的日期
  for (let offset = 0; offset <= 8; offset++) {
    const candidate = atTime(from, parts.byHour, parts.byMinute, zone, offset)
    if (candidate.getTime() <= from.getTime()) continue
    const weekday = weekdayOfZoneDate(addZoneDays(zoneDateOf(from, zone), offset))
    if (parts.byDays && parts.byDays.includes(weekday)) {
      return candidate
    }
  }
  return null
}

// =============================================================================
// 执行入口(scheduler tick 与 run-now 共用)
// =============================================================================

/** 从 SSE 流中摘取摘要用的轻量事件结构 */
export interface SseCapture {
  summary: string | null
  contentTail: string
  errorMessage: string | null
  /**
   * G-669 B 格的分流依据:上游响应**不可当流消费**时的状态码
   * (`!ok`,或 ok 但没有 body)。正常进入流 = null。
   * 过去这里只把状态码写进 errorMessage 文案就 return,调用方看不出"这是失败",
   * 于是 401/403/400 被按成功落库 —— 状态码必须是结构化的返回值,不是文案。
   */
  upstreamStatus: number | null
}

const CONTENT_TAIL_LIMIT = 2000

/** agent 执行参数(SSE 流消费的通用入参,automations 与 patrol 共用) */
export interface AgentStreamParams {
  message: string
  sessionId: string
  botId: string
}

/** 消费 agent-runtime SSE 流直到结束,摘取最终摘要(失败不抛错,返回捕获信息)。 */
export async function consumeAgentStream(
  request: FastifyRequest | null,
  params: AgentStreamParams,
): Promise<SseCapture> {
  const capture: SseCapture = {
    summary: null,
    contentTail: '',
    errorMessage: null,
    upstreamStatus: null,
  }
  const upstream = await aiServiceFetchStream(request, '/api/agent-runtime/execute/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      message: params.message,
      mode: 'auto',
      sessionId: params.sessionId,
      botId: params.botId,
    }),
  })

  if (!upstream.ok || !upstream.body) {
    capture.errorMessage = `上游服务异常(状态码 ${upstream.status})`
    // G-669:状态码同时进结构化字段,调用方据此分流(permanent 缺凭据形状不再被当成功)
    capture.upstreamStatus = upstream.status
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

/** D12:解析 automation 执行会话——绑定会话优先,否则 auto_<id> 独立线程(旧行为) */
export function resolveAutomationSessionId(automation: {
  id: string
  conversationId?: string | null
}): string {
  return automation.conversationId ?? `auto_${automation.id}`
}

// =============================================================================
// G-669 失败分流:重试台账 / 有界退避 / 到期判据
// =============================================================================

/** transient 连续重试上限:超过即与 permanent 同样落 paused —— 有界退避的"界"。 */
export const MAX_TRANSIENT_ATTEMPTS = 8

/** 退避基数 5min(60s tick 粒度下更短的退避没有意义)与上限 6h。 */
const TRANSIENT_BACKOFF_BASE_MS = 5 * 60_000
const TRANSIENT_BACKOFF_CAP_MS = 6 * 60 * 60_000

/** last_error 是 text 列,但失败文案可能整段堆栈 ⇒ 落库前截断,不撑爆行。 */
const LAST_ERROR_LIMIT = 500

/** 第 n 次(n≥1)transient 失败后的退避时长:单调不减,封顶 CAP。纯函数,可单测。 */
export function transientBackoffMs(attempt: number): number {
  const n = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 1
  return Math.min(Math.pow(2, n - 1) * TRANSIENT_BACKOFF_BASE_MS, TRANSIENT_BACKOFF_CAP_MS)
}

/**
 * 行上的 attempt 读不出有限正数一律按 0。
 * 列是 `NOT NULL DEFAULT 0`,这一档只为"迁移尚未应用到某个库"时不把 undefined 带进比较;
 * 真正的前提仍是迁移已落(见 packages/database/drizzle/20261001100000_automation_retry_ledger.sql)。
 */
function attemptOf(automation: UserAutomation): number {
  const raw = automation.attempt
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0
}

/**
 * 到期判据的 **SQL 投影**(tick 查询)。与 isAutomationDue 是同一条规则的两个投影:
 * SQL 做窄筛,取回后仍由 JS 复核(见 runAutomationTick)。新增分支两处必须同改。
 */
export function automationDueConditions(now: Date) {
  return and(
    eq(userAutomations.status, 'active'),
    or(
      // ① 一次性任务首跑(与改造前逐字同条件)
      and(
        eq(userAutomations.scheduleType, 'once'),
        lte(userAutomations.scheduledAt, now),
        isNull(userAutomations.lastRunAt),
      ),
      // ② G-669 新增:一次性任务的 transient 重试位。**必须带 attempt > 0** ——
      // 历史 once 行的 next_run_at 存的就是 scheduled_at(routes/automations.ts 的
      // computeNextRunAt),不看 attempt 会把"已成功的一次性任务"重放成周期任务。
      and(
        eq(userAutomations.scheduleType, 'once'),
        gt(userAutomations.attempt, 0),
        isNotNull(userAutomations.nextRunAt),
        lte(userAutomations.nextRunAt, now),
      ),
      // ③ 周期任务到期(与改造前逐字同条件;transient 回队也是写这一列)
      and(eq(userAutomations.scheduleType, 'recurring'), lte(userAutomations.nextRunAt, now)),
    ),
  )
}

/** 到期判据的 **JS 投影**(执行前复核),与 automationDueConditions 逐分支对应。 */
export function isAutomationDue(automation: UserAutomation, now: Date): boolean {
  if (automation.status !== 'active') return false
  const nowMs = now.getTime()
  if (automation.scheduleType === 'recurring') {
    return automation.nextRunAt !== null && automation.nextRunAt.getTime() <= nowMs
  }
  if (automation.scheduleType === 'once') {
    const firstRun =
      automation.lastRunAt === null &&
      automation.scheduledAt !== null &&
      automation.scheduledAt.getTime() <= nowMs
    const retry =
      attemptOf(automation) > 0 &&
      automation.nextRunAt !== null &&
      automation.nextRunAt.getTime() <= nowMs
    return firstRun || retry
  }
  return false
}

/**
 * 一次执行的结算(唯一写库出口 settleAutomationRun 的入参形状)。
 * lastRunAt / updatedAt / lastResult / attempt / lastError 五格**每次结算都落**,
 * 这正是 A 格的解药:失败也留下了时间戳,到期查询才不会再命中同一行。
 */
export interface AutomationRunSettlement {
  lastRunAt: Date
  updatedAt: Date
  lastResult: AutomationLastResult
  /** 成功归零;transient 失败 +1;permanent 失败保持原值(终态不再计重试)。 */
  attempt: number
  /** 失败原因(含档位与命中判据);成功为 null。 */
  lastError: string | null
  /** null = 停止重排(终态);Date = 下一次到期时间。 */
  nextRunAt: Date | null
  /** 只在需要改档位时给(终态 ⇒ 'paused');缺席 = 不动 status。 */
  status?: string
}

/**
 * 结算的唯一写库出口。一次执行只允许调一次(调用侧的 settled 闸门保证),
 * 写落点收口在这里,免得将来又冒出第二处 update 把"结算只发生一次"顶掉。
 */
async function settleAutomationRun(
  automationId: string,
  settlement: AutomationRunSettlement,
): Promise<void> {
  await db
    .update(userAutomations)
    .set(settlement)
    .where(eq(userAutomations.id, automationId))
}

/** 失败文案:优先显式 message,其次 error 本身;两处都没有也要留一个可诊断的串。 */
function failureDetail(input: AutomationFailureInput): string {
  if (typeof input.message === 'string' && input.message.trim()) return input.message.trim()
  const err = input.error
  if (typeof err === 'string') return err
  if (err instanceof Error) return `${err.name}: ${err.message}`
  if (err !== undefined && err !== null) return String(err)
  return input.status === null || input.status === undefined ? '未知失败' : `上游状态码 ${input.status}`
}

/**
 * 执行一条自动化:调 ai-service agent-runtime 执行 agent,读完整 SSE 流,
 * 把摘要写回 last_result / last_run_at;recurring 重算 next_run_at。
 *
 * G-669 之后这里没有"吞掉失败"的分支了:
 * - 抛穿(catch)与非 ok 响应(consumeAgentStream 的 upstreamStatus)都进 classifyAutomationFailure;
 * - permanent ⇒ paused + last_error,停止重排;
 * - transient ⇒ attempt+1 + 有界退避写 next_run_at,超上限同样 paused;
 * - 每条路径**都恰好落一次结算**,rrule 解析失败也按 permanent 走同一条终态结算
 *   (它过去就置 paused,只是没留 last_error)。
 * 结算本身写不进库时无处落账(库是唯一记账面),此时必须大声记日志而不是静默 —— 见 catch 里的
 * settled 分支。
 *
 * @param request 当前 Fastify request(trace 透传);后台调度传 null
 * @returns 执行摘要(供 run-now 返回给前端);失败返回 null(调用方按 502 处理)
 */
export async function executeAutomation(
  automation: UserAutomation,
  request: FastifyRequest | null = null,
): Promise<string | null> {
  const now = new Date()
  // 结算闸门:一次执行只允许一次写库。settle 先置位再 await,所以"结算自己抛穿"不会
  // 在 catch 里被补成第二次写(第二次写会把同一轮失败记成两次重试,attempt 就失真了)。
  let settled = false
  const settle = async (settlement: AutomationRunSettlement): Promise<void> => {
    settled = true
    await settleAutomationRun(automation.id, settlement)
  }

  /** 终态结算:paused + last_error + 停止重排。 */
  const settleTerminal = async (lastResult: AutomationLastResult, reason: string): Promise<void> => {
    await settle({
      lastRunAt: now,
      updatedAt: now,
      lastResult,
      attempt: attemptOf(automation),
      lastError: reason.slice(0, LAST_ERROR_LIMIT),
      nextRunAt: null,
      status: 'paused',
    })
  }

  /**
   * 失败结算(唯一入口,catch 与非 ok 响应共用)。
   * 返回 null 供 run-now 侧按 502 处理;tick 侧忽略返回值。
   */
  const settleFailure = async (input: AutomationFailureInput): Promise<null> => {
    const verdict = describeAutomationFailure(input)
    const reason = `${verdict.kind}:${verdict.reason} — ${failureDetail(input)}`
    const lastResult: AutomationLastResult = {
      finishedAt: now.toISOString(),
      summary: `执行失败: ${failureDetail(input)}`.slice(0, LAST_ERROR_LIMIT),
    }

    if (verdict.kind === 'permanent') {
      await settleTerminal(lastResult, reason)
      request?.log.warn(
        { automationId: automation.id, kind: verdict.kind, verdict: verdict.reason },
        '[agent-automation] 永久性失败(重试不会变好),自动化已自动暂停',
      )
      return null
    }

    const attempt = attemptOf(automation) + 1
    if (attempt > MAX_TRANSIENT_ATTEMPTS) {
      await settleTerminal(
        lastResult,
        `transient 重试已达上限(${MAX_TRANSIENT_ATTEMPTS} 次) — ${reason}`,
      )
      request?.log.warn(
        { automationId: automation.id, attempt },
        '[agent-automation] 连续 transient 失败超上限,自动化已自动暂停(不再重放)',
      )
      return null
    }

    const backoffMs = transientBackoffMs(attempt)
    await settle({
      lastRunAt: now,
      updatedAt: now,
      lastResult,
      attempt,
      lastError: reason.slice(0, LAST_ERROR_LIMIT),
      nextRunAt: new Date(now.getTime() + backoffMs),
    })
    request?.log.warn(
      { automationId: automation.id, attempt, backoffMs, verdict: verdict.reason },
      '[agent-automation] 临时性失败,已按退避回队',
    )
    return null
  }

  try {
    // D12(2026-09-19 立):绑定了聊天会话的 automation 复用该线程执行——
    // 聊天管线按 sessionId 加载历史并落库,产出自然在同一会话"接力";
    // 未绑定时保持旧行为(auto_<id> 独立线程)。
    const capture = await consumeAgentStream(request, {
      message: automation.prompt,
      sessionId: resolveAutomationSessionId(automation),
      botId: automation.id,
    })

    // B 格:非 ok 响应不再是"成功"。状态码与 errorMessage 一起进同一个分类器。
    if (capture.upstreamStatus !== null) {
      return await settleFailure({
        status: capture.upstreamStatus,
        message: capture.errorMessage ?? `上游服务异常(状态码 ${capture.upstreamStatus})`,
      })
    }

    const summary =
      capture.summary ??
      (capture.contentTail.trim() ? capture.contentTail.trim().slice(-500) : null) ??
      (capture.errorMessage ? `执行失败: ${capture.errorMessage}` : '执行完成')

    // recurring:重算 next_run_at;解析失败按 permanent 收口(与 failure-class 的分类表同档)。
    // 墙钟一律按**行上自己的** timezone 解释(user_automations.timezone),
    // 不得按宿主时区 —— 那正是 2026-09-04~09-29 全体用户定时任务错点的成因。
    let nextRunAt: Date | null = null
    if (automation.scheduleType === 'recurring') {
      if (automation.rrule) {
        nextRunAt = parseNextRun(automation.rrule, now, automation.timezone)
      }
      if (!nextRunAt) {
        const reason = `permanent:rrule — rrule 解析失败,无法排出下次执行(${automation.rrule ?? '空'})`
        request?.log.warn(
          { automationId: automation.id, rrule: automation.rrule },
          '[agent-automation] rrule 解析失败,自动化已自动暂停',
        )
        // 摘要照旧落 last_result(run-now 仍返回 summary,与改造前一致),但走终态结算
        await settleTerminal(
          { finishedAt: now.toISOString(), summary },
          reason,
        )
        return summary
      }
    }

    await settle({
      lastRunAt: now,
      updatedAt: now,
      lastResult: { finishedAt: now.toISOString(), summary },
      attempt: 0,
      lastError: null,
      // recurring ⇒ 排下一次(到这里必非 null);once ⇒ 显式清掉重试位
      // (见 automationDueConditions 分支②的注释:once 的 next_run_at 存量值是 scheduled_at)
      nextRunAt: automation.scheduleType === 'recurring' ? nextRunAt : null,
    })

    return summary
  } catch (err) {
    // A 格:抛穿路径过去只 log.warn + return null(时间戳不动 ⇒ 每 60s 无限重放)。
    // 现在同样进分类与结算;但"结算自己写不进库"不能再补第二次写,只能喊出来。
    if (settled) {
      const text = failureDetail({ error: err })
      request?.log.warn(
        { automationId: automation.id, err: text },
        '[agent-automation] 结算写库失败,本轮无处落账(库是唯一记账面)',
      )
      console.warn(
        `[agent-automation] 自动化 ${automation.id} 的结算写库失败,下轮仍会到期并重放:${text}`,
      )
      return null
    }
    try {
      return await settleFailure({ error: err })
    } catch (settleErr) {
      // 连失败结算都落不下去:不静默(§5e "失败必须响"),但也不能再抛穿打断整轮 tick。
      console.warn(
        `[agent-automation] 自动化 ${automation.id} 执行失败且失败结算也写不进库:` +
          `${failureDetail({ error: err })} / ${failureDetail({ error: settleErr })}`,
      )
      return null
    }
  }
}

// =============================================================================
// 调度器生命周期
// =============================================================================

const TICK_INTERVAL_MS = 60_000
const BATCH_LIMIT = 10

let timer: ReturnType<typeof setInterval> | null = null

/**
 * 单轮扫描体:查询到期项并逐条执行(异常上抛给 flight 层记日志,不让轮次静默死亡)。
 *
 * G-669:SQL 与 JS 是**同一条到期规则的两个投影** —— SQL 做窄筛,取回后逐行用
 * isAutomationDue 复核再执行。这条链上"取回"与"执行"之间隔着一次可能长达数分钟的
 * agent 运行,期间 run-now 接口、并发进程、用户 PATCH 都可能让一行不再到期;
 * 复核让"结算后的行还会不会被取出"成为可断言的行为,被跳过的行**逐条点名**(不得静默丢)。
 *
 * 形态纪律:这个函数**必须是"循环就地写在体内"的 async 函数**,不得写成
 * `() => sweep().then(...)` 之类的包装 —— 单飞工厂在上一轮结束后于同一条 microtask 链里
 * 立即补跑记账的 tick,而 `agent-automation-busy-tick-replay.test.ts`(G-668 验收)断言的
 * 正是补跑落在第几个 microtask;多包一层 await 会让补跑晚一拍,表现是"别人的用例突然红了"。
 */
export async function runAutomationTick(now = new Date()): Promise<void> {
  const due = await db
    .select()
    .from(userAutomations)
    .where(automationDueConditions(now))
    .limit(BATCH_LIMIT)

  for (const automation of due) {
    if (!isAutomationDue(automation, now)) {
      // 点名而不是静默跳过:这一格说明"查询侧与执行侧之间,这行被别人结算/改过了"
      console.warn(
        `[agent-automation] 行 ${automation.id} 在取回后已不再到期(疑似被 run-now 或并发进程结算),本轮跳过`,
      )
      continue
    }
    // 单条失败 catch 继续 next(executeAutomation 内部已兜底,这里再兜一层)
    await executeAutomation(automation, null)
  }
}

// G-668:忙时收到的 tick 不得丢 —— 上一轮未结束时到达的 tick 记账,本轮一结束立即补跑,
// 不再让用户白等一个轮询周期。工厂与验收用例同源(services/automations/index.ts)。
const tickFlight = createSingleFlightTick(runAutomationTick, (err) => {
  console.warn('[agent-automation] 调度 tick 异常', err)
})

/** 启动调度器(60s tick);进程内单例,重复调用幂等。 */
export function startAgentAutomationScheduler(): void {
  if (timer) return
  timer = setInterval(() => {
    void tickFlight.tick()
  }, TICK_INTERVAL_MS)
  // 定时器不阻塞进程退出
  if (typeof timer.unref === 'function') timer.unref()
}

/** 停止调度器(测试/优雅关闭用)。 */
export function stopAgentAutomationScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  // 在飞一轮照常结束,已记账的补跑与后续 tick 一律作废(优雅关停语义)
  tickFlight.stop()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
