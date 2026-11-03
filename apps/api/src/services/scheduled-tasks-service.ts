// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 定时任务服务 — 迁移自旧架构 tasks/ 3 个定时任务 (M-77)。
 *
 * - markInactiveAgents: 标记 180 天未更新的公开 Agent 为 inactive
 * - cleanupOldHeatStats: 清理 90 天前的热度统计数据
 * - cleanupOauthSessions: 清理过期的 OAuth 会话
 * - recordAbsentDaily: 考勤每日缺勤补录(2026-11-01 立,ATT-JOB 票;
 *   档关环境变量 `EDU_ATTENDANCE_ABSENT_DISABLED=1`)
 */

import { lt, eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { agents, agentHeatStats, oauthSessions } from '@ihui/database'
import { runAbsentAttendance, type AbsentRunResult } from './edu-attendance-absent-job.js'

const INACTIVE_THRESHOLD_DAYS = 180
const HEAT_RETENTION_DAYS = 90

export async function markInactiveAgents(): Promise<{ scanned: number; updated: number }> {
  const cutoff = new Date(Date.now() - INACTIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)
  const oldAgents = await db
    .select({ agentId: agents.agentId })
    .from(agents)
    .where(and(eq(agents.status, 'published'), lt(agents.updatedAt, cutoff)))

  let updated = 0
  for (const a of oldAgents) {
    await db
      .update(agents)
      .set({ status: 'inactive', updatedAt: new Date() })
      .where(eq(agents.agentId, a.agentId))
    updated++
  }

  return { scanned: oldAgents.length, updated }
}

export async function cleanupOldHeatStats(): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - HEAT_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const deleted = await db
    .delete(agentHeatStats)
    .where(lt(agentHeatStats.createdAt, cutoff))
    .returning()
  return { deleted: deleted.length }
}

export async function cleanupOauthSessions(): Promise<{ deleted: number }> {
  const now = new Date()
  const deleted = await db.delete(oauthSessions).where(lt(oauthSessions.expiresAt, now)).returning()
  return { deleted: deleted.length }
}

/**
 * 考勤每日缺勤补录(2026-11-01 立,ATT-JOB 票)。
 *
 * 立因:`GET /attendance/stats` 的分母 = "表里已有的行",没来的人不进统计
 * ⇒ 报表缺勤恒 0。判据与幂等实现在 `services/edu-attendance-absent-job.ts`;
 * 本函数只做"档关开关 + 入口对齐"这一层,不复制任何判据(§22c 单源)。
 *
 * 消费方:`workers/scheduler-worker.ts` 的 switch case `'edu-attendance-absent-daily'`
 * (与 `mark-inactive-agents` 同一形态)。注册数组 SCHEDULED_JOBS 在
 * `plugins/scheduler.ts`,与 worker 的 case 均在本票文件白名单外,需主席同批补齐
 * —— AGENTS §"造好没装车"= 没有:补完那两处之前本 job 结构上不会被调度。
 *
 * 可关档位:`EDU_ATTENDANCE_ABSENT_DISABLED=1` 直接返回零计数,不查库。
 *   失效方向 = "多要一次说明":日志点名"因 ENV 关闭",不静默。
 */
export async function recordAbsentDaily(): Promise<AbsentRunResult> {
  if (process.env.EDU_ATTENDANCE_ABSENT_DISABLED === '1') {
    return { rules: 0, students: 0, created: 0, skipped: 0, missedIds: [] }
  }
  return runAbsentAttendance()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
