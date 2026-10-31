// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 按用户的请求限流(认证后调用)。
 *
 * 立因(2026-10-30):全局限流只按 IP 计一个桶(`server.ts` 的 rateLimit,100/min)。
 * 两种真实失真:
 *   · 同出口 IP 的多个用户(公司 NAT / 家庭多设备)互相挤占;
 *   · 本机回环流量共用一个桶 —— 实测 256 条只读探测就把 `/health` 打到 429。
 * 这里在认证成功后按 userId 再计一层,阈值远高于正常使用(默认 600/min),
 * 只拦真正按用户维度的滥用,不与 IP 层重复收紧。
 *
 * 失败方向:**放行**(Redis 不可用返回 true)。IP 层仍在兜底,而为了"限流"把
 * 已认证用户挡在门外,代价大于收益(与 account-lockout 的降级同口径)。
 */
import IORedis from 'ioredis'
import { config } from '../config/index.js'
import { FAST_FAIL_REDIS_OPTIONS } from '../plugins/redis.js'
import { logger } from '../utils/logger.js'

const WINDOW_SECONDS = 60
const DEFAULT_MAX_PER_MINUTE = 600

let redis: IORedis | null = null
let initFailed = false

function getRedis(): IORedis | null {
  if (redis) return redis
  if (initFailed) return null
  try {
    // 每请求一次:Redis 不可用时必须立刻失败(见文件头注「失败方向:放行」)。
    // 默认 enableOfflineQueue 会把 incr 排到重连退避耗尽,单请求拖到秒级(选项单源 §0.6)。
    redis = new IORedis(config.REDIS_URL, FAST_FAIL_REDIS_OPTIONS)
    redis.on('error', (err) => {
      logger.error('[user-rate-limit] redis error', { err: (err as Error).message })
    })
    return redis
  } catch (e) {
    initFailed = true
    logger.error('[user-rate-limit] 初始化失败,按用户限流停用', { err: (e as Error).message })
    return null
  }
}

function maxPerMinute(): number {
  const raw = Number((config as { USER_RATE_LIMIT_PER_MINUTE?: number }).USER_RATE_LIMIT_PER_MINUTE)
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_MAX_PER_MINUTE
}

/** true = 放行;false = 该用户本分钟已超阈值(调用方回 429)。 */
export async function checkUserRateLimit(userId: string): Promise<boolean> {
  if (!userId) return true
  const client = getRedis()
  if (!client) return true
  const bucket = Math.floor(Date.now() / (WINDOW_SECONDS * 1000))
  const key = `ihui:url:${userId}:${bucket}`
  try {
    const n = await client.incr(key)
    if (n === 1) await client.expire(key, WINDOW_SECONDS * 2)
    return n <= maxPerMinute()
  } catch (e) {
    logger.error('[user-rate-limit] 计数失败(放行)', { err: (e as Error).message })
    return true
  }
}

export const __test__ = { checkUserRateLimit, maxPerMinute, DEFAULT_MAX_PER_MINUTE }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
