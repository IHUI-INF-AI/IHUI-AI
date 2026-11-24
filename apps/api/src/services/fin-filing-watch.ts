// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 申报到期提醒(2026-11-24 补口)。
 *
 * 缺口原文:"只有 filing/deadlines 查询接口,没有定时任务/待办/通知"。本文件把提醒腿
 * 补成**站内信 + 幂等**:每任务每业务日最多一条,重复触发(cron 重启/手动补跑)不重发。
 * 提醒对象 = 任务 assignee;没有指派 ⇒ 计入 skippedNoAssignee 点名,不猜收件人。
 * 陈旧线:逾期超过 staleDays(默认 30 天)的任务不再打扰 —— 历史欠账由人工在台账处理,
 * 不属于"到期提醒"的职责。
 */
import { and, gte, inArray, lte } from 'drizzle-orm'

import { db } from '../db/index.js'
import { finFilingTask } from '@ihui/database'
import { bizDayKey, shiftBizDayKey } from '../utils/biz-day.js'
import { createNotificationIdempotent } from '../db/notification-queries.js'

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function diffDays(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`)
  const b = Date.parse(`${toIso}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

/** 提醒窗内任务的选取纯核(测试单钉边界) */
export function selectFilingDueTasks<T extends { id: string; status: string; dueDate: string }>(
  tasks: readonly T[],
  todayIso: string,
  leadDays = 3,
  staleDays = 30,
): Array<{ task: T; kind: 'upcoming' | 'overdue'; days: number }> {
  const remindable = new Set(['pending', 'computed', 'drafted'])
  const floor = addDaysIso(todayIso, -staleDays)
  const out: Array<{ task: T; kind: 'upcoming' | 'overdue'; days: number }> = []
  for (const t of tasks) {
    if (!remindable.has(t.status)) continue
    const due = t.dueDate.slice(0, 10)
    if (due < floor) continue
    const days = diffDays(todayIso, due)
    if (days < 0) out.push({ task: t, kind: 'overdue', days })
    else if (days <= leadDays) out.push({ task: t, kind: 'upcoming', days })
  }
  return out
}

export interface FilingDeadlineScanResult {
  date: string
  scanned: number
  reminded: number
  deduped: number
  skippedNoAssignee: number
  noAssignee: Array<{ taskId: string; taxType: string; dueDate: string }>
}

export async function scanFilingDeadlines(now: Date = new Date()): Promise<FilingDeadlineScanResult> {
  const todayIso = bizDayKey(now)
  const ceiling = addDaysIso(todayIso, 3)
  const floor = shiftBizDayKey(
    shiftBizDayKey(todayIso, 3),
    -33, // ceiling - 33 = today - 30(陈旧线)
  )
  const tasks = await db
    .select()
    .from(finFilingTask)
    .where(
      and(
        inArray(finFilingTask.status, ['pending', 'computed', 'drafted']),
        gte(finFilingTask.dueDate, floor),
        lte(finFilingTask.dueDate, ceiling),
      ),
    )
  const picked = selectFilingDueTasks(tasks, todayIso)
  let reminded = 0
  let deduped = 0
  let skippedNoAssignee = 0
  const noAssignee: FilingDeadlineScanResult['noAssignee'] = []
  for (const { task, kind, days } of picked) {
    if (!task.assignee) {
      skippedNoAssignee += 1
      noAssignee.push({ taskId: task.id, taxType: task.taxType, dueDate: task.dueDate.slice(0, 10) })
      continue
    }
    const title =
      kind === 'overdue'
        ? `申报逾期:${task.taxType} ${task.period}(逾期 ${Math.abs(days)} 天)`
        : `申报临期:${task.taxType} ${task.period}(剩 ${days} 天)`
    const res = await createNotificationIdempotent({
      userId: task.assignee,
      type: 'fin.filing_due',
      title,
      content: `截止 ${task.dueDate.slice(0, 10)}。请在电子税务局完成申报并回填回执号;未获回执前任务状态不得推进为已受理。`,
      data: { taskId: task.id, taxType: task.taxType, period: task.period, kind, days },
      idempotencyKey: `fin-filing-due:${task.id}:${todayIso}`,
    })
    if (res.created) reminded += 1
    else deduped += 1
  }
  return { date: todayIso, scanned: tasks.length, reminded, deduped, skippedNoAssignee, noAssignee }
}

/** 手动触发出口(管理端按钮/AI 工具面共用;幂等键与 cron 同形,当日重复点不重发) */
export async function remindFilingDeadlinesNow() {
  return scanFilingDeadlines(new Date())
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
