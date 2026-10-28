// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** 固定窗口计数器:Redis 为主,不可用时回退进程内 Map。
 *
 * 为什么要单独一份(2026-10-22):发码链上有四处"每手机号/每 IP 在 N 分钟内第几次"的计数
 * (短信 60s / 1h / 24h 三档限速 + 回显闸的发送频控),过去各写各的进程内 Map。
 * 它们的失效方向是同一个:**一次部署就把计数清零**。限速是防短信轰炸的,
 * 而轰炸配额恰好就是那 100~200 条免费额度 —— 计数能被部署重置,等于没有上限。
 * 收成一个出口,免得再长出第五份副本(§0.6)。
 */
import IORedis, { type Redis } from 'ioredis'
import { config } from '../config/index.js'
import { logger } from './logger.js'

let redisClient: Redis | null = null
let initFailed = false

function getRedis(): Redis | null {
  if (redisClient) return redisClient
  if (initFailed) return null
  try {
    redisClient = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: false,
      // 关离线队列:否则 Redis 不可达时命令挂死而不是报错,内存兜底永远走不到
      enableOfflineQueue: false,
      commandTimeout: 2000,
    })
    redisClient.on('error', (err) => {
      logger.error('[window-counter] redis error,已回退进程内计数', {
        error: String(err?.message ?? err),
      })
    })
    const quit = (): void => {
      redisClient?.quit().catch(() => {
        /* ignore */
      })
    }
    process.once('SIGTERM', quit)
    process.once('SIGINT', quit)
  } catch (e) {
    initFailed = true
    redisClient = null
    logger.error('[window-counter] redis 初始化失败,本进程全程用内存计数', {
      error: String((e as Error)?.message ?? e),
    })
  }
  return redisClient
}

/** INCR 与首次 PEXPIRE 必须同批:分两步时若在两步之间崩溃,键会永不过期 ⇒ 该号码被永久限速。 */
const INCR_SCRIPT = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return n
`

interface LocalWindow {
  count: number
  windowStart: number
}
const localStore = new Map<string, LocalWindow>()
/** 内存兜底也必须有死亡机制,否则 Redis 长期不可用时这张表会单调涨到 OOM。 */
const LOCAL_MAX_KEYS = 20_000

function localIncr(key: string, windowMs: number, now: number): number {
  const existing = localStore.get(key)
  if (!existing || now - existing.windowStart > windowMs) {
    if (localStore.size >= LOCAL_MAX_KEYS) {
      const oldest = localStore.keys().next().value
      if (oldest !== undefined) localStore.delete(oldest)
    }
    localStore.set(key, { count: 1, windowStart: now })
    return 1
  }
  existing.count += 1
  return existing.count
}

/** 记一次并返回"本窗口内累计第几次"。窗口从第一次命中开始算。 */
export async function incrWindow(key: string, windowMs: number): Promise<number> {
  const now = Date.now()
  const redis = getRedis()
  if (redis) {
    try {
      return (await redis.eval(INCR_SCRIPT, 1, key, String(windowMs))) as number
    } catch (e) {
      logger.error('[window-counter] 计数脚本失败,回退内存', {
        error: String((e as Error)?.message ?? e),
      })
    }
  }
  return localIncr(key, windowMs, now)
}

export interface WindowSpec {
  key: string
  windowMs: number
  max: number
}

/** 多档窗口一次性放行:全部未超限才各加 1。
 *  返回 0 = 已放行;返回 n>0 = 被第 n 档挡住(1 起算),且**一档都没加**。
 *
 *  为什么不能"逐档先加后判":那样被最窄一档挡下的请求,照样把宽档配额也烧掉了 ——
 *  用户连点几次"重新发送"就会在 24 小时档里留下十几次并不存在的发送。
 *  判与加必须同批,所以走脚本而不是 GET 三次再 INCR 三次。 */
export async function tryConsumeWindows(specs: WindowSpec[]): Promise<number> {
  const redis = getRedis()
  if (redis) {
    try {
      const keys = specs.map((s) => s.key)
      const argv = specs.flatMap((s) => [String(s.windowMs), String(s.max)])
      const script = `
local n = #KEYS
for i = 1, n do
  local c = tonumber(redis.call('GET', KEYS[i]) or '0')
  if c >= tonumber(ARGV[(i - 1) * 2 + 2]) then return i end
end
for i = 1, n do
  local c = redis.call('INCR', KEYS[i])
  if c == 1 then redis.call('PEXPIRE', KEYS[i], ARGV[(i - 1) * 2 + 1]) end
end
return 0
`
      return (await redis.eval(script, keys.length, ...keys, ...argv)) as number
    } catch (e) {
      logger.error('[window-counter] 多档脚本失败,回退内存', {
        error: String((e as Error)?.message ?? e),
      })
    }
  }
  return localTryConsumeWindows(specs, Date.now())
}

/** 退还一次已消费的窗口(投递失败时用)。只减不删:删键会把窗口起点一起抹掉,
 *  等于把「刚刚确实试过一次」这件事实清空;DECR 到 0 保留原起点,窗口仍按原时间自然过期。 */
const REFUND_SCRIPT = `
for i = 1, #KEYS do
  local c = tonumber(redis.call('GET', KEYS[i]) or '0')
  if c > 0 then redis.call('DECR', KEYS[i]) end
end
return #KEYS
`

/** 退还一次已消费的窗口。与 tryConsumeWindows 成对使用:先消费、发不出去再退回,
 *  避免「云侧故障一次」就锁死用户 60 秒、并吃掉 1h/24h 配额。 */
export async function refundWindows(specs: WindowSpec[]): Promise<void> {
  if (specs.length === 0) return
  const redis = getRedis()
  if (redis) {
    try {
      await redis.eval(
        REFUND_SCRIPT,
        specs.length,
        ...specs.map((s) => s.key),
      )
      return
    } catch (e) {
      logger.error('[window-counter] 退还脚本失败,回退内存', {
        error: String((e as Error)?.message ?? e),
      })
    }
  }
  const now = Date.now()
  for (const s of specs) {
    const w = localStore.get(s.key)
    if (w && now - w.windowStart <= s.windowMs && w.count > 0) w.count -= 1
  }
}

/** 一次性占位(幂等键):首次写入返回 acquired=true 并带回本次值;
 *  键已存在则返回 acquired=false 和**已有值**,让调用方能把第一次的结果告诉重试方。
 *  Redis 不可用时退进程内 Map —— 与计数同向降级,不假装成功。 */
export interface OnceResult {
  acquired: boolean
  existing: string | null
}

const localOnce = new Map<string, { value: string; expiresAt: number }>()

export async function acquireOnce(
  key: string,
  value: string,
  ttlMs: number,
): Promise<OnceResult> {
  const ttl = Math.max(1000, ttlMs)
  const redis = getRedis()
  if (redis) {
    try {
      const ok = await redis.set(key, value, 'PX', ttl, 'NX')
      if (ok === 'OK') return { acquired: true, existing: null }
      return { acquired: false, existing: await redis.get(key) }
    } catch (e) {
      logger.error('[window-counter] 幂等占位失败,回退内存', {
        error: String((e as Error)?.message ?? e),
      })
    }
  }
  const now = Date.now()
  const current = localOnce.get(key)
  if (current && current.expiresAt > now) {
    return { acquired: false, existing: current.value }
  }
  if (localOnce.size >= LOCAL_MAX_KEYS) {
    const oldest = localOnce.keys().next().value
    if (oldest !== undefined) localOnce.delete(oldest)
  }
  localOnce.set(key, { value, expiresAt: now + ttl })
  return { acquired: true, existing: null }
}

/** 该计数键还剩多少毫秒到期(用于 Retry-After)。键不存在或取不到 ⇒ 按整窗返回。 */
export async function windowRemainingMs(key: string, windowMs: number): Promise<number> {
  const redis = getRedis()
  if (redis) {
    try {
      const ttl = (await redis.pttl(key)) as number
      if (ttl > 0) return ttl
      return windowMs
    } catch (e) {
      logger.error('[window-counter] pttl 失败,回退内存', {
        error: String((e as Error)?.message ?? e),
      })
    }
  }
  const w = localStore.get(key)
  if (!w) return windowMs
  return Math.max(0, Math.min(windowMs, w.windowStart + windowMs - Date.now()))
}

function localTryConsumeWindows(specs: WindowSpec[], now: number): number {
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i]
    if (!s) continue
    const w = localStore.get(s.key)
    const active = w && now - w.windowStart <= s.windowMs ? w : null
    if (active && active.count >= s.max) return i + 1
  }
  for (const s of specs) {
    const w = localStore.get(s.key)
    const active = w && now - w.windowStart <= s.windowMs ? w : null
    if (active) {
      active.count += 1
    } else {
      if (localStore.size >= LOCAL_MAX_KEYS) {
        const oldest = localStore.keys().next().value
        if (oldest !== undefined) localStore.delete(oldest)
      }
      localStore.set(s.key, { count: 1, windowStart: now })
    }
  }
  return 0
}

/** 清空指定前缀的计数(内存 + 共享存储两面)。给测试隔离用。 */
export async function resetCounters(prefixes: string[]): Promise<void> {
  localStore.clear()
  localOnce.clear()
  const redis = getRedis()
  if (!redis || redis.status !== 'ready') return
  for (const prefix of prefixes) {
    try {
      let cursor = '0'
      const keys: string[] = []
      do {
        const [next, batch] = (await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200)) as [
          string,
          string[],
        ]
        cursor = next
        keys.push(...batch)
      } while (cursor !== '0')
      if (keys.length) await redis.del(...keys)
    } catch {
      // 清不干净只影响测试隔离,不该把整轮用例顶死
    }
  }
}

/** 测试出口(§22c):计数搬到 Redis 之后,原来那个"清一下内存"的 resetSendQuotaForTests
 *  已经不够用了 —— 只清内存的话,上一个用例留在共享存储里的计数会串到下一个用例,
 *  表现为"配额测试偶发红",而红的那次其实测的是别人的残留。所以必须两面一起清。 */
export const __test__ = {
  reset: resetCounters,
  localSize(): number {
    return localStore.size
  },
  backend(): 'redis' | 'memory' {
    const r = getRedis()
    return r && r.status === 'ready' ? 'redis' : 'memory'
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
