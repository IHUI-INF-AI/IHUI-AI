/**
 * 中转站核心调度引擎(2026-07-31 立,#4 #6 合并任务)。
 *
 * 职责:
 * 1. selectChannelKey(model): 按模型路由 → 找可用渠道组 → 组内按策略选 key_pool 条目
 * 2. recordChannelResult(keyPoolId, success, latencyMs): 记录调用结果,更新熔断状态
 * 3. 熔断状态机(内存 Map,进程级,不持久化):closed → open(连续 3 次失败)→ half-open(60s 后)→ closed/open
 * 4. 负载均衡策略:weight(加权随机)/ round-robin(轮询)/ least-latency(最少延迟)
 *    + session-affinity(渠道亲和性,2026-07-31 立,TTL 10min,fallback round-robin)
 *    + least-connections(最小连接数,2026-07-31 立,适合 Realtime WebSocket 等长连接)
 *
 * 按模型路由流程:
 *   aiModelConfigModels(modelId) → aiModelConfig(configId, providerCode, baseUrl)
 *   → aiRelayKeyPool(providerCode) → aiRelayChannelGroupMembers(keyPoolId) → aiRelayChannelGroups(groupId)
 *   → 按组优先级排序,组内按策略选 key
 *
 * 故障切换:某 key 熔断 open 时跳过,降级到组内其他 key 或下一个优先级组
 *
 * 注意:本服务只负责选 key + 熔断状态,不调用上游(调用链路由由 vendor-caller-service 等负责)
 */
import { eq, and, inArray } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import {
  aiModelConfig,
  aiModelConfigModels,
  aiRelayKeyPool,
  aiRelayChannelGroups,
  aiRelayChannelGroupMembers,
} from '@ihui/database'
import { decryptJSON, type EncryptedPayload } from '../utils/crypto.js'
import { checkQuota } from './channel-quota-service.js'

// ============================================================================
// 常量
// ============================================================================
const CIRCUIT_FAILURE_THRESHOLD = 3 // 连续 3 次失败 → open
const CIRCUIT_OPEN_DURATION_MS = 60_000 // 熔断 60s 后转 half-open
const MAX_RECENT_CALLS = 10 // 最近调用记录上限(用于 least-latency 策略 + 统计)
// session-affinity:亲和性缓存 TTL(10 分钟,过期后重新选渠道,避免粘到已下线渠道)
const SESSION_AFFINITY_TTL_MS = 10 * 60 * 1000
// session-affinity:定期清理周期(与 TTL 一致,清理过期亲和性条目,防止内存泄漏)
const SESSION_AFFINITY_SWEEP_INTERVAL_MS = SESSION_AFFINITY_TTL_MS
// 渠道配额检查:组内单次选 key 的最大重试次数(配额超限则剔除该 key 重选,避免死循环)
const MAX_QUOTA_RETRY = 3

// ============================================================================
// 类型定义
// ============================================================================
export type CircuitStateName = 'closed' | 'open' | 'half-open'

export interface CircuitState {
  state: CircuitStateName
  failureCount: number
  lastFailureAt: number
  halfOpenAt: number | null
}

interface CallRecord {
  success: boolean
  latencyMs: number
  ts: number
}

export interface SelectedChannelKey {
  keyPoolId: string
  apiKey: string
  baseUrl: string
  providerCode: string
  configId: string
  groupId: string
  groupName: string
}

interface GroupRow {
  id: string
  name: string
  loadBalanceStrategy: string
  priority: number
}

interface MemberRow {
  memberId: string
  groupId: string
  keyPoolId: string
  weight: number
}

interface KeyPoolRow {
  id: string
  apiKeyEnc: string
  providerCode: string
  weight: number
}

interface WeightedItem {
  keyPoolId: string
  weight: number
}

// ============================================================================
// 内存状态(进程级,不持久化,重启清空)
// ============================================================================
const circuitMap = new Map<string, CircuitState>()
const recentCallsMap = new Map<string, CallRecord[]>()
const roundRobinIndexMap = new Map<string, number>()

// session-affinity:亲和性缓存,key = affinityKey(userId|apiKeyId),value = { channelId, expireAt }
const sessionAffinityMap = new Map<string, { channelId: string; expireAt: number }>()
// least-connections:每个渠道的当前活跃连接数(请求开始 +1,响应结束 -1)
const activeConnectionsMap = new Map<string, number>()

// session-affinity:定期清理过期亲和性条目(防止一次性用户导致内存泄漏)
// unref 确保定时器不会阻止进程退出;stopRelayChannelRouterSweep 供 index.ts shutdown 显式清理
let sweepTimer: ReturnType<typeof setInterval> | null = null
if (typeof setInterval !== 'undefined') {
  sweepTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, val] of sessionAffinityMap) {
      if (now > val.expireAt) sessionAffinityMap.delete(key)
    }
  }, SESSION_AFFINITY_SWEEP_INTERVAL_MS)
  // Node.js 环境下 unref,浏览器/测试环境忽略
  if (typeof sweepTimer.unref === 'function') sweepTimer.unref()
}

/** P2 修复(2026-07-31):显式停止定时器,避免 vitest/HMR 场景下累积。 */
export function stopRelayChannelRouterSweep(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer)
    sweepTimer = null
  }
}

// ============================================================================
// 工具函数
// ============================================================================
/** 解密 api_key_enc(存储格式:JSON.stringify(encryptJSON(plainKey)))。 */
function decryptApiKey(apiKeyEnc: string): string {
  const payload = JSON.parse(apiKeyEnc) as EncryptedPayload
  const plain = decryptJSON(payload)
  return typeof plain === 'string' ? plain : String(plain)
}

/** 记录最近调用(滑动窗口,保留最近 MAX_RECENT_CALLS 条)。 */
function pushRecentCall(keyPoolId: string, record: CallRecord): void {
  const list = recentCallsMap.get(keyPoolId) ?? []
  list.push(record)
  if (list.length > MAX_RECENT_CALLS) list.shift()
  recentCallsMap.set(keyPoolId, list)
}

/** 计算最近调用的平均延迟(无记录返回 null)。 */
function getAvgLatency(keyPoolId: string): number | null {
  const list = recentCallsMap.get(keyPoolId)
  if (!list || list.length === 0) return null
  const sum = list.reduce((acc, r) => acc + r.latencyMs, 0)
  return sum / list.length
}

// ============================================================================
// 熔断状态机
// ============================================================================
/**
 * 熔断检查:选 key 时跳过 open 状态。
 * 副作用:若 open 状态已超过熔断时长,转为 half-open 允许探测。
 */
export function isCircuitOpen(keyPoolId: string): boolean {
  const state = circuitMap.get(keyPoolId)
  if (!state) return false // 无状态 = closed(从未失败)
  if (state.state === 'closed') return false
  if (state.state === 'open') {
    // 检查是否超过熔断时长 → 转 half-open
    if (Date.now() - state.lastFailureAt >= CIRCUIT_OPEN_DURATION_MS) {
      state.state = 'half-open'
      state.halfOpenAt = Date.now()
      return false // 允许探测
    }
    return true // 仍在熔断期
  }
  // half-open:允许探测(简化:并发场景下第一个结果会转换状态)
  return false
}

/** 获取熔断状态(供 admin 端点查询,只读)。 */
export function getCircuitState(keyPoolId: string): CircuitState {
  const state = circuitMap.get(keyPoolId)
  if (!state) {
    return {
      state: 'closed',
      failureCount: 0,
      lastFailureAt: 0,
      halfOpenAt: null,
    }
  }
  // 触发 open → half-open 转换检查(与 isCircuitOpen 一致)
  void isCircuitOpen(keyPoolId)
  return { ...state }
}

/**
 * 记录调用结果,更新熔断状态。
 * - 成功:重置 failureCount,状态 → closed
 * - 失败:failureCount++,连续 3 次 → open;half-open 失败 → open
 */
export async function recordChannelResult(
  keyPoolId: string,
  success: boolean,
  latencyMs: number,
): Promise<void> {
  // 记录最近调用(用于 least-latency 策略 + 统计)
  pushRecentCall(keyPoolId, { success, latencyMs, ts: Date.now() })

  // 获取或初始化熔断状态
  let state = circuitMap.get(keyPoolId)
  if (!state) {
    state = { state: 'closed', failureCount: 0, lastFailureAt: 0, halfOpenAt: null }
    circuitMap.set(keyPoolId, state)
  }

  if (success) {
    // 成功:重置 failureCount,状态 → closed(无论之前是 closed/half-open)
    state.failureCount = 0
    state.state = 'closed'
    state.halfOpenAt = null
    return
  }

  // 失败:failureCount++,更新 lastFailureAt
  state.failureCount++
  state.lastFailureAt = Date.now()
  // half-open 失败 → 立即转 open;或连续失败达阈值 → open
  if (state.state === 'half-open' || state.failureCount >= CIRCUIT_FAILURE_THRESHOLD) {
    state.state = 'open'
    state.halfOpenAt = null
  }
}

// ============================================================================
// 负载均衡策略
// ============================================================================
/** weight 策略:加权随机(权重越大选中概率越高)。 */
function selectByWeight(items: WeightedItem[]): WeightedItem | null {
  if (items.length === 0) return null
  const totalWeight = items.reduce((sum, i) => sum + Math.max(0, i.weight), 0)
  if (totalWeight <= 0) return items[0] ?? null // 全 0 权重,选第一个
  let r = Math.random() * totalWeight
  for (const item of items) {
    r -= Math.max(0, item.weight)
    if (r < 0) return item
  }
  return items[items.length - 1] ?? null
}

/** round-robin 策略:轮询(内存 Map 记录上次选的 index)。 */
function selectByRoundRobin(groupId: string, items: WeightedItem[]): WeightedItem | null {
  if (items.length === 0) return null
  const lastIndex = roundRobinIndexMap.get(groupId) ?? -1
  const nextIndex = (lastIndex + 1) % items.length
  roundRobinIndexMap.set(groupId, nextIndex)
  return items[nextIndex] ?? null
}

/** least-latency 策略:最少延迟(最近 10 次调用的平均延迟选最小的,无记录优先)。 */
function selectByLeastLatency(items: WeightedItem[]): WeightedItem | null {
  if (items.length === 0) return null
  // 计算每个 item 的平均延迟(无记录 = -1,优先选)
  const scored = items.map((item) => {
    const avg = getAvgLatency(item.keyPoolId)
    return { item, avgLatency: avg ?? -1 }
  })
  // 按平均延迟升序(最小的优先)
  scored.sort((a, b) => a.avgLatency - b.avgLatency)
  return scored[0]?.item ?? null
}

// ----------------------------------------------------------------------------
// session-affinity 策略(2026-07-31 立)
// ----------------------------------------------------------------------------
/**
 * session-affinity 策略:相同 user_id 或 api_key_id 的请求尽量走同一渠道(减少冷启动)。
 *
 * 流程:
 * 1. 查亲和性缓存,若命中且渠道在可用列表中 → 直接返回(亲和性命中)
 * 2. 缓存过期 / 渠道不可用(熔断 open / 已移除)→ fallback 到 round-robin 选新渠道
 * 3. 选中新渠道后写入缓存(TTL 10 分钟)
 *
 * 命中亲和性时不修改 circuitMap(熔断状态仅由 recordChannelResult 更新),正常计费。
 *
 * @param affinityKey 亲和性 key(userId 或 apiKeyId),空时退化为 groupId(无亲和性效果)
 * @param items 当前可用的 key_pool 条目(已过滤熔断 open)
 * @param groupId 组 id(fallback round-robin 用)
 */
function selectBySessionAffinity(
  affinityKey: string,
  items: WeightedItem[],
  groupId: string,
): WeightedItem | null {
  if (items.length === 0) return null

  // 1. 查亲和性缓存(惰性清理过期条目)
  const cached = sessionAffinityMap.get(affinityKey)
  if (cached) {
    if (Date.now() > cached.expireAt) {
      // 过期 → 清理,走 fallback
      sessionAffinityMap.delete(affinityKey)
    } else {
      // 缓存有效,检查对应渠道是否仍在可用列表中
      const hit = items.find((i) => i.keyPoolId === cached.channelId)
      if (hit) {
        // 亲和性命中:走同一渠道,不触碰 circuitMap
        return hit
      }
      // 渠道不可用(熔断/禁用/移除)→ fallback 到 round-robin 选新渠道
    }
  }

  // 2. 无有效亲和性 → fallback 到 round-robin
  const selected = selectByRoundRobin(groupId, items)
  if (selected) {
    // 3. 写入缓存(TTL 10 分钟)
    sessionAffinityMap.set(affinityKey, {
      channelId: selected.keyPoolId,
      expireAt: Date.now() + SESSION_AFFINITY_TTL_MS,
    })
  }
  return selected
}

// ----------------------------------------------------------------------------
// least-connections 策略(2026-07-31 立)
// ----------------------------------------------------------------------------
/**
 * least-connections 策略:优先转发给当前活跃连接最少的渠道。
 * 适合长连接场景(如 Realtime WebSocket),避免单渠道连接堆积。
 *
 * 连接数通过 trackConnectionStart / trackConnectionEnd 手动维护:
 * - 请求/连接开始时调 trackConnectionStart(channelId)
 * - 请求/连接结束时调 trackConnectionEnd(channelId)
 */
function selectByLeastConnections(items: WeightedItem[]): WeightedItem | null {
  if (items.length === 0) return null
  let best: WeightedItem | null = null
  let bestCount = Infinity
  for (const item of items) {
    const count = activeConnectionsMap.get(item.keyPoolId) ?? 0
    if (count < bestCount) {
      bestCount = count
      best = item
    }
  }
  return best
}

/**
 * 记录渠道连接开始(活跃连接数 +1)。
 * 供长连接/流式请求处理器在连接建立时调用。
 */
export function trackConnectionStart(channelId: string): void {
  const current = activeConnectionsMap.get(channelId) ?? 0
  activeConnectionsMap.set(channelId, current + 1)
}

/**
 * 记录渠道连接结束(活跃连接数 -1,降到 0 时清理条目)。
 * 供长连接/流式请求处理器在连接关闭时调用。
 * 必须与 trackConnectionStart 配对调用(建议在 finally 块中调用)。
 */
export function trackConnectionEnd(channelId: string): void {
  const current = activeConnectionsMap.get(channelId) ?? 0
  if (current <= 1) {
    activeConnectionsMap.delete(channelId)
  } else {
    activeConnectionsMap.set(channelId, current - 1)
  }
}

/** 按策略选 key。 */
function selectByStrategy(
  groupId: string,
  strategy: string,
  items: WeightedItem[],
  affinityKey?: string,
): WeightedItem | null {
  if (strategy === 'round-robin') return selectByRoundRobin(groupId, items)
  if (strategy === 'least-latency') return selectByLeastLatency(items)
  if (strategy === 'session-affinity') {
    return selectBySessionAffinity(affinityKey ?? groupId, items, groupId)
  }
  if (strategy === 'least-connections') return selectByLeastConnections(items)
  // weight (default)
  return selectByWeight(items)
}

// ============================================================================
// 核心选 key 逻辑
// ============================================================================
/**
 * 按模型路由选 channel key。
 *
 * 流程:
 * 1. 查 aiModelConfigModels 找该 model 对应的 configId(需 enabled + isRelayPublic)
 * 2. 查 aiModelConfig 找该 configId 的 providerCode + baseUrl(需 enabled)
 * 3. 查 aiRelayKeyPool 找该 providerCode 的可用 key(需 isEnabled=true)
 * 4. 过滤掉熔断 open 的 key
 * 5. 查 aiRelayChannelGroupMembers 找这些 key 所属的组
 * 6. 查 aiRelayChannelGroups 找启用的组,按优先级排序(高的先)
 * 7. 逐组尝试:组内按 loadBalanceStrategy 选 key
 * 8. 所有组都失败 → fallback 到 weight 策略在所有可用 key 中选(默认组)
 *
 * @param model 模型 id(如 'gpt-4o')
 * @param userId 预留:未来按用户分级路由(当前未使用,session-affinity 时可作亲和性 key)
 * @param affinityKey 亲和性 key(userId 或 api_key_id,session-affinity 策略用);未传时回退到 userId
 * @returns 选定的 key 信息,或 null(无可用 key)
 */
export async function selectChannelKey(
  model: string,
  userId?: string,
  affinityKey?: string,
): Promise<SelectedChannelKey | null> {
  // session-affinity 策略的亲和性 key:优先用传入的 affinityKey,否则回退到 userId
  const effectiveAffinityKey = affinityKey ?? userId

  // 1. 查 model → configId
  const modelRows = await dbRead
    .select({ configId: aiModelConfigModels.configId })
    .from(aiModelConfigModels)
    .where(
      and(
        eq(aiModelConfigModels.modelId, model),
        eq(aiModelConfigModels.enabled, true),
        eq(aiModelConfigModels.isRelayPublic, true),
      ),
    )
    .limit(1)
  if (modelRows.length === 0) return null
  const modelRow = modelRows[0]
  if (!modelRow) return null
  const configId = modelRow.configId

  // 2. 查 config → providerCode + baseUrl
  const configRows = await dbRead
    .select({
      id: aiModelConfig.id,
      providerCode: aiModelConfig.providerCode,
      baseUrl: aiModelConfig.baseUrl,
    })
    .from(aiModelConfig)
    .where(and(eq(aiModelConfig.id, configId), eq(aiModelConfig.enabled, true)))
    .limit(1)
  if (configRows.length === 0) return null
  const config = configRows[0]
  if (!config) return null

  // 3. 查 key_pool → 该 providerCode 的可用 key
  const keys = await dbRead
    .select({
      id: aiRelayKeyPool.id,
      apiKeyEnc: aiRelayKeyPool.apiKeyEnc,
      providerCode: aiRelayKeyPool.providerCode,
      weight: aiRelayKeyPool.weight,
    })
    .from(aiRelayKeyPool)
    .where(
      and(eq(aiRelayKeyPool.providerCode, config.providerCode), eq(aiRelayKeyPool.isEnabled, true)),
    )
  if (keys.length === 0) return null

  // 4. 过滤掉熔断 open 的 key
  const availableKeys: KeyPoolRow[] = keys.filter((k) => !isCircuitOpen(k.id))
  if (availableKeys.length === 0) return null

  // 5. 查 channel_group_members → 这些 key 所属的组成员关系
  const keyPoolIds = availableKeys.map((k) => k.id)
  const members = await dbRead
    .select({
      memberId: aiRelayChannelGroupMembers.id,
      groupId: aiRelayChannelGroupMembers.groupId,
      keyPoolId: aiRelayChannelGroupMembers.keyPoolId,
      weight: aiRelayChannelGroupMembers.weight,
    })
    .from(aiRelayChannelGroupMembers)
    .where(inArray(aiRelayChannelGroupMembers.keyPoolId, keyPoolIds))

  // 6. 查 channel_groups → 启用的组
  const groupIds = [...new Set(members.map((m) => m.groupId))]
  let groups: GroupRow[] = []
  if (groupIds.length > 0) {
    const groupRows = await dbRead
      .select({
        id: aiRelayChannelGroups.id,
        name: aiRelayChannelGroups.name,
        loadBalanceStrategy: aiRelayChannelGroups.loadBalanceStrategy,
        priority: aiRelayChannelGroups.priority,
      })
      .from(aiRelayChannelGroups)
      .where(
        and(inArray(aiRelayChannelGroups.id, groupIds), eq(aiRelayChannelGroups.enabled, true)),
      )
    groups = groupRows
  }

  // 7. 按组优先级排序(高的先),逐组尝试选 key
  groups.sort((a, b) => b.priority - a.priority)

  for (const group of groups) {
    const groupMembers: MemberRow[] = members.filter((m) => m.groupId === group.id)
    // 过滤掉熔断 open 的 key
    const availableMembers = groupMembers.filter((m) => !isCircuitOpen(m.keyPoolId))
    if (availableMembers.length === 0) continue

    let items: WeightedItem[] = availableMembers.map((m) => ({
      keyPoolId: m.keyPoolId,
      weight: m.weight,
    }))

    // 组内按策略选 key,选定后检查渠道配额;配额超限则剔除该 key 重选(最多 MAX_QUOTA_RETRY 次)
    for (let attempt = 0; attempt < MAX_QUOTA_RETRY && items.length > 0; attempt++) {
      const selected = selectByStrategy(
        group.id,
        group.loadBalanceStrategy,
        items,
        effectiveAffinityKey,
      )
      if (!selected) break

      const keyData = availableKeys.find((k) => k.id === selected.keyPoolId)
      if (!keyData) {
        // keyData 缺失,从候选列表移除避免死循环
        items = items.filter((i) => i.keyPoolId !== selected.keyPoolId)
        continue
      }

      // 渠道配额检查:超限则跳过该 key,尝试组内下一个
      const quotaResult = await checkQuota(keyData.id)
      if (!quotaResult.allowed) {
        console.warn(
          `[relay-router] channel quota exceeded, skip key ${keyData.id} in group ${group.name}`,
          { reason: quotaResult.reason ?? 'unknown' },
        )
        items = items.filter((i) => i.keyPoolId !== selected.keyPoolId)
        continue
      }

      return {
        keyPoolId: keyData.id,
        apiKey: decryptApiKey(keyData.apiKeyEnc),
        baseUrl: config.baseUrl,
        providerCode: config.providerCode,
        configId: String(config.id),
        groupId: group.id,
        groupName: group.name,
      }
    }
    // 组内所有 key 都超额或不可用 → 降级到下一优先级组
  }

  // 8. 无组配置或所有组都失败 → fallback 到 weight 策略(默认组),同样检查渠道配额
  let fallbackItems: WeightedItem[] = availableKeys.map((k) => ({
    keyPoolId: k.id,
    weight: k.weight,
  }))

  for (let attempt = 0; attempt < MAX_QUOTA_RETRY && fallbackItems.length > 0; attempt++) {
    const fallbackSelected = selectByWeight(fallbackItems)
    if (!fallbackSelected) break

    const keyData = availableKeys.find((k) => k.id === fallbackSelected.keyPoolId)
    if (!keyData) {
      fallbackItems = fallbackItems.filter((i) => i.keyPoolId !== fallbackSelected.keyPoolId)
      continue
    }

    // fallback 渠道同样需检查配额
    const quotaResult = await checkQuota(keyData.id)
    if (!quotaResult.allowed) {
      console.warn(`[relay-router] fallback channel quota exceeded, skip key ${keyData.id}`, {
        reason: quotaResult.reason ?? 'unknown',
      })
      fallbackItems = fallbackItems.filter((i) => i.keyPoolId !== fallbackSelected.keyPoolId)
      continue
    }

    return {
      keyPoolId: keyData.id,
      apiKey: decryptApiKey(keyData.apiKeyEnc),
      baseUrl: config.baseUrl,
      providerCode: config.providerCode,
      configId: String(config.id),
      groupId: '',
      groupName: '(default)',
    }
  }

  return null
}

// ============================================================================
// 统计辅助(供 admin 端点用)
// ============================================================================
/** 获取某 key 的最近调用记录(只读副本)。 */
export function getRecentCalls(keyPoolId: string): CallRecord[] {
  const list = recentCallsMap.get(keyPoolId)
  return list ? [...list] : []
}

/** 重置某 key 的熔断状态(供 admin 手动恢复用)。 */
export function resetCircuit(keyPoolId: string): void {
  circuitMap.delete(keyPoolId)
}
