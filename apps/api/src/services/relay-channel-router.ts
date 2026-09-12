// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 中转站核心调度引擎(2026-07-31 立,#4 #6 合并任务)。
 *
 * 职责:
 * 1. selectChannelKey(model): 按模型路由 → 找可用渠道组 → 组内按策略选 key_pool 条目
 *    selectChannelCandidates(model, ..., limit): 有序候选列表(转发层逐请求 failover 用)
 * 2. recordChannelResult(keyPoolId, success, latencyMs): 记录调用结果,更新熔断状态
 * 3. 熔断状态机(2026-09-12 迁 Redis,多实例共享;Redis 不可用降级进程内存):
 *    closed → open(连续 3 次失败)→ half-open(60s 后)→ closed/open
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
import IORedis, { type Redis } from 'ioredis'
import { dbRead } from '../db/index.js'
import { config } from '../config/index.js'
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
  extraMetadata: unknown
}

interface WeightedItem {
  keyPoolId: string
  weight: number
}

// ============================================================================
// 内存状态(进程级;Redis 可用时仅作降级兜底镜像,Redis 不可用时为主状态)
// ============================================================================
const circuitMap = new Map<string, CircuitState>()
const recentCallsMap = new Map<string, CallRecord[]>()
const roundRobinIndexMap = new Map<string, number>()

// session-affinity:亲和性缓存,key = affinityKey(userId|apiKeyId),value = { channelId, expireAt }
const sessionAffinityMap = new Map<string, { channelId: string; expireAt: number }>()
// least-connections:每个渠道的当前活跃连接数(请求开始 +1,响应结束 -1)
const activeConnectionsMap = new Map<string, number>()

// ============================================================================
// 跨实例共享状态(Redis,2026-09-12 立)
// ----------------------------------------------------------------------------
// 熔断状态 / session-affinity / round-robin 游标原为进程内存态,多实例部署时
// 各实例状态互不可见(实例 A 熔断的渠道在实例 B 仍会被选中)。迁移到 Redis:
//   - relay:circuit:{keyPoolId}   hash{state,failureCount,lastFailureAt,halfOpenAt} TTL 600s
//   - relay:affinity:{affinityKey} string(channelId) TTL 600s(与内存亲和 TTL 一致)
//   - relay:rr:{groupId}          counter(INCR 取模)
// recentCallsMap(least-latency 统计)与 activeConnectionsMap(连接数)保留进程内存:
//   - 连接数语义上就是实例本地的(连接终止在本实例)
//   - 延迟统计跨实例共享收益低(需 List 读写放大),多实例下按实例本地近似即可
// Redis 不可用(连接失败/超时)时所有操作降级回内存实现,功能不中断。
// ============================================================================
let redisClient: Redis | null = null
let redisDisabled = false // 首次致命错误后熔断 Redis(进程生命周期内不再重试,避免每请求超时)

function getRedis(): Redis | null {
  if (redisDisabled) return null
  if (redisClient) return redisClient
  try {
    redisClient = new IORedis(config.REDIS_URL, {
      lazyConnect: true,
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: null, // 连接失败不重连 → 后续命令立即拒绝 → 走内存降级
    })
    redisClient.on('error', () => {
      /* 静默:错误由调用方 catch 后降级 */
    })
    void redisClient.connect().catch(() => {
      redisDisabled = true
    })
    return redisClient
  } catch {
    redisDisabled = true
    return null
  }
}

/** Redis 操作统一包装:任何错误返回 null 并熔断 Redis(降级内存)。 */
async function redisOp<T>(fn: (r: Redis) => Promise<T>): Promise<T | null> {
  const r = getRedis()
  if (!r) return null
  try {
    return await fn(r)
  } catch {
    redisDisabled = true
    return null
  }
}

const CIRCUIT_REDIS_TTL_S = 600 // 熔断状态键 TTL(10 分钟无更新自动消失 = 状态自愈为 closed)
const AFFINITY_REDIS_TTL_S = SESSION_AFFINITY_TTL_MS / 1000

function circuitToRedis(state: CircuitState): Record<string, string> {
  return {
    state: state.state,
    failureCount: String(state.failureCount),
    lastFailureAt: String(state.lastFailureAt),
    halfOpenAt: state.halfOpenAt === null ? '' : String(state.halfOpenAt),
  }
}

function circuitFromRedis(raw: Record<string, string>): CircuitState | null {
  const state = raw['state']
  if (state !== 'closed' && state !== 'open' && state !== 'half-open') return null
  const failureCount = Number(raw['failureCount'] ?? 0)
  const lastFailureAt = Number(raw['lastFailureAt'] ?? 0)
  const halfOpenRaw = raw['halfOpenAt'] ?? ''
  return {
    state,
    failureCount: Number.isFinite(failureCount) ? failureCount : 0,
    lastFailureAt: Number.isFinite(lastFailureAt) ? lastFailureAt : 0,
    halfOpenAt: halfOpenRaw === '' ? null : Number(halfOpenRaw) || null,
  }
}

/** 读熔断状态:Redis 优先,降级内存。不触发 open→half-open 转换(由 isCircuitOpen 负责)。 */
async function readCircuitState(keyPoolId: string): Promise<CircuitState> {
  const raw = await redisOp((r) => r.hgetall(`relay:circuit:${keyPoolId}`))
  if (raw && Object.keys(raw).length > 0) {
    const parsed = circuitFromRedis(raw)
    if (parsed) return parsed
  }
  return (
    circuitMap.get(keyPoolId) ?? {
      state: 'closed',
      failureCount: 0,
      lastFailureAt: 0,
      halfOpenAt: null,
    }
  )
}

/** 写熔断状态:Redis(hash + TTL)与内存镜像双写。 */
async function writeCircuitState(keyPoolId: string, state: CircuitState): Promise<void> {
  circuitMap.set(keyPoolId, state)
  await redisOp(async (r) => {
    const key = `relay:circuit:${keyPoolId}`
    await r.hset(key, circuitToRedis(state))
    await r.expire(key, CIRCUIT_REDIS_TTL_S)
  })
}

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
 * 副作用:若 open 状态已超过熔断时长,转为 half-open 允许探测(转换结果双写 Redis + 内存)。
 * 2026-09-12:改为异步,状态读 Redis(多实例共享),Redis 不可用降级内存。
 */
export async function isCircuitOpen(keyPoolId: string): Promise<boolean> {
  const state = await readCircuitState(keyPoolId)
  if (state.state === 'closed') return false
  if (state.state === 'open') {
    // 检查是否超过熔断时长 → 转 half-open
    if (Date.now() - state.lastFailureAt >= CIRCUIT_OPEN_DURATION_MS) {
      state.state = 'half-open'
      state.halfOpenAt = Date.now()
      await writeCircuitState(keyPoolId, state) // 允许探测
      return false
    }
    return true // 仍在熔断期
  }
  // half-open:允许探测(简化:并发场景下第一个结果会转换状态)
  return false
}

/** 获取熔断状态(供 admin 端点查询,只读)。 */
export async function getCircuitState(keyPoolId: string): Promise<CircuitState> {
  const state = await readCircuitState(keyPoolId)
  // 触发 open → half-open 转换检查(与 isCircuitOpen 一致)
  void isCircuitOpen(keyPoolId).catch(() => {})
  return state
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
  // 记录最近调用(用于 least-latency 策略 + 统计;进程本地近似)
  pushRecentCall(keyPoolId, { success, latencyMs, ts: Date.now() })

  // 获取当前状态(Redis 优先)
  const state = await readCircuitState(keyPoolId)

  if (success) {
    // 成功:重置 failureCount,状态 → closed(无论之前是 closed/half-open)
    state.failureCount = 0
    state.state = 'closed'
    state.halfOpenAt = null
    await writeCircuitState(keyPoolId, state)
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
  await writeCircuitState(keyPoolId, state)
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

/** round-robin 策略:轮询(Redis INCR 跨实例共享游标;Redis 不可用降级内存 Map)。 */
async function selectByRoundRobin(
  groupId: string,
  items: WeightedItem[],
): Promise<WeightedItem | null> {
  if (items.length === 0) return null
  const n = await redisOp((r) => r.incr(`relay:rr:${groupId}`))
  if (n !== null && n > 0) {
    await redisOp((r) => r.expire(`relay:rr:${groupId}`, CIRCUIT_REDIS_TTL_S))
    return items[(n - 1) % items.length] ?? null
  }
  // 内存降级
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
async function selectBySessionAffinity(
  affinityKey: string,
  items: WeightedItem[],
  groupId: string,
): Promise<WeightedItem | null> {
  if (items.length === 0) return null

  // 1. 查亲和性缓存(Redis 优先 → 内存降级;惰性清理过期条目)
  let cachedChannelId: string | null = null
  const redisVal = await redisOp((r) => r.get(`relay:affinity:${affinityKey}`))
  if (redisVal !== null) {
    cachedChannelId = redisVal
  } else {
    const cached = sessionAffinityMap.get(affinityKey)
    if (cached) {
      if (Date.now() > cached.expireAt) {
        sessionAffinityMap.delete(affinityKey)
      } else {
        cachedChannelId = cached.channelId
      }
    }
  }
  if (cachedChannelId) {
    // 缓存有效,检查对应渠道是否仍在可用列表中
    const hit = items.find((i) => i.keyPoolId === cachedChannelId)
    if (hit) {
      // 亲和性命中:走同一渠道,不触碰 circuitMap(熔断状态仅由 recordChannelResult 更新),正常计费。
      return hit
    }
    // 渠道不可用(熔断/禁用/移除)→ fallback 到 round-robin 选新渠道
  }

  // 2. 无有效亲和性 → fallback 到 round-robin
  const selected = await selectByRoundRobin(groupId, items)
  if (selected) {
    // 3. 写入缓存(TTL 10 分钟;Redis + 内存双写)
    await redisOp((r) =>
      r.set(`relay:affinity:${affinityKey}`, selected.keyPoolId, 'EX', AFFINITY_REDIS_TTL_S),
    )
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

/** 按策略选 key(2026-09-12:round-robin/affinity 改异步 Redis 共享)。 */
async function selectByStrategy(
  groupId: string,
  strategy: string,
  items: WeightedItem[],
  affinityKey?: string,
): Promise<WeightedItem | null> {
  if (strategy === 'round-robin') return await selectByRoundRobin(groupId, items)
  if (strategy === 'least-latency') return selectByLeastLatency(items)
  if (strategy === 'session-affinity') {
    return await selectBySessionAffinity(affinityKey ?? groupId, items, groupId)
  }
  if (strategy === 'least-connections') return selectByLeastConnections(items)
  // weight (default)
  return selectByWeight(items)
}

// ============================================================================
// 核心选 key 逻辑
// ============================================================================
/**
 * 按模型路由选 channel key 候选列表(按切换优先级排序,供转发层逐请求 failover)。
 *
 * 流程(2026-09-13 多上游同模型改造):
 * 1. 查 aiModelConfigModels 找该 model 对应的**全部** configId(需 enabled + isRelayPublic;
 *    同一 modelId 可在多个 provider/config 上架,如 token6688 与 swiftapi 同时供同一模型)
 * 2. 查 aiModelConfig 找这些 configId 的 providerCode + baseUrl(需 enabled)
 * 3. 查 aiRelayKeyPool 找这些 providerCode 的可用 key(需 isEnabled=true;
 *    key 级 extraMetadata.baseUrl 覆盖 config.baseUrl——同一聚合上游多端点各自成渠,按 key 粒度测速/熔断/切换)
 * 4. 过滤掉熔断 open 的 key
 * 5. 查 aiRelayChannelGroupMembers 找这些 key 所属的组
 * 6. 查 aiRelayChannelGroups 找启用的组,按优先级排序(高的先)
 * 7. 逐组按 loadBalanceStrategy 产生首选,其余 key 按权重降序作为组内备选
 * 8. 所有组失败 → fallback:全部可用 key 按权重降序(默认组)
 * 9. 候选去重后逐个检查渠道配额(超限剔除),最多返回 limit 个
 *
 * @param model 模型 id(如 'gpt-4o',DB 原始 model_id,不带 LiteLLM 前缀)
 * @param userId 预留:未来按用户分级路由(当前未使用,session-affinity 时可作亲和性 key)
 * @param affinityKey 亲和性 key(userId 或 api_key_id,session-affinity 策略用);未传时回退到 userId
 * @param limit 最多返回的候选数(默认 3,转发层逐个尝试实现 failover)
 * @returns 有序候选列表(空 = 无可用渠道)
 */
export async function selectChannelCandidates(
  model: string,
  userId?: string,
  affinityKey?: string,
  limit = 3,
): Promise<SelectedChannelKey[]> {
  if (limit <= 0) return []
  // session-affinity 策略的亲和性 key:优先用传入的 affinityKey,否则回退到 userId
  const effectiveAffinityKey = affinityKey ?? userId

  // 1. 查 model → 全部匹配的 configId(多上游同模型:同一 modelId 允许多 config 同时上架)
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
  if (modelRows.length === 0) return []
  const configIds = [...new Set(modelRows.map((r) => r.configId))]
  if (configIds.length === 0) return []

  // 2. 查全部启用 config → providerCode + baseUrl(每个 config = 一条独立上游链路)
  const configs = await dbRead
    .select({
      id: aiModelConfig.id,
      providerCode: aiModelConfig.providerCode,
      baseUrl: aiModelConfig.baseUrl,
    })
    .from(aiModelConfig)
    .where(and(inArray(aiModelConfig.id, configIds), eq(aiModelConfig.enabled, true)))
  if (configs.length === 0) return []

  /** providerCode → 首个启用 config(同一 provider 多 config 时取第一条;key 级覆盖可改 baseUrl) */
  const configByProvider = new Map<string, { id: number; providerCode: string; baseUrl: string }>()
  for (const c of configs) {
    if (!configByProvider.has(c.providerCode)) {
      configByProvider.set(c.providerCode, c)
    }
  }

  // 3. 查 key_pool → 所有相关 providerCode 的可用 key(按权重降序,天然成为备选顺序)
  const providerCodes = [...new Set(configs.map((c) => c.providerCode))]
  const keys = await dbRead
    .select({
      id: aiRelayKeyPool.id,
      apiKeyEnc: aiRelayKeyPool.apiKeyEnc,
      providerCode: aiRelayKeyPool.providerCode,
      weight: aiRelayKeyPool.weight,
      extraMetadata: aiRelayKeyPool.extraMetadata,
    })
    .from(aiRelayKeyPool)
    .where(
      and(inArray(aiRelayKeyPool.providerCode, providerCodes), eq(aiRelayKeyPool.isEnabled, true)),
    )
  if (keys.length === 0) return []

  // 4. 过滤掉熔断 open 的 key
  const circuitFlags = await Promise.all(keys.map((k) => isCircuitOpen(k.id)))
  const availableKeys: KeyPoolRow[] = keys.filter((_, i) => !circuitFlags[i])
  if (availableKeys.length === 0) return []
  const byWeightDesc = (a: { weight: number }, b: { weight: number }) => b.weight - a.weight

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

  // 7. 按组优先级排序(高的先),逐组产生候选:策略首选 + 权重降序备选
  groups.sort((a, b) => b.priority - a.priority)

  /** 有序候选(未去重/未查配额),以 keyPoolId 标识 */
  const ordered: Array<{ candidate: SelectedChannelKey }> = []
  const seen = new Set<string>()

  /** 安全解析 extra_metadata(保留未知字段)。 */
  const readKeyMetadata = (raw: unknown): Record<string, unknown> => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
    return raw as Record<string, unknown>
  }

  /**
   * 解析候选上游 baseUrl:key 级 extraMetadata.baseUrl 覆盖 > config.baseUrl。
   * 同一聚合上游(如 swiftapi)的多端点各建一条 key_pool 条目、各自覆写 baseUrl,
   * 即得以 key 粒度参与测速(least-latency)/熔断/自动切换。
   */
  const resolveCandidateTarget = (
    keyData: KeyPoolRow,
  ): { baseUrl: string; configId: string; providerCode: string } | null => {
    const cfg = configByProvider.get(keyData.providerCode)
    if (!cfg) return null
    const meta = readKeyMetadata(keyData.extraMetadata)
    const override = meta['baseUrl']
    const baseUrl =
      typeof override === 'string' && override.trim() !== '' ? override.trim() : cfg.baseUrl
    return { baseUrl, configId: String(cfg.id), providerCode: keyData.providerCode }
  }

  const pushCandidate = (keyData: KeyPoolRow, groupId: string, groupName: string) => {
    if (seen.has(keyData.id)) return
    const target = resolveCandidateTarget(keyData)
    if (!target) return
    seen.add(keyData.id)
    ordered.push({
      candidate: {
        keyPoolId: keyData.id,
        apiKey: decryptApiKey(keyData.apiKeyEnc),
        baseUrl: target.baseUrl,
        providerCode: target.providerCode,
        configId: target.configId,
        groupId,
        groupName,
      },
    })
  }

  for (const group of groups) {
    if (ordered.length >= limit) break
    const groupMembers: MemberRow[] = members.filter((m) => m.groupId === group.id)
    // 过滤掉熔断 open 的 key
    const memberFlags = await Promise.all(groupMembers.map((m) => isCircuitOpen(m.keyPoolId)))
    const availableMembers = groupMembers.filter((_, i) => !memberFlags[i])
    if (availableMembers.length === 0) continue

    const items: WeightedItem[] = availableMembers.map((m) => ({
      keyPoolId: m.keyPoolId,
      weight: m.weight,
    }))

    // 组内首选:按 loadBalanceStrategy 选
    const primary = await selectByStrategy(
      group.id,
      group.loadBalanceStrategy,
      items,
      effectiveAffinityKey,
    )
    if (primary) {
      const keyData = availableKeys.find((k) => k.id === primary.keyPoolId)
      if (keyData) pushCandidate(keyData, group.id, group.name)
    }
    // 组内备选:其余 key 按权重降序(策略首选已入列会被去重跳过)
    const rest = items.filter((i) => i.keyPoolId !== primary?.keyPoolId).sort(byWeightDesc)
    for (const item of rest) {
      if (ordered.length >= limit) break
      const keyData = availableKeys.find((k) => k.id === item.keyPoolId)
      if (keyData) pushCandidate(keyData, group.id, group.name)
    }
  }

  // 8. 无组配置或组候选不足 → fallback:全部可用 key 按权重降序(默认组)
  if (ordered.length < limit) {
    const fallback = [...availableKeys].sort(byWeightDesc)
    for (const keyData of fallback) {
      if (ordered.length >= limit) break
      pushCandidate(keyData, '', '(default)')
    }
  }

  // 9. 渠道配额检查:超限剔除(最多顺序检查前 6 个,避免放大查询)
  const result: SelectedChannelKey[] = []
  for (const { candidate } of ordered) {
    if (result.length >= limit) break
    if (result.some((r) => r.keyPoolId === candidate.keyPoolId)) continue
    const quotaResult = await checkQuota(candidate.keyPoolId)
    if (!quotaResult.allowed) {
      console.warn(
        `[relay-router] channel quota exceeded, skip key ${candidate.keyPoolId} in group ${candidate.groupName}`,
        { reason: quotaResult.reason ?? 'unknown' },
      )
      continue
    }
    result.push(candidate)
  }
  return result
}

/**
 * 按模型路由选 channel key(兼容入口,等价于 selectChannelCandidates 的首个候选)。
 * 2026-09-12:转发层 failover 改用 selectChannelCandidates,本函数保留为单选便捷入口。
 */
export async function selectChannelKey(
  model: string,
  userId?: string,
  affinityKey?: string,
): Promise<SelectedChannelKey | null> {
  const candidates = await selectChannelCandidates(model, userId, affinityKey, 1)
  return candidates[0] ?? null
}

// ============================================================================
// 统计辅助(供 admin 端点用)
// ============================================================================
/** 获取某 key 的最近调用记录(只读副本)。 */
export function getRecentCalls(keyPoolId: string): CallRecord[] {
  const list = recentCallsMap.get(keyPoolId)
  return list ? [...list] : []
}

/** 重置某 key 的熔断状态(供 admin 手动恢复用;Redis + 内存双清)。 */
export async function resetCircuit(keyPoolId: string): Promise<void> {
  circuitMap.delete(keyPoolId)
  await redisOp((r) => r.del(`relay:circuit:${keyPoolId}`))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
