// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 多 Agent 工作区锁(2-2,ioredis 版)。
 *
 * 跨端协议契约(与 apps/ai-service/app/services/workspace_lock.py 双侧同步维护,
 * 改动任何一项必须同时改另一侧):
 *   key:      ihui:workspace_lock:{workspace}
 *   TTL:      120s(两侧一致)
 *   value:    JSON,canonical 字段为 snake_case:
 *             {workspace, holder, token, acquired_at, heartbeat_at}
 *   兼容读取: 两侧解析器同时接受 snake_case 与 camelCase 历史格式
 *             (acquiredAt/heartbeatAt),防止跨服务互读失败
 *   释放/续期: Lua 脚本 cjson 解码后比较 token 字段(原子,防误删他人锁)
 *   解析失败:   一律视为"未知格式的活锁"——不删除、不抢锁
 *             (宁可不抢,不可误删;Redis TTL 保证坏 key 最终自愈)
 *
 * 降级(F-204):Redis 不可用时退化为进程内 Map。该降级只在单实例下语义一致,
 * 多实例下不具备跨实例互斥 —— 因此:
 *   - 每次降级都打 warn 并累加计数(getWorkspaceLockDegradeCount 可观测);
 *   - 内存锁同样带 TTL(过期自动释放)与 owner(token)校验(非 owner 不能释放/续期);
 *   - WORKSPACE_LOCK_FAIL_FAST=true 时不再降级,直接抛 WORKSPACE_LOCK_REDIS_UNAVAILABLE。
 */
import { randomUUID } from 'crypto'
import IORedis, { type Redis } from 'ioredis'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'

/** 锁 TTL(秒),与 ai-service WORKSPACE_LOCK_TTL 保持一致 */
export const WORKSPACE_LOCK_TTL = 120

const LOCK_KEY_PREFIX = 'ihui:workspace_lock:'

export interface WorkspaceLockInfo {
  workspace: string
  holder: string
  token: string
  acquiredAt: number
  heartbeatAt: number
}

// 释放/续期 Lua(与 Python 侧逐字一致,协议改动须双侧同步)
const RELEASE_LUA = `
local v = redis.call("get", KEYS[1])
if not v then return 0 end
local ok, d = pcall(cjson.decode, v)
if not ok or type(d) ~= "table" or d["token"] ~= ARGV[1] then return 0 end
return redis.call("del", KEYS[1])
`
const RENEW_LUA = `
local v = redis.call("get", KEYS[1])
if not v then return 0 end
local ok, d = pcall(cjson.decode, v)
if not ok or type(d) ~= "table" or d["token"] ~= ARGV[1] then return 0 end
redis.call("expire", KEYS[1], ARGV[2])
return 1
`

let redisClient: Redis | null = null

function getRedis(): Redis | null {
  if (redisClient) return redisClient
  try {
    redisClient = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: false,
    })
    redisClient.on('error', (err) => {
      logger.error('[workspace-lock] redis error', { error: err })
    })
    const quit = (): void => {
      redisClient?.quit().catch(() => {
        /* ignore */
      })
    }
    process.once('SIGTERM', quit)
    process.once('SIGINT', quit)
  } catch (e) {
    logger.error('[workspace-lock] redis init failed', { error: e })
    redisClient = null
  }
  return redisClient
}

function lockKey(workspace: string): string {
  return `${LOCK_KEY_PREFIX}${workspace}`
}

/** 锁 value 原始字段(snake_case canonical + camelCase 历史格式兼容) */
interface RawLockFields {
  workspace?: unknown
  holder?: unknown
  token?: unknown
  acquired_at?: unknown
  acquiredAt?: unknown
  heartbeat_at?: unknown
  heartbeatAt?: unknown
}

function parseLock(raw: string | null, workspace: string): WorkspaceLockInfo | null {
  if (!raw) return null
  let d: RawLockFields
  try {
    d = JSON.parse(raw) as RawLockFields
  } catch {
    logger.warn('[workspace-lock] 未知格式锁值,按被持有处理(不删除)', { workspace })
    return null
  }
  if (typeof d.holder !== 'string' || typeof d.token !== 'string') {
    logger.warn('[workspace-lock] 未知格式锁值,按被持有处理(不删除)', { workspace })
    return null
  }
  const num = (...keys: (keyof RawLockFields)[]): number => {
    for (const k of keys) {
      const v = d[k]
      if (typeof v === 'number' && Number.isFinite(v)) return v
    }
    return 0
  }
  return {
    workspace: typeof d.workspace === 'string' ? d.workspace : workspace,
    holder: d.holder,
    token: d.token,
    acquiredAt: num('acquired_at', 'acquiredAt'),
    heartbeatAt: num('heartbeat_at', 'heartbeatAt'),
  }
}

/** 序列化为 canonical snake_case 格式(跨端协议,见文件头契约) */
function serializeLock(info: WorkspaceLockInfo): string {
  return JSON.stringify({
    workspace: info.workspace,
    holder: info.holder,
    token: info.token,
    acquired_at: info.acquiredAt,
    heartbeat_at: info.heartbeatAt,
  })
}

// ---------------------------------------------------------------------------
// 降级可观测(F-204):Redis 不可用时每次降级 warn + 计数,并提供 fail-fast 开关
// ---------------------------------------------------------------------------
let degradeCount = 0

/** 降级累计次数(运维/测试可观测:>0 即说明当前进程正在用进程内锁) */
export function getWorkspaceLockDegradeCount(): number {
  return degradeCount
}

/** 测试隔离:重置降级计数 */
export function _resetWorkspaceLockDegradeStats(): void {
  degradeCount = 0
}

/** fail-fast:显式开启才抛错,默认 false 维持线上历史降级行为(配置见 config.WORKSPACE_LOCK_FAIL_FAST) */
function isFailFastOnRedisFailure(): boolean {
  return config.WORKSPACE_LOCK_FAIL_FAST === true
}

/**
 * 统一降级出口:计数 + warn 留痕;fail-fast 档直接抛错,不进入内存锁。
 * 调用方(acquire/renew/release/get/force)在 catch 与"无 Redis 客户端"两处复用。
 */
function onRedisUnavailable(operation: string, workspace: string, error: unknown): void {
  degradeCount++
  logger.warn('[workspace-lock] redis 不可用,降级为进程内锁(无跨实例互斥)', {
    operation,
    workspace,
    degradeCount,
    failFast: isFailFastOnRedisFailure(),
    error,
  })
  if (isFailFastOnRedisFailure()) {
    throw new Error('WORKSPACE_LOCK_REDIS_UNAVAILABLE')
  }
}

// ---------------------------------------------------------------------------
// 进程内降级存储(Redis 不可用时):与 Redis 锁同语义 —— TTL + owner(token) 校验
// ---------------------------------------------------------------------------
interface MemoryLockEntry {
  info: WorkspaceLockInfo
  /** 过期时刻(秒);到点即失效,由读写路径惰性清理 */
  expiresAt: number
}

const memoryLocks = new Map<string, MemoryLockEntry>()

function memoryGet(workspace: string): WorkspaceLockInfo | null {
  const entry = memoryLocks.get(workspace)
  if (!entry) return null
  if (entry.expiresAt <= Date.now() / 1000) {
    memoryLocks.delete(workspace)
    return null
  }
  return entry.info
}

function memoryAcquire(workspace: string, holder: string, ttlSec: number): WorkspaceLockInfo {
  const now = Date.now() / 1000
  const existing = memoryLocks.get(workspace)
  if (existing) {
    if (existing.expiresAt <= now) {
      memoryLocks.delete(workspace) // 过期自动释放,不再要求 owner 匹配
    } else if (existing.info.holder !== holder) {
      throw new Error('LOCK_HELD')
    } else {
      // 同 owner 重入/续期:心跳前推并重置 TTL
      existing.info.heartbeatAt = now
      existing.expiresAt = now + ttlSec
      return existing.info
    }
  }
  const info: WorkspaceLockInfo = {
    workspace,
    holder,
    token: randomUUID().replace(/-/g, ''),
    acquiredAt: now,
    heartbeatAt: now,
  }
  memoryLocks.set(workspace, { info, expiresAt: now + ttlSec })
  return info
}

/** 释放:仅当前持有者(token = owner 凭证)且未过期时生效 */
function memoryRelease(workspace: string, token: string): boolean {
  const entry = memoryLocks.get(workspace)
  if (!entry) return false
  if (entry.expiresAt <= Date.now() / 1000) {
    memoryLocks.delete(workspace) // 已过期,视为无锁,本次释放不成立
    return false
  }
  if (entry.info.token !== token) return false // 非 owner 不得释放
  memoryLocks.delete(workspace)
  return true
}

/** 续期:仅当前持有者且未过期时生效;过期锁不可续命(必须重新抢) */
function memoryRenew(workspace: string, token: string, ttlSec: number): boolean {
  const entry = memoryLocks.get(workspace)
  if (!entry) return false
  const now = Date.now() / 1000
  if (entry.expiresAt <= now) {
    memoryLocks.delete(workspace)
    return false
  }
  if (entry.info.token !== token) return false // 非 owner 不得续期
  entry.info.heartbeatAt = now
  entry.expiresAt = now + ttlSec
  return true
}

/** 强制释放(admin 运维场景,无视 owner);返回是否释放了一把仍然有效的锁 */
function memoryForceRelease(workspace: string): boolean {
  const entry = memoryLocks.get(workspace)
  if (!entry) return false
  memoryLocks.delete(workspace)
  return entry.expiresAt > Date.now() / 1000
}

/**
 * 获取工作区锁。
 * @returns LockInfo 成功(或同 holder 重入续期);null 被其他持有者占用
 */
export async function acquireWorkspaceLock(
  workspace: string,
  holder: string,
  ttlSec: number = WORKSPACE_LOCK_TTL,
): Promise<WorkspaceLockInfo | null> {
  if (!workspace || !holder) throw new Error('workspace 与 holder 均不能为空')
  const r = getRedis()
  if (!r) {
    onRedisUnavailable('acquire', workspace, new Error('redis client unavailable'))
    return memoryAcquire(workspace, holder, ttlSec)
  }
  try {
    const raw = await r.get(lockKey(workspace))
    if (raw) {
      const existing = parseLock(raw, workspace)
      if (existing === null) {
        // 未知格式锁值(其他端历史格式/损坏数据):视为未知活锁,
        // 宁可不抢,不可误删(TTL 到期后 key 自愈)
        return null
      } else if (existing.holder !== holder) {
        return null
      } else {
        const renewed = await r.eval(
          RENEW_LUA,
          1,
          lockKey(workspace),
          existing.token,
          String(ttlSec),
        )
        if (Number(renewed) === 1) {
          existing.heartbeatAt = Date.now() / 1000
          return existing
        }
      }
    }
    const info: WorkspaceLockInfo = {
      workspace,
      holder,
      token: randomUUID().replace(/-/g, ''),
      acquiredAt: Date.now() / 1000,
      heartbeatAt: Date.now() / 1000,
    }
    const ok = await r.set(lockKey(workspace), serializeLock(info), 'EX', ttlSec, 'NX')
    return ok === 'OK' ? info : null
  } catch (e) {
    onRedisUnavailable('acquire', workspace, e)
    try {
      return memoryAcquire(workspace, holder, ttlSec)
    } catch {
      return null
    }
  }
}

/** 查询当前持有者(无锁/查询失败返回 null) */
export async function getWorkspaceLock(workspace: string): Promise<WorkspaceLockInfo | null> {
  const r = getRedis()
  if (!r) {
    onRedisUnavailable('get', workspace, new Error('redis client unavailable'))
    return memoryGet(workspace)
  }
  try {
    return parseLock(await r.get(lockKey(workspace)), workspace)
  } catch (e) {
    onRedisUnavailable('get', workspace, e)
    return memoryGet(workspace)
  }
}

/** 释放锁(仅 token 匹配时生效)。@returns 是否真正释放 */
export async function releaseWorkspaceLock(workspace: string, token: string): Promise<boolean> {
  const r = getRedis()
  if (!r) {
    onRedisUnavailable('release', workspace, new Error('redis client unavailable'))
    return memoryRelease(workspace, token)
  }
  try {
    return Number(await r.eval(RELEASE_LUA, 1, lockKey(workspace), token)) === 1
  } catch (e) {
    onRedisUnavailable('release', workspace, e)
    return memoryRelease(workspace, token)
  }
}

/** 心跳续期(仅 token 匹配时生效) */
export async function renewWorkspaceLock(
  workspace: string,
  token: string,
  ttlSec: number = WORKSPACE_LOCK_TTL,
): Promise<boolean> {
  const r = getRedis()
  if (!r) {
    onRedisUnavailable('renew', workspace, new Error('redis client unavailable'))
    return memoryRenew(workspace, token, ttlSec)
  }
  try {
    return Number(await r.eval(RENEW_LUA, 1, lockKey(workspace), token, String(ttlSec))) === 1
  } catch (e) {
    onRedisUnavailable('renew', workspace, e)
    return memoryRenew(workspace, token, ttlSec)
  }
}

/** 强制释放(admin 运维场景,无视 token) */
export async function forceReleaseWorkspaceLock(workspace: string): Promise<boolean> {
  const r = getRedis()
  if (!r) {
    onRedisUnavailable('force_release', workspace, new Error('redis client unavailable'))
    return memoryForceRelease(workspace)
  }
  try {
    return Number(await r.del(lockKey(workspace))) === 1
  } catch (e) {
    onRedisUnavailable('force_release', workspace, e)
    return memoryForceRelease(workspace)
  }
}

/** 测试隔离:清空进程内降级存储 */
export function _resetMemoryLocks(): void {
  memoryLocks.clear()
}
