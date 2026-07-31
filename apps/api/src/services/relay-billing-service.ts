/**
 * 中转站计费核心 service(P0-5a,2026-07-29 立)。
 *
 * 职责:
 * 1. checkQuota(apiKeyId, estimatedTokens): 调用前检查 API Key 余额,返回是否允许调用
 * 2. recordCall({...}): 调用后写入 llm_call_logs + 扣减 API Key 余额 + 累计已用统计
 * 3. calculateCost(model, promptTokens, completionTokens): 按模型定价 × 中转站倍率计算成本(分)
 *
 * 计费链路:
 *   上游定价(aiPricing.inputTokenPrice / outputTokenPrice,分/千 token)
 *   × 中转站倍率(aiModelConfigModels.relayPriceMultiplier,1.0=原价,1.2=加价20%)
 *   = 中转站成本(分)
 *
 * 余额规则(developerApiKeys.tokenBalance / costBalanceCents):
 *   -1 = 无限额度(admin 信任的 Key),0 = 余额耗尽,>0 = 可用余额
 *
 * 读写分离:写用 db,读用 dbRead。
 */
import { eq, and, sql, desc, isNull } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import {
  developerApiKeys,
  llmCallLogs,
  aiPricing,
  aiModelConfigModels,
  aiModelConfig,
} from '@ihui/database'
import { getCurrentTierMultiplier } from './tiered-pricing-service.js'
// Relay 返佣(2026-07-31 立,扣费后异步触发,失败不影响主链路)
import { recordRelayCommission } from './relay-commission-service.js'
import { getUserModelMultiplier } from './user-billing-group-service.js'
// Relay Webhook 通知(2026-08-01 立,扣费后异步触发 relay.call.completed/failed/balance.low 事件)
import { notifyRelayEvent } from './webhook-relay-notifier.js'
// API Key 分组(2026-08-01 立,组池余额检查/扣减)
import { getKeyGroup } from './api-key-group-service.js'
import { apiKeyGroups } from '@ihui/database'

// =============================================================================
// 类型定义
// =============================================================================

export interface CheckQuotaResult {
  allowed: boolean
  reason?: 'no_balance_token' | 'no_balance_cost' | 'key_not_found' | 'key_revoked'
  apiKeyId: string
  userId: string
  tokenBalance: number
  costBalanceCents: number
}

export interface RecordCallInput {
  apiKeyId: string
  userId: string
  model: string
  prompt: string
  response: string | null
  promptTokens: number
  completionTokens: number
  totalTokens: number
  latencyMs: number
  status: 'success' | 'error'
  errorMessage?: string | null
  conversationId?: string | null
  /** 额外 metadata(如 upstream_model / provider_code / key_pool_id) */
  metadata?: Record<string, unknown>
  /** 计费模式:'relay'=中转站(默认,平台扣全额含上游成本+加价) | 'byok'=BYOK(平台只收抽成,不碰大厂成本) */
  mode?: 'relay' | 'byok'
  /** BYOK 模式下的平台抽成率(0.10=10%),未传时由 getByokCommissionRate 兜底读取全局默认 */
  commissionRate?: number
  /** prompt cache 命中读取的 token 数(按 input price × 0.1 计费,OpenAI/Claude 标准) */
  cacheReadTokens?: number
  /** prompt cache 创建写入的 token 数(按 input price × 1.25 计费) */
  cacheCreationTokens?: number
  /** P0 中转站造血能力批次(2026-08-01):8 个审计/统计字段,写入 llm_call_logs 对应列 */
  /** 调用所用 API Key id(已存在于接口,这里仅声明会写入 api_key_id 列) */
  // apiKeyId 已在上方声明(必填,用于 developerApiKeys 余额扣减)
  /** 上游 provider 代码(如 'openai'/'anthropic'/'stepfun'),未传则不写入 */
  providerCode?: string
  /** 所用模型配置 id(关联 ai_model_config.id),未传则不写入 */
  configId?: string
  /** 所用 key 池条目 id(关联 ai_relay_key_pool.id),未传则不写入 */
  keyPoolId?: string
  /** 调用方 IP(支持 IPv4/IPv6),未传则不写入 */
  clientIp?: string
  /** 本次调用总成本(分),未传则用 calculateCost 的 totalCostCents 自动填充 */
  costCents?: number
  /** 上游 HTTP 状态码(如 200/429/500),未传则不写入 */
  httpStatus?: number
  /** Time To First Token 毫秒数(首 token 耗时,流式才有),未传则不写入 */
  ttftMs?: number
}

export interface RecordCallResult {
  logId: string
  costCents: number
  /** 扣减后的新余额(-1 = 无限,0 = 耗尽,>0 = 可用) */
  newTokenBalance: number
  newCostBalanceCents: number
  /** BYOK 模式:大厂上游原价(分,用户直接付给大厂,平台不碰) */
  upstreamCostCents?: number
  /** BYOK 模式:平台服务费(分,= upstreamCostCents × commissionRate,免费 provider 为 0) */
  platformFeeCents?: number
}

export interface CalculateCostResult {
  /** 输入 token 成本(分,不含 cache 部分) */
  inputCostCents: number
  /** 输出 token 成本(分) */
  outputCostCents: number
  /** 总成本(分,= input + cacheRead + cacheCreation + output) */
  totalCostCents: number
  /** prompt cache 命中读取成本(分,= cacheReadTokens × inputPrice × 0.1 × multiplier) */
  cacheReadCostCents: number
  /** prompt cache 创建写入成本(分,= cacheCreationTokens × inputPrice × 1.25 × multiplier) */
  cacheCreationCostCents: number
  /** 中转站定价倍率(1.0 = 原价) */
  multiplier: number
  /** 基础输入单价(分/千 token,来自 aiPricing 或 aiModelConfigModels 兜底) */
  baseInputPricePer1k: number
  /** 基础输出单价(分/千 token) */
  baseOutputPricePer1k: number
  /** 定价来源:'ai_pricing' | 'model_config' | 'default' */
  source: 'ai_pricing' | 'model_config' | 'default'
}

/** calculateCost 第 4 个参数:cache 折扣计费选项 */
export interface CalculateCostCacheOptions {
  /** prompt cache 命中读取的 token 数(按 input price × 0.1 计费) */
  cacheReadTokens?: number
  /** prompt cache 创建写入的 token 数(按 input price × 1.25 计费) */
  cacheCreationTokens?: number
}

// =============================================================================
// 1. checkQuota — 调用前检查 API Key 余额
// =============================================================================

/**
 * 调用前检查 API Key 余额是否允许调用。
 * estimatedTokens 用于预估是否够用(允许传入 0 = 不预检 token,只检查 Key 状态)。
 */
export async function checkQuota(apiKeyId: string, estimatedTokens = 0): Promise<CheckQuotaResult> {
  const [row] = await dbRead
    .select({
      id: developerApiKeys.id,
      userId: developerApiKeys.userId,
      status: developerApiKeys.status,
      tokenBalance: developerApiKeys.tokenBalance,
      costBalanceCents: developerApiKeys.costBalanceCents,
    })
    .from(developerApiKeys)
    .where(eq(developerApiKeys.id, apiKeyId))
    .limit(1)

  if (!row) {
    return {
      allowed: false,
      reason: 'key_not_found',
      apiKeyId,
      userId: '',
      tokenBalance: 0,
      costBalanceCents: 0,
    }
  }
  if (row.status !== 'active') {
    return {
      allowed: false,
      reason: 'key_revoked',
      apiKeyId: row.id,
      userId: row.userId,
      tokenBalance: row.tokenBalance,
      costBalanceCents: row.costBalanceCents,
    }
  }

  // === 组池余额检查(2026-08-01 立,API Key 分组)===
  // 若 Key 所属组存在且 enabled,检查组池余额(sharedTokenBalance / sharedCostBalanceCents)
  // 而非 Key 个人余额。无组则走下方个人余额逻辑(向后兼容)。
  const groupInfo = await getKeyGroup(row.id)
  if (groupInfo && groupInfo.enabled) {
    if (groupInfo.sharedTokenBalance === -1 && groupInfo.sharedCostBalanceCents === -1) {
      return {
        allowed: true,
        apiKeyId: row.id,
        userId: row.userId,
        tokenBalance: groupInfo.sharedTokenBalance,
        costBalanceCents: groupInfo.sharedCostBalanceCents,
      }
    }
    if (
      groupInfo.sharedTokenBalance !== -1 &&
      estimatedTokens > 0 &&
      groupInfo.sharedTokenBalance < estimatedTokens
    ) {
      return {
        allowed: false,
        reason: 'no_balance_token',
        apiKeyId: row.id,
        userId: row.userId,
        tokenBalance: groupInfo.sharedTokenBalance,
        costBalanceCents: groupInfo.sharedCostBalanceCents,
      }
    }
    if (groupInfo.sharedCostBalanceCents === 0) {
      return {
        allowed: false,
        reason: 'no_balance_cost',
        apiKeyId: row.id,
        userId: row.userId,
        tokenBalance: groupInfo.sharedTokenBalance,
        costBalanceCents: groupInfo.sharedCostBalanceCents,
      }
    }
    return {
      allowed: true,
      apiKeyId: row.id,
      userId: row.userId,
      tokenBalance: groupInfo.sharedTokenBalance,
      costBalanceCents: groupInfo.sharedCostBalanceCents,
    }
  }

  // === 个人余额检查(无组,维持原逻辑,向后兼容)===
  // -1 = 无限额度,直接放行
  if (row.tokenBalance === -1 && row.costBalanceCents === -1) {
    return {
      allowed: true,
      apiKeyId: row.id,
      userId: row.userId,
      tokenBalance: row.tokenBalance,
      costBalanceCents: row.costBalanceCents,
    }
  }

  // token 余额检查(仅当 estimatedTokens > 0 时预检)
  if (row.tokenBalance !== -1 && estimatedTokens > 0 && row.tokenBalance < estimatedTokens) {
    return {
      allowed: false,
      reason: 'no_balance_token',
      apiKeyId: row.id,
      userId: row.userId,
      tokenBalance: row.tokenBalance,
      costBalanceCents: row.costBalanceCents,
    }
  }

  // cost 余额检查(0 = 耗尽,>0 但无法预估单次成本时放行,由 recordCall 扣减时判定)
  if (row.costBalanceCents === 0) {
    return {
      allowed: false,
      reason: 'no_balance_cost',
      apiKeyId: row.id,
      userId: row.userId,
      tokenBalance: row.tokenBalance,
      costBalanceCents: row.costBalanceCents,
    }
  }

  return {
    allowed: true,
    apiKeyId: row.id,
    userId: row.userId,
    tokenBalance: row.tokenBalance,
    costBalanceCents: row.costBalanceCents,
  }
}

// =============================================================================
// 2. calculateCost — 按模型定价 × 中转站倍率计算成本
// =============================================================================

/**
 * 去 LiteLLM 自定义前缀(stepfun/agnes),返回 DB 中存储的原始 model_id。
 * 用于 calculateCost 查 ai_model_config_models.modelId 时去前缀。
 *
 * 注意:仅去除 stepfun/agnes 两个自定义前缀,保留 openai/ 等 LiteLLM 原生前缀。
 */
function stripLiteLLMPrefix(model: string): string {
  const slashIdx = model.indexOf('/')
  if (slashIdx > 0) {
    const prefix = model.slice(0, slashIdx)
    if (prefix === 'stepfun' || prefix === 'agnes') {
      return model.slice(slashIdx + 1)
    }
  }
  return model
}

/**
 * 计算单次调用成本(分)。
 *
 * 查找顺序:
 * 1. aiPricing 表(全局定价,WHERE modelId = ? AND 当前生效)
 * 2. aiModelConfigModels 表(模型配置兜底,WHERE modelId = ? AND isRelayPublic = true)
 * 3. 默认(0 成本,免费模型)
 *
 * 中转站倍率:从 aiModelConfigModels.relayPriceMultiplier 读取(默认 1.0)
 */
export async function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  options?: CalculateCostCacheOptions,
  userId?: string,
): Promise<CalculateCostResult> {
  // P0-5 修复(2026-07-30):去 LiteLLM 前缀(stepfun/agnes)再查 DB,
  // 因为 DB ai_model_config_models.model_id 存的是不带前缀的原始 model 名。
  const dbModelId = stripLiteLLMPrefix(model)

  // 1. 查 aiModelConfigModels 获取中转站倍率 + 兜底定价
  const [modelRow] = await dbRead
    .select({
      id: aiModelConfigModels.id,
      inputPricePer1k: aiModelConfigModels.inputPricePer1k,
      outputPricePer1k: aiModelConfigModels.outputPricePer1k,
      relayPriceMultiplier: aiModelConfigModels.relayPriceMultiplier,
      isRelayPublic: aiModelConfigModels.isRelayPublic,
    })
    .from(aiModelConfigModels)
    .where(eq(aiModelConfigModels.modelId, dbModelId))
    .limit(1)

  // 2. 查 aiPricing 获取全局定价(优先)
  const [pricingRow] = await dbRead
    .select({
      inputTokenPrice: aiPricing.inputTokenPrice,
      outputTokenPrice: aiPricing.outputTokenPrice,
    })
    .from(aiPricing)
    .where(
      and(
        eq(aiPricing.modelId, dbModelId),
        sql`${aiPricing.effectiveAt} <= now()`,
        sql`(${aiPricing.expiresAt} IS NULL OR ${aiPricing.expiresAt} > now())`,
      ),
    )
    .orderBy(desc(aiPricing.effectiveAt))
    .limit(1)

  // 解析倍率(字符串 numeric(10,4) → number,默认 1.0)
  let multiplier = modelRow?.relayPriceMultiplier
    ? Math.max(0, Number(modelRow.relayPriceMultiplier) || 1)
    : 1

  // 用户计费分组倍率(2026-08-01 立):userId 传入时查分组倍率并叠加
  // 中转站倍率 × 用户分组倍率 = 实际计费倍率(如 svip 组 gpt-4o = 1.0 × 0.8 = 0.8)
  if (userId) {
    const groupMultiplier = await getUserModelMultiplier(userId, model)
    multiplier *= groupMultiplier
  }

  // 阶梯计价倍率(2026-08-01 立):userId 传入时查当月阶梯倍率并叠加
  // 中转站倍率 × 用户分组倍率 × 阶梯倍率 = 实际计费倍率(如 gpt-4o 月用 200 万 = 1.0 × 1.0 × 0.9 = 0.9)
  if (userId) {
    const tier = await getCurrentTierMultiplier(userId, dbModelId)
    multiplier *= tier.multiplier
  }

  let baseInputPricePer1k = 0
  let baseOutputPricePer1k = 0
  let source: CalculateCostResult['source'] = 'default'

  if (pricingRow) {
    baseInputPricePer1k = pricingRow.inputTokenPrice
    baseOutputPricePer1k = pricingRow.outputTokenPrice
    source = 'ai_pricing'
  } else if (modelRow) {
    baseInputPricePer1k = modelRow.inputPricePer1k ?? 0
    baseOutputPricePer1k = modelRow.outputPricePer1k ?? 0
    source = 'model_config'
  }

  // 成本 = (inputPrice × promptTokens/1000 + outputPrice × completionTokens/1000) × multiplier
  // 单位:分(整数,Math.round 四舍五入避免浮点)
  //
  // prompt cache 折扣计费(2026-07-31 立,OpenAI/Claude 标准):
  //   - cacheReadTokens:按 input price × 0.1 计费(10% 折扣,命中已缓存的 prompt)
  //   - cacheCreationTokens:按 input price × 1.25 计费(25% 加价,首次写入缓存)
  //   - 普通 input tokens = promptTokens - cacheReadTokens - cacheCreationTokens(按原价)
  //
  // 边界保护:cacheReadTokens + cacheCreationTokens > promptTokens 时 clamp 到 promptTokens
  // (异常输入防止负数普通 input tokens)
  const rawCacheReadTokens = Math.max(0, options?.cacheReadTokens ?? 0)
  const rawCacheCreationTokens = Math.max(0, options?.cacheCreationTokens ?? 0)
  const cacheReadTokens = Math.min(rawCacheReadTokens, promptTokens)
  const cacheCreationTokens = Math.min(
    rawCacheCreationTokens,
    Math.max(0, promptTokens - cacheReadTokens),
  )
  const normalInputTokens = Math.max(0, promptTokens - cacheReadTokens - cacheCreationTokens)

  const rawNormalInputCost = (baseInputPricePer1k * normalInputTokens) / 1000
  const rawCacheReadCost = (baseInputPricePer1k * cacheReadTokens * 0.1) / 1000
  const rawCacheCreationCost = (baseInputPricePer1k * cacheCreationTokens * 1.25) / 1000
  const rawOutputCost = (baseOutputPricePer1k * completionTokens) / 1000
  const inputCostCents = Math.round(rawNormalInputCost * multiplier)
  const cacheReadCostCents = Math.round(rawCacheReadCost * multiplier)
  const cacheCreationCostCents = Math.round(rawCacheCreationCost * multiplier)
  const outputCostCents = Math.round(rawOutputCost * multiplier)
  const totalCostCents =
    inputCostCents + cacheReadCostCents + cacheCreationCostCents + outputCostCents

  return {
    inputCostCents,
    outputCostCents,
    totalCostCents,
    cacheReadCostCents,
    cacheCreationCostCents,
    multiplier,
    baseInputPricePer1k,
    baseOutputPricePer1k,
    source,
  }
}

// =============================================================================
// 2b. BYOK 平台模式计费(2026-07-30 立)
// =============================================================================
// 用户用自己的 API Key 调用大厂模型,大厂直接扣用户账户,平台只收服务费(上游原价 × 抽成率)。
// 免费 provider(cloudflare/huggingface/pollinations 等)平台不抽成。
// =============================================================================

/**
 * 免费 provider 前缀清单(平台对 BYOK 调用不抽成)。
 * 来源:ai-service 侧 llm_gateway.py 中标注为免费/无需 API Key 的 provider。
 */
const FREE_PROVIDER_PREFIXES = [
  'cloudflare/',
  '@cf/',
  'github/',
  'huggingface/',
  'pollinations/',
  'llm7/',
  'ovh/',
  'aihorde/',
  'reka/',
  'routeway/',
  'bazaarlink/',
  'ainative/',
  'opencode/',
  'vercel/',
  'modal/',
  'inferencenet/',
  'nlpcloud/',
  'scaleway/',
  'alibaba-intl/',
]

/**
 * 判断模型是否属于免费 provider(平台对 BYOK 调用不抽成)。
 * 匹配规则:model 名前缀命中 FREE_PROVIDER_PREFIXES 任一项。
 */
export function isFreeProvider(model: string): boolean {
  const m = model.toLowerCase()
  return FREE_PROVIDER_PREFIXES.some((p) => m.startsWith(p))
}

/**
 * 模型名 → provider_code 映射(与 ai-service 侧 llm_gateway.py 的 _model_to_provider_code 一致)。
 * 用于 BYOK 模式下查 ai_model_config 中用户私有配置/全局抽成率,
 * 以及写入 llm_call_logs.provider_code 审计字段。
 * 只覆盖主要厂商,未命中默认 'openai'。
 */
export function modelToProviderCode(model: string): string {
  const m = model.toLowerCase()
  const prefixMap: Record<string, string> = {
    'byok/': 'byok',
    'siliconflow-byok/': 'siliconflow-byok',
    'stepfun/': 'stepfun',
    'agnes/': 'agnes',
    'deepseek-': 'deepseek',
    'glm-': 'zhipu',
    qwen: 'alibaba',
    'moonshot-': 'moonshot',
    'kimi-': 'moonshot',
    'doubao-': 'bytedance',
    'gpt-': 'openai',
    'o1-': 'openai',
    'o3-': 'openai',
    'o4-': 'openai',
    'claude-': 'anthropic',
    'gemini-': 'google',
    'groq/': 'groq',
    'openrouter/': 'openrouter',
  }
  for (const [prefix, code] of Object.entries(prefixMap)) {
    if (m.startsWith(prefix)) return code
  }
  return 'openai'
}

/** BYOK 成本计算结果 */
export interface ByokCostResult {
  /** 大厂上游原价(分,用户直接付给大厂,平台不碰) */
  upstreamCostCents: number
  /** 平台服务费(分,= upstreamCostCents × commissionRate,免费 provider 为 0) */
  platformFeeCents: number
  /** 抽成率(0.10=10%) */
  commissionRate: number
  /** 基础输入单价(分/千 token) */
  baseInputPricePer1k: number
  /** 基础输出单价(分/千 token) */
  baseOutputPricePer1k: number
  /** 定价来源:'ai_pricing' | 'model_config' | 'default' */
  source: 'ai_pricing' | 'model_config' | 'default'
  /** 是否免费 provider */
  isFree: boolean
}

/**
 * 计算 BYOK 调用成本(分)。
 *
 * 复用 calculateCost 的定价查询逻辑(aiPricing 优先 → aiModelConfigModels 兜底 → 默认 0),
 * 但**不乘中转站倍率**(BYOK 模式用户用自己的 key,平台不参与上游定价)。
 *
 * - upstreamCostCents = Math.round(baseInput × promptTokens/1000 + baseOutput × completionTokens/1000)
 * - isFree = isFreeProvider(model)
 * - platformFeeCents = isFree ? 0 : Math.round(upstreamCostCents × commissionRate)
 */
export async function calculateByokCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  commissionRate: number,
): Promise<ByokCostResult> {
  const dbModelId = stripLiteLLMPrefix(model)

  const [modelRow] = await dbRead
    .select({
      inputPricePer1k: aiModelConfigModels.inputPricePer1k,
      outputPricePer1k: aiModelConfigModels.outputPricePer1k,
    })
    .from(aiModelConfigModels)
    .where(eq(aiModelConfigModels.modelId, dbModelId))
    .limit(1)

  const [pricingRow] = await dbRead
    .select({
      inputTokenPrice: aiPricing.inputTokenPrice,
      outputTokenPrice: aiPricing.outputTokenPrice,
    })
    .from(aiPricing)
    .where(
      and(
        eq(aiPricing.modelId, dbModelId),
        sql`${aiPricing.effectiveAt} <= now()`,
        sql`(${aiPricing.expiresAt} IS NULL OR ${aiPricing.expiresAt} > now())`,
      ),
    )
    .orderBy(desc(aiPricing.effectiveAt))
    .limit(1)

  let baseInputPricePer1k = 0
  let baseOutputPricePer1k = 0
  let source: ByokCostResult['source'] = 'default'

  if (pricingRow) {
    baseInputPricePer1k = pricingRow.inputTokenPrice
    baseOutputPricePer1k = pricingRow.outputTokenPrice
    source = 'ai_pricing'
  } else if (modelRow) {
    baseInputPricePer1k = modelRow.inputPricePer1k ?? 0
    baseOutputPricePer1k = modelRow.outputPricePer1k ?? 0
    source = 'model_config'
  }

  const upstreamCostCents = Math.round(
    (baseInputPricePer1k * promptTokens) / 1000 + (baseOutputPricePer1k * completionTokens) / 1000,
  )
  const isFree = isFreeProvider(model)
  const platformFeeCents = isFree ? 0 : Math.round(upstreamCostCents * commissionRate)

  return {
    upstreamCostCents,
    platformFeeCents,
    commissionRate,
    baseInputPricePer1k,
    baseOutputPricePer1k,
    source,
    isFree,
  }
}

/**
 * 判断指定用户对模型是否走 BYOK 模式。
 * 查 ai_model_config WHERE owner_uuid = userId AND provider_code = modelToProviderCode(model) AND enabled = true,
 * 返回是否有用户私有配置(有 = BYOK 模式,无 = 中转站模式)。
 */
export async function isByokCall(userId: string, model: string): Promise<boolean> {
  const providerCode = modelToProviderCode(model)
  const [row] = await dbRead
    .select({ id: aiModelConfig.id })
    .from(aiModelConfig)
    .where(
      and(
        eq(aiModelConfig.ownerUuid, userId),
        eq(aiModelConfig.providerCode, providerCode),
        eq(aiModelConfig.enabled, true),
      ),
    )
    .limit(1)
  return !!row
}

/**
 * 查询指定 provider 的 BYOK 平台默认抽成率(从 ai_model_config 全局配置行)。
 * WHERE provider_code = ? AND owner_uuid IS NULL AND enabled = true
 * 默认 0.10(10%)。
 */
export async function getByokCommissionRate(providerCode: string): Promise<number> {
  const [row] = await dbRead
    .select({ rate: aiModelConfig.byokCommissionRate })
    .from(aiModelConfig)
    .where(
      and(
        eq(aiModelConfig.providerCode, providerCode),
        isNull(aiModelConfig.ownerUuid),
        eq(aiModelConfig.enabled, true),
      ),
    )
    .limit(1)
  if (!row?.rate) return 0.1
  const n = Number(row.rate)
  return Number.isFinite(n) && n >= 0 ? n : 0.1
}

// =============================================================================
// 3. recordCall — 调用后写入 llm_call_logs + 扣减 API Key 余额
// =============================================================================

/**
 * 调用后记录流水 + 扣减余额 + 累计已用统计。
 *
 * 幂等性:llm_call_logs 每次 call 写一行(无去重),developerApiKeys 余额原子扣减。
 * 失败容错:写流水失败不抛错(只 log),扣减失败也不抛错(避免影响已返回给用户的响应)。
 */
export async function recordCall(input: RecordCallInput): Promise<RecordCallResult> {
  // 1. 计算成本(区分 mode:'relay' 中转站 / 'byok' BYOK 平台模式)
  const mode = input.mode ?? 'relay'

  // P0 第二批次(2026-07-31 立):响应缓存命中时成本为 0(未调用上游,无大厂成本)
  // metadata.cacheHit === true 时跳过成本计算,只记录流水(供统计缓存节省金额)
  const isCacheHit = input.metadata?.cacheHit === true

  // 中转站模式:全额成本(上游 × 中转站倍率),平台扣全额
  // BYOK 模式:平台只收 platformFeeCents(上游原价 × 抽成率),不碰大厂成本 upstreamCostCents
  let costCentsToDeduct: number
  let multiplier = 1
  let pricingSource: 'ai_pricing' | 'model_config' | 'default' = 'default'
  let upstreamCostCents: number | undefined
  let platformFeeCents: number | undefined
  let commissionRate: number | undefined

  if (isCacheHit) {
    // 缓存命中:成本为 0,不扣减余额,只记录流水供统计
    costCentsToDeduct = 0
    pricingSource = 'default'
  } else if (mode === 'byok') {
    // BYOK:抽成率优先用入参,否则查全局默认
    const providerCode = modelToProviderCode(input.model)
    const rate = input.commissionRate ?? (await getByokCommissionRate(providerCode))
    const byokCost = await calculateByokCost(
      input.model,
      input.promptTokens,
      input.completionTokens,
      rate,
    )
    costCentsToDeduct = byokCost.platformFeeCents
    pricingSource = byokCost.source
    upstreamCostCents = byokCost.upstreamCostCents
    platformFeeCents = byokCost.platformFeeCents
    commissionRate = rate
  } else {
    // 中转站(默认)
    const cost = await calculateCost(
      input.model,
      input.promptTokens,
      input.completionTokens,
      {
        cacheReadTokens: input.cacheReadTokens,
        cacheCreationTokens: input.cacheCreationTokens,
      },
      input.userId,
    )
    costCentsToDeduct = cost.totalCostCents
    multiplier = cost.multiplier
    pricingSource = cost.source
  }

  // 2. 写 llm_call_logs(prompt 截断 5000 字符防止超大字段)
  const truncatedPrompt =
    input.prompt.length > 5000 ? input.prompt.slice(0, 5000) + '...[truncated]' : input.prompt
  const truncatedResponse =
    input.response && input.response.length > 5000
      ? input.response.slice(0, 5000) + '...[truncated]'
      : (input.response ?? '')

  const metadata: Record<string, unknown> = {
    multiplier,
    pricingSource,
    ...(input.metadata ?? {}),
  }
  if (mode === 'byok') {
    metadata.byokMode = true
    metadata.upstreamCostCents = upstreamCostCents
    metadata.platformFeeCents = platformFeeCents
    metadata.commissionRate = commissionRate
  }

  // P0 中转站造血能力批次(2026-08-01):8 个审计/统计字段写入顶层列
  // apiKeyId/costCents 从 metadata 迁移到顶层列(支持索引聚合查询)
  // costCents:未传则用 calculateCost 的 totalCostCents(costCentsToDeduct)自动填充
  const [logRow] = await db
    .insert(llmCallLogs)
    .values({
      userId: input.userId,
      model: input.model,
      prompt: truncatedPrompt,
      response: truncatedResponse,
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.totalTokens,
      cacheReadTokens: input.cacheReadTokens ?? 0,
      cacheCreationTokens: input.cacheCreationTokens ?? 0,
      latencyMs: input.latencyMs,
      status: input.status,
      errorMessage: input.errorMessage ?? null,
      conversationId: input.conversationId ?? null,
      metadata,
      apiKeyId: input.apiKeyId,
      providerCode: input.providerCode ?? null,
      configId: input.configId ?? null,
      keyPoolId: input.keyPoolId ?? null,
      clientIp: input.clientIp ?? null,
      costCents: input.costCents ?? costCentsToDeduct,
      httpStatus: input.httpStatus ?? null,
      ttftMs: input.ttftMs ?? null,
    })
    .returning({ id: llmCallLogs.id })

  // 3. 扣减余额 + 累计已用统计(原子操作)
  // 2026-08-01 立:若 Key 所属组存在且 enabled,扣组池(sharedTokenBalance / sharedCostBalanceCents)
  // 无组则扣 Key 个人余额(向后兼容)
  // tokenBalance/costBalanceCents = -1 时不扣减(无限额度),只累加统计
  // BYOK 模式:costBalanceCents 只扣 platformFeeCents(不扣大厂成本 upstreamCostCents)
  let newTokenBalance = -1
  let newCostBalanceCents = -1

  const groupInfoForDeduct = await getKeyGroup(input.apiKeyId)
  if (groupInfoForDeduct && groupInfoForDeduct.enabled) {
    // === 扣组池(2026-08-01 立)===
    const [groupRow] = await dbRead
      .select({
        sharedTokenBalance: apiKeyGroups.sharedTokenBalance,
        sharedCostBalanceCents: apiKeyGroups.sharedCostBalanceCents,
      })
      .from(apiKeyGroups)
      .where(eq(apiKeyGroups.id, groupInfoForDeduct.groupId))
      .limit(1)

    newTokenBalance = groupRow?.sharedTokenBalance ?? -1
    newCostBalanceCents = groupRow?.sharedCostBalanceCents ?? -1

    if (groupRow) {
      const groupSetClause: Record<string, unknown> = { updatedAt: new Date() }

      if (groupRow.sharedTokenBalance === -1) {
        newTokenBalance = -1
      } else {
        newTokenBalance = Math.max(0, groupRow.sharedTokenBalance - input.totalTokens)
        groupSetClause.sharedTokenBalance = newTokenBalance
      }

      if (groupRow.sharedCostBalanceCents === -1) {
        newCostBalanceCents = -1
      } else {
        newCostBalanceCents = Math.max(0, groupRow.sharedCostBalanceCents - costCentsToDeduct)
        groupSetClause.sharedCostBalanceCents = newCostBalanceCents
      }

      await db
        .update(apiKeyGroups)
        .set(groupSetClause)
        .where(eq(apiKeyGroups.id, groupInfoForDeduct.groupId))
        .catch(() => {
          // 扣减失败不抛错(避免影响已返回给用户的响应)
        })
    }

    // 同时累加 Key 个人统计(tokenUsedTotal / costUsedTotalCents,用于组内用量排行)
    await db
      .update(developerApiKeys)
      .set({
        tokenUsedTotal: sql`${developerApiKeys.tokenUsedTotal} + ${input.totalTokens}`,
        costUsedTotalCents: sql`${developerApiKeys.costUsedTotalCents} + ${costCentsToDeduct}`,
        updatedAt: new Date(),
      })
      .where(eq(developerApiKeys.id, input.apiKeyId))
      .catch(() => {
        // 统计累加失败不影响主链路
      })
  } else {
    // === 扣个人余额(无组,维持原逻辑,向后兼容)===
    const [apiKeyRow] = await dbRead
      .select({
        tokenBalance: developerApiKeys.tokenBalance,
        costBalanceCents: developerApiKeys.costBalanceCents,
      })
      .from(developerApiKeys)
      .where(eq(developerApiKeys.id, input.apiKeyId))
      .limit(1)

    newTokenBalance = apiKeyRow?.tokenBalance ?? -1
    newCostBalanceCents = apiKeyRow?.costBalanceCents ?? -1

    if (apiKeyRow) {
      // 计算扣减后的值(不直接用 SQL 扣减,避免 -1 被误减)
      const setClause: Record<string, unknown> = { updatedAt: new Date() }

      if (apiKeyRow.tokenBalance === -1) {
        // 无限额度,不扣减 token 余额
        newTokenBalance = -1
      } else {
        newTokenBalance = Math.max(0, apiKeyRow.tokenBalance - input.totalTokens)
        setClause.tokenBalance = newTokenBalance
      }

      if (apiKeyRow.costBalanceCents === -1) {
        // 无限额度,不扣减成本余额
        newCostBalanceCents = -1
      } else {
        newCostBalanceCents = Math.max(0, apiKeyRow.costBalanceCents - costCentsToDeduct)
        setClause.costBalanceCents = newCostBalanceCents
      }

      // 累计已用统计(总是累加,即使余额无限)
      setClause.tokenUsedTotal = sql`${developerApiKeys.tokenUsedTotal} + ${input.totalTokens}`
      setClause.costUsedTotalCents = sql`${developerApiKeys.costUsedTotalCents} + ${costCentsToDeduct}`

      await db
        .update(developerApiKeys)
        .set(setClause)
        .where(eq(developerApiKeys.id, input.apiKeyId))
        .catch(() => {
          // 扣减失败不抛错,只 log(避免影响已返回给用户的响应)
        })
    }
  }

  // 4. 异步触发 relay 返佣(2026-07-31 立,被邀请人消费 → 邀请人返佣)
  // 不阻塞主链路,失败不影响已返回给用户的响应;BYOK 模式也触发(基于 platformFeeCents 返佣)
  const relayLogId = logRow?.id
  if (costCentsToDeduct > 0 && relayLogId) {
    setImmediate(() => {
      recordRelayCommission({
        sourceUserId: input.userId,
        sourceCallLogId: relayLogId,
        sourceCostCents: costCentsToDeduct,
      }).catch(() => {
        // 返佣失败不影响主链路(只 log,不抛错)
      })
    })
  }

  // 5. 异步触发 relay webhook 通知(2026-08-01 立,扣费后通知订阅方)
  // 事件:relay.call.completed(success)/ relay.call.failed(error)/ relay.balance.low(余额不足)
  // 不阻塞主链路,失败只忽略;余额判断排除 -1(无限额度)避免误触发
  if (relayLogId) {
    setImmediate(() => {
      notifyRelayEvent({
        userId: input.userId,
        event: input.status === 'success' ? 'relay.call.completed' : 'relay.call.failed',
        payload: {
          callLogId: relayLogId,
          model: input.model,
          costCents: costCentsToDeduct,
          status: input.status,
          errorMessage: input.errorMessage ?? null,
        },
      }).catch(() => {
        // webhook 通知失败不影响主链路
      })
      // 余额检查:token 余额耗尽 或 cost 余额低于 1000 分(10 元)且非无限额度
      if (newTokenBalance === 0 || (newCostBalanceCents !== -1 && newCostBalanceCents < 1000)) {
        notifyRelayEvent({
          userId: input.userId,
          event: 'relay.balance.low',
          payload: {
            tokenBalance: newTokenBalance,
            costBalanceCents: newCostBalanceCents,
          },
        }).catch(() => {
          // 余额告警通知失败不影响主链路
        })
      }
    })
  }

  return {
    logId: logRow?.id ?? '',
    costCents: costCentsToDeduct,
    newTokenBalance,
    newCostBalanceCents,
    ...(mode === 'byok' ? { upstreamCostCents, platformFeeCents } : {}),
  }
}

// =============================================================================
// 4. 辅助:更新 API Key 余额(admin 充值 / 用户充值时调用)
// =============================================================================

/**
 * 增加 API Key 余额(充值)。
 * amount > 0 增加,< 0 扣减(允许负数扣减但不低于 0,除非 -1 无限额度)。
 * 返回更新后的余额。
 */
export async function adjustBalance(
  apiKeyId: string,
  tokenDelta: number,
  costDeltaCents: number,
): Promise<{ tokenBalance: number; costBalanceCents: number } | null> {
  const [existing] = await dbRead
    .select({
      tokenBalance: developerApiKeys.tokenBalance,
      costBalanceCents: developerApiKeys.costBalanceCents,
    })
    .from(developerApiKeys)
    .where(eq(developerApiKeys.id, apiKeyId))
    .limit(1)
  if (!existing) return null

  const setClause: Record<string, unknown> = { updatedAt: new Date() }

  // token 余额:-1 保持无限,否则累加(不低于 0)
  if (existing.tokenBalance === -1) {
    // 无限额度,不修改
  } else {
    const newTokenBalance = Math.max(0, existing.tokenBalance + tokenDelta)
    setClause.tokenBalance = newTokenBalance
  }

  // cost 余额:同上
  if (existing.costBalanceCents === -1) {
    // 无限额度,不修改
  } else {
    const newCostBalanceCents = Math.max(0, existing.costBalanceCents + costDeltaCents)
    setClause.costBalanceCents = newCostBalanceCents
  }

  const [updated] = await db
    .update(developerApiKeys)
    .set(setClause)
    .where(eq(developerApiKeys.id, apiKeyId))
    .returning({
      tokenBalance: developerApiKeys.tokenBalance,
      costBalanceCents: developerApiKeys.costBalanceCents,
    })

  return updated
    ? { tokenBalance: updated.tokenBalance, costBalanceCents: updated.costBalanceCents }
    : null
}

// =============================================================================
// 5. rechargeByKey — 兑换码充值(2026-07-31 立,P0-5 刮刮卡式裂变充值配套)
// =============================================================================

/**
 * 给指定 API Key 充值 token 余额(2026-07-31 立,P0-5 兑换码充值用)。
 *
 * - apiKeyId: 用户当前活跃 Key
 * - tokenAmount: 充值 token 数(必须 > 0)
 * - 若 tokenBalance = -1(无限额度)→ 不操作,直接返回 -1
 * - 若 tokenBalance = 0 或 >0 → 增加 tokenAmount
 * - 原子操作:用 SQL CASE WHEN 在数据库层处理 -1 分支,避免读改写竞态
 *
 * 返回更新后的 tokenBalance;Key 不存在 → 返回 null。
 */
export async function rechargeByKey(
  apiKeyId: string,
  tokenAmount: number,
): Promise<{ newTokenBalance: number } | null> {
  if (tokenAmount <= 0) {
    // 无效充值金额,直接读当前余额返回(不写库)
    const [row] = await dbRead
      .select({ tokenBalance: developerApiKeys.tokenBalance })
      .from(developerApiKeys)
      .where(eq(developerApiKeys.id, apiKeyId))
      .limit(1)
    return row ? { newTokenBalance: row.tokenBalance } : null
  }

  const [updated] = await db
    .update(developerApiKeys)
    .set({
      // -1(无限额度)保持 -1,否则累加 tokenAmount
      tokenBalance: sql`CASE WHEN ${developerApiKeys.tokenBalance} = -1 THEN -1 ELSE ${developerApiKeys.tokenBalance} + ${tokenAmount} END`,
      updatedAt: new Date(),
    })
    .where(eq(developerApiKeys.id, apiKeyId))
    .returning({ tokenBalance: developerApiKeys.tokenBalance })

  return updated ? { newTokenBalance: updated.tokenBalance } : null
}
