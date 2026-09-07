// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

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
 */

import type { FastifyRequest } from 'fastify'
import { and, eq, isNull, lte, or } from 'drizzle-orm'
import { db } from '../db/index.js'
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
    const tokens = parts.BYDAY
      .split(',')
      .map((s) => s.trim().toUpperCase())
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

function atTime(base: Date, hour: number, minute: number): Date {
  const d = new Date(base)
  d.setHours(hour, minute, 0, 0)
  return d
}

/**
 * 计算 rrule 下一次执行时间(严格晚于 from)。
 *
 * - HOURLY:from + 1h(MVP 忽略 BYHOUR)
 * - DAILY:明天(或今天未到点时今天)BYHOUR:BYMINUTE
 * - WEEKLY:下一个匹配 BYDAY 的 BYHOUR:BYMINUTE(最多向后看 8 天)
 *
 * 解析失败返回 null(调用方记 warn 并把 automation 置 paused 防死循环)。
 */
export function parseNextRun(rrule: string, from: Date): Date | null {
  const parts = parseRruleParts(rrule)
  if (!parts) return null

  if (parts.freq === 'HOURLY') {
    return new Date(from.getTime() + 60 * 60 * 1000)
  }

  if (parts.freq === 'DAILY') {
    const today = atTime(from, parts.byHour, parts.byMinute)
    if (today.getTime() > from.getTime()) return today
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow
  }

  // WEEKLY:从 from 当天起向后找第一个匹配 BYDAY 且时刻晚于 from 的日期
  for (let offset = 0; offset <= 8; offset++) {
    const candidate = atTime(from, parts.byHour, parts.byMinute)
    candidate.setDate(candidate.getDate() + offset)
    if (candidate.getTime() <= from.getTime()) continue
    if (parts.byDays && parts.byDays.includes(candidate.getDay())) {
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

/** 消费 agent-runtime SSE 流直到结束,摘取最终摘要(失败不抛错,返回捕获信息)。 */
async function consumeAgentStream(
  request: FastifyRequest | null,
  automation: UserAutomation,
): Promise<SseCapture> {
  const capture: SseCapture = { summary: null, contentTail: '', errorMessage: null }
  const upstream = await aiServiceFetchStream(request, '/api/agent-runtime/execute/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      message: automation.prompt,
      mode: 'auto',
      sessionId: `auto_${automation.id}`,
      botId: automation.id,
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
export async function executeAutomation(
  automation: UserAutomation,
  request: FastifyRequest | null = null,
): Promise<string | null> {
  const now = new Date()
  try {
    const capture = await consumeAgentStream(request, automation)
    const summary =
      capture.summary ??
      (capture.contentTail.trim() ? capture.contentTail.trim().slice(-500) : null) ??
      (capture.errorMessage ? `执行失败: ${capture.errorMessage}` : '执行完成')

    // recurring:重算 next_run_at;解析失败置 paused 防死循环
    let nextRunAt: Date | null = null
    let status: string | undefined
    if (automation.scheduleType === 'recurring') {
      if (automation.rrule) {
        nextRunAt = parseNextRun(automation.rrule, now)
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

let running = false
let timer: ReturnType<typeof setInterval> | null = null

async function tick(): Promise<void> {
  // 并发保护:上一轮未结束直接跳过本轮
  if (running) return
  running = true
  try {
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
            and(
              eq(userAutomations.scheduleType, 'recurring'),
              lte(userAutomations.nextRunAt, now),
            ),
          ),
        ),
      )
      .limit(BATCH_LIMIT)

    for (const automation of due) {
      // 单条失败 catch 继续 next(executeAutomation 内部已兜底,这里再兜一层)
      await executeAutomation(automation, null)
    }
  } catch (err) {
    console.warn('[agent-automation] 调度 tick 异常', err)
  } finally {
    running = false
  }
}

/** 启动调度器(60s tick);进程内单例,重复调用幂等。 */
export function startAgentAutomationScheduler(): void {
  if (timer) return
  timer = setInterval(() => {
    void tick()
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
  running = false
}
// ⁠[IHUI-AI-PROVENANCE] agent-automation-scheduler · IHUI AI (智汇AI) · 李春川 · aizhs.top
