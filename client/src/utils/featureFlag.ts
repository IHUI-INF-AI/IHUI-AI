/**
 * 特性开关（Feature Flag）框架
 * 用于 A/B 测试和灰度发布
 *
 * 核心能力：
 * - 基于用户 ID 哈希的分桶（一致性哈希，同一用户始终在同一分桶）
 * - 白名单 / 黑名单强制开关
 * - 灰度比例（0-100）
 * - 持久化（localStorage 缓存 + 异步远程覆盖）
 * - 类型安全的 Flag 名称枚举
 */

export type FeatureFlagName = string

/** 实验配置 */
export interface ExperimentConfig {
  /** 灰度比例 0-100 */
  rolloutPercentage: number
  /** 白名单用户 ID（在白名单内始终启用） */
  whitelist?: string[]
  /** 黑名单用户 ID（在黑名单内始终禁用） */
  blacklist?: string[]
  /** 实验变体（用于多臂老虎机 A/B/n 测试） */
  variants?: VariantConfig[]
  /** 启动时间（毫秒时间戳，过期后强制关闭） */
  expiresAt?: number
  /** 远程配置（异步拉取） */
  remoteUrl?: string
}

export interface VariantConfig {
  name: string
  weight: number // 0-100，多个 variant 权重之和应 = 100
  payload?: Record<string, unknown>
}

interface FlagState {
  config: ExperimentConfig
  /** 当前用户分到的变体索引（-1 表示未启用） */
  variantIndex: number
  /** 是否启用 */
  enabled: boolean
  /** 变体 payload */
  variantPayload: Record<string, unknown> | null
}

const STORAGE_KEY = 'feature_flags_cache'

/** 当前用户 ID 解析器（业务侧注入） */
let userIdResolver: () => string | null = () => null

/** 远程实验配置（异步加载） */
let remoteConfigs: Map<string, ExperimentConfig> = new Map()

/** Flag 状态缓存（运行时） */
const flagStates = new Map<FeatureFlagName, FlagState>()

/**
 * 设置用户 ID 解析器（在登录后调用）
 */
export function setFeatureFlagUserIdResolver(resolver: () => string | null): void {
  userIdResolver = resolver
}

/**
 * 加载远程配置
 */
export async function loadRemoteConfigs(url: string): Promise<void> {
  try {
    const resp = await fetch(url)
    if (!resp.ok) return
    const data = (await resp.json()) as Record<string, ExperimentConfig>
    remoteConfigs = new Map(Object.entries(data))
    persistCache()
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[featureFlag] 远程配置加载失败', e)
  }
}

/**
 * 启用 / 关闭实验
 */
export function setExperiment(name: FeatureFlagName, config: ExperimentConfig): void {
  const userId = userIdResolver() || ''
  const { variantIndex, enabled, variantPayload } = evaluateExperiment(config, userId)
  flagStates.set(name, { config, variantIndex, enabled, variantPayload })
  persistCache()
}

/**
 * 检查是否启用
 */
export function isFeatureEnabled(name: FeatureFlagName): boolean {
  const state = flagStates.get(name)
  if (!state) {
    // 尝试从远程配置加载
    const remote = remoteConfigs.get(name)
    if (remote) {
      setExperiment(name, remote)
      return flagStates.get(name)?.enabled || false
    }
    return false
  }
  if (state.config.expiresAt && Date.now() > state.config.expiresAt) {
    return false
  }
  return state.enabled
}

/**
 * 获取变体名称
 */
export function getVariant(name: FeatureFlagName): string | null {
  const state = flagStates.get(name)
  if (!state || !state.enabled || state.variantIndex < 0) return null
  return state.config.variants?.[state.variantIndex]?.name || null
}

/**
 * 获取变体 payload
 */
export function getVariantPayload<T = Record<string, unknown>>(name: FeatureFlagName): T | null {
  const state = flagStates.get(name)
  if (!state || !state.enabled) return null
  return (state.variantPayload || {}) as T
}

/**
 * 调试：获取所有 flag 状态
 */
export function getAllFlagStates(): Record<string, { enabled: boolean; variant: string | null; rollout: number }> {
  const out: Record<string, { enabled: boolean; variant: string | null; rollout: number }> = {}
  for (const [name, state] of flagStates.entries()) {
    out[name] = {
      enabled: state.enabled,
      variant: getVariant(name),
      rollout: state.config.rolloutPercentage,
    }
  }
  return out
}

/**
 * 清理所有 flag（测试用）
 */
export function clearAllFlags(): void {
  flagStates.clear()
  remoteConfigs.clear()
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 忽略
  }
}

/**
 * 内部：评估实验
 */
function evaluateExperiment(config: ExperimentConfig, userId: string): {
  variantIndex: number
  enabled: boolean
  variantPayload: Record<string, unknown> | null
} {
  // 1. 过期
  if (config.expiresAt && Date.now() > config.expiresAt) {
    return { variantIndex: -1, enabled: false, variantPayload: null }
  }

  // 2. 黑名单
  if (config.blacklist?.includes(userId)) {
    return { variantIndex: -1, enabled: false, variantPayload: null }
  }

  // 3. 白名单
  if (config.whitelist?.includes(userId)) {
    const variantIndex = pickVariant(config.variants, userId)
    return {
      variantIndex,
      enabled: true,
      variantPayload: config.variants?.[variantIndex]?.payload || null,
    }
  }

  // 4. 灰度比例
  const userBucket = hashBucket(userId, 10000) // 0-9999
  const threshold = (config.rolloutPercentage / 100) * 10000
  if (userBucket >= threshold) {
    return { variantIndex: -1, enabled: false, variantPayload: null }
  }

  // 5. 分配变体
  const variantIndex = pickVariant(config.variants, userId)
  return {
    variantIndex,
    enabled: true,
    variantPayload: config.variants?.[variantIndex]?.payload || null,
  }
}

/**
 * 内部：一致性哈希分桶
 */
function hashBucket(key: string, buckets: number): number {
  if (!key) return Math.floor(Math.random() * buckets) // 无用户时随机
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % buckets
}

/**
 * 内部：变体选择（按权重）
 */
function pickVariant(variants: VariantConfig[] | undefined, userId: string): number {
  if (!variants || variants.length === 0) return -1
  const totalWeight = variants.reduce((s, v) => s + Math.max(0, v.weight), 0)
  if (totalWeight <= 0) return -1
  const userBucket = hashBucket(userId + '_variant', totalWeight)
  let acc = 0
  for (let i = 0; i < variants.length; i++) {
    acc += Math.max(0, variants[i].weight)
    if (userBucket < acc) return i
  }
  return variants.length - 1
}

/**
 * 内部：持久化缓存
 */
function persistCache(): void {
  if (typeof localStorage === 'undefined') return
  try {
    const data: Record<string, ExperimentConfig> = {}
    for (const [k, v] of remoteConfigs.entries()) data[k] = v
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // 忽略
  }
}

/**
 * 内部：从缓存恢复
 */
export function restoreFromCache(): void {
  if (typeof localStorage === 'undefined') return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw) as Record<string, ExperimentConfig>
    remoteConfigs = new Map(Object.entries(data))
  } catch {
    // 忽略
  }
}
