/**
 * Relay 调用返佣核心 service(2026-07-31 立,把返佣绑到 relay 调用消费)。
 *
 * 职责:
 * 1. getCommissionConfig / setCommissionConfig: 返佣率配置(存 system_configs 表,category='relay_commission')
 * 2. getReferralChain(userId): 查邀请链(父级 level=1 + 祖父级 level=2),查 users.parent_id
 * 3. recordRelayCommission: relay 扣费后调,写 relay_commission_records(status='frozen', frozenUntil=now+7d)
 * 4. releaseExpiredCommissions: 释放冻结返佣(status='frozen' AND frozen_until<=now → released,给 beneficiary API Key costBalanceCents += commissionCents)
 * 5. listUserCommissions: 查用户作为 beneficiary 的返佣记录(分页)
 * 6. listAllCommissions: admin 查全平台返佣记录(支持筛选)
 * 7. getCommissionStats: admin 统计(今日/7d/30d 返佣总额 + 冻结/已释放总额)
 *
 * 返佣率默认(未配置时硬编码):
 *   level1(父级)= 0.05(5%)
 *   level2(祖父级)= 0.01(1%)
 *   frozen_days = 7(冻结期 7 天)
 *
 * 返佣到账:释放时给 beneficiary 最新 active developerApiKey 的 costBalanceCents += commissionCents
 *   (与 relay 消费扣减同维度,都是"分",形成闭环;beneficiary 无 active Key 则保持 frozen 不释放)
 */
import { eq, and, sql, desc, lte, type SQL } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import {
  relayCommissionRecords,
  systemConfigs,
  users,
  developerApiKeys,
} from '@ihui/database'
import type { RelayCommissionRecord } from '@ihui/database'

// =============================================================================
// 常量
// =============================================================================

/** 父级返佣率默认值(未配置时) */
const DEFAULT_LEVEL1_RATE = 0.05

/** 祖父级返佣率默认值(未配置时) */
const DEFAULT_LEVEL2_RATE = 0.01

/** 冻结期默认天数(未配置时) */
const DEFAULT_FROZEN_DAYS = 7

/** system_configs 表中返佣配置的 category */
const COMMISSION_CONFIG_CATEGORY = 'relay_commission'

/** system_configs 表中返佣配置的 key 前缀 */
const COMMISSION_CONFIG_KEY_PREFIX = 'relay_commission.'

// =============================================================================
// 1. 返佣率配置读写
// =============================================================================

export interface CommissionConfig {
  /** 父级返佣率(0.05=5%) */
  level1Rate: number
  /** 祖父级返佣率(0.01=1%) */
  level2Rate: number
  /** 冻结期天数 */
  frozenDays: number
}

/**
 * 读取返佣率配置(从 system_configs 表,未配置用默认值)。
 * key: 'relay_commission.level1_rate' / 'relay_commission.level2_rate' / 'relay_commission.frozen_days'
 */
export async function getCommissionConfig(): Promise<CommissionConfig> {
  const rows = await dbRead
    .select({ key: systemConfigs.key, value: systemConfigs.value })
    .from(systemConfigs)
    .where(eq(systemConfigs.category, COMMISSION_CONFIG_CATEGORY))

  const map = new Map(rows.map((r) => [r.key, r.value]))

  const level1Rate = parseNumber(
    map.get(`${COMMISSION_CONFIG_KEY_PREFIX}level1_rate`),
    DEFAULT_LEVEL1_RATE,
  )
  const level2Rate = parseNumber(
    map.get(`${COMMISSION_CONFIG_KEY_PREFIX}level2_rate`),
    DEFAULT_LEVEL2_RATE,
  )
  const frozenDays = parseNumber(
    map.get(`${COMMISSION_CONFIG_KEY_PREFIX}frozen_days`),
    DEFAULT_FROZEN_DAYS,
  )

  return { level1Rate, level2Rate, frozenDays }
}

/**
 * 更新返佣率配置(upsert system_configs 表,admin 用)。
 * 仅传非 undefined 的字段,未传字段保持原值。
 */
export async function setCommissionConfig(
  patch: Partial<CommissionConfig>,
  updatedBy?: string,
): Promise<CommissionConfig> {
  const entries: Array<{ key: string; value: string }> = []
  if (patch.level1Rate !== undefined) {
    entries.push({ key: 'level1_rate', value: String(patch.level1Rate) })
  }
  if (patch.level2Rate !== undefined) {
    entries.push({ key: 'level2_rate', value: String(patch.level2Rate) })
  }
  if (patch.frozenDays !== undefined) {
    entries.push({ key: 'frozen_days', value: String(patch.frozenDays) })
  }

  for (const e of entries) {
    const fullKey = `${COMMISSION_CONFIG_KEY_PREFIX}${e.key}`
    // upsert:key 存在则更新 value,不存在则插入
    await db
      .insert(systemConfigs)
      .values({
        key: fullKey,
        value: e.value,
        type: 'number',
        category: COMMISSION_CONFIG_CATEGORY,
        description: `Relay 返佣配置(${e.key})`,
        isPublic: false,
        updatedBy: updatedBy ?? null,
      })
      .onConflictDoUpdate({
        target: systemConfigs.key,
        set: { value: e.value, updatedBy: updatedBy ?? null, updatedAt: new Date() },
      })
  }

  return getCommissionConfig()
}

/** 安全解析数字字符串,失败或 NaN 返回默认值 */
function parseNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === null || raw === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

// =============================================================================
// 2. getReferralChain — 查邀请链(父级 + 祖父级)
// =============================================================================

export interface ReferralChainEntry {
  userId: string
  level: 1 | 2
}

/**
 * 查用户的邀请链(父级 level=1 + 祖父级 level=2)。
 *
 * 查 users.parent_id 字段:
 * - level 1(父级)= users.parent_id
 * - level 2(祖父级)= 父级的 parent_id
 *
 * 若 parent_id 为空或用户不存在 → 返佣链到此终止(不报错,返回已查到的层级)。
 * 最多返回 2 条(父级 + 祖父级)。
 */
export async function getReferralChain(userId: string): Promise<ReferralChainEntry[]> {
  const chain: ReferralChainEntry[] = []

  // 查当前用户的父级(level 1)
  const [self] = await dbRead
    .select({ parentId: users.parentId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!self?.parentId) return chain
  chain.push({ userId: self.parentId, level: 1 })

  // 查父级的父级(祖父级 level 2)
  const [parent] = await dbRead
    .select({ parentId: users.parentId })
    .from(users)
    .where(eq(users.id, self.parentId))
    .limit(1)

  if (parent?.parentId) {
    chain.push({ userId: parent.parentId, level: 2 })
  }

  return chain
}

// =============================================================================
// 3. recordRelayCommission — 记录返佣(relay 扣费后调)
// =============================================================================

export interface RecordCommissionInput {
  sourceUserId: string
  sourceCallLogId: string
  sourceCostCents: number
}

/**
 * 记录 relay 调用返佣(relay 扣费后异步调,失败不影响主链路)。
 *
 * 逻辑:
 * 1. getReferralChain 查父级 + 祖父级
 * 2. 每级算 commissionCents = round(sourceCostCents × rate)
 * 3. 写 relay_commission_records,status='frozen',frozenUntil=now + frozenDays
 * 4. 不立即加余额,等冻结期过后由 releaseExpiredCommissions 释放
 *
 * 边界:
 * - sourceCostCents <= 0 → 不返佣
 * - 邀请链空 → 不写记录,静默返回
 * - commissionCents = 0(消费太小四舍五入为 0)→ 仍写记录(审计完整),但释放时加 0 无影响
 */
export async function recordRelayCommission(input: RecordCommissionInput): Promise<void> {
  if (input.sourceCostCents <= 0) return

  const chain = await getReferralChain(input.sourceUserId)
  if (chain.length === 0) return

  const config = await getCommissionConfig()
  const now = new Date()
  const frozenUntil = new Date(now.getTime() + config.frozenDays * 24 * 60 * 60 * 1000)

  const rows = chain.map((entry) => {
    const rate = entry.level === 1 ? config.level1Rate : config.level2Rate
    const commissionCents = Math.round(input.sourceCostCents * rate)
    return {
      sourceUserId: input.sourceUserId,
      sourceCallLogId: input.sourceCallLogId,
      sourceCostCents: input.sourceCostCents,
      beneficiaryUserId: entry.userId,
      beneficiaryLevel: entry.level,
      commissionRate: rate.toFixed(4),
      commissionCents,
      status: 'frozen' as const,
      frozenUntil,
      createdAt: now,
    }
  })

  await db.insert(relayCommissionRecords).values(rows)
}

// =============================================================================
// 4. releaseExpiredCommissions — 释放冻结返佣
// =============================================================================

export interface ReleaseResult {
  /** 本次释放的条数 */
  releasedCount: number
  /** 本次释放的返佣总额(分) */
  releasedCents: number
  /** 因 beneficiary 无 active API Key 而跳过的条数(保持 frozen) */
  skippedNoKey: number
}

/**
 * 释放冻结返佣(定时任务或 admin 手动触发)。
 *
 * 逻辑:
 * 1. 查 status='frozen' AND frozen_until <= now 的记录(批量,默认 100 条)
 * 2. 对每条:查 beneficiary 最新 active developerApiKey
 *    - 有 Key → 原子加 commissionCents 到 costBalanceCents(-1 无限额度保持 -1),status → released,releasedAt=now
 *    - 无 Key → 保持 frozen(下次再试),skippedNoKey++
 * 3. 返回释放统计
 *
 * 幂等:用 UPDATE WHERE status='frozen' AND frozen_until <= now 原子翻转,避免并发重复释放。
 */
export async function releaseExpiredCommissions(batchSize = 100): Promise<ReleaseResult> {
  const now = new Date()

  // 1. 查待释放记录(只取 id + beneficiary + 金额,批量)
  const pending = await dbRead
    .select({
      id: relayCommissionRecords.id,
      beneficiaryUserId: relayCommissionRecords.beneficiaryUserId,
      commissionCents: relayCommissionRecords.commissionCents,
    })
    .from(relayCommissionRecords)
    .where(
      and(
        eq(relayCommissionRecords.status, 'frozen'),
        lte(relayCommissionRecords.frozenUntil, now),
      ),
    )
    .limit(batchSize)

  if (pending.length === 0) {
    return { releasedCount: 0, releasedCents: 0, skippedNoKey: 0 }
  }

  let releasedCount = 0
  let releasedCents = 0
  let skippedNoKey = 0

  for (const record of pending) {
    // 2. 查 beneficiary 最新 active API Key
    const [activeKey] = await dbRead
      .select({ id: developerApiKeys.id })
      .from(developerApiKeys)
      .where(
        and(
          eq(developerApiKeys.userId, record.beneficiaryUserId),
          eq(developerApiKeys.status, 'active'),
        ),
      )
      .orderBy(desc(developerApiKeys.createdAt))
      .limit(1)

    if (!activeKey) {
      // 无 active Key,保持 frozen,下次再试
      skippedNoKey++
      continue
    }

    // 3. 事务包裹两步操作,任一失败整体回滚,记录保持 frozen 下次重试,防资金丢失(P0 修复)
    //    ① 翻转状态 frozen→released(乐观锁,只有仍为 frozen 时才翻转,防并发重复释放)
    //    ② 加 commissionCents 到 beneficiary Key 的 costBalanceCents
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(relayCommissionRecords)
        .set({ status: 'released', releasedAt: now })
        .where(
          and(
            eq(relayCommissionRecords.id, record.id),
            eq(relayCommissionRecords.status, 'frozen'), // 乐观锁,防重复释放
          ),
        )
        .returning({ id: relayCommissionRecords.id })

      if (!updated) return // 已被并发释放,跳过(不累加统计)

      // 4. 加 commissionCents 到 beneficiary Key 的 costBalanceCents
      //    -1(无限额度)保持 -1,否则累加(与 rechargeByKey 同模式,用 SQL CASE 原子操作)
      await tx
        .update(developerApiKeys)
        .set({
          costBalanceCents: sql`CASE WHEN ${developerApiKeys.costBalanceCents} = -1 THEN -1 ELSE ${developerApiKeys.costBalanceCents} + ${record.commissionCents} END`,
          updatedAt: now,
        })
        .where(eq(developerApiKeys.id, activeKey.id))

      releasedCount++
      releasedCents += record.commissionCents
    })
  }

  return { releasedCount, releasedCents, skippedNoKey }
}

// =============================================================================
// 5. listUserCommissions — 查用户返佣记录(作为 beneficiary,分页)
// =============================================================================

export interface ListUserCommissionsResult {
  records: RelayCommissionRecord[]
  total: number
}

/**
 * 查用户作为 beneficiary 的返佣记录(分页,developer 端点用)。
 * 强制 beneficiaryUserId = userId(用户只能查自己的返佣收入)。
 */
export async function listUserCommissions(
  userId: string,
  page: number,
  pageSize: number,
): Promise<ListUserCommissionsResult> {
  const p = Math.max(1, page)
  const ps = Math.min(100, Math.max(1, pageSize))
  const where = eq(relayCommissionRecords.beneficiaryUserId, userId)

  const [records, totalRows] = await Promise.all([
    dbRead
      .select()
      .from(relayCommissionRecords)
      .where(where)
      .orderBy(desc(relayCommissionRecords.createdAt))
      .limit(ps)
      .offset((p - 1) * ps),
    dbRead
      .select({ c: sql<number>`count(*)::int` })
      .from(relayCommissionRecords)
      .where(where),
  ])

  return { records, total: totalRows[0]?.c ?? 0 }
}

// =============================================================================
// 6. listAllCommissions — admin 查全平台返佣记录(支持筛选)
// =============================================================================

export interface ListAllCommissionsFilter {
  sourceUserId?: string
  beneficiaryUserId?: string
  status?: string
  page?: number
  pageSize?: number
}

export async function listAllCommissions(
  filter: ListAllCommissionsFilter,
): Promise<ListUserCommissionsResult> {
  const page = Math.max(1, filter.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20))

  const conds: SQL[] = []
  if (filter.sourceUserId) conds.push(eq(relayCommissionRecords.sourceUserId, filter.sourceUserId))
  if (filter.beneficiaryUserId) {
    conds.push(eq(relayCommissionRecords.beneficiaryUserId, filter.beneficiaryUserId))
  }
  if (filter.status) conds.push(eq(relayCommissionRecords.status, filter.status))
  const where = conds.length > 0 ? and(...conds) : undefined

  const [records, totalRows] = await Promise.all([
    dbRead
      .select()
      .from(relayCommissionRecords)
      .where(where)
      .orderBy(desc(relayCommissionRecords.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    dbRead
      .select({ c: sql<number>`count(*)::int` })
      .from(relayCommissionRecords)
      .where(where),
  ])

  return { records, total: totalRows[0]?.c ?? 0 }
}

// =============================================================================
// 7. getCommissionStats — admin 统计
// =============================================================================

export interface CommissionStats {
  /** 今日返佣总额(分) */
  todayCents: number
  /** 近 7 天返佣总额(分) */
  last7dCents: number
  /** 近 30 天返佣总额(分) */
  last30dCents: number
  /** 冻结中总额(分,status='frozen') */
  frozenCents: number
  /** 已释放总额(分,status='released') */
  releasedCents: number
  /** 已过期总额(分,status='expired') */
  expiredCents: number
  /** 冻结中条数 */
  frozenCount: number
  /** 已释放条数 */
  releasedCount: number
}

/**
 * 返佣统计:今日/7d/30d 返佣总额 + 冻结/已释放/已过期总额与条数。
 */
export async function getCommissionStats(): Promise<CommissionStats> {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // 按状态聚合(总额 + 条数)
  const statusRows = await dbRead
    .select({
      status: relayCommissionRecords.status,
      count: sql<number>`count(*)::int`,
      sumCents: sql<number>`coalesce(sum(${relayCommissionRecords.commissionCents}), 0)::int`,
    })
    .from(relayCommissionRecords)
    .groupBy(relayCommissionRecords.status)

  let frozenCents = 0
  let releasedCents = 0
  let expiredCents = 0
  let frozenCount = 0
  let releasedCount = 0
  for (const r of statusRows) {
    if (r.status === 'frozen') {
      frozenCents = r.sumCents
      frozenCount = r.count
    } else if (r.status === 'released') {
      releasedCents = r.sumCents
      releasedCount = r.count
    } else if (r.status === 'expired') {
      expiredCents = r.sumCents
    }
  }

  // 按时间窗口聚合(今日/7d/30d,不限状态,统计创建时间)
  const timeRows = await dbRead
    .select({
      todayCents: sql<number>`coalesce(sum(${relayCommissionRecords.commissionCents}) filter (where ${relayCommissionRecords.createdAt} >= ${todayStart}), 0)::int`,
      last7dCents: sql<number>`coalesce(sum(${relayCommissionRecords.commissionCents}) filter (where ${relayCommissionRecords.createdAt} >= ${last7d}), 0)::int`,
      last30dCents: sql<number>`coalesce(sum(${relayCommissionRecords.commissionCents}) filter (where ${relayCommissionRecords.createdAt} >= ${last30d}), 0)::int`,
    })
    .from(relayCommissionRecords)

  const timeRow = timeRows[0] ?? { todayCents: 0, last7dCents: 0, last30dCents: 0 }

  return {
    todayCents: timeRow.todayCents,
    last7dCents: timeRow.last7dCents,
    last30dCents: timeRow.last30dCents,
    frozenCents,
    releasedCents,
    expiredCents,
    frozenCount,
    releasedCount,
  }
}
