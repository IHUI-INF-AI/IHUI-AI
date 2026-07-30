/**
 * 用户计费分组 service(P0 中转站造血能力批次,2026-08-01 立)。
 *
 * 职责:
 * 1. getUserBillingGroup(userId): 查用户所属计费组(无则返回 default 组)
 * 2. getUserModelMultiplier(userId, model): 查用户对某模型的实际倍率
 * 3. getUserRateLimit(userId): 查用户 QPM 限制
 * 4. assignUserToGroup(userId, groupId, reason, expiresAt?): 把用户分入某组(订阅激活时调)
 *
 * 倍率规则:模型级覆盖倍率 > 组默认倍率 > 1.0
 * 读写分离:写用 db,读用 dbRead。
 */
import { eq, and } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import {
  userBillingGroups,
  userBillingGroupMembers,
  userBillingGroupModelMultipliers,
  type UserBillingGroup,
} from '@ihui/database'

/**
 * 查用户所属计费组。
 * - 优先查 user_billing_group_members 中未过期的关联
 * - 无关联或已过期 → 返回 is_default = true 的系统默认组
 * - 无系统默认组 → 返回 null(调用方按 1.0 倍率处理)
 */
export async function getUserBillingGroup(userId: string): Promise<UserBillingGroup | null> {
  // 查用户当前分组关联
  const [memberRow] = await dbRead
    .select({
      groupId: userBillingGroupMembers.groupId,
      expiresAt: userBillingGroupMembers.expiresAt,
    })
    .from(userBillingGroupMembers)
    .where(eq(userBillingGroupMembers.userId, userId))
    .limit(1)

  // 有关联且未过期 → 查组详情
  const now = new Date()
  if (memberRow && (!memberRow.expiresAt || memberRow.expiresAt > now)) {
    const [group] = await dbRead
      .select()
      .from(userBillingGroups)
      .where(eq(userBillingGroups.id, memberRow.groupId))
      .limit(1)
    if (group && group.enabled) return group
  }

  // 无关联/已过期/组已禁用 → 回退到系统默认组
  const [defaultGroup] = await dbRead
    .select()
    .from(userBillingGroups)
    .where(eq(userBillingGroups.isDefault, true))
    .limit(1)
  return defaultGroup ?? null
}

/**
 * 查用户对某模型的实际倍率。
 * 优先级:模型级覆盖倍率 > 组默认倍率 > 1.0
 * 返回值:0.80 = 8 折,1.00 = 原价,1.20 = 加价 20%
 */
export async function getUserModelMultiplier(userId: string, model: string): Promise<number> {
  const group = await getUserBillingGroup(userId)
  if (!group) return 1

  // 查模型级覆盖倍率
  const [modelOverride] = await dbRead
    .select({ multiplier: userBillingGroupModelMultipliers.multiplier })
    .from(userBillingGroupModelMultipliers)
    .where(
      and(
        eq(userBillingGroupModelMultipliers.groupId, group.id),
        eq(userBillingGroupModelMultipliers.modelId, model),
      ),
    )
    .limit(1)

  if (modelOverride) {
    const n = Number(modelOverride.multiplier)
    return Number.isFinite(n) && n >= 0 ? n : 1
  }

  // 无覆盖 → 组默认倍率
  const n = Number(group.defaultMultiplier)
  return Number.isFinite(n) && n >= 0 ? n : 1
}

/**
 * 查用户 QPM(每分钟请求数)限制。
 * 无分组 → 返回默认 10
 */
export async function getUserRateLimit(userId: string): Promise<number> {
  const group = await getUserBillingGroup(userId)
  return group?.rateLimitQpm ?? 10
}

/**
 * 把用户分入某组(订阅激活时调)。
 * - 同一用户只能在一个组:用 upsert(user_id unique 约束)
 * - reason: 'subscription'(订阅激活)/'manual'(管理员手动)/'invite'(邀请)
 * - expiresAt: 订阅到期时间,到期后 getUserBillingGroup 自动回退到 default 组
 */
export async function assignUserToGroup(
  userId: string,
  groupId: string,
  reason: string,
  expiresAt?: Date,
): Promise<void> {
  await db
    .insert(userBillingGroupMembers)
    .values({
      userId,
      groupId,
      assignedReason: reason,
      expiresAt: expiresAt ?? null,
    })
    .onConflictDoUpdate({
      target: userBillingGroupMembers.userId,
      set: {
        groupId,
        assignedReason: reason,
        expiresAt: expiresAt ?? null,
        assignedAt: new Date(),
      },
    })
}
