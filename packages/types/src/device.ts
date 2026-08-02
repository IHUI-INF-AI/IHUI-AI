/**
 * 跨端设备指纹采集契约(国安级风控设备维度)。
 *
 * 设计:仿 use-clipboard 工厂模式(AGENTS.md §3 共享层优先 + 工厂模式优先)。
 * 各端注入平台 adapter 实现,返回统一的指纹字符串 + 元数据。
 *
 * 放在 @ihui/types(零依赖底层包)而非 @ihui/shared,避免与 @ihui/api-client 循环依赖:
 * - @ihui/shared 依赖 @ihui/api-client(已有)
 * - @ihui/api-client 依赖 @ihui/types(已有)
 * - 所以设备指纹契约放 @ihui/types,api-client 和 shared 都能 import,无环。
 *
 * 指纹组成(各端按可用性采集,缺失字段跳过):
 * - userAgent:浏览器/客户端 UA
 * - screen:屏幕分辨率 + 色深
 * - timezone:时区(如 Asia/Shanghai)
 * - language:语言(如 zh-CN)
 * - platform:平台标识(如 Win32 / iPhone)
 * - canvas:Canvas 渲染指纹(web 端,hash 后字符串)
 * - webgl:WebGL 渲染器(web 端,hash 后字符串)
 * - hardwareConcurrency:CPU 核心数
 * - deviceMemory:设备内存(GB,部分浏览器支持)
 *
 * 安全约束:
 * - 指纹不可逆(只 hash,不传原始 Canvas/WebGL 数据)
 * - 不采集 PII(个人身份信息),只采集设备特征
 * - 指纹长度固定 32 字符,header 传输限制 128 字符(后端 audit-logger.slice(0,128) 已兜底)
 */

/* -------------------------------------------------------------------------- */
/* 类型定义                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 平台 adapter 实现接口。
 * 各端注入自己的实现,返回当前设备的特征字段(缺失字段返回 undefined)。
 */
export interface DeviceFingerprintImpl {
  /** 采集设备特征,返回原始字段(部分字段可缺失) */
  collect: () => Promise<DeviceFingerprintInput> | DeviceFingerprintInput
}

/**
 * 设备指纹原始输入字段(各端按可用性采集)。
 * 全部可选,缺失字段不参与 hash 计算。
 */
export interface DeviceFingerprintInput {
  userAgent?: string
  screen?: { width: number; height: number; colorDepth: number }
  timezone?: string
  language?: string
  platform?: string
  /** Canvas 渲染指纹 hash(web 端,已 hash 后的字符串) */
  canvas?: string
  /** WebGL 渲染器 hash(web 端,已 hash 后的字符串) */
  webgl?: string
  hardwareConcurrency?: number
  deviceMemory?: number
}

/**
 * 设备指纹采集结果。
 */
export interface DeviceFingerprintResult {
  /** 32 字符 hash,作为设备唯一标识 */
  fingerprint: string
  /** 原始特征字段(用于后端审计/异常检测维度分析,不含 PII) */
  source: DeviceFingerprintInput
  /** 采集时间戳(ms) */
  collectedAt: number
}

/**
 * 工厂返回的设备指纹采集器。
 * 各端通过 createDeviceFingerprintCollector(impl) 创建实例,
 * 调 get() 获取当前设备指纹(带 1 分钟内存缓存,避免重复采集)。
 */
export interface DeviceFingerprintCollector {
  /** 获取设备指纹(带缓存,1 分钟 TTL) */
  get: () => Promise<DeviceFingerprintResult>
  /** 强制重新采集(忽略缓存) */
  refresh: () => Promise<DeviceFingerprintResult>
}

/* -------------------------------------------------------------------------- */
/* Hash 工具(轻量实现,避免引入 node:crypto 依赖以兼容 RN/Taro)              */
/* -------------------------------------------------------------------------- */

/**
 * 简单字符串 hash(FNV-1a 32 位变体)。
 * 跨端兼容:不依赖 node:crypto(RN/Taro 环境无此模块)。
 * 输出 32 位无符号整数的 16 进制字符串(8 字符)。
 * 对于设备指纹场景,8 字符 hash 碰撞率足够低(4 亿分之一)。
 */
function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    // FNV prime: 2^24 + 2^8 + 0x93 = 16777619
    // 用 Math.imul 避免 32 位溢出(所有 JS 引擎支持)
    hash = Math.imul(hash, 0x01000193)
  }
  // 转无符号 32 位 + 16 进制(8 字符,前置补零)
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * 生成 32 字符指纹(4 段 FNV-1a hash 拼接)。
 * 用 4 段独立 hash 提升碰撞 resistance(总碰撞率 2^-32)。
 */
function generateFingerprint(input: DeviceFingerprintInput): string {
  // 固定顺序拼接,确保跨端一致
  const parts: string[] = [
    input.userAgent ?? '',
    input.screen ? `${input.screen.width}x${input.screen.height}x${input.screen.colorDepth}` : '',
    input.timezone ?? '',
    input.language ?? '',
    input.platform ?? '',
    input.canvas ?? '',
    input.webgl ?? '',
    input.hardwareConcurrency !== undefined ? `cpu${input.hardwareConcurrency}` : '',
    input.deviceMemory !== undefined ? `mem${input.deviceMemory}` : '',
  ]
  // 用分隔符避免字段值拼接歧义(如 "ab" + "c" vs "a" + "bc")
  const joined = parts.join('|')
  // 4 段独立 hash(每段对整个字符串 hash,但用不同 seed)
  const h1 = fnv1aHash(`seed1::${joined}`)
  const h2 = fnv1aHash(`seed2::${joined}`)
  const h3 = fnv1aHash(`seed3::${joined}`)
  const h4 = fnv1aHash(`seed4::${joined}`)
  return `${h1}${h2}${h3}${h4}`
}

/* -------------------------------------------------------------------------- */
/* 工厂函数                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 工厂函数:各端注入平台实现,返回统一的设备指纹采集器。
 *
 * 用法:
 * ```ts
 * // web
 * export const deviceFingerprintCollector = createDeviceFingerprintCollector({
 *   collect: () => ({
 *     userAgent: navigator.userAgent,
 *     screen: { width: screen.width, height: screen.height, colorDepth: screen.colorDepth },
 *     timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
 *     language: navigator.language,
 *     platform: navigator.platform,
 *     canvas: hashCanvasFingerprint(), // web 端自实现
 *     webgl: hashWebglFingerprint(),
 *     hardwareConcurrency: navigator.hardwareConcurrency,
 *     deviceMemory: (navigator as any).deviceMemory,
 *   }),
 * })
 * // mobile-rn
 * export const deviceFingerprintCollector = createDeviceFingerprintCollector({
 *   collect: async () => ({
 *     platform: Platform.OS,
 *     hardwareConcurrency: await getDeviceCpuCount(), // RN 原生模块
 *   }),
 * })
 * ```
 *
 * 缓存策略:1 分钟 TTL,避免高频请求重复采集(Canvas/WebGL 采集有性能开销)。
 * refresh() 强制重新采集(用户切换浏览器/设备时调用)。
 */
export function createDeviceFingerprintCollector(
  impl: DeviceFingerprintImpl,
): DeviceFingerprintCollector {
  let cached: DeviceFingerprintResult | null = null
  let cacheExpiry = 0
  const CACHE_TTL_MS = 60_000 // 1 分钟

  async function collectInternal(): Promise<DeviceFingerprintResult> {
    const input = await impl.collect()
    const fingerprint = generateFingerprint(input)
    const result: DeviceFingerprintResult = {
      fingerprint,
      source: input,
      collectedAt: Date.now(),
    }
    cached = result
    cacheExpiry = Date.now() + CACHE_TTL_MS
    return result
  }

  return {
    async get(): Promise<DeviceFingerprintResult> {
      if (cached && Date.now() < cacheExpiry) {
        return cached
      }
      return collectInternal()
    },
    async refresh(): Promise<DeviceFingerprintResult> {
      cached = null
      return collectInternal()
    },
  }
}

/* -------------------------------------------------------------------------- */
/* 默认空实现(未注入 provider 时使用,返回空指纹)                              */
/* -------------------------------------------------------------------------- */

/**
 * 默认空采集器:未注入平台 adapter 时使用。
 * 返回空指纹字符串,api-client 检测到空指纹时不发 header。
 */
export const nullDeviceFingerprintCollector: DeviceFingerprintCollector = {
  async get() {
    return { fingerprint: '', source: {}, collectedAt: 0 }
  },
  async refresh() {
    return { fingerprint: '', source: {}, collectedAt: 0 }
  },
}
