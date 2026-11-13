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

import { lt, eq, and, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import { agents, agentHeatStats, oauthSessions } from '@ihui/database'
import { logger } from '../utils/logger.js'
import { runAbsentAttendance, type AbsentRunResult } from './edu-attendance-absent-job.js'

const INACTIVE_THRESHOLD_DAYS = 180
const HEAT_RETENTION_DAYS = 90
/** 单批删除行数上限:积压到百万级时也不让一条 DELETE 物化全部行(F-352)。 */
const CLEANUP_BATCH_SIZE = 5000
/** 单轮最多批数:防极端积压把 scheduler worker 一直占住。 */
const CLEANUP_MAX_BATCHES = 1000

export async function markInactiveAgents(): Promise<{ scanned: number; updated: number }> {
  const cutoff = new Date(Date.now() - INACTIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)
  // 单条集合 UPDATE,条件内复核 status:不再全量 SELECT + 逐行回写(N+1)。
  // returning 只取主键用于计数,不回读整行。
  const rows = await db
    .update(agents)
    .set({ status: 'inactive', updatedAt: new Date() })
    .where(and(eq(agents.status, 'published'), lt(agents.updatedAt, cutoff)))
    .returning({ agentId: agents.agentId })

  return { scanned: rows.length, updated: rows.length }
}

/**
 * 分批删除:每批最多 CLEANUP_BATCH_SIZE 行,不足即止,最多 CLEANUP_MAX_BATCHES 批。
 * 失败先记 logger.error(任务名 + 本轮已删数)再抛出,与原实现失败语义一致。
 */
async function deleteExpiredInBatches(
  jobName: string,
  deleteBatch: () => Promise<number>,
): Promise<number> {
  let deleted = 0
  try {
    for (let batch = 0; batch < CLEANUP_MAX_BATCHES; batch++) {
      const rows = await deleteBatch()
      deleted += rows
      if (rows < CLEANUP_BATCH_SIZE) break
    }
  } catch (error) {
    logger.error(`${jobName} 分批清理失败`, { jobName, deleted, error })
    throw error
  }
  return deleted
}

export async function cleanupOldHeatStats(): Promise<{ deleted: number }> {
  const cutoff = new Date(Date.now() - HEAT_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const deleted = await deleteExpiredInBatches('cleanup-old-heat', async () => {
    const rows = await db
      .delete(agentHeatStats)
      .where(
        inArray(
          agentHeatStats.id,
          db
            .select({ id: agentHeatStats.id })
            .from(agentHeatStats)
            .where(lt(agentHeatStats.createdAt, cutoff))
            .limit(CLEANUP_BATCH_SIZE),
        ),
      )
      .returning({ id: agentHeatStats.id })
    return rows.length
  })
  return { deleted }
}

export async function cleanupOauthSessions(): Promise<{ deleted: number }> {
  const now = new Date()
  const deleted = await deleteExpiredInBatches('oauth-session-cleanup', async () => {
    const rows = await db
      .delete(oauthSessions)
      .where(
        inArray(
          oauthSessions.id,
          db
            .select({ id: oauthSessions.id })
            .from(oauthSessions)
            .where(lt(oauthSessions.expiresAt, now))
            .limit(CLEANUP_BATCH_SIZE),
        ),
      )
      .returning({ id: oauthSessions.id })
    return rows.length
  })
  return { deleted }
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
