// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 运行时租户配置薄取数层(多租户扫码登录,小程序端)。
 *
 * 职责(与 mobile-rn `src/lib/tenant-providers.ts` 同语义,各端薄实现不抽共享包):
 *  1. 启动时按租户上下文拉取 `GET /api/auth/tenant-providers`(≤3s 超时,失败静默,
 *     绝不阻塞登录页渲染);
 *  2. 租户上下文优先级:启动参数 query(`tenant` / `tenantId` / `tenant_id`,
 *     来自 `Taro.getLaunchOptionsSync().query`,即分享码 / 扫码进入时带的参数)
 *     → 当前页路由参数 → API 基址子域名 → 空(平台默认租户)。
 *     注意:`scene` 是微信入口场景数值枚举(1001/1011…),不承载租户标识,不做解码;
 *     解析失败不猜、不静默提到别的租户。
 *  3. 把后端 providers 按 platform 映射到登录入口实际使用的 appId / extra;
 *     仅当运行时配置缺失 / 该平台未配置 / 请求失败时,才回退编译期配置(单租户兜底)。
 *     小程序端第三方登录是 wx.login 静默换票,客户端不持有第三方 appId,兜底档只表达
 *     "容器内现有入口可用"。
 *  4. 客户端不落 secret —— 接口本身也不下发 secret(仅 appId + extra 元数据)。
 */
import Taro from '@tarojs/taro'
import { BASE_URL } from '@/utils/api-config'

/** 后端返回的租户公开信息(不含任何凭据) */
export interface TenantPublicInfo {
  id: string
  slug: string
  name: string
}

/** 后端 `providers[]` 单条结构(对齐 apps/api/src/services/tenant-platform-apps.ts) */
export interface RuntimeProvider {
  platform: string
  configured: boolean
  enabled: boolean
  appId: string
  extra: Record<string, string>
  source: 'tenant' | 'platform_env' | 'none'
}

/** 接口 `data` 面(包在 `{ code, message, data }` 信封内) */
export interface TenantProvidersPayload {
  tenant: TenantPublicInfo | null
  providers: RuntimeProvider[]
}

const TENANT_PROVIDERS_PATH = '/auth/tenant-providers'
/** 取数超时:登录页不等它,3s 收不住就按失败走编译期兜底。 */
export const TENANT_PROVIDERS_TIMEOUT_MS = 3000

const TENANT_QUERY_KEYS = ['tenant', 'tenantId', 'tenant_id'] as const
/** 子域名保留段(与后端 tenant.ts 同一清单):这些不是租户 slug。 */
const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'admin', 'file', 'bsm', 'ai'])

/**
 * 小程序登录平台键 → 后端 provider.platform 键。
 * 小程序主入口是微信静默登录,后端 wechat / wechat_mp 两条同归于 `wechat`;
 * 飞书/钉钉/企微在小程序端没有对应入口,运行时即便返回也只作元数据透传。
 */
const PLATFORM_TO_BACKEND: Record<string, readonly string[]> = {
  wechat: ['wechat', 'wechat_mp'],
  feishu: ['feishu'],
  dingtalk: ['dingtalk'],
  enterpriseWechat: ['wecom'],
}

/** 租户标识合法性:slug 或 UUID 形态,拒绝空格 / 斜杠 / 编码注入。 */
function normalizeTenantId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) return null
  return value
}

function tenantFromParams(params: Record<string, unknown> | null | undefined): string | null {
  if (!params) return null
  for (const key of TENANT_QUERY_KEYS) {
    const candidate = normalizeTenantId(params[key])
    if (candidate) return candidate
  }
  return null
}

/** 从 API 基址主机名取子域名租户;IP / 保留段 / 单段主机名一律 null。 */
export function tenantFromBaseUrl(baseUrl: string | null | undefined): string | null {
  if (!baseUrl) return null
  try {
    const parsed = new URL(baseUrl)
    const host = parsed.hostname
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return null
    const [first, ...rest] = host.split('.')
    if (!first || rest.length === 0) return null
    if (RESERVED_SUBDOMAINS.has(first.toLowerCase())) return null
    return normalizeTenantId(first)
  } catch {
    return null
  }
}

/**
 * 租户上下文优先级(纯函数,便于测试):
 * 启动 query 参数 → 当前页路由参数 → API 基址子域名 → null(平台默认租户)。
 */
export function resolveTenantIdentifier(input: {
  launchQuery?: Record<string, unknown> | null
  routerParams?: Record<string, unknown> | null
  apiBaseUrl?: string
}): string | null {
  const fromLaunch = tenantFromParams(input.launchQuery)
  if (fromLaunch) return fromLaunch
  const fromRouter = tenantFromParams(input.routerParams)
  if (fromRouter) return fromRouter
  return tenantFromBaseUrl(input.apiBaseUrl)
}

function readLaunchQuery(): Record<string, unknown> {
  try {
    const options = Taro.getLaunchOptionsSync()
    return (options?.query ?? {}) as Record<string, unknown>
  } catch {
    return {}
  }
}

function readRouterParams(): Record<string, unknown> {
  try {
    const instance = Taro.getCurrentInstance()
    return (instance?.router?.params ?? {}) as Record<string, unknown>
  } catch {
    return {}
  }
}

/** 线上取值:启动 query → 路由参数 → API 基址子域名;任一步失败都落到 null,不抛给登录页。 */
export function resolveLiveTenantIdentifier(): string | null {
  return resolveTenantIdentifier({
    launchQuery: readLaunchQuery(),
    routerParams: readRouterParams(),
    apiBaseUrl: BASE_URL,
  })
}

function extractPayload(json: unknown): TenantProvidersPayload | null {
  if (!json || typeof json !== 'object') return null
  const envelope = json as { data?: unknown; tenant?: unknown; providers?: unknown }
  const body = (envelope.data ?? envelope) as Record<string, unknown>
  if (!body || typeof body !== 'object') return null
  const providersRaw = body.providers
  if (!Array.isArray(providersRaw)) return null

  const providers: RuntimeProvider[] = providersRaw.map((row) => {
    const record = (row ?? {}) as Record<string, unknown>
    const extraRecord = (record.extra ?? {}) as Record<string, unknown>
    const extra: Record<string, string> = {}
    for (const [k, v] of Object.entries(extraRecord)) {
      if (typeof v === 'string') extra[k] = v
    }
    return {
      platform: typeof record.platform === 'string' ? record.platform : '',
      configured: record.configured === true,
      enabled: record.enabled !== false,
      appId: typeof record.appId === 'string' ? record.appId : '',
      extra,
      source:
        record.source === 'tenant' || record.source === 'platform_env' ? record.source : 'none',
    }
  })

  const tenantRaw = body.tenant
  const tenant: TenantPublicInfo | null =
    tenantRaw && typeof tenantRaw === 'object'
      ? {
          id: String((tenantRaw as Record<string, unknown>).id ?? ''),
          slug: String((tenantRaw as Record<string, unknown>).slug ?? ''),
          name: String((tenantRaw as Record<string, unknown>).name ?? ''),
        }
      : null

  return { tenant, providers }
}

interface TaroRequestLike {
  success: (res: { statusCode: number; data: unknown }) => void
  fail: (err: { errMsg?: string }) => void
}

export interface FetchTenantProvidersOptions {
  tenantId?: string | null
  timeoutMs?: number
  /** 测试注入:替换 Taro.request;线上走 Taro.request。 */
  requestImpl?: (
    options: {
      url: string
      method: string
      header: Record<string, string>
      timeout: number
    } & TaroRequestLike,
  ) => void
  baseUrl?: string
}

/**
 * 拉取租户 providers。任何失败(网络 / 超时 / 非 2xx / 坏 JSON)都返回 null,
 * 由上层按"运行时缺失"走编译期兜底,绝不向上抛错阻塞登录页。
 */
export function fetchTenantProviders(
  options: FetchTenantProvidersOptions = {},
): Promise<TenantProvidersPayload | null> {
  const base = (options.baseUrl ?? BASE_URL).replace(/\/+$/, '')
  const url = `${base}${TENANT_PROVIDERS_PATH}`
  const requestImpl = options.requestImpl ?? Taro.request
  const header: Record<string, string> = {}
  if (options.tenantId) header['X-Tenant-Id'] = options.tenantId

  return new Promise((resolve) => {
    let settled = false
    const finish = (payload: TenantProvidersPayload | null) => {
      if (settled) return
      settled = true
      resolve(payload)
    }

    try {
      requestImpl({
        url,
        method: 'GET',
        header,
        timeout: options.timeoutMs ?? TENANT_PROVIDERS_TIMEOUT_MS,
        success: (res) => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            finish(null)
            return
          }
          finish(extractPayload(res.data))
        },
        fail: () => finish(null),
      })
    } catch {
      finish(null)
    }
  })
}

// ---- 模块级缓存:登录页挂载时预取一次,点击入口时同步读缓存 ----
let cached: TenantProvidersPayload | null | undefined
let inflight: Promise<TenantProvidersPayload | null> | null = null

export function getCachedTenantProviders(): TenantProvidersPayload | null {
  return cached ?? null
}

/** 线上加载:解析租户 → 拉取 providers;结果(含 null)入缓存,失败不重试、不抛。 */
export function loadTenantProviders(): Promise<TenantProvidersPayload | null> {
  if (cached !== undefined) return Promise.resolve(cached)
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const tenantId = resolveLiveTenantIdentifier()
      cached = await fetchTenantProviders({ tenantId })
    } catch {
      cached = null
    } finally {
      inflight = null
    }
    return cached
  })()
  return inflight
}

/** 登录页挂载时调用:不 await、不阻塞渲染,失败静默落 null。 */
export function preloadTenantProviders(): void {
  void loadTenantProviders()
}

/** 测试专用:清掉缓存与在飞请求,保证用例间隔离。 */
export function __resetTenantProvidersForTest(): void {
  cached = undefined
  inflight = null
}

/** 测试专用:直接写入缓存的 providers 快照,免走网络取数。 */
export function __setTenantProvidersForTest(payload: TenantProvidersPayload | null): void {
  cached = payload
  inflight = null
}

/**
 * 编译期兜底(单租户兜底):小程序端没有第三方客户端 appId 的编译期配置,
 * 兜底档只表达"现有容器内入口可用"。运行时缺失 / 请求失败时回退到这里;
 * secret 只存后端,客户端这里一个密钥都不落。
 */
function compileFallback(platform: string): { enabled: boolean; appId: string } {
  // 微信静默登录入口在 weapp/alipay 容器内本就存在(由容器判断兜底),无 appId 配置。
  if (platform === 'wechat') return { enabled: true, appId: '' }
  return { enabled: false, appId: '' }
}

export interface ResolvedProviderConfig {
  appId: string
  enabled: boolean
  extra: Record<string, string>
  /** runtime=租户运行时配置;fallback=编译期单租户兜底;none=两端都未配置 */
  source: 'runtime' | 'fallback' | 'none'
}

function findRuntimeRow(
  platform: string,
  providers: readonly RuntimeProvider[],
): RuntimeProvider | undefined {
  const backends = PLATFORM_TO_BACKEND[platform] ?? []
  return providers.find((row) => backends.includes(row.platform))
}

/**
 * 解析某登录入口最终使用的配置。
 *
 * 取舍口径:
 *  - 后端 `source=tenant` 的行:只有 `enabled && configured` 齐备才采用运行时值;
 *    缺一则判 `none` —— 不回退编译期兜底,避免把默认租户的入口带到显式关停该平台的租户;
 *  - `source=platform_env`(后端 env 兜底行)或运行时整包缺失:继续走编译期兜底链;
 *  - 兜底也不可用:`none`,入口走现有"未配置 / 不可用"分支。
 */
export function resolveProviderConfig(
  platform: string,
  providers: readonly RuntimeProvider[] | null = getCachedTenantProviders()?.providers ?? null,
): ResolvedProviderConfig {
  const fallback = compileFallback(platform)
  const row = providers ? findRuntimeRow(platform, providers) : undefined

  if (row && row.source === 'tenant') {
    if (row.enabled && row.configured) {
      return {
        appId: row.appId,
        enabled: true,
        extra: row.extra,
        source: 'runtime',
      }
    }
    return { appId: '', enabled: false, extra: {}, source: 'none' }
  }

  if (fallback.enabled) {
    return { appId: fallback.appId, enabled: true, extra: {}, source: 'fallback' }
  }
  return { appId: '', enabled: false, extra: {}, source: 'none' }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
