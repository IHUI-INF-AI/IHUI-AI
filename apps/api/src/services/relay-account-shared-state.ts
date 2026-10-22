// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 反代号池多实例 Redis 共享态(2026-10-22 立)。
 *
 * 账号池转发器与巡检 worker 都可能多实例并行部署,以下三类状态必须跨实例一致,
 * 否则会出现「A 实例熔断冷却中的号被 B 实例继续打」「会话亲和在 B 实例失效导致
 * Trae 多轮上下文断裂」「两实例同时 sweep 造成重复刷新风暴」:
 *
 * (a) 账号冷却:accountId → 冷却到期毫秒时间戳,键 TTL = 剩余冷却秒级时长,
 *     Redis 自然过期,无需清扫任务。
 * (b) 会话亲和:affinityKey → accountId,PX TTL 与进程内旧实现同口径(10 分钟)。
 * (c) 巡检分布式锁:SET NX PX 原子获取,Lua 脚本按 token 原子释放(对标
 *     utils/distributed-lock.ts 的 owner+token 校验,但这里只需要「拿不到就跳过」
 *     的非阻塞语义,不排队等待)。
 *
 * 双档范式与 utils/code-store.ts、services/account-lockout.ts 完全一致:
 * Redis 为主存,写同时穿透进程内 Map;Redis 不可用/命令失败 ⇒ 降级内存兜底,
 * 行为与改造前(纯进程内)一致。降级必须喊出来(logger.error),不得静默;
 * 任何 Redis 故障都不得让转发链路抛错——所有对外函数内部全量 try/catch。
 */
import { randomBytes } from 'node:crypto'
import IORedis, { type Redis } from 'ioredis'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'

// =============================================================================
// Redis 客户端(与 code-store 同范式:快失败 + 离线队列必须关,否则降级是纸面的)
// =============================================================================

let redisClient: Redis | null = null
let redisInitFailed = false

function getRedis(): Redis | null {
  if (redisClient) return redisClient
  if (redisInitFailed) return null
  try {
    redisClient = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: false,
      // 默认 true 时 Redis 不可达的命令会排队挂死而不是立刻报错,
      // catch ⇒ 内存兜底这条路就走不到(code-store 2026-10-22 实测教训)。
      enableOfflineQueue: false,
      commandTimeout: 2000,
    })
    redisClient.on('error', (err) => {
      logger.error('[relay-shared-state] redis error,已回退进程内存储', {
        error: String((err as Error)?.message ?? err),
      })
    })
    redisClient.on('ready', () => {
      logger.info('[relay-shared-state] redis 已连接,账号池状态走共享存储')
    })
    const quit = (): void => {
      redisClient?.quit().catch(() => {
        /* ignore */
      })
    }
    process.once('SIGTERM', quit)
    process.once('SIGINT', quit)
  } catch (e) {
    redisInitFailed = true
    redisClient = null
    logger.error('[relay-shared-state] redis 初始化失败,本进程全程用内存兜底', {
      error: String((e as Error)?.message ?? e),
    })
  }
  return redisClient
}

// =============================================================================
// 键空间
// =============================================================================

const KEY_PREFIX_COOLDOWN = 'relay:pool:cooldown:'
const KEY_PREFIX_AFFINITY = 'relay:pool:affinity:'
const KEY_PREFIX_LOCK = 'relay:pool:lock:'

/** 仅当 token 匹配才删除(原子释放),防误删他人持有的锁。 */
const LOCK_RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`

function logRedisError(op: string, e: unknown): void {
  logger.error(`[relay-shared-state] ${op} redis 失败,回退内存`, {
    error: String((e as Error)?.message ?? e),
  })
}

// =============================================================================
// (a) 账号冷却:accountId → 冷却到期(ms)
// =============================================================================

/** 进程内兜底冷却表。Redis 不可用时才以它为准 —— 多实例下它不等价于共享态。 */
const cooldownFallback = new Map<string, number>()

/** 把账号冷却钉到 cooldownUntilMs(绝对毫秒时间戳);已过期等于解除冷却。 */
export async function setAccountCooldown(
  accountId: string,
  cooldownUntilMs: number,
): Promise<void> {
  const ttlMs = cooldownUntilMs - Date.now()
  if (ttlMs <= 0) {
    await clearAccountCooldown(accountId)
    return
  }
  cooldownFallback.set(accountId, cooldownUntilMs)
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(KEY_PREFIX_COOLDOWN + accountId, String(cooldownUntilMs), 'PX', ttlMs)
  } catch (e) {
    logRedisError('setAccountCooldown', e)
  }
}

/** 解除冷却(调用成功即回血)。两面同删。 */
export async function clearAccountCooldown(accountId: string): Promise<void> {
  cooldownFallback.delete(accountId)
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.del(KEY_PREFIX_COOLDOWN + accountId)
  } catch (e) {
    logRedisError('clearAccountCooldown', e)
  }
}

/** 批量判冷却:返回给定账号中「当前仍在冷却」的 id 集合。一次 MGET,不逐号往返。 */
export async function getAccountsInCooldown(accountIds: string[]): Promise<Set<string>> {
  const cooling = new Set<string>()
  if (accountIds.length === 0) return cooling
  const now = Date.now()
  const redis = getRedis()
  if (redis) {
    try {
      const vals = await redis.mget(...accountIds.map((id) => KEY_PREFIX_COOLDOWN + id))
      for (let i = 0; i < accountIds.length; i++) {
        const id = accountIds[i] as string
        const raw = vals[i]
        if (!raw) {
          // Redis 在线但查无 ⇒ 以 Redis 为准(内存可能是上一实例的陈旧副本)
          cooldownFallback.delete(id)
          continue
        }
        const until = Number(raw)
        if (until > now) cooling.add(id)
        else cooldownFallback.delete(id)
      }
      return cooling
    } catch (e) {
      logRedisError('getAccountsInCooldown', e)
    }
  }
  for (const id of accountIds) {
    const until = cooldownFallback.get(id)
    if (until === undefined) continue
    if (until > now) cooling.add(id)
    else cooldownFallback.delete(id)
  }
  return cooling
}

// =============================================================================
// (b) 会话亲和:affinityKey → accountId
// =============================================================================

const affinityFallback = new Map<string, { accountId: string; expiresAt: number }>()

/** 读亲和命中的 accountId;无命中/已过期返回 null。 */
export async function getSessionAffinity(affinityKey: string): Promise<string | null> {
  const redis = getRedis()
  if (redis) {
    try {
      const v = await redis.get(KEY_PREFIX_AFFINITY + affinityKey)
      if (v) return v
      affinityFallback.delete(affinityKey)
      return null
    } catch (e) {
      logRedisError('getSessionAffinity', e)
    }
  }
  const mem = affinityFallback.get(affinityKey)
  if (!mem) return null
  if (mem.expiresAt <= Date.now()) {
    affinityFallback.delete(affinityKey)
    return null
  }
  return mem.accountId
}

/** 写亲和(同步穿透内存兜底,再异步写 Redis;TTL 到期自动失效)。 */
export async function setSessionAffinity(
  affinityKey: string,
  accountId: string,
  ttlMs: number,
): Promise<void> {
  affinityFallback.set(affinityKey, { accountId, expiresAt: Date.now() + ttlMs })
  if (ttlMs <= 0) return
  const redis = getRedis()
  if (!redis) return
  try {
    await redis.set(KEY_PREFIX_AFFINITY + affinityKey, accountId, 'PX', ttlMs)
  } catch (e) {
    logRedisError('setSessionAffinity', e)
  }
}

// =============================================================================
// (c) 分布式锁(非阻塞 try-acquire;内存兜底下退化为进程内互斥,与无锁现状等价)
// =============================================================================

export interface SharedLockHandle {
  /** 锁名(调用方传入的 name,非 Redis 全键) */
  name: string
  /** 持有 token,释放时校验,防误删 */
  token: string
  /** 释放;true = 本次释放确实销毁了本持有者的锁 */
  release(): Promise<boolean>
}

const lockFallback = new Map<string, { token: string; expiresAt: number }>()

/**
 * 尝试获取锁(SET NX PX)。拿不到返回 null(调用方跳过本轮,不排队等待)。
 * Redis 命令失败 ⇒ 内存锁兜底(同进程互斥;跨进程不等价,但与改造前无锁行为一致)。
 */
export async function tryAcquireSharedLock(
  name: string,
  ttlMs: number,
): Promise<SharedLockHandle | null> {
  const token = randomBytes(16).toString('hex')
  const redis = getRedis()
  if (redis) {
    try {
      const ok = await redis.set(KEY_PREFIX_LOCK + name, token, 'PX', ttlMs, 'NX')
      if (ok !== 'OK') return null
      return {
        name,
        token,
        release: async () => {
          try {
            const res = (await redis.eval(
              LOCK_RELEASE_SCRIPT,
              1,
              KEY_PREFIX_LOCK + name,
              token,
            )) as number
            return res === 1
          } catch (e) {
            logRedisError('lock.release', e)
            return false
          }
        },
      }
    } catch (e) {
      logRedisError('tryAcquireSharedLock', e)
    }
  }
  const now = Date.now()
  const cur = lockFallback.get(name)
  if (cur && cur.expiresAt > now) return null
  lockFallback.set(name, { token, expiresAt: now + ttlMs })
  return {
    name,
    token,
    release: async () => {
      const c = lockFallback.get(name)
      if (c && c.token === token) {
        lockFallback.delete(name)
        return true
      }
      return false
    },
  }
}

// =============================================================================
// 测试出口(与 code-store __test__ 同范式)
// =============================================================================

export const __test__ = {
  /** 清空两面(内存三张表 + Redis relay:pool:* 键)。测试用例之间必须互不残留。 */
  async reset(): Promise<void> {
    cooldownFallback.clear()
    affinityFallback.clear()
    lockFallback.clear()
    const redis = getRedis()
    if (!redis) return
    const keys: string[] = []
    let cursor = '0'
    try {
      do {
        const [next, batch] = (await redis.scan(cursor, 'MATCH', 'relay:pool:*', 'COUNT', 200)) as [
          string,
          string[],
        ]
        cursor = next
        keys.push(...batch)
      } while (cursor !== '0')
      if (keys.length) await redis.del(...keys)
    } catch {
      // 清不干净只影响测试隔离,不该让 beforeEach 抛错把整轮用例顶死
    }
  },
  /** 当前这一轮实际用的是共享存储还是进程内兜底 —— 断言"我测的是哪一档"。 */
  backend(): 'redis' | 'memory' {
    const r = getRedis()
    return r && r.status === 'ready' ? 'redis' : 'memory'
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
