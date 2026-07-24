/**
 * 网络分段策略插件(国安级网络隔离)。
 *
 * 核心能力:
 * - IP 分类:internal / external / blacklisted / unknown
 * - 路由级网络分段策略(routeOptions.config.network = { allowInternal, allowExternal, allowedCidrs })
 * - 黑名单管理:Redis 优先(Redis Set + TTL),降级内存 Map(支持 TTL 过期)
 * - CIDR 匹配:基于 node:net.BlockList(零依赖,原生支持 IPv4/IPv6)
 *
 * 默认内网 CIDR:10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, ::1/128, fc00::/7
 * 违反分段策略 → 403;strict 模式下 unknown IP → 403。
 *
 * 与 CORS 协同:本插件不重复 CORS 逻辑,仅做 IP 来源分类与策略执行。
 */
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { BlockList, isIP } from 'node:net'
import { logger } from '../utils/logger.js'

export type IpClassification = 'internal' | 'external' | 'blacklisted' | 'unknown'

export interface NetworkRouteConfig {
  /** 允许内网 IP 访问(默认 true) */
  allowInternal?: boolean
  /** 允许公网 IP 访问(默认 true) */
  allowExternal?: boolean
  /** 额外允许的 CIDR 列表(白名单,如 ['10.0.0.0/8']) */
  allowedCidrs?: string[]
}

const BLACKLIST_KEY = 'ip_blacklist'

// 默认内网 CIDR 段(RFC 1918 + loopback + IPv6 本地)
const DEFAULT_INTERNAL_CIDRS: { address: string; prefix: number; family: 'ipv4' | 'ipv6' }[] = [
  { address: '10.0.0.0', prefix: 8, family: 'ipv4' },
  { address: '172.16.0.0', prefix: 12, family: 'ipv4' },
  { address: '192.168.0.0', prefix: 16, family: 'ipv4' },
  { address: '127.0.0.0', prefix: 8, family: 'ipv4' },
  { address: '::1', prefix: 128, family: 'ipv6' },
  { address: 'fc00::', prefix: 7, family: 'ipv6' },
]

// 内存黑名单降级存储(Redis 不可用时使用):ip → expireAt(ms),0 = 永久
const memoryBlacklist = new Map<string, number>()

declare module 'fastify' {
  interface FastifyContextConfig {
    network?: NetworkRouteConfig
  }
  interface FastifyInstance {
    networkSegment: {
      /** 分类 IP:internal / external / blacklisted / unknown */
      classifyIp(ip: string): IpClassification
      /** 检查 IP 是否在黑名单中(Redis 优先,降级内存) */
      isBlacklisted(ip: string): Promise<boolean>
      /** 添加 IP 到黑名单(ttlSec=0 永久) */
      addToBlacklist(ip: string, ttlSec?: number): Promise<void>
      /** 从黑名单移除 IP */
      removeFromBlacklist(ip: string): Promise<void>
    }
  }
  interface FastifyRequest {
    /** 当前请求的 IP 分类(由 preHandler 注入) */
    ipClassification?: IpClassification
  }
}

/**
 * 解析 CIDR 字符串 "10.0.0.0/8" → { address, prefix, family }。
 * 无前缀的 IP 视为 /32 (IPv4) 或 /128 (IPv6)。
 */
function parseCidr(
  cidr: string,
): { address: string; prefix: number; family: 'ipv4' | 'ipv6' } | null {
  const slashIdx = cidr.indexOf('/')
  if (slashIdx === -1) {
    const family = isIP(cidr)
    if (family === 4) return { address: cidr, prefix: 32, family: 'ipv4' }
    if (family === 6) return { address: cidr, prefix: 128, family: 'ipv6' }
    return null
  }
  const address = cidr.slice(0, slashIdx)
  const prefix = parseInt(cidr.slice(slashIdx + 1), 10)
  if (!Number.isInteger(prefix) || prefix < 0) return null
  const family = isIP(address)
  if (family === 4) return { address, prefix, family: 'ipv4' }
  if (family === 6) return { address, prefix, family: 'ipv6' }
  return null
}

/**
 * 构建 BlockList(从 CIDR 列表)。
 */
function buildBlockList(
  cidrs: { address: string; prefix: number; family: 'ipv4' | 'ipv6' }[],
): BlockList {
  const bl = new BlockList()
  for (const { address, prefix, family } of cidrs) {
    bl.addSubnet(address, prefix, family)
  }
  return bl
}

// 默认内网 BlockList(模块级单例,避免重复构建)
const defaultInternalBlockList = buildBlockList(DEFAULT_INTERNAL_CIDRS)

const networkSegmentPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  const policy = process.env.NETWORK_SEGMENT_POLICY ?? 'permissive' // strict / permissive

  /**
   * 分类 IP:internal / external / unknown
   * (blacklisted 由 isBlacklisted 异步检查,此处仅做网络位置分类)
   */
  function classifyIp(ip: string): IpClassification {
    const family = isIP(ip)
    if (family === 0) return 'unknown'
    if (defaultInternalBlockList.check(ip, family === 6 ? 'ipv6' : 'ipv4')) {
      return 'internal'
    }
    return 'external'
  }

  /**
   * 检查 IP 是否在黑名单中。
   * 先检查内存黑名单(含 TTL 过期清理),再查 Redis。
   */
  async function isBlacklisted(ip: string): Promise<boolean> {
    // 内存黑名单检查(含 TTL 过期清理)
    const memEntry = memoryBlacklist.get(ip)
    if (memEntry !== undefined) {
      if (memEntry === 0 || memEntry > Date.now()) return true
      memoryBlacklist.delete(ip) // 已过期,清理
    }

    // Redis 黑名单检查
    try {
      const exists = await server.redis.sismember(BLACKLIST_KEY, ip)
      return exists === 1
    } catch (e) {
      // Redis 不可用时,内存黑名单已检查,返回 false(fail-open for non-blacklisted)
      logger.warn('Redis blacklist check failed, using memory only', {
        ip,
        error: (e as Error).message,
      })
      return false
    }
  }

  /**
   * 添加 IP 到黑名单。
   * @param ttlSec TTL(秒),0 或未指定 = 永久
   */
  async function addToBlacklist(ip: string, ttlSec: number = 0): Promise<void> {
    // 内存存储(TTL 转换为绝对过期时间)
    memoryBlacklist.set(ip, ttlSec > 0 ? Date.now() + ttlSec * 1000 : 0)

    try {
      await server.redis.sadd(BLACKLIST_KEY, ip)
      // Redis Set 不支持成员级 TTL,设置 key 级 TTL 作为兜底清理
      if (ttlSec > 0) {
        const currentTtl = await server.redis.ttl(BLACKLIST_KEY)
        if (currentTtl < 0) {
          await server.redis.expire(BLACKLIST_KEY, ttlSec)
        }
      }
      logger.info('IP added to blacklist', { ip, ttlSec })
    } catch (e) {
      logger.warn('Failed to add IP to Redis blacklist, using memory only', {
        ip,
        error: (e as Error).message,
      })
    }
  }

  /**
   * 从黑名单移除 IP(内存 + Redis 双删)。
   */
  async function removeFromBlacklist(ip: string): Promise<void> {
    memoryBlacklist.delete(ip)
    try {
      await server.redis.srem(BLACKLIST_KEY, ip)
      logger.info('IP removed from blacklist', { ip })
    } catch (e) {
      logger.warn('Failed to remove IP from Redis blacklist', {
        ip,
        error: (e as Error).message,
      })
    }
  }

  server.decorate('networkSegment', {
    classifyIp,
    isBlacklisted,
    addToBlacklist,
    removeFromBlacklist,
  })

  // preHandler:网络分段策略执行(仅对配置了 network 的路由生效)
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const routeConfig = request.routeOptions.config
    const networkConfig = routeConfig?.network
    if (!networkConfig) return // 未配置 network 的路由不强制分段(向后兼容)

    const clientIp = request.ip
    const classification = classifyIp(clientIp)
    request.ipClassification = classification

    // 黑名单检查(最高优先级)
    if (await isBlacklisted(clientIp)) {
      reply.status(403).send({ code: 403, message: 'IP is blacklisted' })
      return
    }

    // 额外允许 CIDR 检查(白名单优先于 internal/external 策略)
    if (networkConfig.allowedCidrs && networkConfig.allowedCidrs.length > 0) {
      const parsed = networkConfig.allowedCidrs
        .map(parseCidr)
        .filter(
          (c): c is { address: string; prefix: number; family: 'ipv4' | 'ipv6' } => c !== null,
        )
      if (parsed.length > 0) {
        const bl = buildBlockList(parsed)
        const family = isIP(clientIp)
        if (family > 0 && bl.check(clientIp, family === 6 ? 'ipv6' : 'ipv4')) {
          return // 在额外允许 CIDR 中,放行
        }
      }
    }

    // internal/external 策略
    const allowInternal = networkConfig.allowInternal ?? true
    const allowExternal = networkConfig.allowExternal ?? true

    if (classification === 'internal' && !allowInternal) {
      reply
        .status(403)
        .send({ code: 403, message: 'Internal network access not allowed for this route' })
      return
    }
    if (classification === 'external' && !allowExternal) {
      reply
        .status(403)
        .send({ code: 403, message: 'External network access not allowed for this route' })
      return
    }

    // strict 模式:unknown 分类拒绝
    if (policy === 'strict' && classification === 'unknown') {
      reply
        .status(403)
        .send({ code: 403, message: 'Unrecognized IP address in strict network policy mode' })
      return
    }
  })
}

export default fp(networkSegmentPlugin, {
  name: 'network-segment',
  fastify: '5.x',
})
