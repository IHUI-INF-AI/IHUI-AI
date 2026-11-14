// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GeoIP 服务(MaxMind GeoLite2 本地区库 + HTTPS 公共源远程降级)。
 *
 * 降级链(精度从高到低):
 *   1. MaxMind GeoLite2 本地 .mmdb(最快,需注册下载,零网络开销)
 *   2. ipwho.is 公共 API(仅 HTTPS,无密钥,带 60s 内存缓存)
 *   3. null(fail-open,不阻塞业务;isSameLocation 在此情况下兜底为 IP 前两段比较)
 *
 * 为什么不再用 ip-api.com(F-273):其免费版只提供明文 HTTP,而本服务的结果会直接进入
 * 登录风控裁决(services/anomaly-detector.ts)与登录呈现地区判定(services/login-region.ts)。
 * 明文链路可被中间人改写,裁判依据必须是加密且经过校验的数据,所以远程腿只允许 HTTPS。
 *
 * MaxMind GeoLite2 免费但需注册下载:
 *   注册:https://www.maxmind.com/en/geolite2/signup
 *   下载命令(node scripts/download-geolite2.mjs,需配置 MAXMIND_LICENSE_KEY)
 *   下载后放到项目 data/ 目录,或在 .env 配置 GEOLITE2_CITY_DB_PATH。
 *
 * 零运行时依赖:maxmind npm 包为可选依赖,用动态 import 加载;
 * 远程调用用 Node 18+ 内置 fetch。未安装或数据库缺失时自动降级,
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
  /**
   * ISO 3166-1 alpha-2 国家码(如 CN / US)。
   * 与 country 分列:country 给人读(降级链 1 给人名是英文),判定必须用它 ——
   * 人名的语言随上游/查询参数变(lang=zh-CN 时可能返「中国」),拿它比对会静默失配。
   */
  countryCode?: string
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
      logger.warn('geoip: MaxMind database load failed, using https fallback', {
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
            countryCode: record.country?.iso_code,
            city: record.city?.names?.en,
            region: record.subdivisions?.[0]?.names?.en,
            latitude: record.location?.latitude,
            longitude: record.location?.longitude,
            timezone: record.location?.time_zone,
          }
        }
        // mmdb 查询返回 null(如私有 IP / 数据库未覆盖)→ 继续走 HTTPS 远程兜底
      } catch (e) {
        logger.warn('geoip: mmdb lookup failed, falling back to https source', { ip, err: e })
      }
    }
    // 降级链 2:mmdb 不存在 / 查询失败 → HTTPS 公共源(带缓存,异常一律落 null)
    return lookupViaRemoteHttps(ip)
  }

  async isSameLocation(ip1: string, ip2: string): Promise<boolean> {
    if (ip1 === ip2) return true

    const reader = await this.loadReader()
    if (!reader) {
      // mmdb 不存在:lookup 会走 HTTPS 远程源;远程失败时再兜底 IP 前两段
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
      // mmdb 不存在:lookup 会走 HTTPS 远程源;失败返回 null
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

/**
 * 远程 GeoIP 源:只允许 HTTPS(F-273)。
 * 免费、无密钥;返回 JSON(字段见 parseRemoteLocation)。
 */
const REMOTE_GEO_ENDPOINT = 'https://ipwho.is'
/**
 * 远程查询超时(毫秒)。风控(anomaly-detector)与登录呈现(login-region)都在请求路径上
 * 等这一跳,3 秒内拿不到就当作「无地理信息」,绝不拖住登录。
 */
const REMOTE_GEO_TIMEOUT_MS = 3_000
/** 远程响应体上限:正常报文不足 1KB,超过 16KB 视为异常,直接判「无地理信息」。 */
const REMOTE_GEO_MAX_BYTES = 16 * 1024

/**
 * 远程结果的内存缓存,避免同一 IP 反复出站。
 * TTL 60 秒:null 也缓存(避免对查询失败的 IP 反复打远程)。
 */
const remoteGeoCache = new Map<string, { location: GeoLocation | null; expiry: number }>()
const REMOTE_GEO_CACHE_TTL_MS = 60_000

/**
 * 判断地址是否「非公网 / 非法」——这类地址不出站:
 * 私网、回环、链路本地、CGNAT、文档段、组播/保留段,以及任何解析不出 IPv4/IPv6 形态的字符串。
 * 既避免拿风控流量当探测跳板,也避免对远程源做必然失败的请求。
 */
function isNonPublicIp(ip: string): boolean {
  const clean = ip.trim().toLowerCase()
  if (clean === '') return true

  // IPv6(含 IPv4-mapped 已在外层剥离)
  if (clean.includes(':')) {
    // :: / ::1 等 :: 开头的保留段
    if (clean.startsWith('::')) return true
    // ULA fc00::/7
    if (clean.startsWith('fc') || clean.startsWith('fd')) return true
    // 链路本地 fe80::/10
    if (/^fe[89ab]/.test(clean)) return true
    // 组播 ff00::/8
    if (clean.startsWith('ff')) return true
    // 其余只放行「像 IPv6」的字符集;非法串(含 zone id 等)一律不出站
    return !/^[0-9a-f:.]+$/.test(clean)
  }

  const parts = clean.split('.')
  if (parts.length !== 4) return true
  const octets: number[] = []
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return true
    octets.push(Number(part))
  }
  const a = octets[0] ?? 0
  const b = octets[1] ?? 0
  if (a < 0 || a > 255 || b < 0 || b > 255) return true
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64/10
  if (a === 169 && b === 254) return true // 链路本地
  if (a === 172 && b >= 16 && b <= 31) return true // 私网 172.16/12
  if (a === 192 && b === 168) return true // 私网 192.168/16
  if (a === 192 && b === 0) return true // 192.0.0/24 + 文档段 192.0.2/24
  if (a === 198 && (b === 18 || b === 19)) return true // 基准测试段 198.18/15
  if (a === 198 && b === 51) return true // 文档段 198.51.100/24
  if (a === 203 && b === 0) return true // 文档段 203.0.113/24
  if (a >= 224) return true // 组播 + 保留 + 广播
  return false
}

/** 读取前先看 content-length:声明体积异常就不再解析,避免把超大报文读进内存。 */
function isDeclaredOversize(response: Response): boolean {
  const declared = response.headers?.get?.('content-length')
  if (typeof declared !== 'string' || declared === '') return false
  const size = Number(declared)
  if (!Number.isFinite(size)) return true
  return size > REMOTE_GEO_MAX_BYTES
}

/** 取第一个非空字符串字段;类型不符的值由 hasInvalidFieldTypes 先行拦掉。 */
function firstString(data: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = data[key]
    if (typeof value === 'string' && value !== '') return value
  }
  return undefined
}

/** 取第一个有限数字字段。 */
function firstNumber(data: Record<string, unknown>, keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const value = data[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
  }
  return undefined
}

/**
 * 字段类型自检:只要出现字段但类型不符 ⇒ 整条响应作废。
 * 宁可当作「无地理信息」,也不把脏数据送进风控裁决。
 */
function hasInvalidFieldTypes(data: Record<string, unknown>): boolean {
  for (const key of ['country', 'country_code', 'countryCode', 'region', 'regionName', 'city']) {
    const value = data[key]
    if (value !== undefined && value !== null && typeof value !== 'string') return true
  }
  for (const key of ['latitude', 'longitude', 'lat', 'lon']) {
    const value = data[key]
    if (value !== undefined && value !== null) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return true
    }
  }
  const timezone = data.timezone
  if (timezone !== undefined && timezone !== null) {
    const ok =
      typeof timezone === 'string' ||
      (typeof timezone === 'object' && typeof (timezone as { id?: unknown }).id === 'string')
    if (!ok) return true
  }
  return false
}

/**
 * 把远程 JSON 映射为既有 GeoLocation 结构(对外字段与签名保持不变)。
 * 兼容 ipwho.is 主字段(country_code/region/latitude/longitude/timezone.id)
 * 与既有契约别名(countryCode/regionName/lat/lon/timezone)。
 * 未声明成功、字段类型异常、缺国家码 → null。
 */
function parseRemoteLocation(payload: unknown): GeoLocation | null {
  if (typeof payload !== 'object' || payload === null) return null
  const data = payload as Record<string, unknown>

  // 成功哨兵:ipwho.is 用 success:true;旧契约用 status:'success'
  const succeeded = data.success === true || data.status === 'success'
  if (!succeeded) return null
  if (hasInvalidFieldTypes(data)) return null

  const country = firstString(data, ['country'])
  const countryCode = firstString(data, ['country_code', 'countryCode'])
  // 风控只吃两位国家码;形态不对就不猜,整条作废
  if (countryCode && !/^[A-Za-z]{2}$/.test(countryCode)) return null
  if (!country && !countryCode) return null

  const timezoneRaw = data.timezone
  const timezone =
    typeof timezoneRaw === 'string'
      ? timezoneRaw
      : timezoneRaw !== null && typeof timezoneRaw === 'object'
        ? firstString(timezoneRaw as Record<string, unknown>, ['id'])
        : undefined

  return {
    country,
    countryCode,
    city: firstString(data, ['city']),
    region: firstString(data, ['region', 'regionName']),
    latitude: firstNumber(data, ['latitude', 'lat']),
    longitude: firstNumber(data, ['longitude', 'lon']),
    timezone,
  }
}

/**
 * 通过 HTTPS 公共源查询 IP 地理位置(mmdb 不可用时的降级腿)。
 * - 只出站 HTTPS;URL 协议在调用前二次校验(源锁),非 https 一律不发
 * - 3 秒超时 + content-length 体积上限 + JSON/字段类型校验
 * - 任何异常(超时 / 网络错误 / 非 200 / 非 JSON / 体积或字段异常)→ null(fail-open)
 * - 60 秒内存缓存(含 null),同 IP 反复查询直接命中
 */
async function lookupViaRemoteHttps(ip: string): Promise<GeoLocation | null> {
  const cleanIp = ip.replace(/^::ffff:/i, '').trim()
  // 私网 / 保留 / 非法地址:直接返回 null,不发请求
  if (isNonPublicIp(cleanIp)) return null

  // 命中缓存(含 null 缓存)
  const cached = remoteGeoCache.get(cleanIp)
  if (cached && cached.expiry > Date.now()) return cached.location

  let location: GeoLocation | null = null
  try {
    // 源锁:即便端点常量被改坏,也在这里拦住任何非 HTTPS 出站。
    // cleanIp 已由 isNonPublicIp 限定为 IPv4/IPv6 字符集,直接拼路径不引入 URL 注入。
    const url = new URL(`${REMOTE_GEO_ENDPOINT}/${cleanIp}`)
    if (url.protocol !== 'https:') throw new Error('geoip: non-https endpoint rejected')
    const response = await fetch(url, { signal: AbortSignal.timeout(REMOTE_GEO_TIMEOUT_MS) })
    if (response.ok && !isDeclaredOversize(response)) {
      const payload: unknown = await response.json()
      location = parseRemoteLocation(payload)
    }
  } catch {
    // 超时 / 网络错误 / JSON 解析失败 → fail-open 返回 null
    location = null
  }

  // 写缓存(含 null 缓存,防止异常期间反复打远程)
  remoteGeoCache.set(cleanIp, { location, expiry: Date.now() + REMOTE_GEO_CACHE_TTL_MS })

  // 简单的缓存淘汰:超过 1000 条时清理过期项(防内存无限增长)
  if (remoteGeoCache.size > 1000) {
    const now = Date.now()
    for (const [key, val] of remoteGeoCache) {
      if (val.expiry <= now) remoteGeoCache.delete(key)
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
