/**
 * Agent 管理服务（业务层）。
 * 在 agents-queries 之上提供：详情聚合、发布状态机、审核提交、删除等业务编排。
 */

import { eq, and, sql } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { agents, users, zhsAgentBuy } from '@ihui/database'
import {
  findAgentById,
  findAgentsList,
  findCategoryByAgentId,
  createAgent as createAgentRow,
  updateAgent as updateAgentRow,
  deleteAgent as deleteAgentRow,
  createExamine,
  type AgentListQuery,
  type CreateAgentInput,
  type UpdateAgentInput,
} from '../db/agents-queries.js'

export interface AgentDetail {
  agent: Awaited<ReturnType<typeof findAgentById>>
  category: Awaited<ReturnType<typeof findCategoryByAgentId>>
}

/** 获取 Agent 详情（含分类信息）。 */
export async function getAgentDetail(agentId: string): Promise<AgentDetail | null> {
  const agent = await findAgentById(agentId)
  if (!agent) return null
  const category = await findCategoryByAgentId(agentId)
  return { agent, category }
}

/** 列表查询（透传 agents-queries）。 */
export async function listAgents(query: AgentListQuery) {
  return findAgentsList(query)
}

/** 创建 Agent。 */
export async function createAgent(input: CreateAgentInput) {
  return createAgentRow(input)
}

/** 更新 Agent 配置。 */
export async function updateAgent(agentId: string, patch: UpdateAgentInput) {
  return updateAgentRow(agentId, patch)
}

/**
 * 状态机：提交审核。
 * 仅 offline/pending 状态可提交；置为 pending 并创建审核记录。
 */
export async function submitForReview(
  agentId: string,
  userId?: string,
): Promise<{ success: boolean; reason?: string }> {
  const agent = await findAgentById(agentId)
  if (!agent) return { success: false, reason: 'Agent 不存在' }
  if (agent.status !== 'offline' && agent.status !== 'pending' && agent.status !== 'rejected') {
    return { success: false, reason: `当前状态(${agent.status})不可提交审核` }
  }
  await updateAgentRow(agentId, { status: 'pending' })
  await createExamine({ agentId, userId, status: 'pending' })
  return { success: true }
}

/**
 * 状态机：发布 Agent。
 * 仅已通过审核(approved)或重新上架的 Agent 可发布。
 */
export async function publishAgent(
  agentId: string,
): Promise<{ success: boolean; reason?: string }> {
  const agent = await findAgentById(agentId)
  if (!agent) return { success: false, reason: 'Agent 不存在' }
  if (agent.status === 'published') return { success: false, reason: 'Agent 已发布' }
  await updateAgentRow(agentId, { status: 'published' })
  return { success: true }
}

/**
 * 状态机：下架 Agent。
 */
export async function offlineAgent(
  agentId: string,
): Promise<{ success: boolean; reason?: string }> {
  const agent = await findAgentById(agentId)
  if (!agent) return { success: false, reason: 'Agent 不存在' }
  if (agent.status !== 'published') return { success: false, reason: '仅已发布状态可下架' }
  await updateAgentRow(agentId, { status: 'offline' })
  return { success: true }
}

/**
 * 执行 Agent：前置校验（存在性 + 发布状态）。
 * 使用计数由 recordAgentUse 函数独立记录到 agentUseDetails 表，此处不重复计数。
 * 实际 AI 调用由 agentic-service 路由转发到 AI 服务。
 */
export async function executeAgent(agentId: string): Promise<{
  success: boolean
  agent?: NonNullable<Awaited<ReturnType<typeof findAgentById>>>
  reason?: string
}> {
  const agent = await findAgentById(agentId)
  if (!agent) return { success: false, reason: 'Agent 不存在' }
  if (agent.status !== 'published') return { success: false, reason: 'Agent 未发布，不可执行' }
  return { success: true, agent }
}

/** 删除 Agent。 */
export async function deleteAgent(agentId: string) {
  return deleteAgentRow(agentId)
}

/** 按 userId 统计其 Agent 数量。 */
export async function countAgentsByUser(userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agents)
    .where(eq(agents.userId, userId))
  return rows[0]?.count ?? 0
}

// =============================================================================
// VIP 权限判断（迁移自旧架构 app/utils/agent_type_calculator.py）
// =============================================================================

export type AgentPermissionType = 'free' | 'vip' | 'purchased' | 'vip_only' | 'paid'

export interface AgentPermission {
  /** 智能体访问类型 */
  type: AgentPermissionType
  /** 价格显示文本 */
  accountType: string
  /** 用户是否有权限访问/购买 */
  hasPermission: boolean
  /** 无权限原因（hasPermission=false 时填充） */
  reason?: string
}

/**
 * 计算用户对指定智能体的访问权限。
 *
 * 迁移自旧架构 app/utils/agent_type_calculator.py 的 calculate_agent_type。
 *
 * 规则：
 * - agent.isVipExclusive=true 且用户 isVip=0 → type='vip_only', hasPermission=false
 * - agent.isFree=true → type='free', hasPermission=true
 * - 用户已购买（zhs_agent_buy 存在记录）→ type='purchased', hasPermission=true
 * - agent.price>0 → type='paid', hasPermission=true（需付费购买）
 * - 默认 → type='free', hasPermission=true
 *
 * @param agentId 智能体 ID
 * @param userId 用户 ID（可选，未登录用户只能访问免费/非 VIP 专享）
 */
export async function calculateAgentPermission(
  agentId: string,
  userId?: string,
): Promise<AgentPermission> {
  const result: AgentPermission = { type: 'free', accountType: '免费', hasPermission: true }

  const agent = await findAgentById(agentId)
  if (!agent) {
    return { type: 'free', accountType: '免费', hasPermission: false, reason: 'Agent 不存在' }
  }

  // VIP 专享权限校验（对齐旧架构 group==1 && is_vip==0）
  if (agent.isVipExclusive) {
    let isVip = 0
    if (userId) {
      const userRow = await dbRead
        .select({ isVip: users.isVip })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      isVip = userRow[0]?.isVip ?? 0
    }
    if (isVip < 1) {
      result.hasPermission = false
      result.type = 'vip_only'
      result.reason = 'VIP 会员专享智能体，请先开通 VIP'
      return result
    }
    result.type = 'vip'
    result.accountType = 'VIP 专享'
  }

  // 付费智能体
  if (!agent.isFree && agent.price > 0) {
    result.accountType = `${(agent.price / 100).toFixed(2)} 元`
    if (result.type === 'free') {
      result.type = 'paid'
    }
  }

  // 已购买校验
  if (userId) {
    const purchased = await dbRead
      .select({ id: zhsAgentBuy.id })
      .from(zhsAgentBuy)
      .where(and(eq(zhsAgentBuy.userId, userId), eq(zhsAgentBuy.agentId, agentId)))
      .limit(1)
    if (purchased.length > 0) {
      result.type = 'purchased'
      result.accountType = '已购买'
    }
  }

  return result
}
