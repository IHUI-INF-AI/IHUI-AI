// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { eq, desc, sql } from 'drizzle-orm'
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
 * agent_tasks 可见性视图(2026-11-02,归属回填与 fail-open 收敛)。
 * `isAdmin` 由 utils/dispatch-ownership.ts 的 `isAdminViewer` 提供 —— 本文件不读 roleId。
 */
export interface AgentTaskViewer {
  userId: string
  isAdmin: boolean
}

/** 单 agent 历史扫描窗口:先取最近 500 行,按可见性过滤后再截 limit(默认 50) */
const AGENT_TASK_SCAN_LIMIT = 500

/** agent_tasks 创建者回填的迁移标记 scope(与 drizzle 迁移里的标记行同值) */
const AGENT_TASK_BACKFILL_SCOPE = 'agent_tasks.creator'

/**
 * agent_tasks 行是否对 viewer 可见(**单一判据**,查询与测试都引这里,不在别处重写表达)。
 *
 * 三态(顺序契约的核心):
 *  - 管理员 ⇒ 恒可见(orphan 的独立可见性用例走这一档);
 *  - `createdBy` 非空 ⇒ 只有创建者本人可见;
 *  - `createdBy` 为空(历史行)⇒ **迁移标记写入前**维持旧口径(登录用户可见),不隐藏历史;
 *    **标记写入后**视为 orphan,仅管理员可见。
 *
 * 顺序保证:迁移先把可推导行回填(created_by = agents.user_id),**最后**写
 * `ownership_backfill_state` 标记;代码读到标记才收紧 NULL 行。因此
 * 「代码先上、迁移没跑」⇒ 标记缺失 ⇒ 旧口径;「迁移先跑、代码没上」⇒ 旧代码不认识标记。
 */
export function isAgentTaskVisibleTo(
  row: Pick<AgentTask, 'createdBy'>,
  viewer: AgentTaskViewer,
  backfillApplied: boolean,
): boolean {
  if (viewer.isAdmin) return true
  const creator = row.createdBy
  if (typeof creator === 'string' && creator.length > 0) return creator === viewer.userId
  return backfillApplied ? false : true
}

let backfillAppliedCache: boolean | null = null

/**
 * 迁移标记是否已写入(scope = 'agent_tasks.creator')。
 *
 * 表不存在 / 查询失败 / 无标记行 ⇒ false = 保持旧的「NULL 行可见」口径 ——
 * 迁移没跑完就收紧会让历史数据集体消失,这里宁可按旧口径。
 * 只有 true 才缓存;false 每次重查(迁移可能在进程运行期间补跑,不必重启)。
 */
export async function isAgentTaskBackfillApplied(): Promise<boolean> {
  if (backfillAppliedCache === true) return true
  try {
    const rows = (await dbRead.execute(
      sql`select 1 from ownership_backfill_state where scope = ${AGENT_TASK_BACKFILL_SCOPE} limit 1`,
    )) as unknown as Array<unknown>
    if (rows.length > 0) {
      backfillAppliedCache = true
      return true
    }
  } catch {
    // 迁移未跑(表不存在)⇒ 保持旧口径,不提前收紧
  }
  return false
}

/** 测试用:清空迁移标记缓存(生产入口不会调用) */
export function _resetAgentTaskBackfillCache(): void {
  backfillAppliedCache = null
}

/**
 * 按智能体 ID 查询最近的 agent_tasks 记录(详情页运行时数据聚合用)。
 *
 * agent_tasks 是当前唯一按 agent_id 索引的运行时记录表
 * (subagent dispatch 为进程内/Redis 内存态,无 agentId 字段;langgraph 表无 agent 关联),
 * 详情页 progress/swarm/checkpoint/plan/background 5 个 Tab 均由此聚合。
 *
 * 2026-11-02 收紧:此前完全不过滤创建者 —— 已上架 agent 的汇总会把其他租户的
 * goal/产出一起返回。现在按 `isAgentTaskVisibleTo` 单一判据过滤:
 *  - 后过滤而非 SQL 条件,是为了让「谓词回退 fail-open」的反向例能直接打红;
 *  - 扫描窗口 500 行,过滤后截 limit;本人历史行仍在该窗口内(单 agent 历史有界)。
 *
 * @param agentId 智能体公开 ID(agents.agentId,uuid)
 * @param viewer  调用方(路由经 isAdminViewer 注入管理员档)
 * @param limit   最多返回条数(默认 50)
 */
export async function findAgentTasksByAgentId(
  agentId: string,
  viewer: AgentTaskViewer,
  limit = 50,
): Promise<AgentTask[]> {
  const rows = await dbRead
    .select()
    .from(agentTasks)
    .where(eq(agentTasks.agentId, agentId))
    .orderBy(desc(agentTasks.createdAt))
    .limit(AGENT_TASK_SCAN_LIMIT)
  // 管理员恒可见,不需要探测迁移标记(省一次查询);普通用户按标记三态过滤
  const backfillApplied = viewer.isAdmin ? true : await isAgentTaskBackfillApplied()
  return rows.filter((row) => isAgentTaskVisibleTo(row, viewer, backfillApplied)).slice(0, limit)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
