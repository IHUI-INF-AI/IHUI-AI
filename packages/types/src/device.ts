// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 * 安全约束(2026-09-27 校订:原第一条写作"指纹不可逆",那是可核验但为假的承诺,现按实际能力改写):
 * - Canvas / WebGL 的**原始数据确实不出端** —— canvas 只带 dataURL 的 hash、webgl 只带
 *   "vendor::renderer" 的 hash(见各端 adapter)。这句是真的一部分,保留。
 * - 但 32 字符指纹**不是密码学摘要,也谈不上"不可逆"**。"不可逆"成立的前提是输入空间
 *   不可枚举,而本指纹的 9 段输入几乎全是**有界字典**(见下「逐段可正推性」),
 *   摘要函数又是非密码学的 FNV-1a。所以它是一份**假名(pseudonym)**:
 *   给定「设备型号」这一先验 + 公开字典(时区/语言/分辨率/GPU 型号清单/CPU 核数与内存档位),
 *   正向枚举候选即可命中同一 32 字符值,把画像还原到
 *   **机型 + 分辨率/色深 + 时区 + 语言 + CPU 核数档 + 内存档**(web 端再加 GPU/驱动/字体栅格化组合)
 *   这一精度;**还原不到自然人**,在没有先验时也无法把某台具体机器算出来 —— 两头都别夸大。
 * - 逐段可正推性(UA / 屏幕 / 时区 / 语言 / platform / canvas / webgl / CPU / 内存):
 *   1. userAgent 模板化,同一机型+浏览器版本只有个位数候选 → 可正推到"浏览器+版本+OS";
 *      cli 端更是自拼定式 `IHUI-CLI/<version> (<platform>/<arch>)`,字典 = 版本×平台×架构。
 *   2. screen `WxHxD` 有界字典(常见分辨率数百个 × colorDepth 24/32;taro 端用 pixelRatio*8
 *      估算色深,与 web 端不同源 → 同一物理设备跨端本就不等值)。
 *   3. timezone 有 IANA 清单(~420 项),实际人群集中在极少数 → 数 bit。
 *   4. language 本仓 5 语言 + 少量区域变体 → 1–3 bit。
 *   5. platform 小闭集(Win32/MacIntel/Linux x86_64/iPhone/Android,浏览器侧已冻结收窄);
 *      taro 端是 `brand-platform`,即厂商字典 → 可正推到品牌。
 *   6. canvas(web-only)取值由 GPU/驱动/字体栅格化决定,公开样本可字典化成千档;原始像素不出端。
 *   7. webgl(web-only)是被 hash 的**公开显卡名清单** → 对字典正打即可还原出确切 GPU 型号,
 *      这一步不依赖破解 hash,只依赖枚举。
 *   8. hardwareConcurrency 取值 {1,2,4,6,8,10,12,16,24,32} → 3–5 bit。
 *   9. deviceMemory Chrome 量化到 2 的幂且封顶 8GB,多数浏览器不暴露 → 2–3 bit。
 * - "不采集 PII" 仍然成立,但**非 PII ≠ 不可关联**:同一指纹跨请求、跨会话稳定,
 *   足以把同一设备的全部活动串在一起(这正是风控要它的原因,也是它必须被如实描述的原因)。
 * - 跨端兼容约束(当初不选 SHA-256 的真实理由,不是疏忽):RN / 小程序 Taro 环境无 `node:crypto`,
 *   任何摘要函数都必须是纯 JS 实现。
 * - 指纹长度固定 32 字符,header 传输限制 128 字符(后端 audit-logger.slice(0,128) 已兜底)。
 * - 各 hash 工具注释里的"碰撞率"数字是**逐段成对**概率(2^-32 量级),不是"每台设备一个值"
 *   的保证;真正决定区分度的是上列 9 段的**输入字典大小**,不是输出位数。
 *
 * 改算法的前置条件(本票不动 fnv1aHash / 9 段拼接 / 截断长度,只把文档改成与实现一致):
 * fingerprintHash 是已注册设备的唯一键(`packages/database/src/schema/user-devices.ts` 的
 * (userId, fingerprintHash) 唯一约束),也是支付/资金风控的设备维度(payment-gateway、
 * payment-usdt、order、user/fund-routes、audit-logger 直接取 x-device-fingerprint)。
 * 换成密码学摘要 ⇒ 现网所有设备指纹一次性全部改变 ⇒ user_devices 每一行都对不上,
 * 表现为"所有老设备突然变成新设备"(重绑、二次验证、风控"新设备"告警全线误触发)。
 * 那是需要迁移方案(双写 / 宽限期 / 回填)与 owner 决策的变更,**不是重构**。
 * 换之前还必须先解决输入面不一致:web 送 9 段、cli 送 3 段、taro 送 3 段、rn 只送 1 段,
 * 同一物理设备跨端指纹本就不同;只换摘要函数,这一层不等值原样存在。
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
  /**
   * 32 字符指纹 = 4 段 FNV-1a 拼接(非密码学摘要)。
   * 它是设备特征的**假名**,不是硬件唯一键:输入 9 段几乎全为有界字典,已知型号可正向
   * 枚举命中(详见文件头「安全约束」);且各端采集字段集不同,同一物理设备跨端不等值,
   * 只应作"同端、同字段集下的设备特征代号"用于风控关联。
   */
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
/* 设备推送令牌(2026-09-06,mobile-cap 推送链路)                                */
/* -------------------------------------------------------------------------- */

/** 推送平台标识(与 apps/api devices.ts zod schema 对应) */
export type PushPlatform = 'ios' | 'android' | 'web'

/**
 * 设备推送令牌注册输入。
 * token 为 FCM registration token / APNS device token / Web Push 订阅原样字符串;
 * 后端按 token 唯一约束 upsert,重复上报安全(FCM token 轮换场景)。
 */
export interface RegisterDeviceTokenInput {
  token: string
  platform: PushPlatform
  /** 设备型号/名称(如 userAgent 摘要) */
  deviceType?: string
  /** 客户端版本号 */
  appVersion?: string
  /** 客户端语言区域(如 zh-CN) */
  locale?: string
}

/** PUT /api/devices/token 响应 data */
export interface RegisterDeviceTokenResponse {
  token: string
  platform: PushPlatform
  registered: boolean
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
