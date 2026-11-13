// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 反代号池多实例 Redis 共享态(2026-10-22 立)。
 *
 * 账号池转发器与巡检 worker 都可能多实例并行部署,以下四类状态必须跨实例一致,
 * 否则会出现「A 实例熔断冷却中的号被 B 实例继续打」「会话亲和在 B 实例失效导致
 * Trae 多轮上下文断裂」「两实例同时 sweep 造成重复刷新风暴」「两实例各自放行 ≤N
 * 路全局在途、叠加后打爆上游」:
 *
 * (a) 账号冷却:accountId → 冷却到期毫秒时间戳,键 TTL = 剩余冷却秒级时长,
 *     Redis 自然过期,无需清扫任务。
 * (b) 会话亲和:affinityKey → accountId,PX TTL 与进程内旧实现同口径(10 分钟)。
 * (c) 巡检分布式锁:SET NX PX 原子获取,Lua 脚本按 token 原子释放(对标
 *     utils/distributed-lock.ts 的 owner+token 校验,但这里只需要「拿不到就跳过」
 *     的非阻塞语义,不排队等待)。
 * (d) 全局在途并发闸(2026-10-29 立,O93,对标 pool.max_in_flight_global):
 *     relay:pool:inflight:global 的 INCR/DECR 原子计数,acquire 时写 TTL 安全网,
 *     并在 handle 持有期间定时续期(F-619:长流跑过 TTL 时计数不得中途清零);
 *     达上限即回绝(调用方像冷却一样换下一候选,不排队);Redis 不可用 ⇒ 进程内计数兜底。
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
import { DEFAULT_SOCKET_IDLE_TIMEOUT_MS } from './relay-socket-transport.js'

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
/** 全局在途并发计数键(O93,对标 workbuddy2api-panel pool.max_in_flight_global) */
const KEY_GLOBAL_INFLIGHT = 'relay:pool:inflight:global'

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
// (d) 全局在途并发闸(2026-10-29 立,O93:对标 pool.max_in_flight_global)
//     Redis INCR/DECR 原子计数 + TTL 兜底;Redis 不可用 ⇒ 进程内计数兜底。
//     语义 = 「拿不到就跳过(像冷却一样换下一候选),绝不排队久等」——与上面
//     分布式锁的非阻塞口径同族。钮值(IHUI_RELAY_POOL_MAX_IN_FLIGHT_GLOBAL)
//     住 relay-pool-policy.ts 单源,本文件不读 env、不持默认值。
// =============================================================================

/**
 * 计数键的安全网 TTL(F-619,2026-11-13 修)。
 *
 * 旧值固定 120s 且只在 acquire 时续期:cap=10、10 条 >120s 的长流同时开始后没有新请求,
 * 120s 后键被 Redis 自然清掉 ⇒ 计数归零,第 121s 起新请求继续放行,全局闸中途失效。
 *
 * 新口径 = 「上游超时上限 + 缓冲」:上限取号池链路里最长的一档
 * (relay-socket-transport 的上游空闲超时 —— 长思考/长流静默的容忍上限),
 * 缓冲留出一次续期心跳的余量。真正的保险是 handle 持有期间的定时续期
 * (GLOBAL_INFLIGHT_HEARTBEAT_MS);TTL 仍保留「进程崩溃漏放的腿自愈」的作用,
 * 失效方向依然是到期自动放,不是人工救火。
 */
export const GLOBAL_INFLIGHT_TTL_BUFFER_MS = 60_000
export const GLOBAL_INFLIGHT_TTL_MS = DEFAULT_SOCKET_IDLE_TIMEOUT_MS + GLOBAL_INFLIGHT_TTL_BUFFER_MS
/**
 * 续期心跳间隔(F-619):持有期间每个间隔把计数键 TTL 重新顶到 GLOBAL_INFLIGHT_TTL_MS。
 * 必须显著小于 TTL,留出 Redis 抖动/重试与事件循环延迟的余量。
 */
export const GLOBAL_INFLIGHT_HEARTBEAT_MS = 60_000

/** acquire 的可选覆盖项(测试/排障用;生产一律走上面的单源常量)。 */
export interface GlobalInflightOptions {
  /** 安全网 TTL 覆盖;<=0/非有限数 ⇒ 回落 GLOBAL_INFLIGHT_TTL_MS */
  ttlMs?: number
  /** 续期心跳间隔覆盖;<=0 ⇒ 关闭续期(只留 acquire 时的 TTL) */
  heartbeatMs?: number
  /** 定时器注入(测试可手动推进);默认全局 setInterval */
  setIntervalFn?: (fn: () => void, ms: number) => unknown
  /** 清定时器(与 setIntervalFn 配套);默认全局 clearInterval */
  clearIntervalFn?: (handle: unknown) => void
}

function resolveTtlMs(opts?: GlobalInflightOptions): number {
  const v = opts?.ttlMs
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : GLOBAL_INFLIGHT_TTL_MS
}

function resolveHeartbeatMs(ttlMs: number, opts?: GlobalInflightOptions): number {
  const v = opts?.heartbeatMs
  if (typeof v === 'number' && Number.isFinite(v)) return v > 0 ? v : 0
  // TTL 被覆写时心跳要跟着缩,否则心跳间隔可能长过 TTL(续期永远来不及)
  return Math.max(1_000, Math.min(GLOBAL_INFLIGHT_HEARTBEAT_MS, Math.floor(ttlMs / 3)))
}

function startInflightHeartbeat(
  renew: () => void,
  heartbeatMs: number,
  opts?: GlobalInflightOptions,
): unknown {
  if (!(heartbeatMs > 0)) return null
  const setFn = opts?.setIntervalFn ?? ((fn: () => void, ms: number) => setInterval(fn, ms))
  const handle = setFn(renew, heartbeatMs)
  // 心跳不得单独吊住进程退出(与 relay-socket-transport 的定时器同口径)
  ;(handle as { unref?: () => void } | null)?.unref?.()
  return handle
}

function stopInflightHeartbeat(handle: unknown, opts?: GlobalInflightOptions): void {
  if (handle === null || handle === undefined) return
  const clearFn =
    opts?.clearIntervalFn ??
    ((h: unknown) => clearInterval(h as ReturnType<typeof setInterval>))
  clearFn(handle)
}

/** 进程内兜底计数(Redis 不可用/命令失败时才生效;与 cooldownFallback 同语义) */
let globalInflightFallback = 0

/**
 * 释放脚本:先 DECR;若减出负数(acquire 与 release 之间键已被 TTL 清掉 ⇒ 对新键
 * DECR 会留下无 TTL 的负值,把可用额度虚假放大),立即删键归零。
 * 负数不是错误,是「这一腿的额度已随键过期」的证据,归零即正确。
 */
const GLOBAL_INFLIGHT_RELEASE_SCRIPT = `
local v = redis.call('decr', KEYS[1])
if v < 0 then
  redis.call('del', KEYS[1])
  return 0
end
return v
`

/**
 * 占用脚本:F-240 —— INCR 与 PEXPIRE 必须同一次往返完成。分成两条命令时,
 * INCR 成功而 PEXPIRE 失败会留下「已计数、无 TTL」的键,调用方再降级内存计数
 * 就是双占坑(Redis 永久偏高 + 内存各一)。本脚本内超上限也当场 DECR 回滚,
 * 回滚不再是一次可能失败的独立命令。
 * 续 TTL 只在占坑成功时做(与改造前一致):被回绝的尝试不续命,
 * 否则满载期的连续拒绝会让安全网 TTL 永不到期,漏放的计数无法自愈。
 * 返回:>=1 = 占坑后的计数;0 = 已达上限(本轮无坑,脚本内已回滚)。
 */
const GLOBAL_INFLIGHT_ACQUIRE_SCRIPT = `
local v = redis.call('incr', KEYS[1])
if v > tonumber(ARGV[2]) then
  redis.call('decr', KEYS[1])
  return 0
end
redis.call('pexpire', KEYS[1], ARGV[1])
return v
`

export interface GlobalInflightHandle {
  /** 本次占坑凭据(仅日志/排障用;释放走 handle.release,幂等) */
  token: string
  /** 本轮实际占坑的存储面(测试断言"我测的是哪一档",与 backend() 同口径) */
  backend: 'redis' | 'memory'
  /** 归还在途额度;幂等(同一 handle 重复调用只减一次) */
  release(): Promise<void>
}

/**
 * 尝试占用一枚全局在途额度(前提:调用方已确认 cap >= 1 —— 关闭档由调用方
 * 按 policy.maxInFlightGlobal <= 0 自行跳过,不会走到这里)。
 * 达上限 ⇒ 回滚增量并返回 null(调用方按"该候选本轮跳过"处理)。
 * Redis 侧占用走单条 Lua(F-240):INCR+PEXPIRE 要么同时生效、要么都不生效。
 * Redis 命令失败 ⇒ 降级进程内计数(跨实例不等价,但与无闸现状同向,绝不抛错)。
 */
export async function tryAcquireGlobalInflight(
  cap: number,
  opts?: GlobalInflightOptions,
): Promise<GlobalInflightHandle | null> {
  if (!Number.isFinite(cap) || cap < 1) return null
  const token = randomBytes(8).toString('hex')
  const ttlMs = resolveTtlMs(opts)
  const heartbeatMs = resolveHeartbeatMs(ttlMs, opts)
  const redis = getRedis()
  if (redis) {
    try {
      if (typeof redis.eval === 'function') {
        // F-240:一条 Lua 内完成 INCR+PEXPIRE(+超限回滚),不存在
        // 「计数已加、TTL 未设」的中间态,失败即整条未生效。
        const v = (await redis.eval(
          GLOBAL_INFLIGHT_ACQUIRE_SCRIPT,
          1,
          KEY_GLOBAL_INFLIGHT,
          ttlMs,
          cap,
        )) as number
        if (v < 1) return null
      } else {
        // 极少数不支持 EVAL 的 Redis 代理:退回两段式,但 PEXPIRE 失败必须先
        // 撤销已成功的 INCR 再把错误交给外层(否则 Redis 与内存各计一次 = 双占坑)。
        const v = await redis.incr(KEY_GLOBAL_INFLIGHT)
        if (v > cap) {
          // 超上限:撤销本次增量再回绝。回滚失败不改变"本轮无坑"的结论
          // (TTL 安全网兜底),但必须喊出来。
          try {
            await redis.decr(KEY_GLOBAL_INFLIGHT)
          } catch (e) {
            logRedisError('tryAcquireGlobalInflight.rollback', e)
          }
          return null
        }
        try {
          await redis.pexpire(KEY_GLOBAL_INFLIGHT, ttlMs)
        } catch (e) {
          try {
            const left = await redis.decr(KEY_GLOBAL_INFLIGHT)
            // 回滚后归零的键是本次 INCR 新建的,删掉才不留下无 TTL 的残键
            if (left <= 0) await redis.del(KEY_GLOBAL_INFLIGHT)
          } catch (re) {
            logRedisError('tryAcquireGlobalInflight.rollback', re)
          }
          throw e
        }
      }
      let done = false
      // F-619:持有期间定时把 TTL 顶回去。长流跑多久,计数就续多久;
      // release 之后(done=true)即使有已排队的回调也不再多发一次 PEXPIRE。
      const renew = (): void => {
        if (done) return
        try {
          void Promise.resolve(redis.pexpire(KEY_GLOBAL_INFLIGHT, ttlMs)).catch((e: unknown) => {
            logRedisError('globalInflight.renew', e)
          })
        } catch (e) {
          logRedisError('globalInflight.renew', e)
        }
      }
      const heartbeat = startInflightHeartbeat(renew, heartbeatMs, opts)
      return {
        token,
        backend: 'redis',
        release: async () => {
          if (done) return
          done = true
          // 先停心跳再减计数:避免 release 之后又被续期出一个长 TTL 的空键
          stopInflightHeartbeat(heartbeat, opts)
          try {
            await redis.eval(GLOBAL_INFLIGHT_RELEASE_SCRIPT, 1, KEY_GLOBAL_INFLIGHT)
          } catch (e) {
            logRedisError('globalInflight.release', e)
          }
        },
      }
    } catch (e) {
      logRedisError('tryAcquireGlobalInflight', e)
      // 落入内存兜底(与 cooldown 系列同一条降级路径)
    }
  }
  if (globalInflightFallback >= cap) return null
  globalInflightFallback += 1
  let done = false
  return {
    token,
    backend: 'memory',
    release: async () => {
      if (done) return
      done = true
      globalInflightFallback = Math.max(0, globalInflightFallback - 1)
    },
  }
}

// =============================================================================
// 测试出口(与 code-store __test__ 同范式)
// =============================================================================

export const __test__ = {
  /** 清空两面(内存三张表 + 全局在途计数 + Redis relay:pool:* 键)。测试用例之间必须互不残留。 */
  async reset(): Promise<void> {
    cooldownFallback.clear()
    affinityFallback.clear()
    lockFallback.clear()
    globalInflightFallback = 0
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
  /** 内存兜底档的当前在途计数(测试直接钉住"占用/归还恰好一次")。 */
  globalInflightMemory(): number {
    return globalInflightFallback
  },
  /** 全局闸的安全网 TTL(测试断言档位形态用,单源于此导出)。 */
  globalInflightTtlMs(): number {
    return GLOBAL_INFLIGHT_TTL_MS
  },
  /** 当前这一轮实际用的是共享存储还是进程内兜底 —— 断言"我测的是哪一档"。 */
  backend(): 'redis' | 'memory' {
    const r = getRedis()
    return r && r.status === 'ready' ? 'redis' : 'memory'
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
