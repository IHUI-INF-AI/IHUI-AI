// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { eq, desc, or, isNull, and } from 'drizzle-orm'
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
/**
 * 按智能体 ID 查询最近的 agent_tasks 记录(详情页运行时数据聚合用)。
 *
 * agent_tasks 是当前唯一按 agent_id 索引的运行时记录表
 * (subagent dispatch 为进程内/Redis 内存态,无 agentId 字段;langgraph 表无 agent 关联),
 * 详情页 progress/swarm/checkpoint/plan/background 5 个 Tab 均由此聚合。
 *
 * 租户隔离(S-STATS 残余 R1「option a」,2026-11-02 落地):
 *   - viewerUserId 缺省 ⇒ 仅按 agentId 过滤(旧行为,对所有调用方可见);
 *   - 传入 viewerUserId ⇒ 在 agentId 过滤之上,额外按
 *     `createdBy = viewerUserId OR createdBy IS NULL` 收窄。
 *     NEW 行(2026-08-06 之后、带 createdBy 的派单轨迹)只回给创建者本人;
 *     HISTORICAL NULL 行(2026-08-06 之前、无归属)按「未标注可见」约定
 *     仍对**所有**登录用户可见 —— 这是结构性的、文档化残余,下一张工单再谈清理。
 *
 * @param agentId     智能体公开 ID(agents.agentId,uuid)
 * @param limit       最多返回条数(默认 50)
 * @param viewerUserId 调用方用户 ID;传入时按 createdBy 收窄(见上)
 */
export async function findAgentTasksByAgentId(
  agentId: string,
  limit = 50,
  viewerUserId?: string,
): Promise<AgentTask[]> {
  const where = viewerUserId
    ? and(
        eq(agentTasks.agentId, agentId),
        or(eq(agentTasks.createdBy, viewerUserId), isNull(agentTasks.createdBy)),
      )
    : eq(agentTasks.agentId, agentId)
  const rows = await dbRead
    .select()
    .from(agentTasks)
    .where(where)
    .orderBy(desc(agentTasks.createdAt))
    .limit(limit)
  return rows
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
