import { eq, desc } from 'drizzle-orm'
import { db, dbRead } from './index.js'
import { agents, agentTasks, type Agent, type AgentTask } from '@ihui/database'

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

/**
 * 按智能体 ID 查询最近的 agent_tasks 记录(详情页运行时数据聚合用)。
 *
 * agent_tasks 是当前唯一按 agent_id 索引的运行时记录表
 * (subagent dispatch 为进程内/Redis 内存态,无 agentId 字段;langgraph 表无 agent 关联),
 * 详情页 progress/swarm/checkpoint/plan/background 5 个 Tab 均由此聚合。
 *
 * @param agentId 智能体公开 ID(agents.agentId,uuid)
 * @param limit   最多返回条数(默认 50)
 */
export async function findAgentTasksByAgentId(
  agentId: string,
  limit = 50,
): Promise<AgentTask[]> {
  const rows = await dbRead
    .select()
    .from(agentTasks)
    .where(eq(agentTasks.agentId, agentId))
    .orderBy(desc(agentTasks.createdAt))
    .limit(limit)
  return rows
}
