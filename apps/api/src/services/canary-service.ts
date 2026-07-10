import { eq, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { canaryConfigs, canaryAuditLogs } from '@ihui/database'

export type CanaryStage = 'off' | 'canary_1pct' | 'canary_5pct' | 'canary_25pct' | 'full'

export interface CanaryConfig {
  name: string
  currentStage: CanaryStage
  targetStage: CanaryStage
  failureThreshold: number
  cooldownMinutes: number
  startedAt: Date | null
  lastPromotedAt: Date | null
  failureCount: number
  isActive: boolean
}

export interface CanaryAuditEntry {
  id: string
  configName: string
  action: 'promote' | 'rollback' | 'reset' | 'failure'
  fromStage: CanaryStage
  toStage: CanaryStage
  timestamp: Date
  reason: string
}

const STAGE_ORDER: CanaryStage[] = ['off', 'canary_1pct', 'canary_5pct', 'canary_25pct', 'full']
const STAGE_PERCENT: Record<CanaryStage, number> = {
  off: 0,
  canary_1pct: 1,
  canary_5pct: 5,
  canary_25pct: 25,
  full: 100,
}

/** 根据名称从 DB 读取单条配置的原始行。 */
async function fetchConfigRow(name: string) {
  const [row] = await db.select().from(canaryConfigs).where(eq(canaryConfigs.name, name))
  return row ?? null
}

export async function getCanaryConfig(name: string): Promise<CanaryConfig | null> {
  try {
    return await fetchConfigRow(name)
  } catch (err) {
    console.error('[canary] getCanaryConfig failed:', err)
    return null
  }
}

export async function listCanaryConfigs(): Promise<CanaryConfig[]> {
  try {
    const rows = await db.select().from(canaryConfigs)
    return rows
  } catch (err) {
    console.error('[canary] listCanaryConfigs failed:', err)
    return []
  }
}

export async function createCanary(
  name: string,
  targetStage: CanaryStage = 'full',
  failureThreshold = 5,
  cooldownMinutes = 30,
): Promise<CanaryConfig> {
  const now = new Date()
  try {
    const [row] = await db
      .insert(canaryConfigs)
      .values({
        name,
        currentStage: 'canary_1pct',
        targetStage,
        failureThreshold,
        cooldownMinutes,
        autoRollback: true,
        status: 'active',
        startedAt: now,
        lastPromotedAt: null,
        failureCount: 0,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: canaryConfigs.name,
        set: {
          currentStage: 'canary_1pct',
          targetStage,
          failureThreshold,
          cooldownMinutes,
          autoRollback: true,
          status: 'active',
          startedAt: now,
          lastPromotedAt: null,
          failureCount: 0,
          isActive: true,
          updatedAt: now,
        },
      })
      .returning()

    if (!row) throw new Error('failed to create canary config')

    await addAudit(row.id, 'promote', 'off', 'canary_1pct', 'canary started')
    return row
  } catch (err) {
    console.error('[canary] createCanary failed:', err)
    throw err
  }
}

export async function promoteCanary(name: string): Promise<CanaryConfig> {
  const config = await fetchConfigRow(name)
  if (!config) throw new Error(`canary config "${name}" not found`)
  if (!config.isActive) throw new Error('canary is not active')

  // 冷却期检查
  if (config.lastPromotedAt) {
    const elapsed = Date.now() - config.lastPromotedAt.getTime()
    const cooldownMs = config.cooldownMinutes * 60 * 1000
    if (elapsed < cooldownMs) {
      throw new Error(
        `cooldown period not elapsed (${Math.ceil((cooldownMs - elapsed) / 60000)} minutes remaining)`,
      )
    }
  }

  const currentIdx = STAGE_ORDER.indexOf(config.currentStage)
  const targetIdx = STAGE_ORDER.indexOf(config.targetStage)
  if (currentIdx >= targetIdx) throw new Error('already at or beyond target stage')

  const nextStage = STAGE_ORDER[currentIdx + 1]!
  const now = new Date()
  const reachedTarget = nextStage === config.targetStage

  try {
    await db
      .update(canaryConfigs)
      .set({
        currentStage: nextStage,
        lastPromotedAt: now,
        failureCount: 0,
        isActive: !reachedTarget,
        status: reachedTarget ? 'completed' : 'active',
        updatedAt: now,
      })
      .where(eq(canaryConfigs.name, name))
  } catch (err) {
    console.error('[canary] promoteCanary DB update failed:', err)
    throw err
  }

  await addAudit(config.id, 'promote', config.currentStage, nextStage, 'manual promote')

  return {
    ...config,
    currentStage: nextStage,
    lastPromotedAt: now,
    failureCount: 0,
    isActive: !reachedTarget,
  }
}

export async function rollbackCanary(name: string, reason: string): Promise<CanaryConfig> {
  const config = await fetchConfigRow(name)
  if (!config) throw new Error(`canary config "${name}" not found`)

  const now = new Date()
  try {
    await db
      .update(canaryConfigs)
      .set({
        currentStage: 'off',
        isActive: false,
        failureCount: 0,
        status: 'rolled_back',
        updatedAt: now,
      })
      .where(eq(canaryConfigs.name, name))
  } catch (err) {
    console.error('[canary] rollbackCanary DB update failed:', err)
    throw err
  }

  await addAudit(config.id, 'rollback', config.currentStage, 'off', reason)

  return {
    ...config,
    currentStage: 'off',
    isActive: false,
    failureCount: 0,
  }
}

export async function recordFailure(name: string, reason: string): Promise<CanaryConfig> {
  const config = await fetchConfigRow(name)
  if (!config) throw new Error(`canary config "${name}" not found`)

  const newFailureCount = config.failureCount + 1
  const now = new Date()
  try {
    await db
      .update(canaryConfigs)
      .set({
        failureCount: newFailureCount,
        updatedAt: now,
      })
      .where(eq(canaryConfigs.name, name))
  } catch (err) {
    console.error('[canary] recordFailure DB update failed:', err)
    throw err
  }

  await addAudit(config.id, 'failure', config.currentStage, config.currentStage, reason)

  if (newFailureCount >= config.failureThreshold) {
    return rollbackCanary(
      name,
      `auto-rollback: failure threshold (${config.failureThreshold}) exceeded`,
    )
  }
  return { ...config, failureCount: newFailureCount }
}

export async function resetCanary(name: string): Promise<CanaryConfig> {
  const config = await fetchConfigRow(name)
  if (!config) throw new Error(`canary config "${name}" not found`)

  const now = new Date()
  try {
    await db
      .update(canaryConfigs)
      .set({
        currentStage: 'off',
        failureCount: 0,
        isActive: false,
        status: 'paused',
        startedAt: null,
        lastPromotedAt: null,
        updatedAt: now,
      })
      .where(eq(canaryConfigs.name, name))
  } catch (err) {
    console.error('[canary] resetCanary DB update failed:', err)
    throw err
  }

  // 保留原始行为：reset 后 currentStage 已为 'off'，审计 fromStage 记录为 'off'
  await addAudit(config.id, 'reset', 'off', 'off', 'manual reset')

  return {
    ...config,
    currentStage: 'off',
    failureCount: 0,
    isActive: false,
    startedAt: null,
    lastPromotedAt: null,
  }
}

export async function getAuditLog(configName?: string): Promise<CanaryAuditEntry[]> {
  try {
    const rows = await db
      .select({
        id: canaryAuditLogs.id,
        configName: canaryConfigs.name,
        action: canaryAuditLogs.action,
        fromStage: canaryAuditLogs.fromStage,
        toStage: canaryAuditLogs.toStage,
        timestamp: canaryAuditLogs.createdAt,
        reason: canaryAuditLogs.reason,
      })
      .from(canaryAuditLogs)
      .leftJoin(canaryConfigs, eq(canaryAuditLogs.configId, canaryConfigs.id))
      .where(configName ? eq(canaryConfigs.name, configName) : undefined)
      .orderBy(desc(canaryAuditLogs.createdAt))
      .limit(1000)

    return rows.map((r) => ({
      id: r.id,
      configName: r.configName ?? '',
      action: r.action as CanaryAuditEntry['action'],
      fromStage: (r.fromStage ?? 'off') as CanaryStage,
      toStage: (r.toStage ?? 'off') as CanaryStage,
      timestamp: r.timestamp,
      reason: r.reason ?? '',
    }))
  } catch (err) {
    console.error('[canary] getAuditLog failed:', err)
    return []
  }
}

export function getCanaryPercentage(stage: CanaryStage): number {
  return STAGE_PERCENT[stage]
}

async function addAudit(
  configId: string,
  action: CanaryAuditEntry['action'],
  fromStage: CanaryStage,
  toStage: CanaryStage,
  reason: string,
): Promise<void> {
  try {
    await db.insert(canaryAuditLogs).values({
      configId,
      action,
      fromStage,
      toStage,
      reason,
    })
  } catch (err) {
    // 审计日志写入失败不应影响主流程
    console.error('[canary] failed to write audit log:', err)
  }
}
