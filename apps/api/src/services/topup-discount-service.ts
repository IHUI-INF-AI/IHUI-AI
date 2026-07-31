/**
 * 充值金额阶梯折扣 + 自定义充值选项 service(2026-07-31 立)。
 *
 * 职责:
 * 1. getTopupConfig: 读取阶梯折扣配置(存 system_configs 表,category='topup_discount')
 * 2. calculateTopupBonus: 计算充值到账(阶梯按 minAmount 降序匹配,命中第一个即停)
 * 3. validateTopupAmount: 校验最低充值额(按支付方式)
 * 4. updateTopupConfig: 更新配置(admin only,鉴权由路由层处理)
 *
 * 配置默认值(未配置或解析失败时):
 *   tiers: [{minAmount:100, multiplier:1.2, bonus:20}, {minAmount:500, multiplier:1.5, bonus:80}]
 *   customAmounts: [10, 20, 50, 100, 200, 500]
 *   minTopupByMethod: {alipay:1, wechat:1, usdt:10}
 *
 * 到账计算:actualCredit = round(amount × multiplier) + bonus
 *   - multiplier 1.2 = 充 100 到账 120
 *   - bonus 20 = 额外送 20
 */
import { eq } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { systemConfigs } from '@ihui/database'

// =============================================================================
// 类型定义
// =============================================================================

/** 单个阶梯折扣档位 */
export interface TopupTier {
  /** 命中该档的最低充值额(含) */
  minAmount: number
  /** 倍率(1.2 = 充 100 到账 120) */
  multiplier: number
  /** 额外赠送额度 */
  bonus: number
}

/** 充值折扣配置 */
export interface TopupConfig {
  /** 阶梯折扣档位列表 */
  tiers: TopupTier[]
  /** 预设自定义充值金额选项列表(前端快捷选择按钮) */
  customAmounts: number[]
  /** 各支付方式的最低充值额(键=支付方式,值=最低金额) */
  minTopupByMethod: Record<string, number>
}

/** 阶梯折扣计算结果 */
export interface TopupBonusResult {
  /** 命中档位的倍率(无命中=1) */
  multiplier: number
  /** 命中档位的额外赠送(无命中=0) */
  bonus: number
  /** 实际到账额度 */
  actualCredit: number
}

/** 充值金额校验结果 */
export interface TopupValidationResult {
  /** 是否通过校验 */
  valid: boolean
  /** 不通过时的原因说明 */
  reason?: string
}

// =============================================================================
// 常量
// =============================================================================

/** system_configs 表中充值折扣配置的 category */
const TOPUP_CONFIG_CATEGORY = 'topup_discount'

/** system_configs 表中充值折扣配置的 key(整体 JSON 存储) */
const TOPUP_CONFIG_KEY = 'topup_discount.config'

/** 默认阶梯折扣配置(未配置或解析失败时使用) */
const DEFAULT_CONFIG: TopupConfig = {
  tiers: [
    { minAmount: 100, multiplier: 1.2, bonus: 20 },
    { minAmount: 500, multiplier: 1.5, bonus: 80 },
  ],
  customAmounts: [10, 20, 50, 100, 200, 500],
  minTopupByMethod: { alipay: 1, wechat: 1, usdt: 10 },
}

// =============================================================================
// 1. getTopupConfig — 读取配置
// =============================================================================

/**
 * 读取充值折扣配置(从 system_configs 表,未配置或解析失败用默认值)。
 * 配置以单个 JSON 字符串存储在 key='topup_discount.config'。
 */
export async function getTopupConfig(): Promise<TopupConfig> {
  const [row] = await dbRead
    .select({ value: systemConfigs.value })
    .from(systemConfigs)
    .where(eq(systemConfigs.key, TOPUP_CONFIG_KEY))
    .limit(1)

  if (!row) return cloneDefault()
  return parseConfig(row.value)
}

// =============================================================================
// 2. calculateTopupBonus — 计算阶梯折扣
// =============================================================================

/**
 * 计算充值到账额度。
 * 阶梯按 minAmount 降序匹配,命中第一个(amount >= minAmount)即停。
 * 未命中任何档位时 multiplier=1、bonus=0,actualCredit=amount。
 *
 * @param amount 充值金额
 * @param _method 支付方式(预留,当前阶梯不区分方式;与 validateTopupAmount 签名对齐)
 */
export async function calculateTopupBonus(
  amount: number,
  _method: string,
): Promise<TopupBonusResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { multiplier: 1, bonus: 0, actualCredit: 0 }
  }
  const config = await getTopupConfig()
  const sortedTiers = [...config.tiers].sort((a, b) => b.minAmount - a.minAmount)
  const matched = sortedTiers.find((t) => amount >= t.minAmount)
  if (!matched) {
    return { multiplier: 1, bonus: 0, actualCredit: Math.round(amount) }
  }
  const actualCredit = Math.round(amount * matched.multiplier) + matched.bonus
  return { multiplier: matched.multiplier, bonus: matched.bonus, actualCredit }
}

// =============================================================================
// 3. validateTopupAmount — 校验最低充值额
// =============================================================================

/**
 * 校验充值金额是否满足指定支付方式的最低充值额。
 * 未配置的支付方式返回 invalid(防止绕过最低额限制)。
 */
export async function validateTopupAmount(
  amount: number,
  method: string,
): Promise<TopupValidationResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { valid: false, reason: '充值金额必须大于 0' }
  }
  const config = await getTopupConfig()
  const min = config.minTopupByMethod[method]
  if (min === undefined) {
    return { valid: false, reason: `不支持的充值方式:${method}` }
  }
  if (amount < min) {
    return { valid: false, reason: `${method} 最低充值 ${min}` }
  }
  return { valid: true }
}

// =============================================================================
// 4. updateTopupConfig — 更新配置
// =============================================================================

/**
 * 更新充值折扣配置(upsert system_configs 表,admin only,鉴权由路由层处理)。
 */
export async function updateTopupConfig(config: TopupConfig): Promise<void> {
  const value = JSON.stringify(config)
  await db
    .insert(systemConfigs)
    .values({
      key: TOPUP_CONFIG_KEY,
      value,
      type: 'json',
      category: TOPUP_CONFIG_CATEGORY,
      description: '充值阶梯折扣配置(tiers/customAmounts/minTopupByMethod)',
      isPublic: false,
      updatedBy: null,
    })
    .onConflictDoUpdate({
      target: systemConfigs.key,
      set: { value, type: 'json', updatedAt: new Date() },
    })
}

// =============================================================================
// 内部工具函数
// =============================================================================

/** 返回默认配置的深拷贝(防止调用方篡改常量) */
function cloneDefault(): TopupConfig {
  return {
    tiers: DEFAULT_CONFIG.tiers.map((t) => ({ ...t })),
    customAmounts: [...DEFAULT_CONFIG.customAmounts],
    minTopupByMethod: { ...DEFAULT_CONFIG.minTopupByMethod },
  }
}

/**
 * 安全解析配置 JSON 字符串为 TopupConfig。
 * 任何校验失败(非 JSON / 结构不符 / 字段类型错误)均回退到默认配置。
 */
function parseConfig(raw: string): TopupConfig {
  if (!raw) return cloneDefault()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return cloneDefault()
  }
  if (!isObject(parsed)) return cloneDefault()

  return {
    tiers: parseTiers(parsed.tiers),
    customAmounts: parseNumberArray(parsed.customAmounts),
    minTopupByMethod: parseMinTopupByMethod(parsed.minTopupByMethod),
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function parseTiers(raw: unknown): TopupTier[] {
  if (!Array.isArray(raw)) return cloneDefault().tiers
  const tiers: TopupTier[] = []
  for (const item of raw) {
    if (!isObject(item)) continue
    const { minAmount, multiplier, bonus } = item
    if (!isFiniteNumber(minAmount) || !isFiniteNumber(multiplier) || !isFiniteNumber(bonus)) {
      continue
    }
    tiers.push({ minAmount, multiplier, bonus })
  }
  return tiers
}

function parseNumberArray(raw: unknown): number[] {
  if (!Array.isArray(raw)) return cloneDefault().customAmounts
  const result: number[] = []
  for (const item of raw) {
    if (isFiniteNumber(item)) result.push(item)
  }
  return result
}

function parseMinTopupByMethod(raw: unknown): Record<string, number> {
  if (!isObject(raw)) return cloneDefault().minTopupByMethod
  const result: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (isFiniteNumber(v)) result[k] = v
  }
  return result
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}
