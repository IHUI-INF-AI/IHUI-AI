// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * trae 反代上游模型自动上架任务(ai_model_config_models 表)。
 *
 * 立因:号池模型目录自动同步(relay-pool-model-discovery-sync,每 6 小时)刻意**不**写
 * ai_model_config_models —— 它只把新模型标进 ai_relay_discovery(status='discovered')等人工审批定价。
 * 结果:上游悄悄上新模型后,平台用户在模型列表仍看不到,要等管理员手扫+审批+上架。
 * 用户要求「后端自动更新、自动去重」,本腿补上直写正式表的最后一公里。
 *
 * 行为:
 * 1. 复用号池现成的 fetchUpstreamModelIdsForProvider('trae') 现拉上游清单(自动挑可调度账号);
 * 2. 对每个 id:按 (config_id, model_id) 唯一约束 onConflictDoNothing —— 新模型自动插入
 *    (enabled=true, is_relay_public=true, 立即可见于中转站模型列表),已存在则跳过(不覆盖
 *    管理员手置的展示名/定价);
 * 3. 跨上游去重:trae 内同 model_id 重复行保留最早一条 enabled=true,其余置 false(不删除,
 *    保留审计痕迹)。查询期 /api/relay/models/public 另有一层兜底去重,此处使 DB 本身更干净。
 *
 * 取舍(刻意):新模型 is_relay_public=true 直接上架(用户要的就是「自动上架」),但**不**填
 * 定价/展示名(留 null → 前端回退 model_id)。这与 discovery-sync「机器不瞎填定价」的边界一致,
 * 只是默认可见性按用户明确要求放宽。若日后要恢复「先审后架」,把 INSERT 的 isRelayPublic 改 false 即可。
 *
 * 调度:每 6 小时(时=30分,错开 discovery-cron 的整点批),由 index.ts 注册;
 *   ENABLE_TRAE_MODEL_SYNC=false 禁用;TRAEMODELS_SYNC_UPSTREAM_CODE 覆盖平台(默认 'trae')。
 */

import cron, { type ScheduledTask } from 'node-cron'
import { eq } from 'drizzle-orm'

import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
import { aiModelConfigModels } from '@ihui/database'
import { fetchUpstreamModelIdsForProvider } from '../services/relay-account-pool-service.js'
import { isRelayProviderCode, type RelayProviderCode } from '../services/relay-account-format.js'

/** 单条写入的结局:新增 / 已存在跳过 */
type TraeModelWriteOutcome = 'inserted' | 'exists'

/** 写入函数(可注入,便于测试替换真实 DB) */
export type TraeModelWriter = (
  configId: number,
  modelId: string,
) => Promise<TraeModelWriteOutcome>

/**
 * 单模型 upsert:利用 (config_id, model_id) 唯一约束 onConflictDoNothing。
 * 不更新既有行(避免覆盖管理员手置的 is_relay_public / relay_display_name / 定价)。
 */
async function upsertTraeModel(
  configId: number,
  modelId: string,
): Promise<TraeModelWriteOutcome> {
  const rows = await db
    .insert(aiModelConfigModels)
    .values({
      configId,
      modelId,
      displayName: modelId,
      enabled: true,
      isRelayPublic: true,
    })
    .onConflictDoNothing({ target: [aiModelConfigModels.configId, aiModelConfigModels.modelId] })
    .returning({ id: aiModelConfigModels.id })
  return rows.length > 0 ? 'inserted' : 'exists'
}

/** 同步结果:统计与实际写入一一对应 */
export interface TraeModelSyncResult {
  upstreamCode: string
  configId: number | null
  upstreamModelCount: number
  inserted: number
  exists: number
  deduped: number
  failed: number
  errors: string[]
  fetchOk: boolean
}

/**
 * 跨上游去重:同 model_id 重复行保留最早(最小 id)一条 enabled=true,其余置 false。
 * 只动 enabled=true 的行;已下架的不碰。
 */
async function dedupTraeModelsInDb(configId: number): Promise<number> {
  const rows = await db
    .select({
      id: aiModelConfigModels.id,
      modelId: aiModelConfigModels.modelId,
      enabled: aiModelConfigModels.enabled,
    })
    .from(aiModelConfigModels)
    .where(eq(aiModelConfigModels.configId, configId))
    .orderBy(aiModelConfigModels.id)

  const firstEnabledByModelId = new Map<string, number>()
  const toDeactivate: number[] = []
  for (const row of rows) {
    if (!row.enabled) continue
    if (firstEnabledByModelId.has(row.modelId)) toDeactivate.push(row.id)
    else firstEnabledByModelId.set(row.modelId, row.id)
  }
  for (const id of toDeactivate) {
    await db
      .update(aiModelConfigModels)
      .set({ enabled: false, updatedAt: new Date() })
      .where(eq(aiModelConfigModels.id, id))
  }
  return toDeactivate.length
}

/**
 * 串行写入:逐条 await,单条失败只计 failed 并继续。
 * 串行而非并发:onConflictDoNothing 虽幂等,串行更稳(避免连接池压力 + 便于逐条计错误)。
 */
async function persistModels(
  configId: number,
  modelIds: string[],
  write: TraeModelWriter,
): Promise<{ inserted: number; exists: number; failed: number; errors: string[] }> {
  const stats = { inserted: 0, exists: 0, failed: 0, errors: [] as string[] }
  for (const modelId of modelIds) {
    try {
      const outcome = await write(configId, modelId)
      if (outcome === 'inserted') stats.inserted++
      else if (outcome === 'exists') stats.exists++
    } catch (err) {
      stats.failed++
      const reason = err instanceof Error ? err.message : String(err)
      stats.errors.push(`${modelId.slice(0, 60)}: ${reason.slice(0, 160)}`)
      logger.warn(`[trae-models-sync] write failed: ${modelId}: ${reason}`)
    }
  }
  return stats
}

/** 同步入口:现拉上游 → 逐条 upsert → 跨上游去重,返回完整统计 */
export async function syncTraeModels(
  options: {
    upstreamCode?: string
    write?: TraeModelWriter
    /** 注入上游拉取(测试用);默认用号池适配器现拉 */
    fetchUpstream?: (code: RelayProviderCode) => Promise<{ ok: boolean; ids: string[] }>
  } = {},
): Promise<TraeModelSyncResult> {
  const upstreamCode = options.upstreamCode ?? process.env.TRAEMODELS_SYNC_UPSTREAM_CODE ?? 'trae'
  const fetchUpstream =
    options.fetchUpstream ?? fetchUpstreamModelIdsForProvider

  if (!isRelayProviderCode(upstreamCode)) {
    const msg = `not a relay provider code: '${upstreamCode}'`
    logger.warn(`[trae-models-sync] ${msg}`)
    return {
      upstreamCode,
      configId: null,
      upstreamModelCount: 0,
      inserted: 0,
      exists: 0,
      deduped: 0,
      failed: 0,
      errors: [msg],
      fetchOk: false,
    }
  }

  // 1. 找该平台的 ai_model_config 行(config_id 用于写子表)
  const { aiModelConfig } = await import('@ihui/database')
  const [config] = await db
    .select({ id: aiModelConfig.id, providerCode: aiModelConfig.providerCode })
    .from(aiModelConfig)
    .where(eq(aiModelConfig.providerCode, upstreamCode))
    .orderBy(aiModelConfig.id)
    .limit(1)

  if (!config) {
    const msg = `no ai_model_config row for provider_code='${upstreamCode}'`
    logger.warn(`[trae-models-sync] ${msg}`)
    return {
      upstreamCode,
      configId: null,
      upstreamModelCount: 0,
      inserted: 0,
      exists: 0,
      deduped: 0,
      failed: 0,
      errors: [msg],
      fetchOk: false,
    }
  }

  // 2. 现拉上游模型清单(复用号池适配器,自动挑可调度账号)
  let upstreamIds: string[] = []
  let fetchOk = false
  let fetchErr: string | null = null
  try {
    const outcome = await fetchUpstream(upstreamCode as RelayProviderCode)
    if (outcome.ok) {
      upstreamIds = outcome.ids
      fetchOk = true
      logger.info(`[trae-models-sync] upstream returned ${upstreamIds.length} models`)
    } else {
      fetchErr = 'upstream fetch returned ok=false (取不到 ≠ 没模型,本轮跳过)'
      logger.warn(`[trae-models-sync] ${fetchErr}`)
    }
  } catch (err) {
    fetchErr = err instanceof Error ? err.message : String(err)
    logger.warn(`[trae-models-sync] fetch failed: ${fetchErr}`)
  }

  if (!fetchOk) {
    return {
      upstreamCode,
      configId: config.id,
      upstreamModelCount: 0,
      inserted: 0,
      exists: 0,
      deduped: 0,
      failed: 0,
      errors: [fetchErr ?? 'fetch failed'],
      fetchOk: false,
    }
  }

  // 3. 串行 upsert
  const write = options.write ?? upsertTraeModel
  const stats = await persistModels(config.id, upstreamIds, write)

  // 4. 跨上游去重
  const deduped = await dedupTraeModelsInDb(config.id)
  if (deduped > 0) {
    logger.info(`[trae-models-sync] deduped ${deduped} duplicate rows (config_id=${config.id})`)
  }

  return {
    upstreamCode,
    configId: config.id,
    upstreamModelCount: upstreamIds.length,
    inserted: stats.inserted,
    exists: stats.exists,
    deduped,
    failed: stats.failed,
    errors: stats.errors,
    fetchOk: true,
  }
}

// ===== 调度器 =====

let scheduledTask: ScheduledTask | null = null

export function startTraeModelsScheduler(): void {
  if (scheduledTask) return
  if (process.env.ENABLE_TRAE_MODEL_SYNC === 'false') {
    logger.info('[trae-models-sync] disabled by ENABLE_TRAE_MODEL_SYNC=false')
    return
  }
  scheduledTask = cron.schedule(
    '30 */6 * * *',
    async () => {
      try {
        const r = await syncTraeModels()
        logger.info(
          `[trae-models-sync] done: upstream=${r.upstreamModelCount} inserted=${r.inserted} ` +
            `exists=${r.exists} deduped=${r.deduped} failed=${r.failed} fetchOk=${r.fetchOk}`,
        )
        if (r.failed > 0) {
          logger.warn('[trae-models-sync] errors:', { errors: r.errors.slice(0, 5) })
        }
      } catch (err) {
        logger.error('[trae-models-sync] fatal:', { error: err })
      }
    },
    { timezone: 'Asia/Shanghai' },
  )
  logger.info('[trae-models-sync] scheduler started (cron: "30 */6 * * *" Asia/Shanghai)')
}

export function stopTraeModelsScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
