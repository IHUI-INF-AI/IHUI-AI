// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 模型配置治理体检(2026-11-27 立)。
 *
 * 管理页不仅要知道"跑了多少",还要知道"配置本身是否可信":
 * 同名配置、同 provider 模型别名冲突、孤儿模型行、公开但配置停用、
 * 公开但零价、启用但零模型、从未测试、公开但没有任何运营号。
 * 本服务只读真实表,把这些问题收成一份可给 UI 直接渲染的治理快照。
 */
import { sql } from 'drizzle-orm'
import { aiModelConfig, aiModelConfigModels, aiRelayAccountPool } from '@ihui/database'
import { dbRead } from '../db/index.js'
import { isTokenZeroPriceIssue } from './ai-model-governance-policy.js'
import { providerRuntimeMode, type ProviderRuntimeMode } from './ai-provider-metadata.js'

export interface AccountPoolSummary {
  providerCode: string
  total: number
  healthy: number
  enabled: number
  schedulable: number
  healthySchedulable: number
  sharedToOps: number
  opsTotal: number
  opsHealthy: number
  personalTotal: number
  personalHealthy: number
  tokenExpiringSoon: number
  tokenExpired: number
  lastUsedAt: string | null
}

export interface ConfigGovernance {
  id: number
  name: string
  providerCode: string
  providerGroup: string | null
  baseUrl: string
  enabled: boolean
  ownerUuid: string | null
  hasApiKey: boolean
  runtimeMode: ProviderRuntimeMode
  modelCount: number
  enabledModelCount: number
  publicModelCount: number
  duplicateName: boolean
  aliasConflictModels: string[]
  accountPool: AccountPoolSummary | null
}

export interface GovernanceIssue {
  code: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  count: number
  configIds: number[]
}

export interface AiModelGovernance {
  checkedAt: string
  summary: {
    configs: number
    models: number
    providers: number
    duplicateNameGroups: number
    aliasConflictGroups: number
    orphanModels: number
    enabledNoModels: number
    publicConfigDisabled: number
    publicZeroPrice: number
    configsWithoutTest: number
    publicNoOpsAccounts: number
  }
  byConfig: Record<string, ConfigGovernance>
  byProvider: Record<string, AccountPoolSummary>
  issues: GovernanceIssue[]
}

function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function emptyPool(providerCode: string): AccountPoolSummary {
  return {
    providerCode,
    total: 0,
    healthy: 0,
    enabled: 0,
    schedulable: 0,
    healthySchedulable: 0,
    sharedToOps: 0,
    opsTotal: 0,
    opsHealthy: 0,
    personalTotal: 0,
    personalHealthy: 0,
    tokenExpiringSoon: 0,
    tokenExpired: 0,
    lastUsedAt: null,
  }
}

export async function collectAiModelGovernance(now: Date = new Date()): Promise<AiModelGovernance> {
  const [configs, models, accounts] = await Promise.all([
    dbRead
      .select({
        id: aiModelConfig.id,
        name: aiModelConfig.name,
        providerCode: aiModelConfig.providerCode,
        providerGroup: aiModelConfig.providerGroup,
        baseUrl: aiModelConfig.baseUrl,
        enabled: aiModelConfig.enabled,
        ownerUuid: aiModelConfig.ownerUuid,
        lastTestStatus: aiModelConfig.lastTestStatus,
        hasApiKey: sql<boolean>`${aiModelConfig.apiKeyEnc} is not null`,
      })
      .from(aiModelConfig)
      .orderBy(aiModelConfig.id),
    dbRead
      .select({
        id: aiModelConfigModels.id,
        configId: aiModelConfigModels.configId,
        modelId: aiModelConfigModels.modelId,
        enabled: aiModelConfigModels.enabled,
        isRelayPublic: aiModelConfigModels.isRelayPublic,
        inputPricePer1k: aiModelConfigModels.inputPricePer1k,
        outputPricePer1k: aiModelConfigModels.outputPricePer1k,
        tags: aiModelConfigModels.tags,
      })
      .from(aiModelConfigModels),
    dbRead
      .select({
        providerCode: aiRelayAccountPool.providerCode,
        ownerUserId: aiRelayAccountPool.ownerUserId,
        isEnabled: aiRelayAccountPool.isEnabled,
        tempUnschedulable: aiRelayAccountPool.tempUnschedulable,
        healthStatus: aiRelayAccountPool.healthStatus,
        sharedToOps: aiRelayAccountPool.sharedToOps,
        tokenExpiresAt: aiRelayAccountPool.tokenExpiresAt,
        lastUsedAt: aiRelayAccountPool.lastUsedAt,
      })
      .from(aiRelayAccountPool),
  ])

  const configById = new Map<number, (typeof configs)[number]>()
  for (const c of configs) configById.set(Number(c.id), c)

  const nameGroups = new Map<string, Set<number>>()
  for (const c of configs) {
    const key = String(c.name ?? '')
      .trim()
      .toLowerCase()
    if (!key) continue
    const group = nameGroups.get(key) ?? new Set<number>()
    group.add(Number(c.id))
    nameGroups.set(key, group)
  }
  const duplicateNameGroups = [...nameGroups.values()].filter((group) => group.size > 1).length
  const duplicateConfigIds = new Set<number>()
  for (const group of nameGroups.values()) {
    if (group.size > 1) for (const id of group) duplicateConfigIds.add(id)
  }

  const byProvider: Record<string, AccountPoolSummary> = {}
  for (const account of accounts) {
    const code = String(account.providerCode)
    const pool = (byProvider[code] ??= emptyPool(code))
    const expiresMs = account.tokenExpiresAt ? new Date(account.tokenExpiresAt).getTime() : null
    const healthy = account.healthStatus === 'healthy'
    const schedulable = Boolean(account.isEnabled) && !account.tempUnschedulable
    const isGlobalOps = account.ownerUserId === null
    // 运营可用 = 全局运营号 + 个人号显式共享到运营池。只算全局号会把
    // sharedToOps=true 的试点号漏掉,治理页会误报「公开档位无运营号」。
    const isOpsEligible = isGlobalOps || account.sharedToOps === true
    pool.total++
    if (account.isEnabled) pool.enabled++
    if (healthy) pool.healthy++
    if (schedulable) pool.schedulable++
    if (healthy && schedulable) pool.healthySchedulable++
    if (account.sharedToOps) pool.sharedToOps++
    if (isOpsEligible) pool.opsTotal++
    if (isOpsEligible && healthy && schedulable) pool.opsHealthy++
    if (!isGlobalOps) pool.personalTotal++
    if (!isGlobalOps && healthy && schedulable) pool.personalHealthy++
    if (expiresMs !== null) {
      if (expiresMs <= now.getTime()) pool.tokenExpired++
      else if (expiresMs <= now.getTime() + 7 * 24 * 60 * 60_000) pool.tokenExpiringSoon++
    }
    const last = toIso(account.lastUsedAt)
    if (last && (!pool.lastUsedAt || last > pool.lastUsedAt)) pool.lastUsedAt = last
  }

  const modelsByConfig = new Map<number, Array<(typeof models)[number]>>()
  for (const model of models) {
    const list = modelsByConfig.get(Number(model.configId)) ?? []
    list.push(model)
    modelsByConfig.set(Number(model.configId), list)
  }

  // 同 provider + 同模型别名 >1 个启用配置 = 真实冲突;跨 provider 同别名是合法的多渠道。
  const aliasGroups = new Map<string, Set<number>>()
  const enabledRowsByConfig = new Map<number, Array<(typeof models)[number]>>()
  for (const model of models) {
    const config = configById.get(Number(model.configId))
    if (!config || !config.enabled || !model.enabled) continue
    const key = `${config.providerCode}|${String(model.modelId).toLowerCase()}`
    const group = aliasGroups.get(key) ?? new Set<number>()
    group.add(Number(config.id))
    aliasGroups.set(key, group)
    const list = enabledRowsByConfig.get(Number(config.id)) ?? []
    list.push(model)
    enabledRowsByConfig.set(Number(config.id), list)
  }
  const aliasConflictModelsByConfig = new Map<number, string[]>()
  let aliasConflictGroups = 0
  for (const [key, group] of aliasGroups) {
    if (group.size <= 1) continue
    aliasConflictGroups++
    const modelId = key.split('|').slice(1).join('|')
    for (const id of group) {
      const list = aliasConflictModelsByConfig.get(id) ?? []
      if (!list.includes(modelId)) list.push(modelId)
      aliasConflictModelsByConfig.set(id, list)
    }
  }

  const orphanModels = models.filter((model) => !configById.has(Number(model.configId)))
  const enabledNoModels = configs.filter(
    (config) => config.enabled && (modelsByConfig.get(Number(config.id))?.length ?? 0) === 0,
  )
  const publicConfigDisabled = models.filter((model) => {
    if (!model.isRelayPublic) return false
    const config = configById.get(Number(model.configId))
    return !config || !config.enabled
  })
  const publicZeroPrice = models.filter((model) => {
    const config = configById.get(Number(model.configId))
    return Boolean(config?.enabled) && isTokenZeroPriceIssue(model)
  })
  const configsWithoutTest = configs.filter((config) => !config.lastTestStatus)
  const publicNoOpsAccounts = configs.filter((config) => {
    if (!config.enabled) return false
    const rows = enabledRowsByConfig.get(Number(config.id)) ?? []
    if (!rows.some((model) => model.isRelayPublic)) return false
    if (providerRuntimeMode(config.providerCode) !== 'account_pool') return false
    return (byProvider[String(config.providerCode)]?.opsHealthy ?? 0) === 0
  })

  const byConfig: Record<string, ConfigGovernance> = {}
  for (const config of configs) {
    const id = Number(config.id)
    const list = modelsByConfig.get(id) ?? []
    const pool = byProvider[String(config.providerCode)] ?? null
    byConfig[String(id)] = {
      id,
      name: config.name,
      providerCode: config.providerCode,
      providerGroup: config.providerGroup,
      baseUrl: config.baseUrl ?? '',
      enabled: config.enabled,
      ownerUuid: config.ownerUuid,
      hasApiKey: config.hasApiKey === true,
      runtimeMode: providerRuntimeMode(config.providerCode),
      modelCount: list.length,
      enabledModelCount: list.filter((model) => model.enabled).length,
      publicModelCount: list.filter((model) => model.isRelayPublic).length,
      duplicateName: duplicateConfigIds.has(id),
      aliasConflictModels: aliasConflictModelsByConfig.get(id) ?? [],
      accountPool: pool,
    }
  }

  const publicNoOpsCount = publicNoOpsAccounts.reduce((sum, config) => {
    const rows = enabledRowsByConfig.get(Number(config.id)) ?? []
    return sum + rows.filter((model) => model.isRelayPublic).length
  }, 0)

  const issues: GovernanceIssue[] = []
  const pushIssue = (
    code: string,
    severity: GovernanceIssue['severity'],
    title: string,
    count: number,
    configIds: number[] = [],
  ) => {
    if (count > 0) issues.push({ code, severity, title, count, configIds })
  }
  pushIssue(
    'alias_conflict',
    'critical',
    '同 provider 下模型别名被多个配置占用,路由会隐式选最小 id',
    aliasConflictGroups,
    [...aliasConflictModelsByConfig.keys()],
  )
  pushIssue('orphan_models', 'critical', '模型行挂在已不存在的配置上', orphanModels.length, [
    ...new Set(orphanModels.map((model) => Number(model.configId))),
  ])
  pushIssue(
    'public_config_disabled',
    'critical',
    '公开模型仍挂在已停用的配置上',
    publicConfigDisabled.length,
    [...new Set(publicConfigDisabled.map((model) => Number(model.configId)))],
  )
  pushIssue(
    'public_no_ops_accounts',
    'critical',
    '公开模型没有任何可调度的运营号',
    publicNoOpsCount,
    publicNoOpsAccounts.map((config) => Number(config.id)),
  )
  pushIssue('duplicate_name', 'warning', '存在同名配置,列表难以区分', duplicateConfigIds.size, [
    ...duplicateConfigIds,
  ])
  pushIssue(
    'enabled_no_models',
    'warning',
    '配置已启用但没有任何模型行',
    enabledNoModels.length,
    enabledNoModels.map((config) => Number(config.id)),
  )
  pushIssue(
    'public_zero_price',
    'warning',
    '公开 token 计价模型输入/输出价均为 0;按次媒体模型不计 token 价,已排除',
    publicZeroPrice.length,
    [...new Set(publicZeroPrice.map((model) => Number(model.configId)))],
  )
  pushIssue(
    'configs_without_test',
    'info',
    '配置从未记录过连通测试',
    configsWithoutTest.length,
    configsWithoutTest.map((config) => Number(config.id)),
  )

  return {
    checkedAt: now.toISOString(),
    summary: {
      configs: configs.length,
      models: models.length,
      providers: Object.keys(byProvider).length,
      duplicateNameGroups,
      aliasConflictGroups,
      orphanModels: orphanModels.length,
      enabledNoModels: enabledNoModels.length,
      publicConfigDisabled: publicConfigDisabled.length,
      publicZeroPrice: publicZeroPrice.length,
      configsWithoutTest: configsWithoutTest.length,
      publicNoOpsAccounts: publicNoOpsCount,
    },
    byConfig,
    byProvider,
    issues,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
