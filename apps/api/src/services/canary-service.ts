import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'

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

interface CanaryConfigRow extends CanaryConfig {
  id: string
  target: string | null
  autoRollback: boolean
  status: string
  createdAt: Date
  updatedAt: Date
}

const CANARY_SELECT_COLS = sql`
  id, name, target,
  current_stage AS "currentStage",
  target_stage AS "targetStage",
  failure_threshold AS "failureThreshold",
  cooldown_minutes AS "cooldownMinutes",
  auto_rollback AS "autoRollback",
  status,
  started_at AS "startedAt",
  last_promoted_at AS "lastPromotedAt",
  failure_count AS "failureCount",
  is_active AS "isActive",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`

let initPromise: Promise<void> | null = null

async function ensureTables(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS canary_configs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name varchar(100) NOT NULL UNIQUE,
          target varchar(200),
          current_stage varchar(50) NOT NULL,
          target_stage varchar(50) NOT NULL,
          failure_threshold integer NOT NULL,
          cooldown_minutes integer NOT NULL,
          auto_rollback boolean NOT NULL DEFAULT true,
          status varchar(50) NOT NULL DEFAULT 'active',
          started_at timestamptz,
          last_promoted_at timestamptz,
          failure_count integer NOT NULL DEFAULT 0,
          is_active boolean NOT NULL DEFAULT true,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `)
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS canary_audit_logs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          config_id uuid NOT NULL REFERENCES canary_configs(id) ON DELETE CASCADE,
          action varchar(50) NOT NULL,
          from_stage varchar(50),
          to_stage varchar(50),
          reason text,
          operator_id uuid,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `)
    })()
  }
  return initPromise
}

/** 根据名称从 DB 读取单条配置的原始行。 */
async function fetchConfigRow(name: string): Promise<CanaryConfigRow | null> {
  await ensureTables()
  const rows = await db.execute(sql`
    SELECT ${CANARY_SELECT_COLS} FROM canary_configs WHERE name = ${name}
  `)
  return (rows[0] as CanaryConfigRow | undefined) ?? null
}

export async function getCanaryConfig(name: string): Promise<CanaryConfig | null> {
  try {
    return await fetchConfigRow(name)
  } catch (err) {
    logger.error('[canary] getCanaryConfig failed', { error: err })
    return null
  }
}

export async function listCanaryConfigs(): Promise<CanaryConfig[]> {
  try {
    await ensureTables()
    const rows = await db.execute(sql`
      SELECT ${CANARY_SELECT_COLS} FROM canary_configs ORDER BY created_at DESC
    `)
    return rows as unknown as CanaryConfig[]
  } catch (err) {
    logger.error('[canary] listCanaryConfigs failed', { error: err })
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
    await ensureTables()
    const rows = await db.execute(sql`
      INSERT INTO canary_configs
        (name, current_stage, target_stage, failure_threshold, cooldown_minutes, auto_rollback, status, started_at, last_promoted_at, failure_count, is_active)
      VALUES
        (${name}, 'canary_1pct', ${targetStage}, ${failureThreshold}, ${cooldownMinutes}, true, 'active', ${now}, NULL, 0, true)
      ON CONFLICT (name) DO UPDATE SET
        current_stage = 'canary_1pct',
        target_stage = ${targetStage},
        failure_threshold = ${failureThreshold},
        cooldown_minutes = ${cooldownMinutes},
        auto_rollback = true,
        status = 'active',
        started_at = ${now},
        last_promoted_at = NULL,
        failure_count = 0,
        is_active = true,
        updated_at = ${now}
      RETURNING ${CANARY_SELECT_COLS}
    `)
    const row = rows[0] as CanaryConfigRow | undefined
    if (!row) throw new Error('failed to create canary config')

    await addAudit(row.id, 'promote', 'off', 'canary_1pct', 'canary started')
    return row
  } catch (err) {
    logger.error('[canary] createCanary failed', { error: err })
    throw err
  }
}

export async function promoteCanary(name: string): Promise<CanaryConfig> {
  const config = await fetchConfigRow(name)
  if (!config) throw new Error(`canary config "${name}" not found`)
  if (!config.isActive) throw new Error('canary is not active')

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
    await db.execute(sql`
      UPDATE canary_configs
      SET current_stage = ${nextStage},
          last_promoted_at = ${now},
          failure_count = 0,
          is_active = ${!reachedTarget},
          status = ${reachedTarget ? 'completed' : 'active'},
          updated_at = ${now}
      WHERE name = ${name}
    `)
  } catch (err) {
    logger.error('[canary] promoteCanary DB update failed', { error: err })
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
    await db.execute(sql`
      UPDATE canary_configs
      SET current_stage = 'off',
          is_active = false,
          failure_count = 0,
          status = 'rolled_back',
          updated_at = ${now}
      WHERE name = ${name}
    `)
  } catch (err) {
    logger.error('[canary] rollbackCanary DB update failed', { error: err })
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
    await db.execute(sql`
      UPDATE canary_configs
      SET failure_count = ${newFailureCount},
          updated_at = ${now}
      WHERE name = ${name}
    `)
  } catch (err) {
    logger.error('[canary] recordFailure DB update failed', { error: err })
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
    await db.execute(sql`
      UPDATE canary_configs
      SET current_stage = 'off',
          failure_count = 0,
          is_active = false,
          status = 'paused',
          started_at = NULL,
          last_promoted_at = NULL,
          updated_at = ${now}
      WHERE name = ${name}
    `)
  } catch (err) {
    logger.error('[canary] resetCanary DB update failed', { error: err })
    throw err
  }

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
    await ensureTables()
    const rows = configName
      ? await db.execute(sql`
          SELECT al.id, cc.name AS "configName", al.action,
                 al.from_stage AS "fromStage", al.to_stage AS "toStage",
                 al.created_at AS "timestamp", al.reason
          FROM canary_audit_logs al
          LEFT JOIN canary_configs cc ON al.config_id = cc.id
          WHERE cc.name = ${configName}
          ORDER BY al.created_at DESC
          LIMIT 1000
        `)
      : await db.execute(sql`
          SELECT al.id, cc.name AS "configName", al.action,
                 al.from_stage AS "fromStage", al.to_stage AS "toStage",
                 al.created_at AS "timestamp", al.reason
          FROM canary_audit_logs al
          LEFT JOIN canary_configs cc ON al.config_id = cc.id
          ORDER BY al.created_at DESC
          LIMIT 1000
        `)

    return (
      rows as unknown as Array<{
        id: string
        configName: string | null
        action: string
        fromStage: string | null
        toStage: string | null
        timestamp: Date
        reason: string | null
      }>
    ).map((r) => ({
      id: r.id,
      configName: r.configName ?? '',
      action: r.action as CanaryAuditEntry['action'],
      fromStage: (r.fromStage ?? 'off') as CanaryStage,
      toStage: (r.toStage ?? 'off') as CanaryStage,
      timestamp: r.timestamp,
      reason: r.reason ?? '',
    }))
  } catch (err) {
    logger.error('[canary] getAuditLog failed', { error: err })
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
    await ensureTables()
    await db.execute(sql`
      INSERT INTO canary_audit_logs (config_id, action, from_stage, to_stage, reason)
      VALUES (${configId}, ${action}, ${fromStage}, ${toStage}, ${reason})
    `)
  } catch (err) {
    logger.error('[canary] failed to write audit log', { error: err })
  }
}
