/**
 * API Key 分组 service(2026-08-01 立,P0 中转站造血能力批次)。
 *
 * 职责:
 * - getKeyGroup:查 Key 所属组(无组返回 null)
 * - getGroupMembers:查组内所有 Key + 最近 30d 用量(组内用量排行)
 * - createGroup:主 Key 持有者建组,自动入 owner
 * - createInvite / acceptInvite:邀请码加入组(8 位大写字母数字,24h 有效,一次性)
 * - rechargeGroupBalance:充值组池余额
 *
 * 读写分离:写用 db,读用 dbRead(参照 relay-billing-service.ts 模式)。
 */
import { eq, and, sql, inArray, gte } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { db, dbRead } from '../db/index.js'
import {
  apiKeyGroups,
  apiKeyGroupMembers,
  apiKeyGroupInvites,
  developerApiKeys,
  llmCallLogs,
} from '@ihui/database'
import type { ApiKeyGroup } from '@ihui/database'

// =============================================================================
// 类型定义
// =============================================================================

/** 组内成员用量(组内用量排行用) */
export interface GroupMemberUsage {
  apiKeyId: string
  keyName: string
  role: string
  /** 最近 30d 用量(token) */
  usedTokens: number
  /** 最近 30d 用量(分) */
  usedCostCents: number
}

/** 创建组入参 */
export interface CreateGroupInput {
  name: string
  ownerId: string
  description?: string
  sharedTokenBalance: number
  sharedCostBalanceCents: number
  rateLimitQpm?: number
  allowedModels?: string[] | null
  allowedIps?: string[] | null
}

/** Key 所属组信息(含组池余额,供 relay-billing-service.checkQuota 用) */
export interface KeyGroupInfo {
  groupId: string
  groupName: string
  role: string
  sharedTokenBalance: number
  sharedCostBalanceCents: number
  rateLimitQpm: number
  allowedModels: string[] | null
  allowedIps: string[] | null
  enabled: boolean
  /** 子 Key 单次请求 token 上限(在组限制基础上收紧) */
  maxTokensPerReq: number | null
}

// =============================================================================
// 常量
// =============================================================================

/** 邀请码字符集(大写字母 + 数字,去除易混淆字符 0/O/1/I) */
const INVITE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/** 邀请码长度 */
const INVITE_CODE_LENGTH = 8
/** 邀请码有效期(24h) */
const INVITE_TTL_MS = 24 * 60 * 60 * 1000

// =============================================================================
// 1. getKeyGroup — 查 Key 所属组
// =============================================================================

/**
 * 查 Key 所属组(无组返回 null)。
 * 用于 relay-billing-service.checkQuota / recordCall 判定走组池还是个人余额。
 */
export async function getKeyGroup(apiKeyId: string): Promise<KeyGroupInfo | null> {
  const [row] = await dbRead
    .select({
      groupId: apiKeyGroups.id,
      groupName: apiKeyGroups.name,
      role: apiKeyGroupMembers.role,
      sharedTokenBalance: apiKeyGroups.sharedTokenBalance,
      sharedCostBalanceCents: apiKeyGroups.sharedCostBalanceCents,
      rateLimitQpm: apiKeyGroups.rateLimitQpm,
      allowedModels: apiKeyGroups.allowedModels,
      allowedIps: apiKeyGroups.allowedIps,
      enabled: apiKeyGroups.enabled,
      maxTokensPerReq: apiKeyGroupMembers.maxTokensPerReq,
    })
    .from(apiKeyGroupMembers)
    .innerJoin(apiKeyGroups, eq(apiKeyGroupMembers.groupId, apiKeyGroups.id))
    .where(eq(apiKeyGroupMembers.apiKeyId, apiKeyId))
    .limit(1)

  if (!row) return null
  return row
}

// =============================================================================
// 2. getGroupMembers — 查组内所有 Key + 用量排行
// =============================================================================

/**
 * 查组内所有 Key(组内用量排行用)。
 * 用量统计:最近 30d llm_call_logs 按 apiKeyId 聚合。
 */
export async function getGroupMembers(groupId: string): Promise<GroupMemberUsage[]> {
  // 1. 查组内所有成员
  const members = await dbRead
    .select({
      apiKeyId: apiKeyGroupMembers.apiKeyId,
      keyName: developerApiKeys.name,
      role: apiKeyGroupMembers.role,
    })
    .from(apiKeyGroupMembers)
    .innerJoin(developerApiKeys, eq(apiKeyGroupMembers.apiKeyId, developerApiKeys.id))
    .where(eq(apiKeyGroupMembers.groupId, groupId))

  if (members.length === 0) return []

  // 2. 查最近 30d 用量(按 apiKeyId 聚合)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const memberApiKeyIds = members.map((m) => m.apiKeyId)

  const usageRows = await dbRead
    .select({
      apiKeyId: llmCallLogs.apiKeyId,
      usedTokens: sql<number>`coalesce(sum(${llmCallLogs.totalTokens}), 0)::int`,
      usedCostCents: sql<number>`coalesce(sum(${llmCallLogs.costCents}), 0)::int`,
    })
    .from(llmCallLogs)
    .where(
      and(
        inArray(llmCallLogs.apiKeyId, memberApiKeyIds),
        gte(llmCallLogs.createdAt, thirtyDaysAgo),
      ),
    )
    .groupBy(llmCallLogs.apiKeyId)

  // 3. 合并成员信息 + 用量(无用量记录的成员补 0)
  const usageMap = new Map<string, { usedTokens: number; usedCostCents: number }>()
  for (const u of usageRows) {
    if (u.apiKeyId) {
      usageMap.set(u.apiKeyId, { usedTokens: u.usedTokens, usedCostCents: u.usedCostCents })
    }
  }

  return members.map((m) => ({
    apiKeyId: m.apiKeyId,
    keyName: m.keyName,
    role: m.role,
    usedTokens: usageMap.get(m.apiKeyId)?.usedTokens ?? 0,
    usedCostCents: usageMap.get(m.apiKeyId)?.usedCostCents ?? 0,
  }))
}

// =============================================================================
// 3. createGroup — 创建组(主 Key 持有者建组,自动入 owner)
// =============================================================================

/**
 * 创建组(主 Key 持有者建组,自动入 owner)。
 * ownerId 作为组创建者,同时插入 apiKeyGroupMembers(role='owner')。
 */
export async function createGroup(input: CreateGroupInput): Promise<ApiKeyGroup> {
  const [group] = await db
    .insert(apiKeyGroups)
    .values({
      name: input.name,
      ownerId: input.ownerId,
      description: input.description ?? null,
      sharedTokenBalance: input.sharedTokenBalance,
      sharedCostBalanceCents: input.sharedCostBalanceCents,
      rateLimitQpm: input.rateLimitQpm ?? 100,
      allowedModels: input.allowedModels ?? null,
      allowedIps: input.allowedIps ?? null,
    })
    .returning()

  if (!group) throw new Error('创建 API Key 分组失败')

  // 自动将 owner 的 API Key 加入组(role='owner')
  // 注:ownerId 这里是 user 标识,member.apiKeyId 需要由调用方在路由层解析为具体 apiKeyId
  // 此处 owner member 由 ensureOwnerMember 单独处理(路由层调用)
  return group
}

/**
 * 将 API Key 以指定角色加入组(内部辅助,createGroup + acceptInvite 共用)。
 */
export async function addMember(
  groupId: string,
  apiKeyId: string,
  role: 'owner' | 'admin' | 'member' = 'member',
  maxTokensPerReq?: number | null,
): Promise<void> {
  await db
    .insert(apiKeyGroupMembers)
    .values({
      groupId,
      apiKeyId,
      role,
      maxTokensPerReq: maxTokensPerReq ?? null,
    })
    .onConflictDoNothing({ target: apiKeyGroupMembers.apiKeyId })
}

// =============================================================================
// 4. createInvite / acceptInvite — 邀请码加入组
// =============================================================================

/** 生成 8 位邀请码(大写字母数字,去除易混淆字符) */
function generateInviteCode(): string {
  const bytes = randomBytes(INVITE_CODE_LENGTH)
  let code = ''
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    const byte = bytes[i] ?? 0
    code += INVITE_CHARSET.charAt(byte % INVITE_CHARSET.length)
  }
  return code
}

/**
 * 生成邀请码(8 位大写字母数字,24h 有效,一次性使用)。
 * 冲突重试:若生成的码已存在,重新生成(最多 5 次)。
 */
export async function createInvite(
  groupId: string,
  createdBy: string,
): Promise<{ inviteCode: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

  for (let attempt = 0; attempt < 5; attempt++) {
    const inviteCode = generateInviteCode()
    try {
      await db.insert(apiKeyGroupInvites).values({
        groupId,
        inviteCode,
        createdBy,
        expiresAt,
      })
      return { inviteCode, expiresAt }
    } catch {
      // 唯一约束冲突 → 重试(概率极低,8 位字符集 32^8 ≈ 1万亿组合)
      continue
    }
  }
  throw new Error('生成邀请码失败(冲突重试 5 次)')
}

/**
 * 凭邀请码加入组。
 * 校验:邀请码存在 + 未使用 + 未过期 + Key 未在其他组。
 */
export async function acceptInvite(inviteCode: string, apiKeyId: string): Promise<void> {
  const [invite] = await dbRead
    .select()
    .from(apiKeyGroupInvites)
    .where(eq(apiKeyGroupInvites.inviteCode, inviteCode))
    .limit(1)

  if (!invite) throw new Error('邀请码不存在')
  if (invite.used) throw new Error('邀请码已被使用')
  if (invite.expiresAt <= new Date()) throw new Error('邀请码已过期')

  // 检查 Key 是否已在其他组(api_key_id 唯一索引会阻止,但提前检查给友好错误)
  const [existing] = await dbRead
    .select({ id: apiKeyGroupMembers.id })
    .from(apiKeyGroupMembers)
    .where(eq(apiKeyGroupMembers.apiKeyId, apiKeyId))
    .limit(1)
  if (existing) throw new Error('该 API Key 已在一个分组中(一个 Key 同时只能在一个组)')

  // 加入组 + 标记邀请码已使用
  await db.transaction(async (tx) => {
    await tx
      .insert(apiKeyGroupMembers)
      .values({ groupId: invite.groupId, apiKeyId, role: 'member' })
    await tx
      .update(apiKeyGroupInvites)
      .set({ used: true, usedBy: apiKeyId })
      .where(eq(apiKeyGroupInvites.id, invite.id))
  })
}

// =============================================================================
// 5. rechargeGroupBalance — 充值组池
// =============================================================================

/**
 * 充值组池余额(增加 token + 成本额度)。
 * -1(无限额度)保持 -1,否则累加。
 */
export async function rechargeGroupBalance(
  groupId: string,
  tokenAmount: number,
  costCents: number,
): Promise<{ sharedTokenBalance: number; sharedCostBalanceCents: number } | null> {
  const [updated] = await db
    .update(apiKeyGroups)
    .set({
      // -1(无限额度)保持 -1,否则累加
      sharedTokenBalance: sql`CASE WHEN ${apiKeyGroups.sharedTokenBalance} = -1 THEN -1 ELSE ${apiKeyGroups.sharedTokenBalance} + ${tokenAmount} END`,
      sharedCostBalanceCents: sql`CASE WHEN ${apiKeyGroups.sharedCostBalanceCents} = -1 THEN -1 ELSE ${apiKeyGroups.sharedCostBalanceCents} + ${costCents} END`,
      updatedAt: new Date(),
    })
    .where(eq(apiKeyGroups.id, groupId))
    .returning({
      sharedTokenBalance: apiKeyGroups.sharedTokenBalance,
      sharedCostBalanceCents: apiKeyGroups.sharedCostBalanceCents,
    })

  return updated ?? null
}

// =============================================================================
// 6. 辅助:查用户在组中的角色(路由权限校验用)
// =============================================================================

/**
 * 查用户在组中的角色(通过 user → apiKeyId → member 链路)。
 * 返回 null 表示用户不在组中(无权操作)。
 */
export async function getMemberRole(
  groupId: string,
  apiKeyId: string,
): Promise<'owner' | 'admin' | 'member' | null> {
  const [row] = await dbRead
    .select({ role: apiKeyGroupMembers.role })
    .from(apiKeyGroupMembers)
    .where(
      and(
        eq(apiKeyGroupMembers.groupId, groupId),
        eq(apiKeyGroupMembers.apiKeyId, apiKeyId),
      ),
    )
    .limit(1)
  const role = row?.role
  if (role === 'owner' || role === 'admin' || role === 'member') return role
  return null
}

/**
 * 查用户在组中的所有 Key(用于"列我的组":user 是 owner 或 member 任一 Key)。
 * 返回用户名下的 groupId 列表。
 */
export async function getUserGroupIds(userId: string): Promise<string[]> {
  const rows = await dbRead
    .select({ groupId: apiKeyGroupMembers.groupId })
    .from(apiKeyGroupMembers)
    .innerJoin(developerApiKeys, eq(apiKeyGroupMembers.apiKeyId, developerApiKeys.id))
    .where(eq(developerApiKeys.userId, userId))

  // 同时包含用户作为 owner 创建的组(ownerId = userId,但可能还没加 member 行)
  const ownedGroups = await dbRead
    .select({ id: apiKeyGroups.id })
    .from(apiKeyGroups)
    .where(eq(apiKeyGroups.ownerId, userId))

  const groupIds = new Set<string>()
  for (const r of rows) groupIds.add(r.groupId)
  for (const r of ownedGroups) groupIds.add(r.id)
  return Array.from(groupIds)
}

/**
 * 查用户在指定组中的任意一个 apiKeyId(用于权限校验时定位 member 行)。
 */
export async function getUserApiKeyInGroup(
  userId: string,
  groupId: string,
): Promise<string | null> {
  const [row] = await dbRead
    .select({ apiKeyId: apiKeyGroupMembers.apiKeyId })
    .from(apiKeyGroupMembers)
    .innerJoin(developerApiKeys, eq(apiKeyGroupMembers.apiKeyId, developerApiKeys.id))
    .where(
      and(
        eq(developerApiKeys.userId, userId),
        eq(apiKeyGroupMembers.groupId, groupId),
      ),
    )
    .limit(1)
  return row?.apiKeyId ?? null
}

/** 查组详情(含 owner 校验辅助) */
export async function getGroupById(groupId: string): Promise<ApiKeyGroup | null> {
  const [row] = await dbRead
    .select()
    .from(apiKeyGroups)
    .where(eq(apiKeyGroups.id, groupId))
    .limit(1)
  return row ?? null
}
