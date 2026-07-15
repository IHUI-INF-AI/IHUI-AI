import { eq, and, desc, asc, sql, ilike, inArray } from 'drizzle-orm'
import { db, dbRead } from './index.js'
import {
  agents,
  agentCategories,
  agentSettlements,
  agentExamines,
  agentThumbs,
  agentCollects,
  agentUseDetails,
  type Agent,
  type AgentCategory,
  type AgentSettlement,
  type AgentExamine,
} from '@ihui/database'

// =============================================================================
// Agents 智能体
// =============================================================================

export interface AgentListQuery {
  page?: number
  pageSize?: number
  status?: string
  categoryId?: string
  userId?: string
  keyword?: string
}

export async function findAgentsList(
  query: AgentListQuery,
): Promise<{ list: Agent[]; total: number; page: number; pageSize: number }> {
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 20
  const conds = []
  if (query.status) conds.push(eq(agents.status, query.status))
  if (query.categoryId) conds.push(eq(agents.categoryId, query.categoryId))
  if (query.userId) conds.push(eq(agents.userId, query.userId))
  if (query.keyword) {
    conds.push(ilike(agents.name, `%${query.keyword}%`))
  }
  const where = conds.length ? and(...conds) : undefined
  const [list, totalRows] = await Promise.all([
    dbRead
      .select()
      .from(agents)
      .where(where)
      .orderBy(asc(agents.sort), desc(agents.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    dbRead
      .select({ count: sql<number>`count(*)::int` })
      .from(agents)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page, pageSize }
}

export async function findAgentById(agentId: string): Promise<Agent | undefined> {
  const rows = await dbRead.select().from(agents).where(eq(agents.agentId, agentId)).limit(1)
  return rows[0]
}

export interface CreateAgentInput {
  name: string
  description?: string | null
  avatar?: string | null
  cover?: string | null
  categoryId?: string | null
  userId?: string | null
  workspaceId?: string | null
  status?: string
  price?: number
  isFree?: boolean
  sort?: number
  publishedAt?: Date | null
  remark?: string | null
}

export async function createAgent(data: CreateAgentInput): Promise<Agent | undefined> {
  const rows = await db
    .insert(agents)
    .values({
      name: data.name,
      description: data.description,
      avatar: data.avatar,
      cover: data.cover,
      categoryId: data.categoryId,
      userId: data.userId,
      workspaceId: data.workspaceId,
      status: data.status,
      price: data.price,
      isFree: data.isFree,
      sort: data.sort,
      publishedAt: data.publishedAt,
      remark: data.remark,
    })
    .returning()
  return rows[0]
}

export interface UpdateAgentInput {
  name?: string
  description?: string | null
  avatar?: string | null
  cover?: string | null
  categoryId?: string | null
  userId?: string | null
  workspaceId?: string | null
  status?: string
  price?: number
  isFree?: boolean
  sort?: number
  publishedAt?: Date | null
  remark?: string | null
}

export async function updateAgent(
  agentId: string,
  patch: UpdateAgentInput,
): Promise<Agent | undefined> {
  // 发布时若未显式提供 publishedAt，则自动填充当前时间
  const extra: Partial<UpdateAgentInput> = {}
  if (patch.status === 'published' && patch.publishedAt === undefined) {
    extra.publishedAt = new Date()
  }
  const rows = await db
    .update(agents)
    .set({ ...patch, ...extra, updatedAt: new Date() })
    .where(eq(agents.agentId, agentId))
    .returning()
  return rows[0]
}

export async function deleteAgent(agentId: string): Promise<Agent | undefined> {
  const rows = await db.delete(agents).where(eq(agents.agentId, agentId)).returning()
  return rows[0]
}

// =============================================================================
// Agent Categories 分类
// =============================================================================

export interface CategoryListQuery {
  page?: number
  pageSize?: number
  status?: string
  isPaid?: boolean
  keyword?: string
}

export async function findCategoryList(
  query: CategoryListQuery,
): Promise<{ list: AgentCategory[]; total: number; page: number; pageSize: number }> {
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 50
  const conds = []
  if (query.status) conds.push(eq(agentCategories.status, query.status))
  if (query.isPaid !== undefined) conds.push(eq(agentCategories.isPaid, query.isPaid))
  if (query.keyword) conds.push(ilike(agentCategories.name, `%${query.keyword}%`))
  const where = conds.length ? and(...conds) : undefined
  const [list, totalRows] = await Promise.all([
    dbRead
      .select()
      .from(agentCategories)
      .where(where)
      .orderBy(asc(agentCategories.sort), desc(agentCategories.updatedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    dbRead
      .select({ count: sql<number>`count(*)::int` })
      .from(agentCategories)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page, pageSize }
}

export async function findCategoryById(categoryId: string): Promise<AgentCategory | undefined> {
  const rows = await dbRead
    .select()
    .from(agentCategories)
    .where(eq(agentCategories.categoryId, categoryId))
    .limit(1)
  return rows[0]
}

export async function findCategoriesByIds(ids: string[]): Promise<AgentCategory[]> {
  if (ids.length === 0) return []
  return dbRead.select().from(agentCategories).where(inArray(agentCategories.categoryId, ids))
}

/** 按智能体 ID 查其所属分类（基于 agents.categoryId）。 */
export async function findCategoryByAgentId(agentId: string): Promise<AgentCategory | undefined> {
  const rows = await dbRead
    .select({ category: agentCategories })
    .from(agentCategories)
    .innerJoin(agents, eq(agents.categoryId, agentCategories.categoryId))
    .where(eq(agents.agentId, agentId))
    .limit(1)
  return rows[0]?.category
}

export interface CreateCategoryInput {
  name: string
  description?: string | null
  icon?: string | null
  sort?: number
  status?: string
  isPaid?: boolean
}

export async function createCategory(
  data: CreateCategoryInput,
): Promise<AgentCategory | undefined> {
  const rows = await db
    .insert(agentCategories)
    .values({
      name: data.name,
      description: data.description,
      icon: data.icon,
      sort: data.sort,
      status: data.status,
      isPaid: data.isPaid,
    })
    .returning()
  return rows[0]
}

export interface UpdateCategoryInput {
  name?: string
  description?: string | null
  icon?: string | null
  sort?: number
  status?: string
  isPaid?: boolean
}

export async function updateCategory(
  categoryId: string,
  patch: UpdateCategoryInput,
): Promise<AgentCategory | undefined> {
  const rows = await db
    .update(agentCategories)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(agentCategories.categoryId, categoryId))
    .returning()
  return rows[0]
}

export async function deleteCategory(categoryId: string): Promise<AgentCategory | undefined> {
  const rows = await db
    .delete(agentCategories)
    .where(eq(agentCategories.categoryId, categoryId))
    .returning()
  return rows[0]
}

// =============================================================================
// Agent Settlements 结算
// =============================================================================

export interface SettlementListQuery {
  page?: number
  pageSize?: number
  agentId?: string
  status?: string
  orderNo?: string
}

export async function findSettlementList(
  query: SettlementListQuery,
): Promise<{ list: AgentSettlement[]; total: number; page: number; pageSize: number }> {
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 20
  const conds = []
  if (query.agentId) conds.push(eq(agentSettlements.agentId, query.agentId))
  if (query.status) conds.push(eq(agentSettlements.status, query.status))
  if (query.orderNo) conds.push(eq(agentSettlements.orderNo, query.orderNo))
  const where = conds.length ? and(...conds) : undefined
  const [list, totalRows] = await Promise.all([
    dbRead
      .select()
      .from(agentSettlements)
      .where(where)
      .orderBy(desc(agentSettlements.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    dbRead
      .select({ count: sql<number>`count(*)::int` })
      .from(agentSettlements)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page, pageSize }
}

/** 结算汇总：总金额、已结算金额、未结算金额、记录数。 */
export async function findSettlementSummary(): Promise<{
  totalAmount: number
  settledAmount: number
  unsettledAmount: number
  totalCount: number
  settledCount: number
  unsettledCount: number
}> {
  const rows = await dbRead
    .select({
      totalAmount: sql<number>`coalesce(sum(${agentSettlements.amount}), 0)::int`,
      settledAmount: sql<number>`coalesce(sum(${agentSettlements.amount}) filter (where ${agentSettlements.status} = 'settled'), 0)::int`,
      unsettledAmount: sql<number>`coalesce(sum(${agentSettlements.amount}) filter (where ${agentSettlements.status} = 'unsettled'), 0)::int`,
      totalCount: sql<number>`count(*)::int`,
      settledCount: sql<number>`count(*) filter (where ${agentSettlements.status} = 'settled')::int`,
      unsettledCount: sql<number>`count(*) filter (where ${agentSettlements.status} = 'unsettled')::int`,
    })
    .from(agentSettlements)
  const r = rows[0]
  return {
    totalAmount: r?.totalAmount ?? 0,
    settledAmount: r?.settledAmount ?? 0,
    unsettledAmount: r?.unsettledAmount ?? 0,
    totalCount: r?.totalCount ?? 0,
    settledCount: r?.settledCount ?? 0,
    unsettledCount: r?.unsettledCount ?? 0,
  }
}

/** 按订单号汇总结算。 */
export async function findSettlementByOrder(orderNo: string): Promise<{
  orderNo: string
  totalAmount: number
  commissionAmount: number
  count: number
}> {
  const rows = await dbRead
    .select({
      totalAmount: sql<number>`coalesce(sum(${agentSettlements.amount}), 0)::int`,
      commissionAmount: sql<number>`coalesce(sum(${agentSettlements.commissionAmount}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(agentSettlements)
    .where(eq(agentSettlements.orderNo, orderNo))
  const r = rows[0]
  return {
    orderNo,
    totalAmount: r?.totalAmount ?? 0,
    commissionAmount: r?.commissionAmount ?? 0,
    count: r?.count ?? 0,
  }
}

export interface CreateSettlementInput {
  agentId?: string | null
  buyRecordId?: string | null
  orderNo?: string | null
  amount?: number
  commissionRate?: number
  commissionAmount?: number
  status?: string
}

export async function createSettlement(
  data: CreateSettlementInput,
): Promise<AgentSettlement | undefined> {
  const rows = await db
    .insert(agentSettlements)
    .values({
      agentId: data.agentId,
      buyRecordId: data.buyRecordId,
      orderNo: data.orderNo,
      amount: data.amount,
      commissionRate: data.commissionRate,
      commissionAmount: data.commissionAmount,
      status: data.status,
    })
    .returning()
  return rows[0]
}

/** 将指定结算记录置为已结算。 */
export async function settleSettlement(id: string): Promise<AgentSettlement | undefined> {
  const rows = await db
    .update(agentSettlements)
    .set({ status: 'settled', settledAt: new Date(), updatedAt: new Date() })
    .where(eq(agentSettlements.id, id))
    .returning()
  return rows[0]
}

export async function deleteSettlements(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const rows = await db
    .delete(agentSettlements)
    .where(inArray(agentSettlements.id, ids))
    .returning()
  return rows.length
}

// =============================================================================
// Agent Examines 审核
// =============================================================================

export interface ExamineListQuery {
  page?: number
  pageSize?: number
  agentId?: string
  userId?: string
  status?: string
}

export async function findExamineList(
  query: ExamineListQuery,
): Promise<{ list: AgentExamine[]; total: number; page: number; pageSize: number }> {
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 20
  const conds = []
  if (query.agentId) conds.push(eq(agentExamines.agentId, query.agentId))
  if (query.userId) conds.push(eq(agentExamines.userId, query.userId))
  if (query.status) conds.push(eq(agentExamines.status, query.status))
  const where = conds.length ? and(...conds) : undefined
  const [list, totalRows] = await Promise.all([
    dbRead
      .select()
      .from(agentExamines)
      .where(where)
      .orderBy(desc(agentExamines.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    dbRead
      .select({ count: sql<number>`count(*)::int` })
      .from(agentExamines)
      .where(where),
  ])
  return { list, total: totalRows[0]?.count ?? 0, page, pageSize }
}

/** 审核统计：各状态记录数。 */
export async function findExamineStats(): Promise<{
  totalCount: number
  pendingCount: number
  approvedCount: number
  rejectedCount: number
}> {
  const rows = await dbRead
    .select({
      totalCount: sql<number>`count(*)::int`,
      pendingCount: sql<number>`count(*) filter (where ${agentExamines.status} = 'pending')::int`,
      approvedCount: sql<number>`count(*) filter (where ${agentExamines.status} = 'approved')::int`,
      rejectedCount: sql<number>`count(*) filter (where ${agentExamines.status} = 'rejected')::int`,
    })
    .from(agentExamines)
  const r = rows[0]
  return {
    totalCount: r?.totalCount ?? 0,
    pendingCount: r?.pendingCount ?? 0,
    approvedCount: r?.approvedCount ?? 0,
    rejectedCount: r?.rejectedCount ?? 0,
  }
}

export async function findExamineById(id: string): Promise<AgentExamine | undefined> {
  const rows = await dbRead.select().from(agentExamines).where(eq(agentExamines.id, id)).limit(1)
  return rows[0]
}

export interface CreateExamineInput {
  agentId?: string | null
  userId?: string | null
  status?: string
  reason?: string | null
}

export async function createExamine(data: CreateExamineInput): Promise<AgentExamine | undefined> {
  const rows = await db
    .insert(agentExamines)
    .values({
      agentId: data.agentId,
      userId: data.userId,
      status: data.status,
      reason: data.reason,
    })
    .returning()
  return rows[0]
}

export interface UpdateExamineInput {
  agentId?: string | null
  userId?: string | null
  status?: string
  reason?: string | null
}

export async function updateExamine(
  id: string,
  patch: UpdateExamineInput,
): Promise<AgentExamine | undefined> {
  const rows = await db
    .update(agentExamines)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(agentExamines.id, id))
    .returning()
  return rows[0]
}

export async function deleteExamine(id: string): Promise<AgentExamine | undefined> {
  const rows = await db.delete(agentExamines).where(eq(agentExamines.id, id)).returning()
  return rows[0]
}

// =============================================================================
// thumbs / collect / use / unpublish
// =============================================================================

export async function findThumb(uuid: string, botId: string): Promise<{ id: string } | undefined> {
  const rows = await dbRead
    .select({ id: agentThumbs.id })
    .from(agentThumbs)
    .where(and(eq(agentThumbs.uuid, uuid), eq(agentThumbs.botId, botId)))
    .limit(1)
  return rows[0]
}

export async function addThumb(uuid: string, botId: string): Promise<void> {
  await db.insert(agentThumbs).values({ uuid, botId })
  await db
    .update(agents)
    .set({ likeCount: sql`${agents.likeCount} + 1`, updatedAt: new Date() })
    .where(eq(agents.botId, botId))
}

export async function removeThumb(uuid: string, botId: string): Promise<void> {
  await db.delete(agentThumbs).where(and(eq(agentThumbs.uuid, uuid), eq(agentThumbs.botId, botId)))
  await db
    .update(agents)
    .set({
      likeCount: sql`GREATEST(COALESCE(${agents.likeCount}, 0) - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(agents.botId, botId))
}

export async function findCollect(
  uuid: string,
  botId: string,
): Promise<{ id: string } | undefined> {
  const rows = await dbRead
    .select({ id: agentCollects.id })
    .from(agentCollects)
    .where(and(eq(agentCollects.uuid, uuid), eq(agentCollects.botId, botId)))
    .limit(1)
  return rows[0]
}

export async function addCollect(uuid: string, botId: string): Promise<void> {
  await db.insert(agentCollects).values({ uuid, botId })
  await db
    .update(agents)
    .set({ collectCount: sql`${agents.collectCount} + 1`, updatedAt: new Date() })
    .where(eq(agents.botId, botId))
}

export async function removeCollect(uuid: string, botId: string): Promise<void> {
  await db
    .delete(agentCollects)
    .where(and(eq(agentCollects.uuid, uuid), eq(agentCollects.botId, botId)))
  await db
    .update(agents)
    .set({
      collectCount: sql`GREATEST(COALESCE(${agents.collectCount}, 0) - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(agents.botId, botId))
}

export async function recordAgentUse(uuid: string, botId: string): Promise<void> {
  await db.insert(agentUseDetails).values({ uuid, botId })
  await db
    .update(agents)
    .set({ usageCount: sql`${agents.usageCount} + 1`, updatedAt: new Date() })
    .where(eq(agents.botId, botId))
}

export async function findAgentByBotId(botId: string): Promise<Agent | undefined> {
  const rows = await dbRead.select().from(agents).where(eq(agents.botId, botId)).limit(1)
  return rows[0]
}

export async function findAgentByAgentId(agentId: string): Promise<Agent | undefined> {
  const rows = await dbRead.select().from(agents).where(eq(agents.agentId, agentId)).limit(1)
  return rows[0]
}

export async function unpublishAgentByAgentId(
  agentId: string,
  reason: string,
): Promise<Agent | undefined> {
  void reason
  const rows = await db
    .update(agents)
    .set({
      publishStatus: 'unpublished',
      status: 'offline',
      updatedAt: new Date(),
    })
    .where(eq(agents.agentId, agentId))
    .returning()

  await db
    .update(agentExamines)
    .set({
      status: 'rejected',
      reason: `智能体已下架 - ${reason}`,
      updatedAt: new Date(),
    })
    .where(eq(agentExamines.agentId, agentId))

  return rows[0]
}

export async function findAgentSuggestions(botId: string): Promise<string[] | null> {
  const rows = await dbRead
    .select({ sq: agents.suggestedQuestions })
    .from(agents)
    .where(eq(agents.botId, botId))
    .limit(1)
  const sq = rows[0]?.sq
  if (!sq) return null
  try {
    const parsed = JSON.parse(sq)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function updateAgentDetails(
  agentId: string,
  details: {
    agentVariables?: string
    avatar?: string
    agentModel?: string
  },
): Promise<Agent | undefined> {
  const rows = await db
    .update(agents)
    .set({ ...details, updatedAt: new Date() })
    .where(eq(agents.agentId, agentId))
    .returning()
  return rows[0]
}

/** 批准审核：置为 approved 并记录审核人。 */
export async function approveExamine(
  id: string,
  reviewerId: string,
): Promise<AgentExamine | undefined> {
  const rows = await db
    .update(agentExamines)
    .set({
      status: 'approved',
      reviewerId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agentExamines.id, id))
    .returning()
  return rows[0]
}

/** 驳回审核：置为 rejected 并记录审核人与原因。 */
export async function rejectExamine(
  id: string,
  reviewerId: string,
  reason: string,
): Promise<AgentExamine | undefined> {
  const rows = await db
    .update(agentExamines)
    .set({
      status: 'rejected',
      reviewerId,
      reason,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agentExamines.id, id))
    .returning()
  return rows[0]
}
