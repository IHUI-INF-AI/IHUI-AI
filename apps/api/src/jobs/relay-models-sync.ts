// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池中继平台上游模型通用自动上架 job(ai_model_config_models 表)。
 *
 * 立因:trae-models-sync 只覆盖 trae 单平台。实测全号池 14 个反代型平台里只有 3 个
 * (trae/qoder/minimax)用户能选到模型,其余「有号却选不到模型」—— 它们有可调度账号、
 * 适配器也支持清单接口,但 ai_model_config(_models) 没登记模型行。
 * 本 job 把 trae 的「上游清单→逐条 upsert→跨上游去重→自动下架」链路泛化到**所有**中继平台,
 * 已取代单平台 trae-models-sync(后者不再上车)。
 *
 * 与 model-discovery-cron(relay-pool-model-discovery-sync)的分工:
 *   discovery 写 ai_relay_discovery(status='discovered',等人工审批定价),刻意不写正式表;
 *   本 job 直写正式表 ai_model_config_models(新行 enabled=false/public=false,补价后显式上架),
 *   补齐最后一公里。
 *
 * 覆盖面:号池「有可调度号」且「适配器实现任一清单接口(listModels / listModelsDetailed)」的中继平台。
 *   - 适配器两种清单接口都没有(如 doubao/minimax/codex)⇒ 跳过(无法自动拉清单),如实记 skipped;
 *   - 取不到上游清单(ok=false)⇒ 整块跳过,绝不据此判下架(「取不到 ≠ 没模型」)。
 *
 * 转发安全性(关键):relay-account-forwarder 对号池中继平台恒走 adapter
 *   (executeChat / buildChatRequest,见 forwarder 路径 A/B),**不消费** ai_model_config.base_url。
 *   故为缺行平台自动建父表行时,base_url 仅是满足 NOT NULL 的登记字段(填各平台对话端点常量),
 *   不影响真实转发 —— 登记后既能显示也能真正对话。
 *
 * 调度:每 15 分钟(准实时上架,上游上新/下架最多等 15 分钟即落地 —— 机主 2026-11-24 定档
 *   「各平台一有更新就第一时间抓取」);运维止血可用 RELAY_MODEL_SYNC_CRON 覆盖周期表达式;
 *   由 index.ts 注册;ENABLE_RELAY_MODEL_SYNC=false 禁用;
 *   RELAY_MODEL_SYNC_PROVIDERS 覆盖平台列表(逗号分隔)。
 */

import cron, { type ScheduledTask } from 'node-cron'

import { db, dbRead } from '../db/index.js'
import { aiModelConfig, aiModelConfigModels } from '@ihui/database'
import { logger } from '../utils/logger.js'
import { isRelayProviderCode, type RelayProviderCode } from '../services/relay-account-format.js'
import { fetchUpstreamModelIdsForProvider } from '../services/relay-account-pool-service.js'
import { inferPointsMultiplier } from '../services/points-multiplier.js'

// 逐条写入的结局:新增 / 已存在跳过(不覆盖管理员手置的展示名/定价)
type RelayModelWriteOutcome = 'inserted' | 'exists'

export type RelayModelWriter = (
  configId: number,
  modelId: string,
) => Promise<RelayModelWriteOutcome>

/** 单平台同步结果 */
export interface RelayModelSyncResult {
  providerCode: string
  configId: number | null
  upstreamModelCount: number
  inserted: number
  exists: number
  deduped: number
  /** 上游清单里消失、本轮自动软下架的模型数 */
  delisted: number
  failed: number
  errors: string[]
  fetchOk: boolean
  /** 缺父表行 → 本次自动新建(幂等) */
  configRowCreated: boolean
}

/** 多平台遍历结果 */
export interface RelayModelSyncLoopResult {
  providersScanned: number
  providersOk: number
  providersSkipped: number
  /** 无 listModels 能力而跳过的平台(无法自动拉清单) */
  providersNoListModels: number
  inserted: number
  exists: number
  deduped: number
  delisted: number
  failed: number
  perProvider: Array<{
    providerCode: string
    ok: boolean
    upstreamCount: number
    inserted: number
    deduped: number
    delisted: number
  }>
}

// ─────────────────────────────────────────────────────────────────────────────
// 各中继平台「对话端点基址」登记(仅满足 ai_model_config.base_url NOT NULL;
// 转发恒走适配器,此值不参与真实请求路由,故用对话端点常量作语义占位)。
// 来源:各 *-adapter.ts 顶部端点常量。缺省回退占位(不影响转发)。
// 导出供 admin「手动从零登记模型」端点复用 —— 父行建法单一真相源,禁止第二份映射。
// ─────────────────────────────────────────────────────────────────────────────
const PROVIDER_CONFIG_BASE_URL: Partial<Record<RelayProviderCode, string>> = {
  trae: 'https://trae-api-cn.mchost.guru',
  qoder: 'https://openapi.qoder.com.cn',
  workbuddy: 'https://copilot.tencent.com',
  zcode: 'https://zcode.z.ai',
  raccoon: 'https://xiaohuanxiong.com',
  cursor: 'https://api2.cursor.sh',
  opencode: 'https://opencode.ai/zen/v1',
  loomy: 'https://loomyad.xunfei.cn/api/v1',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  minimax: 'https://api.minimax.chat/v1',
  codearts: 'https://codearts.huawei.com',
}

/** 缺父表行时自动建的显示名(平台可读名,便于 admin 识别)。导出供 admin 手动登记端点复用。 */
const PROVIDER_CONFIG_NAME: Partial<Record<RelayProviderCode, string>> = {
  trae: 'Trae 账号池',
  qoder: 'Qoder 账号池(反代)',
  workbuddy: 'WorkBuddy 账号池(反代)',
  zcode: 'Zcode 账号池(反代)',
  raccoon: '小浣熊 Raccoon 账号池(反代)',
  cursor: 'Cursor 账号池(反代)',
  opencode: 'OpenCode Zen 账号池(反代)',
  loomy: 'Loomy 账号池(反代)',
  doubao: '字节豆包(免费体验)',
  minimax: 'MiniMax(免费额度)',
  codearts: 'CodeArts 账号池(反代)',
}

/** 平台是否有可拉取的模型清单接口(2026-11-24 修):listModels 与 listModelsDetailed 任一存在即有能力。
 *  qoder 只实现 listModelsDetailed(SDK available_models_update 帧 / CLI 回落),旧门只认 listModels
 *  会把 qoder 整家跳过 —— 与服务层 fetchUpstreamModelIds(两种接口都试)判据分裂,导致 qoder
 *  新模型/下架/复活全不生效。此处统一单一真相源,供 loop 能力门与单测复用。 */
export function hasModelCatalogCapability(
  adapter: { listModels?: unknown; listModelsDetailed?: unknown } | undefined | null,
): boolean {
  return Boolean(adapter?.listModels || adapter?.listModelsDetailed)
}

/** 单模型 upsert:按 (config_id, model_id) 唯一约束。
 *  2026-11-26 全收费闸门:
 *  - 新行按 enabled=false / is_relay_public=false 写入;若无 ai_pricing 正价,
 *    数据库准入触发器会直接拒绝该行(连登记行都不落库)。同步腿拿不到可核实
 *    成本价,所以自动同步的未定价模型不会再污染售卖面。
 *  - 已存在行一律不动(onConflictDoNothing),不再自动复活 enabled=false 的旧行;
 *    上游重新上架时由管理员补价后显式上架,避免每轮同步把隔离状态翻回去。 */
async function upsertRelayModel(
  configId: number,
  modelId: string,
): Promise<RelayModelWriteOutcome> {
  // 非聊天模型(embedding/rerank/图像/视频/音频/翻译/审核)与 free 变体
  // 不进 LLM 售卖面。这里在写入前拦截,避免上游清单每 15 分钟又把它们插回来。
  if (shouldDisableOnMissingCost(classifyModelKind(modelId))) {
    return 'exists'
  }
  const rows = await db
    .insert(aiModelConfigModels)
    .values({
      configId,
      modelId,
      displayName: modelId,
      enabled: false,
      isRelayPublic: false,
      pointsMultiplier: inferPointsMultiplier(modelId).toFixed(2),
    })
    .onConflictDoNothing({
      target: [aiModelConfigModels.configId, aiModelConfigModels.modelId],
    })
    .returning({ id: aiModelConfigModels.id })
  return rows.length > 0 ? 'inserted' : 'exists'
}

/** 跨上游去重:同 model_id 重复行保留最早(最小 id)一条 enabled=true,其余置 false。
 *  只动 enabled=true 的行;已下架的不碰。 */
async function dedupModelsInDb(configId: number): Promise<number> {
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
    // 只对「同 model_id 的第二份及以后 enabled 行」发 UPDATE(先按 id 序比出来的真变化),
    // 不是无条件覆盖:rows 已读现值,toDeactivate 只收真需要下架的那几枚。
    await db
      .update(aiModelConfigModels)
      .set({
        enabled: false,
        updatedAt: new Date(),
      })
      .where(eq(aiModelConfigModels.id, id))
  }
  return toDeactivate.length
}

// eq 延迟到此处(保持顶部 import 简洁,与本文件其他 drizzle 用法一致)
import { eq, isNotNull, and } from 'drizzle-orm'
import { classifyModelKind, shouldDisableOnMissingCost } from '../services/model-kind-classifier.js'

/** 自动下架安全阀(2026-11-24 立):单轮"启用中模型"下架比例超过此值、且绝对条数超过下限,
 *  判定上游清单异常/部分返回,本轮不下架只告警 —— 防止上游一次抖动把整家平台清空。
 *  与 Python model_sync 的 _AUTO_DISABLE_MAX_REMOVAL_RATIO / _AUTO_DISABLE_ABS_FLOOR 同参。 */
export const AUTO_DELIST_MAX_RATIO = 0.5
export const AUTO_DELIST_ABS_FLOOR = 2

/** 纯判据:本轮哪些启用中模型应下架。
 *  - stale = 本平台库内 enabled=true 但上游本轮清单不再返回的 model_id;
 *  - 安全阀:stale 条数 > ABS_FLOOR 且 stale/total > MAX_RATIO ⇒ 判异常,返回空(不下架);
 *    小目录(<= ABS_FLOOR 条)比例天然失真,不看比例照常下架。
 *  导出供单测钉死阈值行为;DB 层 zero-hit 的 update 不产生副作用。 */
export function resolveStaleModelIds(
  enabledDbIds: string[],
  upstreamIds: string[],
  maxRatio = AUTO_DELIST_MAX_RATIO,
  absFloor = AUTO_DELIST_ABS_FLOOR,
  keepPrefixed = false,
): { stale: string[]; total: number; suppressedBySafety: boolean } {
  const upstream = new Set(upstreamIds)
  const total = enabledDbIds.length
  // keepPrefixed(qoder):带 'qoder/' 前缀的老别名行与上游裸 id 不同命名空间,
  // 不能被差集判 stale —— 它们 public=true 正在用,误删会直接打断线上路由。
  const stale = enabledDbIds.filter(
    (id) => !upstream.has(id) && !(keepPrefixed && id.includes('/')),
  )
  const suppressedBySafety = stale.length > absFloor && total > 0 && stale.length / total > maxRatio
  return { stale: suppressedBySafety ? [] : stale, total, suppressedBySafety }
}

/** 自动下架:上游本轮清单里消失的启用中模型置 enabled=false(软下架,可逆)。
 *  只碰本 configId 下 enabled=true 的行;admin 手置的 is_relay_public / 定价一律不动。
 *  上游重新上架时由 upsertRelayModel 的 onConflict 分支原地复活(见该函数)。 */
async function delistStaleModels(
  configId: number,
  upstreamIds: string[],
  providerCode: string,
): Promise<{ delisted: number; suppressedBySafety: boolean; total: number }> {
  const rows = await db
    .select({ modelId: aiModelConfigModels.modelId, enabled: aiModelConfigModels.enabled })
    .from(aiModelConfigModels)
    .where(eq(aiModelConfigModels.configId, configId))
  const enabledDbIds = rows.filter((r) => r.enabled).map((r) => r.modelId)
  const { stale, total, suppressedBySafety } = resolveStaleModelIds(
    enabledDbIds,
    upstreamIds,
    AUTO_DELIST_MAX_RATIO,
    AUTO_DELIST_ABS_FLOOR,
    providerCode === 'qoder',
  )
  if (suppressedBySafety) {
    logger.warn(
      `[relay-models-sync] ${configId} 本轮下架 ${stale.length}/${total} 触发安全阀(>50% 且 >2 条),判上游清单异常,跳过下架`,
    )
  }
  if (stale.length === 0) return { delisted: 0, suppressedBySafety, total }
  for (const modelId of stale) {
    await db
      .update(aiModelConfigModels)
      .set({ enabled: false, updatedAt: new Date() })
      .where(
        and(
          eq(aiModelConfigModels.configId, configId),
          eq(aiModelConfigModels.modelId, modelId),
          eq(aiModelConfigModels.enabled, true),
        ),
      )
  }
  return { delisted: stale.length, suppressedBySafety, total }
}

/** 串行写入:逐条 await,单条失败只计 failed 并继续(不整批中断)。 */
async function persistModels(
  configId: number,
  modelIds: string[],
  write: RelayModelWriter,
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
      logger.warn(`[relay-models-sync] write failed: ${modelId}: ${reason}`)
    }
  }
  return stats
}

/** 取该平台 ai_model_config 行;缺则自动建(幂等,按 provider_code 查重)。
 *  注:唯一约束是 (provider_code, COALESCE(base_url,'')) 而非单 provider_code,
 *  故用「先查后插」而非 onConflict(provider_code)。返回 [configId, created]。
 *  导出供 admin「手动从零登记模型」端点复用 —— 父行建法单一真相源。 */
export async function ensureProviderConfigRow(
  providerCode: RelayProviderCode,
): Promise<{ configId: number; created: boolean }> {
  const [existing] = await db
    .select({ id: aiModelConfig.id })
    .from(aiModelConfig)
    .where(and(eq(aiModelConfig.providerCode, providerCode), isNull(aiModelConfig.ownerUuid)))
    .orderBy(aiModelConfig.id)
    .limit(1)
  if (existing) return { configId: existing.id, created: false }

  const baseUrl = PROVIDER_CONFIG_BASE_URL[providerCode] ?? `https://${providerCode}.relay.invalid`
  const name = PROVIDER_CONFIG_NAME[providerCode] ?? `${providerCode} 账号池(反代)`
  const [created] = await db
    .insert(aiModelConfig)
    .values({
      name,
      providerCode,
      baseUrl,
      apiFormat: 'openai_chat',
      enabled: true,
      isBuiltin: false,
      description: `号池反代自动登记(${providerCode});转发走适配器,base_url 仅登记字段`,
    })
    .returning({ id: aiModelConfig.id })
  if (!created)
    throw new Error(`ensureProviderConfigRow: insert returned no row for ${providerCode}`)
  return { configId: created.id, created: true }
}

/** 单平台同步:现拉上游 → 逐条 upsert → 跨上游去重,返回完整统计。永不抛。 */
export async function syncRelayProviderModels(options: {
  providerCode: string
  write?: RelayModelWriter
  fetchUpstream?: (code: RelayProviderCode) => Promise<{ ok: boolean; ids: string[] }>
}): Promise<RelayModelSyncResult> {
  const providerCode = options.providerCode
  const empty = (configId: number | null, configRowCreated = false): RelayModelSyncResult => ({
    providerCode,
    configId,
    upstreamModelCount: 0,
    inserted: 0,
    exists: 0,
    deduped: 0,
    delisted: 0,
    failed: 0,
    errors: [],
    fetchOk: false,
    configRowCreated,
  })

  if (!isRelayProviderCode(providerCode)) {
    const msg = `not a relay provider code: '${providerCode}'`
    logger.warn(`[relay-models-sync] ${msg}`)
    return { ...empty(null), errors: [msg] }
  }

  const fetchUpstream = options.fetchUpstream ?? fetchUpstreamModelIdsForProvider
  // 把平台码绑进默认 writer(2026-11-26 起全平台新行统一不公开/不启用;
  // 显式注入 options.write 的调用方(测试/admin)仍完全掌控写入语义。
  const write: RelayModelWriter = options.write ?? ((cid, mid) => upsertRelayModel(cid, mid))

  // 1. 现拉上游清单(适配器无 listModels ⇒ ok=false 跳过)
  let upstreamIds: string[] = []
  let fetchOk = false
  let fetchErr: string | null = null
  try {
    const outcome = await fetchUpstream(providerCode)
    if (outcome.ok) {
      upstreamIds = outcome.ids
      fetchOk = true
      logger.info(
        `[relay-models-sync] ${providerCode} upstream returned ${upstreamIds.length} models`,
      )
    } else {
      fetchErr = 'upstream fetch returned ok=false (取不到 ≠ 没模型,本轮跳过)'
      logger.warn(`[relay-models-sync] ${providerCode}: ${fetchErr}`)
    }
  } catch (err) {
    fetchErr = err instanceof Error ? err.message : String(err)
    logger.warn(`[relay-models-sync] ${providerCode} fetch failed: ${fetchErr}`)
  }
  if (!fetchOk) return { ...empty(null), errors: [fetchErr ?? 'fetch failed'] }

  // 2. 父表行(缺则自动建)
  const { configId, created } = await ensureProviderConfigRow(providerCode)

  // 3. 串行 upsert(新增 / 复活已下架行)
  const stats = await persistModels(configId, upstreamIds, write)

  // 4. 自动下架:上游本轮清单里消失的启用中模型软下架。
  //    空清单保护:上游返回 0 个模型视为异常(取不到 ≠ 没模型),本轮不下架整家。
  let delisted = 0
  if (upstreamIds.length > 0) {
    const d = await delistStaleModels(configId, upstreamIds, providerCode)
    delisted = d.delisted
    if (delisted > 0) {
      logger.info(
        `[relay-models-sync] ${providerCode} delisted ${delisted}/${d.total} stale models (config_id=${configId})`,
      )
    }
  }

  // 5. 跨上游去重
  const deduped = await dedupModelsInDb(configId)
  if (deduped > 0) {
    logger.info(
      `[relay-models-sync] ${providerCode} deduped ${deduped} duplicate rows (config_id=${configId})`,
    )
  }

  return {
    providerCode,
    configId,
    upstreamModelCount: upstreamIds.length,
    inserted: stats.inserted,
    exists: stats.exists,
    deduped,
    delisted,
    failed: stats.failed,
    errors: stats.errors,
    fetchOk: true,
    configRowCreated: created,
  }
}

/** 遍历所有「有可调度号 + 适配器支持 listModels」的中继平台。永不抛(单平台失败隔离)。 */
export async function runRelayModelsSyncLoop(
  options: {
    providers?: RelayProviderCode[]
    write?: RelayModelWriter
    fetchUpstream?: (code: RelayProviderCode) => Promise<{ ok: boolean; ids: string[] }>
    listModelsCapable?: (code: RelayProviderCode) => Promise<boolean>
  } = {},
): Promise<RelayModelSyncLoopResult> {
  const result: RelayModelSyncLoopResult = {
    providersScanned: 0,
    providersOk: 0,
    providersSkipped: 0,
    providersNoListModels: 0,
    inserted: 0,
    exists: 0,
    deduped: 0,
    delisted: 0,
    failed: 0,
    perProvider: [],
  }

  // 平台遍历面:显式注入 > RELAY_MODEL_SYNC_PROVIDERS 环境变量 > 号池「有可调度号」的中继平台
  // (discovery-sync 同范式)。环境变量是运维止血/定向补跑出口:逗号分隔、逐个经白名单校验,
  // 空串/非法项一律丢弃;全部非法则回落 DB 枚举(绝不跑一个空列表冒充"本轮无平台")。
  let providers: RelayProviderCode[] = []
  const envProviders = (process.env.RELAY_MODEL_SYNC_PROVIDERS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is RelayProviderCode => s !== '' && isRelayProviderCode(s))
  if (options.providers && options.providers.length > 0) {
    providers = options.providers
  } else if (envProviders.length > 0) {
    providers = [...new Set(envProviders)].sort()
  } else {
    const { accountSchedulableCondition } =
      await import('../services/relay-account-pool-scheduler.js')
    const accounts = await dbRead
      .select({ providerCode: aiRelayAccountPool.providerCode })
      .from(aiRelayAccountPool)
      .where(and(accountSchedulableCondition(), isNotNull(aiRelayAccountPool.providerCode)))
    const set = new Set<string>()
    for (const row of accounts) {
      if (isRelayProviderCode(row.providerCode)) set.add(row.providerCode)
    }
    providers = [...set].filter((c): c is RelayProviderCode => isRelayProviderCode(c)).sort()
  }

  // 模型清单能力面:注入 > 默认按适配器是否实现任一清单接口(listModels / listModelsDetailed)。
  // 统一走 hasModelCatalogCapability,勿在这里另写 listModels-only 判据(qoder 会被整家跳过)。
  const capable =
    options.listModelsCapable ??
    (async (code: RelayProviderCode) => {
      const { getRelayAdapter } = await import('../services/relay-upstream-adapters.js')
      const { registerAllRelayAdapters } = await import('../services/upstream-adapters/index.js')
      registerAllRelayAdapters()
      return hasModelCatalogCapability(getRelayAdapter(code))
    })

  for (const providerCode of providers) {
    result.providersScanned += 1
    if (!(await capable(providerCode))) {
      result.providersNoListModels += 1
      result.perProvider.push({
        providerCode,
        ok: false,
        upstreamCount: 0,
        inserted: 0,
        deduped: 0,
        delisted: 0,
      })
      continue
    }
    try {
      const r = await syncRelayProviderModels({
        providerCode,
        write: options.write,
        fetchUpstream: options.fetchUpstream,
      })
      result.providersOk += r.fetchOk ? 1 : 0
      if (!r.fetchOk) result.providersSkipped += 1
      result.inserted += r.inserted
      result.exists += r.exists
      result.deduped += r.deduped
      result.delisted += r.delisted
      result.failed += r.failed
      result.perProvider.push({
        providerCode,
        ok: r.fetchOk,
        upstreamCount: r.upstreamModelCount,
        inserted: r.inserted,
        deduped: r.deduped,
        delisted: r.delisted,
      })
    } catch (err) {
      result.providersSkipped += 1
      result.failed += 1
      const msg = err instanceof Error ? err.message : String(err)
      logger.error(`[relay-models-sync] ${providerCode} loop iteration failed: ${msg}`)
      result.perProvider.push({
        providerCode,
        ok: false,
        upstreamCount: 0,
        inserted: 0,
        deduped: 0,
        delisted: 0,
      })
    }
  }
  return result
}

// ===== 调度器 =====
import { aiRelayAccountPool } from '@ihui/database'
import { isNull } from 'drizzle-orm'

let scheduledTask: ScheduledTask | null = null

/**
 * 默认 15 分钟一轮(机主 2026-11-24「各平台一有更新就第一时间抓取」定档)。
 * 抽取成单源导出:启动日志与测试都读它,杜绝日志写一个周期、实际注册另一个(§0.6)。
 * RELAY_MODEL_SYNC_CRON 仅作运维止血覆盖(如上游限流时临时降频),空串/纯空白按缺省处理。
 */
export const DEFAULT_MODEL_SYNC_CRON = '*/15 * * * *'

export function resolveModelSyncCron(env: NodeJS.ProcessEnv = process.env): string {
  const override = String(env.RELAY_MODEL_SYNC_CRON ?? '').trim()
  return override || DEFAULT_MODEL_SYNC_CRON
}

export function startRelayModelsSyncScheduler(): void {
  if (scheduledTask) return
  if (process.env.ENABLE_RELAY_MODEL_SYNC === 'false') {
    logger.info('[relay-models-sync] disabled by ENABLE_RELAY_MODEL_SYNC=false')
    return
  }
  const pattern = resolveModelSyncCron()
  scheduledTask = cron.schedule(
    pattern,
    async () => {
      try {
        const r = await runRelayModelsSyncLoop()
        logger.info(
          `[relay-models-sync] loop done: scanned=${r.providersScanned} ok=${r.providersOk} ` +
            `skipped=${r.providersSkipped} noListModels=${r.providersNoListModels} ` +
            `inserted=${r.inserted} exists=${r.exists} deduped=${r.deduped} failed=${r.failed}`,
        )
        if (r.failed > 0) {
          logger.warn('[relay-models-sync] failures:', { failed: r.failed })
        }
      } catch (err) {
        logger.error('[relay-models-sync] fatal:', { error: err })
      }
    },
    { timezone: 'Asia/Shanghai' },
  )
  logger.info(`[relay-models-sync] scheduler started (cron: "${pattern}" Asia/Shanghai)`)
}

export function stopRelayModelsSyncScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
