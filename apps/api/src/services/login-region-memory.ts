// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 登录地区记忆 + 异地提醒抑制名单。
 *
 * 立因(2026-11-27):原来的异地判定是「本次 IP 地区 ≠ 上一次登录 IP 地区」,
 * 只要用户在家用宽带 / 手机流量 / 本机自动化之间来回切换,每换一次就发一条
 * 「异地登录提醒」。生产 7 天发了 45 条,其中 11 条来自 127.0.0.1(前端反代后
 * 后端只看到回环地址)、7 条来自自动化走的日本代理出口 —— 全是假异地。
 *
 * 本模块把判据换成「该地区在最近 N 天内是否登录过」:
 *  - 首次见到某地区 ⇒ novel(值得提醒一次),登录成功后写入记忆;
 *  - 再见同一地区 ⇒ known(不再提醒),不管上一次是在哪;
 *  - 没有任何历史记忆(新账号/Redis 不可用)⇒ unknown,不提醒(不能把"判不出"当"异地");
 *  - 回环/内网/显式配置的自动化出口 ⇒ isLoginAlertIgnoredIp 直接跳过判定。
 *
 * 记忆只是"提醒开关",不参与鉴权、限流、封禁;失效方向是"少提醒",不是"多放行"。
 */
import type { Redis } from 'ioredis'
import { BlockList, isIP } from 'node:net'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'

export type LoginRegionVerdict = 'known' | 'novel' | 'unknown'

const KEY_PREFIX = 'login:regions:'
const keyOf = (userId: string): string => `${KEY_PREFIX}${userId}`

/** Redis 不可用时的内存降级:userId → (地区键 → 过期时间 ms)。 */
const memRegions = new Map<string, Map<string, number>>()
/** 内存降级表的用户数上限,超出按插入顺序淘汰,避免长期无 Redis 时无限增长。 */
const MEM_USERS_MAX = 20_000

function memGet(userId: string): Map<string, number> {
  let m = memRegions.get(userId)
  if (!m) {
    if (memRegions.size >= MEM_USERS_MAX) {
      const oldest = memRegions.keys().next().value
      if (oldest !== undefined) memRegions.delete(oldest)
    }
    m = new Map()
    memRegions.set(userId, m)
  }
  return m
}

function memoryTtlSec(): number {
  return Math.max(1, config.LOGIN_REGION_MEMORY_DAYS) * 24 * 60 * 60
}

/** 内网/回环段:这类地址没有地理含义,永远不参与异地判定。 */
const INTERNAL_CIDRS = [
  '127.0.0.0/8',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '169.254.0.0/16',
  '::1/128',
  'fc00::/7',
  'fe80::/10',
] as const

interface ParsedCidr {
  address: string
  prefix: number
  family: 'ipv4' | 'ipv6'
}

function parseCidr(cidr: string): ParsedCidr | null {
  const slash = cidr.indexOf('/')
  if (slash === -1) {
    const family = isIP(cidr)
    if (family === 4) return { address: cidr, prefix: 32, family: 'ipv4' }
    if (family === 6) return { address: cidr, prefix: 128, family: 'ipv6' }
    return null
  }
  const address = cidr.slice(0, slash)
  const prefix = Number.parseInt(cidr.slice(slash + 1), 10)
  const family = isIP(address)
  if (!Number.isInteger(prefix) || prefix < 0) return null
  if (family === 4) return { address, prefix, family: 'ipv4' }
  if (family === 6) return { address, prefix, family: 'ipv6' }
  return null
}

let cachedRaw = ''
let cachedList: BlockList | null = null

function buildList(raw: string): BlockList | null {
  const parsed = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseCidr)
    .filter((c): c is ParsedCidr => c !== null)
  if (parsed.length === 0) return null
  const bl = new BlockList()
  for (const c of parsed) bl.addSubnet(c.address, c.prefix, c.family)
  return bl
}

/** 纯函数版:给定 CIDR 列表字符串,判断 IP 是否命中(便于单测)。 */
export function matchesCidrList(ip: string, raw: string): boolean {
  const family = isIP(ip)
  if (family === 0) return false
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedList = buildList(raw)
  }
  if (!cachedList) return false
  return cachedList.check(ip, family === 6 ? 'ipv6' : 'ipv4')
}

/**
 * 该 IP 的登录是否跳过"新地区"判定。
 * 回环 / 内网恒跳过;另加 config.LOGIN_REGION_ALERT_IGNORE_CIDRS 里的自动化/代理出口。
 */
export function isLoginAlertIgnoredIp(ip: string): boolean {
  const raw = `${INTERNAL_CIDRS.join(',')},${config.LOGIN_REGION_ALERT_IGNORE_CIDRS ?? ''}`
  return matchesCidrList(ip, raw)
}

/**
 * 判断本次登录地区对用户是否"新"。
 *
 * @param seed 首次判定(该用户还没有记忆集合)时,用历史登录设备补齐已知地区,
 *             避免上线后第一批老用户被自己的常用地误报一次。
 * @returns known / novel / unknown(unknown = 没有可比历史,调用方不应提醒)
 */
export async function evaluateLoginRegion(
  redis: Redis | null,
  userId: string,
  region: string,
  seed: () => Promise<string[]> = async () => [],
): Promise<LoginRegionVerdict> {
  const ttl = memoryTtlSec()

  if (!redis) {
    const m = memGet(userId)
    const now = Date.now()
    for (const [k, exp] of m) if (exp <= now) m.delete(k)
    if (m.size === 0) {
      const seeds = await safeSeed(seed)
      for (const s of seeds) m.set(s, now + ttl * 1000)
      if (m.size === 0) return 'unknown'
    }
    return m.has(region) ? 'known' : 'novel'
  }

  try {
    const exists = await redis.exists(keyOf(userId))
    if (exists === 0) {
      const seeds = await safeSeed(seed)
      if (seeds.length === 0) return 'unknown'
      await redis.sadd(keyOf(userId), ...seeds)
      await redis.expire(keyOf(userId), ttl)
    }
    const member = await redis.sismember(keyOf(userId), region)
    return member === 1 ? 'known' : 'novel'
  } catch (e) {
    logger.warn('login-region: evaluate failed, treat as unknown', { err: e, userId })
    return 'unknown'
  }
}

async function safeSeed(seed: () => Promise<string[]>): Promise<string[]> {
  try {
    const keys = await seed()
    return Array.from(new Set(keys.filter((k) => typeof k === 'string' && k !== '')))
  } catch (e) {
    logger.warn('login-region: seed failed, continue without history', { err: e })
    return []
  }
}

/** 登录成功后记住该地区(成功路径才写,避免失败登录污染"常用地")。 */
export async function rememberLoginRegion(
  redis: Redis | null,
  userId: string,
  region: string,
): Promise<void> {
  if (!region) return
  const ttl = memoryTtlSec()

  if (!redis) {
    memGet(userId).set(region, Date.now() + ttl * 1000)
    return
  }
  try {
    await redis.sadd(keyOf(userId), region)
    await redis.expire(keyOf(userId), ttl)
  } catch (e) {
    memGet(userId).set(region, Date.now() + ttl * 1000)
    logger.warn('login-region: remember failed, used memory', { err: e, userId })
  }
}

/** 测试面:清空内存降级表与 CIDR 缓存。 */
export const __test__ = {
  clearMemory: (): void => {
    memRegions.clear()
  },
  clearCidrCache: (): void => {
    cachedRaw = ''
    cachedList = null
  },
  regionKeyOf: keyOf,
  internalCidrs: INTERNAL_CIDRS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
