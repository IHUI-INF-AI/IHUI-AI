/**
 * GeoIP 服务(MaxMind GeoLite2 集成 + ip-api.com 远程降级)。
 *
 * 降级链(精度从高到低):
 *   1. MaxMind GeoLite2 本地 .mmdb(最快,需注册下载,零网络开销)
 *   2. ip-api.com 免费 API(远程,45 req/min,精准,无需账号,带 60s 内存缓存)
 *   3. null(fail-open,不阻塞业务;isSameLocation 在此情况下兜底为 IP 前两段比较)
 *
 * MaxMind GeoLite2 免费但需注册下载:
 *   注册:https://www.maxmind.com/en/geolite2/signup
 *   下载命令(node scripts/download-geolite2.mjs,需配置 MAXMIND_LICENSE_KEY)
 *   下载后放到项目 data/ 目录,或在 .env 配置 GEOLITE2_CITY_DB_PATH。
 *
 * 零运行时依赖:maxmind npm 包为可选依赖,用动态 import 加载;
 * ip-api.com 调用用 Node 18+ 内置 fetch。未安装或数据库缺失时自动降级,
 * 不影响服务启动(fail-open)。
 */

// 可选依赖:maxmind npm 包可能未安装。用变量名动态 import 避免 TypeScript 要求模块存在,
// 安装 maxmind (npm i maxmind) 后运行时自动加载,类型由下方局部接口精确约束。
/** MaxMind GeoLite2-City 记录的最小形状(仅取本服务使用的字段)。 */
interface MaxMindRecord {
  country?: { names?: Record<string, string>; iso_code?: string }
  city?: { names?: Record<string, string> }
  subdivisions?: ReadonlyArray<{ names?: Record<string, string> }>
  location?: { latitude?: number; longitude?: number; time_zone?: string }
}
/** maxmind Reader 的最小形状(仅 get 方法)。 */
interface MaxMindReader {
  get(ip: string): MaxMindRecord | null
}
/** maxmind 模块的最小形状(仅 open 函数)。 */
interface MaxMindModule {
  open(filepath: string): Promise<MaxMindReader>
}

import { logger } from '../utils/logger.js'

/* -------------------------------------------------------------------------- */
/* 类型                                                                        */
/* -------------------------------------------------------------------------- */

export interface GeoLocation {
  country?: string
  city?: string
  region?: string
  latitude?: number
  longitude?: number
  timezone?: string
}

export interface GeoIpService {
  /** 查询 IP 地理位置,失败或无数据库返回 null(fail-open)。 */
  lookup(ip: string): Promise<GeoLocation | null>
  /** 两个 IP 是否同一地点(country + city 相同)。无数据库时降级为前两段比较。 */
  isSameLocation(ip1: string, ip2: string): Promise<boolean>
  /** 两个 IP 间的球面距离(km),无坐标或无数据库返回 null。 */
  getDistanceKm(ip1: string, ip2: string): Promise<number | null>
}

/* -------------------------------------------------------------------------- */
/* 服务实现                                                                    */
/* -------------------------------------------------------------------------- */

class GeoIpServiceImpl implements GeoIpService {
  /** lazy: undefined = 未加载 / null = 加载失败(降级) / 对象 = 成功 */
  private reader: MaxMindReader | null | undefined = undefined
  /** 并发去重:同一进程内只加载一次 */
  private loadPromise: Promise<MaxMindReader | null> | null = null

  private getDbPath(): string {
    return process.env.GEOLITE2_CITY_DB_PATH || './data/GeoLite2-City.mmdb'
  }

  private async loadReader(): Promise<MaxMindReader | null> {
    if (this.reader !== undefined) return this.reader
    if (this.loadPromise) return this.loadPromise
    this.loadPromise = this.doLoadReader()
    this.reader = await this.loadPromise
    return this.reader
  }

  private async doLoadReader(): Promise<MaxMindReader | null> {
    const dbPath = this.getDbPath()
    try {
      // 动态 import:maxmind 为可选依赖,用变量名避免 TypeScript 要求模块存在;
      // 未安装时 catch 后降级到"IP 前两段"判断
      const moduleName = 'maxmind'
      const maxmind = (await import(moduleName)) as MaxMindModule
      const reader = await maxmind.open(dbPath)
      logger.info('geoip: MaxMind database loaded', { path: dbPath })
      return reader
    } catch (e) {
      logger.warn('geoip: MaxMind database load failed, using ip-api.com fallback', {
        path: dbPath,
        err: e,
      })
      return null
    }
  }

  /* ----------------------------- 查询 ----------------------------- */

  async lookup(ip: string): Promise<GeoLocation | null> {
    if (!ip) return null
    const reader = await this.loadReader()
    // 降级链 1:mmdb 存在 → 用 mmdb(本地,最快,零网络开销)
    if (reader) {
      try {
        const record = reader.get(ip)
        if (record) {
          return {
            country: record.country?.names?.en ?? record.country?.iso_code,
            city: record.city?.names?.en,
            region: record.subdivisions?.[0]?.names?.en,
            latitude: record.location?.latitude,
            longitude: record.location?.longitude,
            timezone: record.location?.time_zone,
          }
        }
        // mmdb 查询返回 null(如私有 IP / 数据库未覆盖)→ 继续走 ip-api 兜底
      } catch (e) {
        logger.warn('geoip: mmdb lookup failed, falling back to ip-api.com', { ip, err: e })
      }
    }
    // 降级链 2:mmdb 不存在 / 查询失败 → ip-api.com(远程,免费,精准,带缓存)
    return lookupViaIpApi(ip)
  }

  async isSameLocation(ip1: string, ip2: string): Promise<boolean> {
    if (ip1 === ip2) return true

    const reader = await this.loadReader()
    if (!reader) {
      // mmdb 不存在:lookup 会走 ip-api.com;ip-api 失败时再兜底 IP 前两段
      const [loc1, loc2] = await Promise.all([this.lookup(ip1), this.lookup(ip2)])
      if (!loc1 || !loc2) return ipFirstTwoOctetsEqual(ip1, ip2)
      return loc1.country === loc2.country && loc1.city === loc2.city
    }

    try {
      const [loc1, loc2] = await Promise.all([this.lookup(ip1), this.lookup(ip2)])
      // 任一 IP 查询失败 → 降级到前两段比较
      if (!loc1 || !loc2) return ipFirstTwoOctetsEqual(ip1, ip2)
      // country + city 相同视为同地
      return loc1.country === loc2.country && loc1.city === loc2.city
    } catch (e) {
      logger.warn('geoip: isSameLocation failed, using fallback', { err: e })
      return ipFirstTwoOctetsEqual(ip1, ip2)
    }
  }

  async getDistanceKm(ip1: string, ip2: string): Promise<number | null> {
    if (ip1 === ip2) return 0
    const reader = await this.loadReader()
    if (!reader) {
      // mmdb 不存在:lookup 会走 ip-api.com;失败返回 null
      const [loc1, loc2] = await Promise.all([this.lookup(ip1), this.lookup(ip2)])
      if (!loc1 || !loc2) return null
      if (loc1.latitude === undefined || loc1.longitude === undefined) return null
      if (loc2.latitude === undefined || loc2.longitude === undefined) return null
      return haversineKm(loc1.latitude, loc1.longitude, loc2.latitude, loc2.longitude)
    }
    try {
      const [loc1, loc2] = await Promise.all([this.lookup(ip1), this.lookup(ip2)])
      if (!loc1 || !loc2) return null
      if (loc1.latitude === undefined || loc1.longitude === undefined) return null
      if (loc2.latitude === undefined || loc2.longitude === undefined) return null
      return haversineKm(loc1.latitude, loc1.longitude, loc2.latitude, loc2.longitude)
    } catch (e) {
      logger.warn('geoip: getDistanceKm failed', { err: e })
      return null
    }
  }
}

/* -------------------------------------------------------------------------- */
/* 辅助函数                                                                    */
/* -------------------------------------------------------------------------- */

/** ip-api.com 响应的最小形状(仅取本服务使用的字段)。 */
interface IpApiResponse {
  status: string
  country?: string
  countryCode?: string
  regionName?: string
  city?: string
  lat?: number
  lon?: number
  timezone?: string
}

/**
 * ip-api.com 免费 API 调用的内存缓存,避免重复查询同一 IP 触发 45 req/min 限速。
 * TTL 60 秒:null 也缓存(避免对查询失败的 IP 反复打远程)。
 */
const ipApiCache = new Map<string, { location: GeoLocation | null; expiry: number }>()
const IP_API_CACHE_TTL_MS = 60_000

/**
 * 通过 ip-api.com 免费 API 查询 IP 地理位置(mmdb 不可用时的精准降级)。
 * - 免费版:45 req/min,HTTP(非 HTTPS),无需账号,返回 zh-CN 字段。
 * - 3 秒超时 + fail-open:失败返回 null,不阻塞业务。
 * - 60 秒内存缓存:同 IP 反复查询直接命中缓存,绕过限速。
 * 文档:https://ip-api.com/docs/api/json
 */
async function lookupViaIpApi(ip: string): Promise<GeoLocation | null> {
  // 私有 / 内网 IP 直接返回 null,不打远程(ip-api 也查不到)
  const cleanIp = ip.replace(/^::ffff:/, '')
  if (cleanIp.startsWith('127.') || cleanIp.startsWith('10.') || cleanIp.startsWith('192.168.')) {
    return null
  }
  if (cleanIp.startsWith('172.')) {
    const second = parseInt(cleanIp.split('.')[1] ?? '0', 10)
    if (second >= 16 && second <= 31) return null
  }
  if (cleanIp === '::1' || cleanIp.startsWith('fc') || cleanIp.startsWith('fd')) return null

  // 命中缓存(含 null 缓存)
  const cached = ipApiCache.get(cleanIp)
  if (cached && cached.expiry > Date.now()) return cached.location

  let location: GeoLocation | null = null
  try {
    const url = `http://ip-api.com/json/${cleanIp}?fields=status,country,countryCode,regionName,city,lat,lon,timezone&lang=zh-CN`
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) })
    if (response.ok) {
      const data = (await response.json()) as IpApiResponse
      if (data.status === 'success') {
        location = {
          country: data.country,
          city: data.city,
          region: data.regionName,
          latitude: data.lat,
          longitude: data.lon,
          timezone: data.timezone,
        }
      }
    }
  } catch {
    // 超时 / 网络错误 / JSON 解析失败 → fail-open 返回 null
  }

  // 写缓存(含 null 缓存,防止限速期间反复打远程)
  ipApiCache.set(cleanIp, { location, expiry: Date.now() + IP_API_CACHE_TTL_MS })

  // 简单的缓存淘汰:超过 1000 条时清理过期项(防内存无限增长)
  if (ipApiCache.size > 1000) {
    const now = Date.now()
    for (const [key, val] of ipApiCache) {
      if (val.expiry <= now) ipApiCache.delete(key)
    }
  }

  return location
}

/** 判断两个 IPv4 前两段是否相同(无 GeoIP 时的降级判断)。 */
function ipFirstTwoOctetsEqual(a: string, b: string): boolean {
  const pa = a.replace(/^::ffff:/, '').split('.')
  const pb = b.replace(/^::ffff:/, '').split('.')
  if (pa.length !== 4 || pb.length !== 4) {
    // 非 IPv4,字符串相同即视为同段
    return a === b
  }
  return pa[0] === pb[0] && pa[1] === pb[1]
}

/** Haversine 公式:两点间大圆距离(km)。 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // 地球半径(km)
  const toRad = (deg: number): number => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/* -------------------------------------------------------------------------- */
/* 单例工厂                                                                    */
/* -------------------------------------------------------------------------- */

let singleton: GeoIpService | null = null
export function getGeoIpService(): GeoIpService {
  if (!singleton) singleton = new GeoIpServiceImpl()
  return singleton
}
