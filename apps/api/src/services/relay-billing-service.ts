// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { logger } from '../utils/logger.js'
import {
  developerApiKeys,
  llmCallLogs,
  aiPricing,
  aiModelConfigModels,
  aiModelConfig,
  userMargins,
  tokenFlows,
} from '@ihui/database'
import { getCurrentTierMultiplier } from './tiered-pricing-service.js'
// 分时(高峰/低谷)倍率(2026-09-16 立):命中规则时作为倍率链最后一环叠加,无规则 = 1
import { resolvePeakMultiplier } from './peak-pricing-service.js'
// API 订阅窗口配额(2026-09-16 立):订阅用户除 Key 余额外,还受日/周/月窗口额度约束
import {
  checkSubscriptionWindowQuota,
  consumeSubscriptionWindowUsage,
} from './subscription-window-service.js'
// Key 级限流窗口 + IP ACL(B/C,2026-09-16 立)
import { checkKeyRateWindows, incrKeyRateWindows } from './key-rate-window-service.js'
// 余额不足邮件通知(E,2026-09-16 立)
import { checkAndNotifyLowBalance } from './mail-relay-notifier.js'
// Relay 返佣(2026-07-31 立,扣费后异步触发,失败不影响主链路)
import { recordRelayCommission } from './relay-commission-service.js'
import { getUserModelMultiplier } from './user-billing-group-service.js'
// 模型名官方归一(2026-09-13 立):计费键空间与 DB 归一后的 model_id 对齐
import { normalizeModelId } from '@ihui/shared'
// Relay Webhook 通知(2026-08-01 立,扣费后异步触发 relay.call.completed/failed/balance.low 事件)
import { notifyRelayEvent } from './webhook-relay-notifier.js'
// API Key 分组(2026-08-01 立,组池余额检查/扣减)
import { getKeyGroup } from './api-key-group-service.js'
// O5 原文留存(2026-09-21):写入口侧的"按 key 关闭原文留存"判定,纯函数、无副作用。
import { buildRawTextColumns } from './audit-log-service.js'
import { apiKeyGroups } from '@ihui/database'

// =============================================================================
// 类型定义
// =============================================================================

export interface CheckQuotaResult {
  allowed: boolean
  reason?:
    | 'no_balance_token'
    | 'no_balance_cost'
    | 'key_not_found'
    | 'key_revoked'
    | 'subscription_window_exceeded'
    | 'ip_blocked'
    | 'ip_not_allowed'
    | 'key_rate_window_exceeded'
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
  /** 所用模型配置 id(关联 ai_model_config.id,bigserial 主键),未传则不写入 */
  configId?: number
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
  /**
   * 调用类型(2026-09-13 多模态计费):chat(默认)|image|video。
   * 写入 llm_call_logs.call_type,并驱动 calculateCost 的多模态计费分支。
   */
  callType?: 'chat' | 'image' | 'video'
  /** 多模态计费单位数:image=张数(默认 1);video=次数或秒数(按定价行 videoUnit,默认 1) */
  billingUnits?: number
  /**
   * 两段式计费(2026-09-12 立):调用前 preDeductQuota 的预扣凭证。
   * 传入时:recordCall 不再全额扣减余额(预扣已发生),只累计统计并在结尾调用
   * settlePreDeduction 按实际用量「补差价 / 退差额」,保证总扣减 = 实际用量。
   */
  preDeducted?: PreDeduction | null
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
  /** 定价来源:'ai_pricing' | 'model_config' | 'default' | 'unavailable'(计费熔断降级) */
  source: 'ai_pricing' | 'model_config' | 'default' | 'unavailable'
  /** 计费模式(2026-09-13):token | per_call | per_image | per_video(无定价时 'token') */
  billingMode: 'token' | 'per_call' | 'per_image' | 'per_video'
  /** 多模态计费单位数(张/次/秒;token 模式为 0) */
  unitsApplied: number
  /** per_call 命中档位(仅 per_call 有值) */
  callTier?: 'le256k' | 'mid' | 'gt512k'
  /**
   * 分时(高峰/低谷)倍率(2026-09-16 立):命中规则时的倍率因子,未命中为 1。
   * 注意 multiplier 字段是四段倍率连乘后的总值(中转站 × 分组 × 阶梯 × 分时),
   * 本字段单独暴露分时段因子,便于日志与账单归因。
   */
  peakMultiplier?: number
}

/** calculateCost 第 4 个参数:cache 折扣计费选项 + 多模态计费选项(2026-09-13) */
export interface CalculateCostCacheOptions {
  /** prompt cache 命中读取的 token 数(按 input price × 0.1 计费) */
  cacheReadTokens?: number
  /** prompt cache 创建写入的 token 数(按 input price × 1.25 计费) */
  cacheCreationTokens?: number
  /**
   * 调用类型(2026-09-13 多模态计费):chat(默认)|image|video。
   * 定价行 billingMode 与之匹配时走按次/按张/按视频分支:
   *   per_image → perUnitPrice × units(张数)
   *   per_video → perUnitPrice × units(videoUnit='second' 按秒,'call' 按次)
   *   per_call  → tieredCallPrices 按 promptTokens 分档(≤256K/≤512K/>512K),chat 专用
   */
  callType?: 'chat' | 'image' | 'video'
  /** 多模态计费单位数:image=张数;video=次数或秒数(默认 1) */
  units?: number
}

/** per_call 上下文分档阈值(与上游报价页对齐):256K=262144,512K=524288 */
const PER_CALL_TIER_LE256K = 262144
const PER_CALL_TIER_LE512K = 524288

/**
 * 金额(分)保留 6 位小数(2026-09-13)。
 * 根因修复:cost 类列已 integer→numeric(18,6);低价计费(按次 0.01 分/次、
 * token 0.0105 分/千 × 短对话)在 Math.round 整数取整下恒为 0,形成免费敞口。
 * 6 位小数 = 百万分之一分,远小于任何计费粒度,同时消除浮点噪声。
 */
export const roundCents = (value: number): number => Math.round(value * 1e6) / 1e6

/** per_call 三档价 jsonb 形状(分/次) */
export interface TieredCallPrices {
  le256k: number
  mid: number
  gt512k: number
}

/** 按 promptTokens 选 per_call 档位价;三档缺失时逐级回退(缺失档按最低非空档)。 */
export function pickPerCallPrice(
  tiered: unknown,
  promptTokens: number,
): { price: number; tier: 'le256k' | 'mid' | 'gt512k' } | null {
  if (!tiered || typeof tiered !== 'object') return null
  const t = tiered as Partial<TieredCallPrices>
  const tier =
    promptTokens <= PER_CALL_TIER_LE256K
      ? ('le256k' as const)
      : promptTokens <= PER_CALL_TIER_LE512K
        ? ('mid' as const)
        : ('gt512k' as const)
  const order: Array<'le256k' | 'mid' | 'gt512k'> = ['le256k', 'mid', 'gt512k']
  // 首选本档;缺失时回退到最低非空档(保守少收),全空才返回 null
  for (const key of [tier, ...order]) {
    const v = t[key]
    if (typeof v === 'number' && v > 0) return { price: v, tier: key === tier ? tier : key }
  }
  return null
}

// =============================================================================
// IP ACL 匹配纯函数(C,2026-09-19 立):精确 / IPv4 前缀通配 / CIDR
// =============================================================================

/**
 * 解析 IPv4 点分十进制为 uint32;非法输入(段数不对/段>255/非数字)返回 null。
 * 仅支持 IPv4(IPv6 地址解析为 null,规则安全跳过不匹配)。
 */
export function parseIPv4(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let out = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const v = Number(part)
    if (v > 255) return null
    out = out * 256 + v
  }
  return out >>> 0
}

/**
 * 判断 IPv4 是否落在 CIDR 网段内(如 '192.168.1.0/24')。
 * prefix=0(如 0.0.0.0/0)恒真;无 '/' / 非法 IP / 非法前缀返回 false(安全跳过该规则)。
 */
export function ipInCidr(ip: string, cidr: string): boolean {
  const slash = cidr.indexOf('/')
  if (slash === -1) return false
  const base = parseIPv4(cidr.slice(0, slash))
  const ipInt = parseIPv4(ip)
  if (base === null || ipInt === null) return false
  const prefixStr = cidr.slice(slash + 1)
  if (!/^\d{1,2}$/.test(prefixStr)) return false
  const prefix = Number(prefixStr)
  if (prefix > 32) return false
  if (prefix === 0) return true
  const mask = (0xffffffff << (32 - prefix)) >>> 0
  return (ipInt & mask) === (base & mask)
}

// =============================================================================
// 1. checkQuota — 调用前检查 API Key 余额
// =============================================================================

/**
 * 调用前检查 API Key 余额是否允许调用。
 * estimatedTokens 用于预估是否够用(允许传入 0 = 不预检 token,只检查 Key 状态)。
 */
export async function checkQuota(
  apiKeyId: string,
  estimatedTokens = 0,
  options?: { clientIp?: string },
): Promise<CheckQuotaResult> {
  const [row] = await dbRead
    .select({
      id: developerApiKeys.id,
      userId: developerApiKeys.userId,
      status: developerApiKeys.status,
      tokenBalance: developerApiKeys.tokenBalance,
      costBalanceCents: developerApiKeys.costBalanceCents,
      // IP ACL + 限流窗口(B/C,2026-09-16 立)
      allowedIps: developerApiKeys.allowedIps,
      blockedIps: developerApiKeys.blockedIps,
      rateLimit5h: developerApiKeys.rateLimit5h,
      rateLimit1d: developerApiKeys.rateLimit1d,
      rateLimit7d: developerApiKeys.rateLimit7d,
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

  // === IP ACL 运行时校验(C,2026-09-16 立):此前 allowedIps 只存取不校验 ===
  // 黑名单优先(命中 403);白名单存在且非空时,不在名单内即拒。
  // 匹配:精确 IP、IPv4 前缀通配('192.168.*')或 CIDR('192.168.1.0/24')(2026-09-19 补 CIDR)。
  const clientIp = options?.clientIp
  if (clientIp) {
    const ipMatches = (rule: string): boolean =>
      rule === clientIp ||
      (rule.endsWith('.*') && clientIp.startsWith(rule.slice(0, -1))) ||
      ipInCidr(clientIp, rule)
    const blockedList = Array.isArray(row.blockedIps) ? (row.blockedIps as unknown[]) : []
    if (blockedList.some((b) => typeof b === 'string' && ipMatches(b))) {
      return {
        allowed: false,
        reason: 'ip_blocked',
        apiKeyId: row.id,
        userId: row.userId,
        tokenBalance: row.tokenBalance,
        costBalanceCents: row.costBalanceCents,
      }
    }
    const allowedList = Array.isArray(row.allowedIps) ? (row.allowedIps as unknown[]) : []
    if (allowedList.length > 0 && !allowedList.some((a) => typeof a === 'string' && ipMatches(a))) {
      return {
        allowed: false,
        reason: 'ip_not_allowed',
        apiKeyId: row.id,
        userId: row.userId,
        tokenBalance: row.tokenBalance,
        costBalanceCents: row.costBalanceCents,
      }
    }
  }

  // === Key 级限流窗口(B,2026-09-16 立):5h/1d/7d 每窗口最大请求数(NULL 不限) ===
  // 全 NULL(存量 Key)时 checkKeyRateWindows 直接放行,零额外查询。
  const keyWindowLimits = {
    '5h': row.rateLimit5h,
    '1d': row.rateLimit1d,
    '7d': row.rateLimit7d,
  } as const
  const keyWindowCheck = await checkKeyRateWindows(row.id, keyWindowLimits)
  if (!keyWindowCheck.allowed) {
    return {
      allowed: false,
      reason: 'key_rate_window_exceeded',
      apiKeyId: row.id,
      userId: row.userId,
      tokenBalance: row.tokenBalance,
      costBalanceCents: row.costBalanceCents,
    }
  }

  // === 订阅窗口配额检查(2026-09-16 立)===
  // 订阅用户(存在活跃 api_subscriptions 且套餐配了日/周/月限额)除 Key 余额外,
  // 还受窗口额度约束(如"包月:每月 200 万 token,每日 20 万 token")。
  // 无活跃订阅或无窗口限额配置时直接放行 —— 存量用户与纯按量付费用户行为完全不变。
  const windowCheck = await checkSubscriptionWindowQuota(row.userId, Math.max(0, estimatedTokens))
  if (!windowCheck.allowed) {
    return {
      allowed: false,
      reason: 'subscription_window_exceeded',
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
// ── 计费熔断(F,2026-09-16 立):定价查询缓存 + 降级标记,堵死免费敞口 ──
// 背景:此前 calculateCost 的定价查询失败(如 DB 抖动)时异常上抛,部分调用方
// catch 后降级放行;或两行查询均空 → basePrice=0 → 免费调用,形成
// "DB 一抖 = 白嫖一轮"的资金敞口。修复三层:
//   1. 查询成功写 5min 内存缓存;
//   2. 查询失败用 stale 缓存兜底(计费不中断,不产生新敞口);
//   3. 连缓存都没有 → source='unavailable',preDeductQuota 抛 BillingUnavailableError,
//      v1 网关 fail-closed 返回 503 —— 宁拒一次调用,不放一轮免费。
export class BillingUnavailableError extends Error {
  constructor(message = 'pricing_unavailable') {
    super(message)
    this.name = 'BillingUnavailableError'
  }
}

async function queryPricingRows(dbModelId: string) {
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

  const [pricingRow] = await dbRead
    .select({
      inputTokenPrice: aiPricing.inputTokenPrice,
      outputTokenPrice: aiPricing.outputTokenPrice,
      billingMode: aiPricing.billingMode,
      perUnitPrice: aiPricing.perUnitPrice,
      tieredCallPrices: aiPricing.tieredCallPrices,
      videoUnit: aiPricing.videoUnit,
      // 长上下文加价 + 推理输出倍率(G,2026-09-16)
      longContextMultiplier: aiPricing.longContextMultiplier,
      longContextThresholdTokens: aiPricing.longContextThresholdTokens,
      reasoningOutputMultiplier: aiPricing.reasoningOutputMultiplier,
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

  return { modelRow, pricingRow }
}

interface PricingCacheEntry {
  at: number
  modelRow: Awaited<ReturnType<typeof queryPricingRows>>['modelRow']
  pricingRow: Awaited<ReturnType<typeof queryPricingRows>>['pricingRow']
}
const pricingCache = new Map<string, PricingCacheEntry>()
const PRICING_CACHE_TTL_MS = 5 * 60_000

export async function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  options?: CalculateCostCacheOptions,
  userId?: string,
): Promise<CalculateCostResult> {
  // P0-5 修复(2026-07-30):去 LiteLLM 前缀(stepfun/agnes)再查 DB,
  // 因为 DB ai_model_config_models.model_id 存的是不带前缀的原始 model 名。
  // 2026-09-13:追加官方名归一,客户端任意大小写都能命中(计费漏损兜底)。
  const dbModelId = normalizeModelId(stripLiteLLMPrefix(model))

  // 1+2. 定价查询(带 5min 内存缓存,计费熔断见上方 F 注释)
  let modelRow: PricingCacheEntry['modelRow']
  let pricingRow: PricingCacheEntry['pricingRow']
  let pricingDegraded = false
  try {
    const fresh = await queryPricingRows(dbModelId)
    modelRow = fresh.modelRow
    pricingRow = fresh.pricingRow
    pricingCache.set(dbModelId, { at: Date.now(), modelRow, pricingRow })
  } catch (e) {
    const cached = pricingCache.get(dbModelId)
    if (cached && Date.now() - cached.at < PRICING_CACHE_TTL_MS) {
      modelRow = cached.modelRow
      pricingRow = cached.pricingRow
      logger.warn('[billing] 定价查询失败,使用 5min 内缓存兜底(计费不中断)', {
        model: dbModelId,
        err: e instanceof Error ? e.message : String(e),
      })
    } else {
      pricingDegraded = true
      logger.error('[billing] 定价查询失败且无缓存,本次计费标记 unavailable(v1 侧 fail-closed)', {
        model: dbModelId,
        err: e instanceof Error ? e.message : String(e),
      })
    }
  }

  // 解析倍率(字符串 numeric(10,4) → number,默认 1.0)
  let multiplier = modelRow?.relayPriceMultiplier
    ? Math.max(0, Number(modelRow.relayPriceMultiplier) || 1)
    : 1

  // 用户计费分组倍率(2026-08-01 立):userId 传入时查分组倍率并叠加
  // 中转站倍率 × 用户分组倍率 = 实际计费倍率(如 svip 组 gpt-4o = 1.0 × 0.8 = 0.8)
  if (userId) {
    // 2026-09-13 修复(回归复现):必须用归一后的 dbModelId 查询,与上方 aiPricing /
    // aiModelConfigModels 及 getCurrentTierMultiplier 同一键空间——否则客户端大小写
    // 与分组覆盖倍率配置不一致时静默取不到覆盖(少收/多收)。
    const groupMultiplier = await getUserModelMultiplier(userId, dbModelId)
    multiplier *= groupMultiplier
  }

  // 阶梯计价倍率(2026-08-01 立):userId 传入时查当月阶梯倍率并叠加
  // 中转站倍率 × 用户分组倍率 × 阶梯倍率 = 实际计费倍率(如 gpt-4o 月用 200 万 = 1.0 × 1.0 × 0.9 = 0.9)
  if (userId) {
    const tier = await getCurrentTierMultiplier(userId, dbModelId)
    multiplier *= tier.multiplier
  }

  // 分时(高峰/低谷)倍率(2026-09-16 立):按 UTC+8 星期 + 时段命中规则后叠加,命中即用不叠加。
  // 作为倍率链最后一环(中转站 × 分组 × 阶梯 × 分时),与对外公示的高峰倍率口径一致。
  // 无启用规则(或全部未命中)时恒为 1,既有账单金额完全不变;服务异常亦降级为 1。
  const peak = await resolvePeakMultiplier(dbModelId)
  const peakMultiplier = peak.multiplier
  multiplier *= peakMultiplier

  // 长上下文加价(G,2026-09-16):promptTokens 超过阈值时倍率链再乘 longContextMultiplier。
  // 未配置(NULL)视为不启用;阈值未配置默认 200K。作为倍率链第 5 环,与公示口径一致。
  if (
    pricingRow?.longContextMultiplier !== null &&
    pricingRow?.longContextMultiplier !== undefined &&
    Number(pricingRow.longContextMultiplier) > 1 &&
    promptTokens > Number(pricingRow.longContextThresholdTokens ?? 200_000)
  ) {
    multiplier *= Number(pricingRow.longContextMultiplier)
  }

  let baseInputPricePer1k = 0
  let baseOutputPricePer1k = 0
  // 计费熔断(F,2026-09-16):定价查询失败且无缓存时标记 unavailable,
  // preDeductQuota 据此抛 BillingUnavailableError,v1 网关返回 503 宁拒不放。
  let source: CalculateCostResult['source'] = pricingDegraded ? 'unavailable' : 'default'
  let billingMode: CalculateCostResult['billingMode'] = 'token'
  const callType = options?.callType ?? 'chat'
  const units = Math.max(0, Math.ceil(options?.units ?? 1))

  if (pricingRow) {
    baseInputPricePer1k = pricingRow.inputTokenPrice
    baseOutputPricePer1k = pricingRow.outputTokenPrice
    source = 'ai_pricing'
    billingMode = (pricingRow.billingMode as CalculateCostResult['billingMode']) ?? 'token'
  } else if (modelRow) {
    baseInputPricePer1k = modelRow.inputPricePer1k ?? 0
    baseOutputPricePer1k = modelRow.outputPricePer1k ?? 0
    source = 'model_config'
  }

  // ── 多模态计费分支(2026-09-13):per_image / per_video / per_call ──
  // 仅当定价行声明了对应 billingMode 且请求 callType 匹配时生效;
  // 不匹配(如 image 端点打到 token 价模型)回退 token 计费,调用方应保证定价行正确。
  if (pricingRow && billingMode !== 'token') {
    if (billingMode === 'per_image' && callType === 'image') {
      const unit = pricingRow.perUnitPrice ?? 0
      const total = Math.max(0, roundCents(unit * units * multiplier))
      return {
        inputCostCents: 0,
        outputCostCents: 0,
        totalCostCents: total,
        cacheReadCostCents: 0,
        cacheCreationCostCents: 0,
        multiplier,
        peakMultiplier,
        baseInputPricePer1k: 0,
        baseOutputPricePer1k: 0,
        source,
        billingMode,
        unitsApplied: units,
      }
    }

    if (billingMode === 'per_video' && callType === 'video') {
      const unit = pricingRow.perUnitPrice ?? 0
      const vUnit = pricingRow.videoUnit === 'second' ? 'second' : 'call'
      const applied = vUnit === 'second' ? units : 1
      const total = Math.max(0, roundCents(unit * applied * multiplier))
      return {
        inputCostCents: 0,
        outputCostCents: 0,
        totalCostCents: total,
        cacheReadCostCents: 0,
        cacheCreationCostCents: 0,
        multiplier,
        peakMultiplier,
        baseInputPricePer1k: 0,
        baseOutputPricePer1k: 0,
        source,
        billingMode,
        unitsApplied: applied,
      }
    }

    if (billingMode === 'per_call') {
      // 分档按请求上下文(promptTokens);image/video 端点打到 per_call 模型时
      // promptTokens 为 0 → 命中 le256k 档(即基础档价),不额外惩罚
      const picked = pickPerCallPrice(pricingRow.tieredCallPrices, promptTokens)
      if (picked) {
        const total = Math.max(0, roundCents(picked.price * units * multiplier))
        return {
          inputCostCents: 0,
          outputCostCents: 0,
          totalCostCents: total,
          cacheReadCostCents: 0,
          cacheCreationCostCents: 0,
          multiplier,
          peakMultiplier,
          baseInputPricePer1k: 0,
          baseOutputPricePer1k: 0,
          source,
          billingMode,
          unitsApplied: units,
          callTier: picked.tier,
        }
      }
      // 三档价未配置 → 回退 token 计费(避免免费敞口),调用方可据此告警
      billingMode = 'token'
    }
    // per_image/per_video 与 callType 不匹配 → 落到下方 token 计费兜底
  }

  // 成本 = (inputPrice × promptTokens/1000 + outputPrice × completionTokens/1000) × multiplier
  // 单位:分(2026-09-13 起保留 6 位小数,roundCents 消除浮点噪声;不再整数取整)
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
  // 推理输出倍率(G,2026-09-16):仅作用于 completionTokens 分量(推理模型输出上浮),
  // 不影响输入/缓存分量;未配置或非法值一律按 1。
  const reasoningRaw = Number(pricingRow?.reasoningOutputMultiplier ?? 1)
  const reasoningOutputMultiplier =
    Number.isFinite(reasoningRaw) && reasoningRaw > 0 ? reasoningRaw : 1
  const inputCostCents = roundCents(rawNormalInputCost * multiplier)
  const cacheReadCostCents = roundCents(rawCacheReadCost * multiplier)
  const cacheCreationCostCents = roundCents(rawCacheCreationCost * multiplier)
  const outputCostCents = roundCents(rawOutputCost * multiplier * reasoningOutputMultiplier)
  const totalCostCents =
    inputCostCents + cacheReadCostCents + cacheCreationCostCents + outputCostCents

  return {
    inputCostCents,
    outputCostCents,
    totalCostCents,
    cacheReadCostCents,
    cacheCreationCostCents,
    multiplier,
    peakMultiplier,
    baseInputPricePer1k,
    baseOutputPricePer1k,
    source,
    billingMode: 'token',
    unitsApplied: 0,
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
 * - upstreamCostCents = roundCents(baseInput × promptTokens/1000 + baseOutput × completionTokens/1000)
 * - isFree = isFreeProvider(model)
 * - platformFeeCents = isFree ? 0 : roundCents(upstreamCostCents × commissionRate)
 *   (2026-09-13 起统一 6 位小数,不再整数取整——整数取整下 <0.5 分抽成恒为 0,形成免费敞口)
 */
export async function calculateByokCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  commissionRate: number,
): Promise<ByokCostResult> {
  const dbModelId = normalizeModelId(stripLiteLLMPrefix(model))

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

  const upstreamCostCents = roundCents(
    (baseInputPricePer1k * promptTokens) / 1000 + (baseOutputPricePer1k * completionTokens) / 1000,
  )
  const isFree = isFreeProvider(model)
  const platformFeeCents = isFree ? 0 : roundCents(upstreamCostCents * commissionRate)

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
  // P0 修复(2026-08-02):顶层 try/catch 统一捕获所有错误。
  // 大量调用方使用 `void recordCall({...})` 模式(fire-and-forget),若内部 db 操作抛错
  // 会导致 unhandledRejection(Node 15+ 默认退出进程)。billing 埋点失败不应影响主链路。
  try {
    return await recordCallInternal(input)
  } catch (err) {
    logger.error('[billing] recordCall failed', {
      apiKeyId: input.apiKeyId,
      userId: input.userId,
      model: input.model,
      error: err instanceof Error ? err.message : String(err),
    })
    return { logId: '', costCents: 0, newTokenBalance: -1, newCostBalanceCents: -1 }
  }
}

async function recordCallInternal(input: RecordCallInput): Promise<RecordCallResult> {
  // 1. 计算成本(区分 mode:'relay' 中转站 / 'byok' BYOK 平台模式)
  const mode = input.mode ?? 'relay'

  // P0 第二批次(2026-07-31 立):响应缓存命中时成本为 0(未调用上游,无大厂成本)
  // metadata.cacheHit === true 时跳过成本计算,只记录流水(供统计缓存节省金额)
  const isCacheHit = input.metadata?.cacheHit === true

  // 中转站模式:全额成本(上游 × 中转站倍率),平台扣全额
  // BYOK 模式:平台只收 platformFeeCents(上游原价 × 抽成率),不碰大厂成本 upstreamCostCents
  let costCentsToDeduct: number
  let multiplier = 1
  let pricingSource: 'ai_pricing' | 'model_config' | 'default' | 'unavailable' = 'default'
  let upstreamCostCents: number | undefined
  let platformFeeCents: number | undefined
  let commissionRate: number | undefined
  let relayCost: CalculateCostResult | undefined

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
        callType: input.callType,
        units: input.billingUnits,
      },
      input.userId,
    )
    costCentsToDeduct = cost.totalCostCents
    multiplier = cost.multiplier
    pricingSource = cost.source
    relayCost = cost
  }

  // 2026-09-13 修复:写库 model 统一为归一值(与定价查表键空间一致,防用量统计按大小写分裂)
  const normalizedModelId = normalizeModelId(stripLiteLLMPrefix(input.model))

  // 2. 写 llm_call_logs(prompt 截断 5000 字符防止超大字段)
  const truncatedPrompt =
    input.prompt.length > 5000 ? input.prompt.slice(0, 5000) + '...[truncated]' : input.prompt
  const truncatedResponse =
    input.response && input.response.length > 5000
      ? input.response.slice(0, 5000) + '...[truncated]'
      : (input.response ?? '')
  // O5 原文留存(2026-09-21):全局默认 30 天到期清除;按 key 关闭留存时**本行不落原文**
  // (prompt 落空串/ response 落 NULL),而不是等清除器迟到抹掉 —— 对承诺不留正文的 key,
  // 写入即不留,窗口为零。归因/计费列(token 数、成本、apiKeyId)不受影响。
  const rawCols = buildRawTextColumns({
    apiKeyId: input.apiKeyId ?? null,
    prompt: truncatedPrompt,
    response: truncatedResponse,
  })

  const metadata: Record<string, unknown> = {
    multiplier,
    pricingSource,
    ...(input.metadata ?? {}),
  }
  if (input.callType && input.callType !== 'chat') {
    // 多模态计费审计(2026-09-13):记录计费模式与单位数,结算/退款依赖 task_id
    metadata.callType = input.callType
    metadata.billingUnits = input.billingUnits ?? 1
  }
  if (relayCost) {
    // 计费模式审计(2026-09-13):token/per_call/per_image/per_video + 命中档位
    metadata.billingMode = relayCost.billingMode
    if (relayCost.unitsApplied > 0) metadata.unitsApplied = relayCost.unitsApplied
    if (relayCost.callTier) metadata.callTier = relayCost.callTier
  }
  if (mode === 'byok') {
    metadata.byokMode = true
    metadata.upstreamCostCents = upstreamCostCents
    metadata.platformFeeCents = platformFeeCents
    metadata.commissionRate = commissionRate
  }

  // 失败调用不计费(2026-09-13):上游错误(4xx/5xx)时平台未获得服务。
  // per_call/per_image/per_video 与 token 数无关、失败仍有价,必须置 0,
  // 否则上游一抖动用户就被扣钱(token 模式失败调用 tokens=0 本就为 0,语义统一)。
  // 两段式计费下 settlePreDeduction 会按 0 退还预扣额。
  if (input.status && input.status !== 'success') {
    if (costCentsToDeduct > 0) metadata.noChargeReason = `status=${input.status}`
    costCentsToDeduct = 0
  }

  // P0 中转站造血能力批次(2026-08-01):8 个审计/统计字段写入顶层列
  // apiKeyId/costCents 从 metadata 迁移到顶层列(支持索引聚合查询)
  // costCents:未传则用 calculateCost 的 totalCostCents(costCentsToDeduct)自动填充
  const [logRow] = await db
    .insert(llmCallLogs)
    .values({
      userId: input.userId,
      model: normalizedModelId,
      prompt: rawCols.prompt,
      response: rawCols.response,
      // 原文是否仍在表内:入口侧关闭留存时为 false(本行从未写过原文)
      rawRetained: rawCols.rawRetained,
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
      callType: input.callType ?? 'chat',
    })
    .returning({ id: llmCallLogs.id })

  // 3. 扣减余额 + 累计已用统计(原子操作)
  // 2026-08-01 立:若 Key 所属组存在且 enabled,扣组池(sharedTokenBalance / sharedCostBalanceCents)
  // 无组则扣 Key 个人余额(向后兼容)
  // tokenBalance/costBalanceCents = -1 时不扣减(无限额度),只累加统计
  // BYOK 模式:costBalanceCents 只扣 platformFeeCents(不扣大厂成本 upstreamCostCents)
  //
  // 两段式计费(2026-09-12 立):preDeducted 传入时跳过全额扣减(预扣已在 preDeductQuota 发生),
  // 只累计统计,并在结尾 settlePreDeduction 按实际用量补差价/退差额。
  const pre = input.preDeducted ?? null
  const hasPreDeduction = !!pre && (pre.tokens > 0 || pre.cents > 0)

  let newTokenBalance = -1
  let newCostBalanceCents = -1

  const groupInfoForDeduct = await getKeyGroup(input.apiKeyId)
  if (hasPreDeduction && pre) {
    // === 两段式:只累计统计(余额调整由 settlePreDeduction 统一处理)===
    await db
      .update(developerApiKeys)
      .set({
        tokenUsedTotal: sql`${developerApiKeys.tokenUsedTotal} + ${input.totalTokens}`,
        costUsedTotalCents: sql`${developerApiKeys.costUsedTotalCents} + ${costCentsToDeduct}`,
        updatedAt: new Date(),
      })
      .where(eq(developerApiKeys.id, input.apiKeyId))
      .catch((err: unknown) => {
        logger.error('[billing] 统计累加失败(两段式)', {
          apiKeyId: input.apiKeyId,
          error: err instanceof Error ? err.message : String(err),
        })
      })
    await settlePreDeduction(pre, input.totalTokens, costCentsToDeduct)
    // Key 级限流窗口计数(B,2026-09-16):成功调用后窗口请求数 +1。
    // fire-and-forget(不 await 不阻塞返回),内部自查限额配置,全 NULL 零写入;
    // 失败静默(仅告警)——窗口是附加约束,余额/熔断已兜底,计数丢失只影响精度。
    void incrKeyRateWindows(input.apiKeyId).catch(() => {})
    // 读取结算后余额供返回值/余额告警使用(组池优先)
    if (groupInfoForDeduct && groupInfoForDeduct.enabled) {
      const [g] = await dbRead
        .select({
          sharedTokenBalance: apiKeyGroups.sharedTokenBalance,
          sharedCostBalanceCents: apiKeyGroups.sharedCostBalanceCents,
        })
        .from(apiKeyGroups)
        .where(eq(apiKeyGroups.id, groupInfoForDeduct.groupId))
        .limit(1)
      newTokenBalance = g?.sharedTokenBalance ?? -1
      newCostBalanceCents = g?.sharedCostBalanceCents ?? -1
    } else {
      const [k] = await dbRead
        .select({
          tokenBalance: developerApiKeys.tokenBalance,
          costBalanceCents: developerApiKeys.costBalanceCents,
        })
        .from(developerApiKeys)
        .where(eq(developerApiKeys.id, input.apiKeyId))
        .limit(1)
      newTokenBalance = k?.tokenBalance ?? -1
      newCostBalanceCents = k?.costBalanceCents ?? -1
    }
  } else if (groupInfoForDeduct && groupInfoForDeduct.enabled) {
    // === 扣组池(2026-08-01 立;P0-8 修复 2026-08-05)===
    // P0-8 原实现:dbRead 读余额 → 应用层计算 → db UPDATE,并发 Lost Update 超用平台额度。
    // 改为原子 CASE WHEN 条件更新(与个人余额同模式),-1(无限额度)保持 -1,余额不足不扣减。
    let updatedGroup: { sharedTokenBalance: number; sharedCostBalanceCents: number } | undefined
    try {
      const groupRows = await db
        .update(apiKeyGroups)
        .set({
          sharedTokenBalance: sql`CASE WHEN ${apiKeyGroups.sharedTokenBalance} = -1 THEN -1 WHEN ${apiKeyGroups.sharedTokenBalance} >= ${input.totalTokens} THEN ${apiKeyGroups.sharedTokenBalance} - ${input.totalTokens} ELSE ${apiKeyGroups.sharedTokenBalance} END`,
          sharedCostBalanceCents: sql`CASE WHEN ${apiKeyGroups.sharedCostBalanceCents} = -1 THEN -1 WHEN ${apiKeyGroups.sharedCostBalanceCents} >= ${costCentsToDeduct} THEN ${apiKeyGroups.sharedCostBalanceCents} - ${costCentsToDeduct} ELSE ${apiKeyGroups.sharedCostBalanceCents} END`,
          updatedAt: new Date(),
        })
        .where(eq(apiKeyGroups.id, groupInfoForDeduct.groupId))
        .returning({
          sharedTokenBalance: apiKeyGroups.sharedTokenBalance,
          sharedCostBalanceCents: apiKeyGroups.sharedCostBalanceCents,
        })
      updatedGroup = groupRows[0]
    } catch (err) {
      // 扣减失败记录错误日志(原静默吞掉导致平台财务损失无法排查)
      logger.error('[billing] 组池余额扣减失败', {
        groupId: groupInfoForDeduct.groupId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
    newTokenBalance = updatedGroup?.sharedTokenBalance ?? -1
    newCostBalanceCents = updatedGroup?.sharedCostBalanceCents ?? -1

    // 同时累加 Key 个人统计(tokenUsedTotal / costUsedTotalCents,用于组内用量排行)
    await db
      .update(developerApiKeys)
      .set({
        tokenUsedTotal: sql`${developerApiKeys.tokenUsedTotal} + ${input.totalTokens}`,
        costUsedTotalCents: sql`${developerApiKeys.costUsedTotalCents} + ${costCentsToDeduct}`,
        updatedAt: new Date(),
      })
      .where(eq(developerApiKeys.id, input.apiKeyId))
      .catch((err: unknown) => {
        // P1 修复:统计累加失败记录错误日志(原静默吞掉导致用量统计丢失无法排查)
        logger.error('[billing] 统计累加失败', {
          apiKeyId: input.apiKeyId,
          error: err instanceof Error ? err.message : String(err),
        })
      })
  } else {
    // === 扣个人余额(无组,原子操作防竞态)===
    // P0 修复:原 SELECT+应用层计算+UPDATE 模式存在竞态,改为原子 CASE WHEN UPDATE
    let updated: { tokenBalance: number; costBalanceCents: number } | undefined
    try {
      const rows = await db
        .update(developerApiKeys)
        .set({
          // -1(无限额度)保持 -1;余额 >= 扣减量时扣减;否则保持不变(拒绝扣减,防负数)
          tokenBalance: sql`CASE WHEN ${developerApiKeys.tokenBalance} = -1 THEN -1 WHEN ${developerApiKeys.tokenBalance} >= ${input.totalTokens} THEN ${developerApiKeys.tokenBalance} - ${input.totalTokens} ELSE ${developerApiKeys.tokenBalance} END`,
          costBalanceCents: sql`CASE WHEN ${developerApiKeys.costBalanceCents} = -1 THEN -1 WHEN ${developerApiKeys.costBalanceCents} >= ${costCentsToDeduct} THEN ${developerApiKeys.costBalanceCents} - ${costCentsToDeduct} ELSE ${developerApiKeys.costBalanceCents} END`,
          // 累计已用统计(总是累加,即使余额无限)
          tokenUsedTotal: sql`${developerApiKeys.tokenUsedTotal} + ${input.totalTokens}`,
          costUsedTotalCents: sql`${developerApiKeys.costUsedTotalCents} + ${costCentsToDeduct}`,
          updatedAt: new Date(),
        })
        .where(eq(developerApiKeys.id, input.apiKeyId))
        .returning({
          tokenBalance: developerApiKeys.tokenBalance,
          costBalanceCents: developerApiKeys.costBalanceCents,
        })
      updated = rows[0]
    } catch (err) {
      // P1 修复:扣减失败记录错误日志(原静默吞掉导致平台财务损失无法排查)
      logger.error('[billing] 余额扣减失败', {
        apiKeyId: input.apiKeyId,
        error: err instanceof Error ? err.message : String(err),
        tokenCost: input.totalTokens,
        costCents: costCentsToDeduct,
      })
    }
    newTokenBalance = updated?.tokenBalance ?? -1
    newCostBalanceCents = updated?.costBalanceCents ?? -1
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
        // 余额不足邮件通知(E,2026-09-16 立):webhook 之外补邮件通道,
        // 防骚扰冷却(24h/用户)与 SMTP 缺失降级都在服务内部处理,fire-and-forget。
        void checkAndNotifyLowBalance({
          userId: input.userId,
          keyId: input.apiKeyId,
          keyName: input.model,
          tokenBalance: newTokenBalance,
          costBalanceCents: newCostBalanceCents,
        }).catch(() => {
          // 邮件通知失败不影响主链路
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

/**
 * P0-7 修复(2026-08-05):用户自充 API Key 余额原为无成本直加(adjustBalance),
 * 普通用户可自充任意余额 = 免费无限额度。改为钱包转账:
 * 事务内行锁 user_margins → 扣 token(1 token = 1 cent,与充值汇率一致) →
 * API Key 加余额 → 写 token_flows 流水(opType=4,可审计)。
 *
 * @param tokenDelta / costDeltaCents 必须为正整数(>0)
 * @throws {Error & {statusCode}} 余额不足 400 / Key 不存在 404
 */
export async function rechargeApiKeyFromWallet(
  userId: string,
  apiKeyId: string,
  tokenDelta: number,
  costDeltaCents: number,
): Promise<{ tokenBalance: number; costBalanceCents: number } | null> {
  if (
    !Number.isInteger(tokenDelta) ||
    tokenDelta <= 0 ||
    !Number.isInteger(costDeltaCents) ||
    costDeltaCents <= 0
  ) {
    throw Object.assign(new Error('充值数量必须为正整数'), { statusCode: 400 })
  }
  // 1 token = 1 cent:cost 额度(分)需等额 token 支付
  const totalTokensNeeded = tokenDelta + costDeltaCents
  return db.transaction(async (tx) => {
    // ① 行锁用户钱包
    const [margin] = await tx
      .select()
      .from(userMargins)
      .where(eq(userMargins.userId, userId))
      .for('update')
      .limit(1)
    if (!margin || margin.tokenQuantity < totalTokensNeeded) {
      throw Object.assign(new Error('钱包余额不足'), { statusCode: 400 })
    }
    const newWalletBalance = margin.tokenQuantity - totalTokensNeeded
    // ② 扣减钱包
    await tx
      .update(userMargins)
      .set({ tokenQuantity: newWalletBalance, updatedAt: new Date() })
      .where(eq(userMargins.userId, userId))
    await tx.insert(tokenFlows).values({
      userId,
      opType: 4,
      quantity: totalTokensNeeded,
      balanceAfter: newWalletBalance,
      remark: `Relay API Key 充值:${apiKeyId}(token+${tokenDelta}, cost+${costDeltaCents})`,
    })
    // ③ API Key 加余额(行锁;tokenBalance/costBalanceCents = -1 无限额度则不动)
    const [keyRow] = await tx
      .select({
        tokenBalance: developerApiKeys.tokenBalance,
        costBalanceCents: developerApiKeys.costBalanceCents,
      })
      .from(developerApiKeys)
      .where(eq(developerApiKeys.id, apiKeyId))
      .for('update')
      .limit(1)
    if (!keyRow) throw Object.assign(new Error('API Key 不存在'), { statusCode: 404 })
    const setClause: Record<string, unknown> = { updatedAt: new Date() }
    if (keyRow.tokenBalance !== -1) setClause.tokenBalance = keyRow.tokenBalance + tokenDelta
    if (keyRow.costBalanceCents !== -1)
      setClause.costBalanceCents = keyRow.costBalanceCents + costDeltaCents
    const [updated] = await tx
      .update(developerApiKeys)
      .set(setClause)
      .where(eq(developerApiKeys.id, apiKeyId))
      .returning({
        tokenBalance: developerApiKeys.tokenBalance,
        costBalanceCents: developerApiKeys.costBalanceCents,
      })
    if (!updated) throw Object.assign(new Error('API Key 不存在'), { statusCode: 404 })
    return { tokenBalance: updated.tokenBalance, costBalanceCents: updated.costBalanceCents }
  })
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

// =============================================================================
// 5.5 异步任务失败退款(2026-09-13 立,多模态计费配套)
// -----------------------------------------------------------------------------
// 生图/生视频为异步任务:提交时已按次/按张扣费(乐观计费,防漏损),
// 任务查询发现 failed 时按 costCents 全额退款,并把该流水标记 metadata.refunded=true。
// 幂等保证:refunded 标记在查询条件里,重复查询/并发退款只会退一次。
// =============================================================================

export interface RefundTaskResult {
  refunded: boolean
  /** 退款金额(分);refunded=false 时为 0 */
  refundedCents: number
  /** 退款原因:无流水(未扣费)|已退款过|退款成功|流水缺 apiKeyId */
  reason: 'refunded' | 'no_log' | 'ok' | 'no_api_key'
}

/**
 * 按 taskId 退款(生图/生视频任务失败时调用)。
 * 查找该任务提交时写入的计费流水(call_type in image/video + metadata.task_id),
 * 未退款过则把 costCents 原样退回组池或个人余额并打标记。
 * 失败容错:任何 db 错误只 log 并返回 refunded:false(主链路不受影响)。
 */
export async function refundTaskCall(taskId: string): Promise<RefundTaskResult> {
  try {
    if (!taskId) return { refunded: false, refundedCents: 0, reason: 'no_log' }

    const [log] = await dbRead
      .select({
        id: llmCallLogs.id,
        apiKeyId: llmCallLogs.apiKeyId,
        costCents: llmCallLogs.costCents,
        metadata: llmCallLogs.metadata,
      })
      .from(llmCallLogs)
      .where(
        and(
          sql`${llmCallLogs.metadata}->>'task_id' = ${taskId}`,
          sql`${llmCallLogs.callType} in ('image','video')`,
          eq(llmCallLogs.status, 'success'),
          sql`COALESCE(${llmCallLogs.metadata}->>'refunded','false') <> 'true'`,
        ),
      )
      .orderBy(desc(llmCallLogs.createdAt))
      .limit(1)

    if (!log) return { refunded: false, refundedCents: 0, reason: 'no_log' }
    if (!log.apiKeyId) return { refunded: false, refundedCents: 0, reason: 'no_api_key' }

    const cents = Math.max(0, log.costCents ?? 0)
    if (cents <= 0) {
      // 0 成本流水只需打标记,无需动余额
      await markTaskRefunded(log.id)
      return { refunded: true, refundedCents: 0, reason: 'ok' }
    }

    const groupInfo = await getKeyGroup(log.apiKeyId)
    if (groupInfo && groupInfo.enabled) {
      // 组池退款:-1(无限额度)不退,否则原额加回
      await db
        .update(apiKeyGroups)
        .set({
          sharedTokenBalance: sql`CASE WHEN ${apiKeyGroups.sharedTokenBalance} = -1 THEN -1 ELSE ${apiKeyGroups.sharedTokenBalance} + ${cents} END`,
          updatedAt: new Date(),
        })
        .where(eq(apiKeyGroups.id, groupInfo.groupId))
    } else {
      // 个人余额退款:-1(无限额度)不退
      await db
        .update(developerApiKeys)
        .set({
          tokenBalance: sql`CASE WHEN ${developerApiKeys.tokenBalance} = -1 THEN -1 ELSE ${developerApiKeys.tokenBalance} + ${cents} END`,
          updatedAt: new Date(),
        })
        .where(eq(developerApiKeys.id, log.apiKeyId))
    }

    await markTaskRefunded(log.id)
    logger.info('[billing] 多模态任务失败退款', { taskId, apiKeyId: log.apiKeyId, cents })
    return { refunded: true, refundedCents: cents, reason: 'ok' }
  } catch (err) {
    logger.error('[billing] refundTaskCall failed', {
      taskId,
      error: err instanceof Error ? err.message : String(err),
    })
    return { refunded: false, refundedCents: 0, reason: 'no_log' }
  }
}

/** 给流水打已退款标记(jsonb_set,幂等) */
async function markTaskRefunded(logId: string): Promise<void> {
  await db
    .update(llmCallLogs)
    .set({
      metadata: sql`jsonb_set(COALESCE(${llmCallLogs.metadata},'{}'::jsonb), '{refunded}', 'true'::jsonb)`,
    })
    .where(eq(llmCallLogs.id, logId))
}

// =============================================================================
// 6. 两段式计费:预扣 + 结算(2026-09-12 立)
// -----------------------------------------------------------------------------
// 解决问题:原「事前 checkQuota + 事后 recordCall 扣费」只挡余额为 0 的 Key,
// 余额充足的 Key 发起长请求(如 10 万 token 生成)可透支到任意负成本敞口。
// 两段式:调用前按预估用量预扣(封顶当前余额),调用后按实际用量结算,
// 总扣减恒等于实际用量(预扣多退少补),敞口上限 = 单次预扣额。
// 预扣凭证 PreDeduction 由调用方透传回 recordCall({ preDeducted }),结算自动完成。
// =============================================================================

/** 预扣凭证:记录调用前实际预扣的 token / 成本(分),0 = 对应维度无限额度未预扣 */
export interface PreDeduction {
  apiKeyId: string
  userId: string
  tokens: number
  cents: number
}

export interface PreDeductInput {
  apiKeyId: string
  model: string
  userId?: string
  /** 预估 prompt token 数(调用方按字符数/4 估算) */
  estimatedPromptTokens: number
  /** 预估 completion token 数(调用方传 max_tokens,未传建议 1024) */
  estimatedCompletionTokens: number
  /**
   * 多模态计费(2026-09-13):callType=image|video 时按定价行 billingMode 预估;
   * units=image 张数 / video 次数或秒数。per_call 走 estimatedPromptTokens 分档。
   */
  callType?: 'chat' | 'image' | 'video'
  billingUnits?: number
}

/**
 * 调用前预扣余额(两段式第一阶段)。
 *
 * - 预估成本 = calculateCost(model, estPrompt, estCompletion)(含中转站/分组/阶梯倍率)
 * - 预扣额封顶当前余额(余额不足按余额全额预扣,尽量覆盖敞口)
 * - tokenBalance 与 costBalanceCents 任一为 -1(无限额度)则该维度不预扣
 * - 两者均无需预扣(无限额度)或预扣额为 0 → 返回 null(调用方无需透传凭证)
 * - 组池 Key 扣 sharedTokenBalance / sharedCostBalanceCents,个人 Key 扣自身余额
 * - 失败容错:任何 db 错误只 log 并返回 null(降级为无预扣,主链路不受影响)
 */
export async function preDeductQuota(input: PreDeductInput): Promise<PreDeduction | null> {
  try {
    const [row] = await dbRead
      .select({
        id: developerApiKeys.id,
        userId: developerApiKeys.userId,
        status: developerApiKeys.status,
        tokenBalance: developerApiKeys.tokenBalance,
        costBalanceCents: developerApiKeys.costBalanceCents,
      })
      .from(developerApiKeys)
      .where(eq(developerApiKeys.id, input.apiKeyId))
      .limit(1)
    if (!row || row.status !== 'active') return null

    const estTokens = Math.max(
      0,
      Math.ceil(input.estimatedPromptTokens + input.estimatedCompletionTokens),
    )
    const cost = await calculateCost(
      input.model,
      Math.max(0, Math.ceil(input.estimatedPromptTokens)),
      Math.max(0, Math.ceil(input.estimatedCompletionTokens)),
      {
        callType: input.callType,
        units: input.billingUnits,
      },
      input.userId,
    )
    // 计费熔断(F,2026-09-16):定价不可用(查询失败且无缓存)时宁拒不预扣——
    // 抛出后由 v1 网关转 503 fail-closed;否则 cost=0 会静默免费放行。
    if (cost.source === 'unavailable') {
      throw new BillingUnavailableError()
    }
    const estCents = Math.max(0, cost.totalCostCents)

    const tokensToDeduct = row.tokenBalance === -1 ? 0 : Math.min(estTokens, row.tokenBalance)
    const centsToDeduct = row.costBalanceCents === -1 ? 0 : Math.min(estCents, row.costBalanceCents)
    if (tokensToDeduct <= 0 && centsToDeduct <= 0) return null

    const groupInfo = await getKeyGroup(input.apiKeyId)
    const base = { apiKeyId: row.id, userId: row.userId }

    if (groupInfo && groupInfo.enabled) {
      if (groupInfo.sharedTokenBalance === -1 && groupInfo.sharedCostBalanceCents === -1)
        return null
      const t =
        groupInfo.sharedTokenBalance === -1
          ? 0
          : Math.min(estTokens, Math.max(0, groupInfo.sharedTokenBalance))
      const c =
        groupInfo.sharedCostBalanceCents === -1
          ? 0
          : Math.min(estCents, Math.max(0, groupInfo.sharedCostBalanceCents))
      if (t <= 0 && c <= 0) return null
      const [updated] = await db
        .update(apiKeyGroups)
        .set({
          sharedTokenBalance:
            t > 0
              ? sql`CASE WHEN ${apiKeyGroups.sharedTokenBalance} = -1 THEN -1 WHEN ${apiKeyGroups.sharedTokenBalance} >= ${t} THEN ${apiKeyGroups.sharedTokenBalance} - ${t} ELSE 0 END`
              : sql`${apiKeyGroups.sharedTokenBalance}`,
          sharedCostBalanceCents:
            c > 0
              ? sql`CASE WHEN ${apiKeyGroups.sharedCostBalanceCents} = -1 THEN -1 WHEN ${apiKeyGroups.sharedCostBalanceCents} >= ${c} THEN ${apiKeyGroups.sharedCostBalanceCents} - ${c} ELSE 0 END`
              : sql`${apiKeyGroups.sharedCostBalanceCents}`,
          updatedAt: new Date(),
        })
        .where(eq(apiKeyGroups.id, groupInfo.groupId))
        .returning({
          sharedTokenBalance: apiKeyGroups.sharedTokenBalance,
          sharedCostBalanceCents: apiKeyGroups.sharedCostBalanceCents,
        })
      if (!updated) return null
      // 实际扣减额按扣后余额反推(并发下可能与预估值不同,以实际为准)
      const actualTokens =
        groupInfo.sharedTokenBalance === -1
          ? 0
          : Math.max(0, groupInfo.sharedTokenBalance - (updated.sharedTokenBalance ?? 0))
      const actualCents =
        groupInfo.sharedCostBalanceCents === -1
          ? 0
          : Math.max(0, groupInfo.sharedCostBalanceCents - (updated.sharedCostBalanceCents ?? 0))
      if (actualTokens <= 0 && actualCents <= 0) return null
      return { ...base, tokens: actualTokens, cents: actualCents }
    }

    // 个人余额
    if (row.tokenBalance === -1 && row.costBalanceCents === -1) return null
    const [updated] = await db
      .update(developerApiKeys)
      .set({
        tokenBalance:
          tokensToDeduct > 0
            ? sql`CASE WHEN ${developerApiKeys.tokenBalance} = -1 THEN -1 WHEN ${developerApiKeys.tokenBalance} >= ${tokensToDeduct} THEN ${developerApiKeys.tokenBalance} - ${tokensToDeduct} ELSE 0 END`
            : sql`${developerApiKeys.tokenBalance}`,
        costBalanceCents:
          centsToDeduct > 0
            ? sql`CASE WHEN ${developerApiKeys.costBalanceCents} = -1 THEN -1 WHEN ${developerApiKeys.costBalanceCents} >= ${centsToDeduct} THEN ${developerApiKeys.costBalanceCents} - ${centsToDeduct} ELSE 0 END`
            : sql`${developerApiKeys.costBalanceCents}`,
        updatedAt: new Date(),
      })
      .where(eq(developerApiKeys.id, row.id))
      .returning({
        tokenBalance: developerApiKeys.tokenBalance,
        costBalanceCents: developerApiKeys.costBalanceCents,
      })
    if (!updated) return null
    const actualTokens =
      row.tokenBalance === -1 ? 0 : Math.max(0, row.tokenBalance - (updated.tokenBalance ?? 0))
    const actualCents =
      row.costBalanceCents === -1
        ? 0
        : Math.max(0, row.costBalanceCents - (updated.costBalanceCents ?? 0))
    if (actualTokens <= 0 && actualCents <= 0) return null
    return { ...base, tokens: actualTokens, cents: actualCents }
  } catch (err) {
    // 计费熔断(F):定价不可用必须向上穿透(fail-closed),不得降级为"无预扣"放行
    if (err instanceof BillingUnavailableError) throw err
    logger.error('[billing] preDeductQuota failed(降级为无预扣)', {
      apiKeyId: input.apiKeyId,
      model: input.model,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

/**
 * 结算预扣(两段式第二阶段):按实际用量与预扣额对账,多退少补。
 *
 * - delta = 预扣 - 实际;delta > 0 退款(余额回补),delta < 0 补扣(余额够则扣,不够扣到 0 为止)
 * - 组池 Key 结算组池余额,个人 Key 结算自身余额
 * - 总扣减恒等式:预扣 + 结算调整 = 实际用量(补扣不足时存在少量敞口,log 可审计)
 * - 失败容错:只 log 不抛错(计费调整失败不影响已返回的响应)
 */
export async function settlePreDeduction(
  pre: PreDeduction,
  actualTokens: number,
  actualCostCents: number,
): Promise<void> {
  try {
    // 订阅窗口用量累加(2026-09-16 立):按本次调用的"实际用量"累加进日/周/月窗口。
    // 必须置于下方 delta===0 提前 return 之前 —— 否则"预扣恰好等于实扣"的调用
    // (deltaTokens/deltaCents 均为 0)会跳过窗口记账,导致窗口额度被无限透支。
    // 无活跃订阅或无窗口限额配置时不产生任何写入;内部失败已自行吞掉,不影响结算。
    await consumeSubscriptionWindowUsage(
      pre.userId,
      Math.max(0, actualTokens),
      Math.max(0, actualCostCents),
    )

    const deltaTokens = pre.tokens - Math.max(0, actualTokens)
    const deltaCents = pre.cents - Math.max(0, actualCostCents)
    if (deltaTokens === 0 && deltaCents === 0) return

    const buildSet =
      (tokenCol: typeof developerApiKeys.tokenBalance | typeof apiKeyGroups.sharedTokenBalance) =>
      (
        centsCol:
          typeof developerApiKeys.costBalanceCents | typeof apiKeyGroups.sharedCostBalanceCents,
      ) => {
        const tokenExpr =
          deltaTokens === 0
            ? sql`${tokenCol}`
            : deltaTokens > 0
              ? sql`CASE WHEN ${tokenCol} = -1 THEN -1 ELSE ${tokenCol} + ${deltaTokens} END`
              : sql`CASE WHEN ${tokenCol} = -1 THEN -1 WHEN ${tokenCol} >= ${-deltaTokens} THEN ${tokenCol} - ${-deltaTokens} ELSE 0 END`
        const centsExpr =
          deltaCents === 0
            ? sql`${centsCol}`
            : deltaCents > 0
              ? sql`CASE WHEN ${centsCol} = -1 THEN -1 ELSE ${centsCol} + ${deltaCents} END`
              : sql`CASE WHEN ${centsCol} = -1 THEN -1 WHEN ${centsCol} >= ${-deltaCents} THEN ${centsCol} - ${-deltaCents} ELSE 0 END`
        return { tokenExpr, centsExpr }
      }

    const groupInfo = await getKeyGroup(pre.apiKeyId)
    if (groupInfo && groupInfo.enabled) {
      const { tokenExpr, centsExpr } = buildSet(apiKeyGroups.sharedTokenBalance)(
        apiKeyGroups.sharedCostBalanceCents,
      )
      await db
        .update(apiKeyGroups)
        .set({
          sharedTokenBalance: tokenExpr,
          sharedCostBalanceCents: centsExpr,
          updatedAt: new Date(),
        })
        .where(eq(apiKeyGroups.id, groupInfo.groupId))
    } else {
      const { tokenExpr, centsExpr } = buildSet(developerApiKeys.tokenBalance)(
        developerApiKeys.costBalanceCents,
      )
      await db
        .update(developerApiKeys)
        .set({ tokenBalance: tokenExpr, costBalanceCents: centsExpr, updatedAt: new Date() })
        .where(eq(developerApiKeys.id, pre.apiKeyId))
    }
  } catch (err) {
    logger.error('[billing] settlePreDeduction failed(预扣对账未完成,需人工核对)', {
      apiKeyId: pre.apiKeyId,
      preTokens: pre.tokens,
      preCents: pre.cents,
      actualTokens,
      actualCostCents,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
