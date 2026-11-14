// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { eq, desc, and, or, isNull, inArray, sql, type SQL } from 'drizzle-orm'
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

/** 查询可选过滤(全部下推 SQL;不传时行为与旧调用一致) */
export interface AgentTaskQueryOptions {
  /** 任务状态(单值或列表),非空时进入 WHERE */
  status?: string | string[]
  /** 偏移量,>0 时进入 OFFSET(配合 limit 分页) */
  offset?: number
}

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
 * goal/产出一起返回。现在按 `isAgentTaskVisibleTo` 单一判据过滤。
 *
 * F-601(2026-11-13):可见性 / 状态条件全部下推 SQL WHERE,排序与分页交给
 * ORDER BY + LIMIT/OFFSET。旧实现先取最近 500 行再内存 filter/slice,热门 agent 下
 * 本人历史会被挤出窗口(页面误显示无数据),且每次多拉 500 行。
 *
 * @param agentId 智能体公开 ID(agents.agentId,uuid)
 * @param viewer  调用方(路由经 isAdminViewer 注入管理员档)
 * @param limit   最多返回条数(默认 50)
 * @param options 可选过滤:status / offset(不传保持旧行为)
 */
export async function findAgentTasksByAgentId(
  agentId: string,
  viewer: AgentTaskViewer,
  limit = 50,
  options: AgentTaskQueryOptions = {},
): Promise<AgentTask[]> {
  // 管理员恒可见,不需要探测迁移标记(省一次查询);普通用户按标记三态过滤
  const backfillApplied = viewer.isAdmin ? true : await isAgentTaskBackfillApplied()

  const conditions: SQL[] = [eq(agentTasks.agentId, agentId)]
  if (!viewer.isAdmin) {
    // 与 isAgentTaskVisibleTo 同口径:本人恒可见;created_by 为空在迁移前维持旧口径可见
    const ownership = backfillApplied
      ? eq(agentTasks.createdBy, viewer.userId)
      : or(eq(agentTasks.createdBy, viewer.userId), isNull(agentTasks.createdBy))
    if (ownership) conditions.push(ownership)
  }
  const statuses = (Array.isArray(options.status) ? options.status : [options.status])
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim())
  const uniqueStatuses = Array.from(new Set(statuses))
  if (uniqueStatuses.length > 1) {
    conditions.push(inArray(agentTasks.status, uniqueStatuses))
  } else if (uniqueStatuses.length === 1) {
    const onlyStatus = uniqueStatuses[0]
    if (onlyStatus) conditions.push(eq(agentTasks.status, onlyStatus))
  }

  const offset = options.offset && options.offset > 0 ? Math.floor(options.offset) : 0
  const query = dbRead
    .select()
    .from(agentTasks)
    .where(and(...conditions))
    .orderBy(desc(agentTasks.createdAt), desc(agentTasks.id))
    .limit(limit)
  const rows = offset > 0 ? await query.offset(offset) : await query
  // SQL 已按同一判据过滤;此处仅保留单一判据的防御性复筛(不改变结果与顺序)
  return rows.filter((row) => isAgentTaskVisibleTo(row, viewer, backfillApplied))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
