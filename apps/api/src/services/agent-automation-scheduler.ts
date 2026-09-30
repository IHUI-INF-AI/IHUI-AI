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
 */

import type { FastifyRequest } from 'fastify'
import { and, eq, isNull, lte, or } from 'drizzle-orm'
import { db } from '../db/index.js'
import { createSingleFlightTick } from './automations/index.js'
import { userAutomations, type UserAutomation } from '@ihui/database'
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
interface SseCapture {
  summary: string | null
  contentTail: string
  errorMessage: string | null
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
  const capture: SseCapture = { summary: null, contentTail: '', errorMessage: null }
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

/**
 * 执行一条自动化:调 ai-service agent-runtime 执行 agent,读完整 SSE 流,
 * 把摘要写回 last_result / last_run_at;recurring 重算 next_run_at
 * (解析失败置 paused)。所有异常吞掉只记日志,保证 tick 循环不被打断。
 *
 * @param request 当前 Fastify request(trace 透传);后台调度传 null
 * @returns 执行摘要(供 run-now 返回给前端);失败返回 null
 */
/** D12:解析 automation 执行会话——绑定会话优先,否则 auto_<id> 独立线程(旧行为) */
export function resolveAutomationSessionId(automation: {
  id: string
  conversationId?: string | null
}): string {
  return automation.conversationId ?? `auto_${automation.id}`
}

export async function executeAutomation(
  automation: UserAutomation,
  request: FastifyRequest | null = null,
): Promise<string | null> {
  const now = new Date()
  try {
    // D12(2026-09-19 立):绑定了聊天会话的 automation 复用该线程执行——
    // 聊天管线按 sessionId 加载历史并落库,产出自然在同一会话"接力";
    // 未绑定时保持旧行为(auto_<id> 独立线程)。
    const capture = await consumeAgentStream(request, {
      message: automation.prompt,
      sessionId: resolveAutomationSessionId(automation),
      botId: automation.id,
    })
    const summary =
      capture.summary ??
      (capture.contentTail.trim() ? capture.contentTail.trim().slice(-500) : null) ??
      (capture.errorMessage ? `执行失败: ${capture.errorMessage}` : '执行完成')

    // recurring:重算 next_run_at;解析失败置 paused 防死循环。
    // 墙钟一律按**行上自己的** timezone 解释(user_automations.timezone),
    // 不得按宿主时区 —— 那正是 2026-09-04~09-29 全体用户定时任务错点的成因。
    let nextRunAt: Date | null = null
    let status: string | undefined
    if (automation.scheduleType === 'recurring') {
      if (automation.rrule) {
        nextRunAt = parseNextRun(automation.rrule, now, automation.timezone)
      }
      if (!nextRunAt) {
        status = 'paused'
        request?.log.warn(
          { automationId: automation.id, rrule: automation.rrule },
          '[agent-automation] rrule 解析失败,自动化已自动暂停',
        )
      }
    }

    await db
      .update(userAutomations)
      .set({
        lastRunAt: now,
        lastResult: { finishedAt: now.toISOString(), summary },
        ...(nextRunAt ? { nextRunAt } : {}),
        ...(status ? { status } : {}),
        updatedAt: now,
      })
      .where(eq(userAutomations.id, automation.id))

    return summary
  } catch (err) {
    request?.log.warn(
      { automationId: automation.id, err: String(err) },
      '[agent-automation] 自动化执行失败',
    )
    return null
  }
}

// =============================================================================
// 调度器生命周期
// =============================================================================

const TICK_INTERVAL_MS = 60_000
const BATCH_LIMIT = 10

let timer: ReturnType<typeof setInterval> | null = null

/** 单轮扫描体:查询到期项并逐条执行(异常上抛给 flight 层记日志,不让轮次静默死亡)。 */
async function runTickScan(): Promise<void> {
    const now = new Date()
    const due = await db
      .select()
      .from(userAutomations)
      .where(
        and(
          eq(userAutomations.status, 'active'),
          or(
            and(
              eq(userAutomations.scheduleType, 'once'),
              lte(userAutomations.scheduledAt, now),
              isNull(userAutomations.lastRunAt),
            ),
            and(eq(userAutomations.scheduleType, 'recurring'), lte(userAutomations.nextRunAt, now)),
          ),
        ),
      )
      .limit(BATCH_LIMIT)

    for (const automation of due) {
      // 单条失败 catch 继续 next(executeAutomation 内部已兜底,这里再兜一层)
      await executeAutomation(automation, null)
    }
}

// G-668:忙时收到的 tick 不得丢 —— 上一轮未结束时到达的 tick 记账,本轮一结束立即补跑,
// 不再让用户白等一个轮询周期。工厂与验收用例同源(services/automations/index.ts)。
const tickFlight = createSingleFlightTick(runTickScan, (err) => {
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
