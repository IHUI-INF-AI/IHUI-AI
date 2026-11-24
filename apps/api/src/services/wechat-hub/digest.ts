// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 日报计划与进程内调度。
 *
 * 不用 Windows 计划任务：API 进程启动后每 30 秒扫一次，按计划时区判断
 * 是否到达 hour:minute；lastRunDay 是"今天已跑"的抢占闸，多实例也不会重复。
 * 推送动作仍由 manager 执行（复用分析 + 出站策略 + 审计）。
 */

import { and, desc, eq, isNull, ne, or } from 'drizzle-orm'
import { wechatHubDigestSchedules } from '@ihui/database'
import type {
  WechatAnalysisRunView,
  WechatDigestScheduleInput,
  WechatDigestScheduleView,
} from '@ihui/types'
import { db, dbRead } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import { assertAccountForUser } from './guards.js'

interface LocalParts {
  dayKey: string
  hour: number
  minute: number
}

/** 日报只发纯文本；控制在单条消息上限内，避免 5000 字被后端截断。 */
export function formatDigestText(accountLabel: string, run: WechatAnalysisRunView): string {
  const result = run.result
  if (!result) return `【微信日报】${accountLabel}\n分析未产出结果。`
  const lines = [
    `【微信日报】${accountLabel}`,
    `消息 ${result.stats.messageCount} 条 · 参与 ${result.stats.participantCount} 人`,
    '',
    result.summary,
  ]
  if (result.highlights.length > 0) {
    lines.push('', '重点：')
    for (const item of result.highlights.slice(0, 5)) lines.push(`- ${item}`)
  }
  if (result.todos.length > 0) {
    lines.push('', '待办：')
    for (const todo of result.todos.slice(0, 5)) {
      lines.push(`- ${todo.text}${todo.owner ? `（${todo.owner}）` : ''}`)
    }
  }
  return lines.join('\n').slice(0, 4_500)
}

/** 按 IANA 时区取本地日期与时分；不依赖服务器时区。 */
export function localParts(date: Date, timezone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const values: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = part.value
  }
  return {
    dayKey: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour ?? '0'),
    minute: Number(values.minute ?? '0'),
  }
}

/** 是否到达当天执行点；只允许命中当前分钟，避免启动即补发。 */
export function isDigestDue(
  schedule: Pick<
    WechatDigestScheduleView,
    'enabled' | 'hour' | 'minute' | 'timezone' | 'lastRunAt'
  >,
  now = new Date(),
): boolean {
  if (!schedule.enabled) return false
  const parts = localParts(now, schedule.timezone)
  if (parts.hour !== schedule.hour || parts.minute !== schedule.minute) return false
  if (!schedule.lastRunAt) return true
  const last = localParts(new Date(schedule.lastRunAt), schedule.timezone)
  return last.dayKey !== parts.dayKey
}

function toScheduleView(
  row: typeof wechatHubDigestSchedules.$inferSelect,
): WechatDigestScheduleView {
  return {
    id: row.id,
    accountId: row.accountId,
    enabled: row.enabled,
    hour: row.hour,
    minute: row.minute,
    timezone: row.timezone,
    target: row.target,
    lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : null,
    lastStatus: row.lastStatus,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function getSchedule(
  userId: string,
  accountId: string,
): Promise<WechatDigestScheduleView | null> {
  await assertAccountForUser(userId, accountId)
  const rows = await dbRead
    .select()
    .from(wechatHubDigestSchedules)
    .where(eq(wechatHubDigestSchedules.accountId, accountId))
    .orderBy(desc(wechatHubDigestSchedules.createdAt))
    .limit(1)
  return rows[0] ? toScheduleView(rows[0]) : null
}

export async function saveSchedule(
  userId: string,
  accountId: string,
  input: WechatDigestScheduleInput,
): Promise<WechatDigestScheduleView> {
  await assertAccountForUser(userId, accountId)
  const values = {
    accountId,
    enabled: input.enabled ?? false,
    hour: input.hour ?? 9,
    minute: input.minute ?? 0,
    timezone: input.timezone ?? 'Asia/Shanghai',
    target: input.target ?? '',
  }
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: values.timezone })
  } catch {
    throw new AppError(
      '时区非法，请使用 IANA 名称，例如 Asia/Shanghai',
      400,
      'WECHAT_DIGEST_BAD_TIMEZONE',
    )
  }
  const upserted = await db
    .insert(wechatHubDigestSchedules)
    .values(values)
    .onConflictDoUpdate({
      target: wechatHubDigestSchedules.accountId,
      set: {
        enabled: values.enabled,
        hour: values.hour,
        minute: values.minute,
        timezone: values.timezone,
        target: values.target,
        updatedAt: new Date(),
      },
    })
    .returning()
  const row = upserted[0]
  if (!row) throw new AppError('保存日报计划失败', 500, 'WECHAT_DIGEST_SAVE_FAILED')
  return toScheduleView(row)
}

/** 扫到期计划并原子抢占；返回本轮拿到执行权的账号 id。 */
export async function claimDueSchedules(now = new Date()): Promise<string[]> {
  const rows = await dbRead
    .select()
    .from(wechatHubDigestSchedules)
    .where(eq(wechatHubDigestSchedules.enabled, true))
  const claimed: string[] = []
  for (const row of rows) {
    if (!isDigestDue(toScheduleView(row), now)) continue
    const dayKey = localParts(now, row.timezone).dayKey
    const marked = await db
      .update(wechatHubDigestSchedules)
      .set({
        lastRunAt: now,
        lastRunDay: dayKey,
        lastStatus: 'running',
        lastError: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(wechatHubDigestSchedules.id, row.id),
          or(
            isNull(wechatHubDigestSchedules.lastRunDay),
            eq(wechatHubDigestSchedules.lastRunDay, ''),
            ne(wechatHubDigestSchedules.lastRunDay, dayKey),
          ),
        ),
      )
      .returning({ id: wechatHubDigestSchedules.id, accountId: wechatHubDigestSchedules.accountId })
    if (marked[0]) claimed.push(marked[0].accountId)
  }
  return claimed
}

/** 手动执行前把计划标成 running；不受小时/分钟限制。手动执行不占当天调度名额。 */
export async function markRunning(
  accountId: string,
  now = new Date(),
  consumeSlot = true,
): Promise<boolean> {
  const rows = await dbRead
    .select({
      timezone: wechatHubDigestSchedules.timezone,
      lastRunDay: wechatHubDigestSchedules.lastRunDay,
    })
    .from(wechatHubDigestSchedules)
    .where(eq(wechatHubDigestSchedules.accountId, accountId))
    .limit(1)
  const row = rows[0]
  if (!row) return false
  const dayKey = localParts(now, row.timezone).dayKey
  await db
    .update(wechatHubDigestSchedules)
    .set({
      lastRunAt: now,
      ...(consumeSlot ? { lastRunDay: dayKey } : {}),
      lastStatus: 'running',
      lastError: null,
      updatedAt: now,
    })
    .where(eq(wechatHubDigestSchedules.accountId, accountId))
  return true
}

/** 执行结束后落状态；不影响 lastRunDay（当天仍视为已跑）。 */
export async function markResult(
  accountId: string,
  status: string,
  error: string | null,
): Promise<void> {
  const rows = await dbRead
    .select({
      lastStatus: wechatHubDigestSchedules.lastStatus,
      lastError: wechatHubDigestSchedules.lastError,
    })
    .from(wechatHubDigestSchedules)
    .where(eq(wechatHubDigestSchedules.accountId, accountId))
    .limit(1)
  const current = rows[0]
  if (!current || (current.lastStatus === status && current.lastError === error)) return
  const changed = { lastStatus: status, lastError: error }
  await db
    .update(wechatHubDigestSchedules)
    .set({ ...changed, updatedAt: new Date() })
    .where(eq(wechatHubDigestSchedules.accountId, accountId))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
