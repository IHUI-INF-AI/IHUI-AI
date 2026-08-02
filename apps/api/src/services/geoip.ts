/**
 * GeoIP 服务(MaxMind GeoLite2 集成 + 本地降级)。
 *
 * 用 MaxMind GeoLite2 本地数据库(.mmdb)查询 IP 地理位置(country / city / 坐标)。
 * 数据库不存在或查询失败时降级为"IP 前两段变化"判断(向后兼容 anomaly-detector 旧逻辑)。
 *
 * MaxMind GeoLite2 免费但需注册下载:
 *   注册:https://www.maxmind.com/en/geolite2/signup
 *   下载后放到项目 data/ 目录,或在 .env 配置 GEOLITE2_CITY_DB_PATH。
 *
 * 零运行时依赖:maxmind npm 包为可选依赖,用动态 import 加载,
 * 未安装或数据库缺失时自动降级,不影响服务启动(fail-open)。
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
      logger.warn('geoip: MaxMind database load failed, using IP prefix fallback', {
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
    if (!reader) return null
    try {
      const record = reader.get(ip)
      if (!record) return null
      return {
        country: record.country?.names?.en ?? record.country?.iso_code,
        city: record.city?.names?.en,
        region: record.subdivisions?.[0]?.names?.en,
        latitude: record.location?.latitude,
        longitude: record.location?.longitude,
        timezone: record.location?.time_zone,
      }
    } catch (e) {
      logger.warn('geoip: lookup failed', { ip, err: e })
      return null
    }
  }

  async isSameLocation(ip1: string, ip2: string): Promise<boolean> {
    if (ip1 === ip2) return true

    const reader = await this.loadReader()
    if (!reader) {
      // 降级:IP 前两段比较
      return ipFirstTwoOctetsEqual(ip1, ip2)
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
    if (!reader) return null
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
