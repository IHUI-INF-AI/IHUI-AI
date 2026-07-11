/**
 * 定时任务服务 — 迁移自旧架构 tasks/ 3 个定时任务 (M-77)。
 *
 * - markInactiveAgents: 标记 180 天未更新的公开 Agent 为 inactive
 * - cleanupOldHeatStats: 清理 90 天前的热度统计数据
 * - cleanupOauthSessions: 清理过期的 OAuth 会话
 */

import { lt, eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { agents, agentHeatStats, oauthSessions } from '@ihui/database'

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
