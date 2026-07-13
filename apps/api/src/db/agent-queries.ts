import { eq } from 'drizzle-orm'
import { db } from './index.js'
import { agents, type Agent } from '@ihui/database'

/**
 * 更新智能体发布状态。
 * - status: 'published' / 'offline' / 'pending' / 'rejected'。
 * - published=true 时同步 status='published' 与 publishedAt=now()。
 */
export async function publishAgent(agentId: string, publish: boolean): Promise<Agent | undefined> {
  const status = publish ? 'published' : 'offline'
  const set: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  }
  if (publish) set.publishedAt = new Date()
  const rows = await db.update(agents).set(set).where(eq(agents.agentId, agentId)).returning()
  return rows[0]
}

/**
 * 查询智能体详情。
 */
export async function findAgentById(agentId: string): Promise<Agent | undefined> {
  const rows = await db.select().from(agents).where(eq(agents.agentId, agentId)).limit(1)
  return rows[0]
}
