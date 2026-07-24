/**
 * 设备指纹生成与可信设备管理(国安级 MFA 配套)。
 *
 * - 指纹仅从请求头提取(SHA-256 组合),不依赖客户端 JS
 * - 可信设备存储:Redis(30 天 TTL),降级到内存 Map
 * - Redis 降级工具(rGet/rSet/rDel)导出供 risk-scoring-engine 复用
 */
import { createHash } from 'node:crypto'
import type { Redis } from 'ioredis'
import { logger } from '../utils/logger.js'

export interface FingerprintInput {
  userAgent: string
  acceptLanguage: string
  ip: string
  xForwardedFor?: string
  secChUa?: string
  secChUaPlatform?: string
}

/**
 * 生成设备指纹(SHA-256 → 64 位 hex)。
 * 组合 UA / Accept-Language / IP / X-Forwarded-For / Sec-CH-UA / Sec-CH-UA-Platform。
 */
export function generateFingerprint(input: FingerprintInput): string {
  const parts = [
    input.userAgent ?? '',
    input.acceptLanguage ?? '',
    input.ip ?? '',
    input.xForwardedFor ?? '',
    input.secChUa ?? '',
    input.secChUaPlatform ?? '',
  ]
  return createHash('sha256').update(parts.join('|'), 'utf8').digest('hex')
}

// ============ 内存降级存储 ============

interface MemoryEntry {
  value: string
  expiresAt: number // epoch ms,0 = 永不过期
}

const memoryStore = new Map<string, MemoryEntry>()

function memGet(key: string): string | null {
  const entry = memoryStore.get(key)
  if (!entry) return null
  if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
    memoryStore.delete(key)
    return null
  }
  return entry.value
}

function memSet(key: string, value: string, ttlSec: number): void {
  memoryStore.set(key, {
    value,
    expiresAt: ttlSec > 0 ? Date.now() + ttlSec * 1000 : 0,
  })
}

function memDel(key: string): boolean {
  return memoryStore.delete(key)
}

// ============ Redis 读写(带降级,导出供 risk-scoring-engine 复用) ============

/** Redis get,失败降级到内存。 */
export async function rGet(redis: Redis | null, key: string): Promise<string | null> {
  if (redis) {
    try {
      return await redis.get(key)
    } catch (err) {
      logger.warn('Redis get 降级到内存', { key, err: String(err) })
    }
  }
  return memGet(key)
}

/** Redis set (带 TTL),失败降级到内存。 */
export async function rSet(
  redis: Redis | null,
  key: string,
  value: string,
  ttlSec: number,
): Promise<void> {
  if (redis) {
    try {
      await redis.set(key, value, 'EX', ttlSec)
      return
    } catch (err) {
      logger.warn('Redis set 降级到内存', { key, err: String(err) })
    }
  }
  memSet(key, value, ttlSec)
}

/** Redis del,失败降级到内存。 */
export async function rDel(redis: Redis | null, key: string): Promise<boolean> {
  if (redis) {
    try {
      const n = await redis.del(key)
      return n > 0
    } catch (err) {
      logger.warn('Redis del 降级到内存', { key, err: String(err) })
    }
  }
  return memDel(key)
}

// ============ 可信设备管理 ============

const TRUSTED_TTL_SEC = 30 * 24 * 60 * 60 // 30 天
const TRUSTED_PREFIX = 'trusted:user:'

export interface TrustedDevice {
  fingerprint: string
  deviceName: string
  registeredAt: number
}

function trustedKey(userId: string): string {
  return `${TRUSTED_PREFIX}${userId}`
}

/**
 * 注册可信设备(Redis 30 天 TTL)。已存在则更新名称。
 */
export async function registerTrustedDevice(
  redis: Redis | null,
  userId: string,
  fingerprint: string,
  deviceName: string,
): Promise<void> {
  const key = trustedKey(userId)
  const list = await listTrustedDevices(redis, userId)
  const filtered = list.filter((d) => d.fingerprint !== fingerprint)
  filtered.push({ fingerprint, deviceName, registeredAt: Date.now() })
  await rSet(redis, key, JSON.stringify(filtered), TRUSTED_TTL_SEC)
}

/**
 * 查询设备是否可信。
 */
export async function isTrustedDevice(
  redis: Redis | null,
  userId: string,
  fingerprint: string,
): Promise<boolean> {
  const list = await listTrustedDevices(redis, userId)
  return list.some((d) => d.fingerprint === fingerprint)
}

/**
 * 吊销可信设备。返回是否找到并删除。
 */
export async function revokeTrustedDevice(
  redis: Redis | null,
  userId: string,
  fingerprint: string,
): Promise<boolean> {
  const key = trustedKey(userId)
  const list = await listTrustedDevices(redis, userId)
  const filtered = list.filter((d) => d.fingerprint !== fingerprint)
  if (filtered.length === list.length) return false // 未找到
  if (filtered.length === 0) {
    await rDel(redis, key)
  } else {
    await rSet(redis, key, JSON.stringify(filtered), TRUSTED_TTL_SEC)
  }
  return true
}

/**
 * 列出所有可信设备。
 */
export async function listTrustedDevices(
  redis: Redis | null,
  userId: string,
): Promise<TrustedDevice[]> {
  const raw = await rGet(redis, trustedKey(userId))
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed as TrustedDevice[]
  } catch {
    return []
  }
}

/**
 * 检测是否为新设备(未在可信列表中 → 需触发 MFA 验证)。
 */
export async function isNewDevice(
  redis: Redis | null,
  userId: string,
  fingerprint: string,
): Promise<boolean> {
  return !(await isTrustedDevice(redis, userId, fingerprint))
}
