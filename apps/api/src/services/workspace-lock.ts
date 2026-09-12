// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 多 Agent 工作区锁(2-2,ioredis 版)。
 *
 * 与 apps/ai-service/app/services/workspace_lock.py 共享 Redis 协议:
 *   key:   ihui:workspace_lock:{workspace}
 *   value: JSON {workspace, holder, token, acquiredAt, heartbeatAt}
 *   释放/续期: Lua 脚本 cjson 解码后比较 token 字段(原子,防误删他人锁)
 *
 * 降级:Redis 不可用时退化为进程内 Map(单实例部署语义一致)。
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

function parseLock(raw: string | null, workspace: string): WorkspaceLockInfo | null {
  if (!raw) return null
  try {
    const d = JSON.parse(raw) as Partial<WorkspaceLockInfo>
    if (typeof d.holder !== 'string' || typeof d.token !== 'string') return null
    return {
      workspace,
      holder: d.holder,
      token: d.token,
      acquiredAt: Number(d.acquiredAt) || 0,
      heartbeatAt: Number(d.heartbeatAt) || 0,
    }
  } catch {
    logger.warn('[workspace-lock] value 损坏,按无锁处理', { workspace })
    return null
  }
}

/** 进程内降级存储(Redis 不可用时) */
const memoryLocks = new Map<string, WorkspaceLockInfo>()

function memoryAcquire(workspace: string, holder: string, ttlSec: number): WorkspaceLockInfo {
  const now = Date.now() / 1000
  const existing = memoryLocks.get(workspace)
  if (existing) {
    if (existing.holder !== holder) throw new Error('LOCK_HELD')
    existing.heartbeatAt = now
    return existing
  }
  const info: WorkspaceLockInfo = {
    workspace,
    holder,
    token: randomUUID().replace(/-/g, ''),
    acquiredAt: now,
    heartbeatAt: now,
  }
  memoryLocks.set(workspace, info)
  void ttlSec // 内存模式无 TTL(单进程生命周期)
  return info
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
  if (!r) return memoryAcquire(workspace, holder, ttlSec)
  try {
    const raw = await r.get(lockKey(workspace))
    if (raw) {
      const existing = parseLock(raw, workspace)
      if (existing === null) {
        // 损坏 value:清除坏 key 后走 SET NX 重新竞争(自愈)
        await r.del(lockKey(workspace))
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
    const ok = await r.set(lockKey(workspace), JSON.stringify(info), 'EX', ttlSec, 'NX')
    return ok === 'OK' ? info : null
  } catch (e) {
    logger.warn('[workspace-lock] acquire redis 失败,降级内存锁', { error: e })
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
  if (!r) return memoryLocks.get(workspace) ?? null
  try {
    return parseLock(await r.get(lockKey(workspace)), workspace)
  } catch (e) {
    logger.warn('[workspace-lock] get 失败(视为无锁)', { error: e })
    return null
  }
}

/** 释放锁(仅 token 匹配时生效)。@returns 是否真正释放 */
export async function releaseWorkspaceLock(workspace: string, token: string): Promise<boolean> {
  const r = getRedis()
  if (!r) {
    const existing = memoryLocks.get(workspace)
    if (!existing || existing.token !== token) return false
    memoryLocks.delete(workspace)
    return true
  }
  try {
    return Number(await r.eval(RELEASE_LUA, 1, lockKey(workspace), token)) === 1
  } catch (e) {
    logger.warn('[workspace-lock] release redis 失败,降级内存锁', { error: e })
    const existing = memoryLocks.get(workspace)
    if (!existing || existing.token !== token) return false
    memoryLocks.delete(workspace)
    return true
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
    const existing = memoryLocks.get(workspace)
    if (!existing || existing.token !== token) return false
    existing.heartbeatAt = Date.now() / 1000
    return true
  }
  try {
    return Number(await r.eval(RENEW_LUA, 1, lockKey(workspace), token, String(ttlSec))) === 1
  } catch (e) {
    logger.warn('[workspace-lock] renew redis 失败,降级内存锁', { error: e })
    const existing = memoryLocks.get(workspace)
    if (!existing || existing.token !== token) return false
    existing.heartbeatAt = Date.now() / 1000
    return true
  }
}

/** 强制释放(admin 运维场景,无视 token) */
export async function forceReleaseWorkspaceLock(workspace: string): Promise<boolean> {
  const r = getRedis()
  if (!r) return memoryLocks.delete(workspace)
  try {
    return Number(await r.del(lockKey(workspace))) === 1
  } catch (e) {
    logger.warn('[workspace-lock] force_release redis 失败,降级内存锁', { error: e })
    return memoryLocks.delete(workspace)
  }
}

/** 测试隔离:清空进程内降级存储 */
export function _resetMemoryLocks(): void {
  memoryLocks.clear()
}
