// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 运行时租户配置薄取数层(多租户扫码登录,RN 端)。
 *
 * 职责(与小程序端 `src/lib/tenant-providers.ts` 同语义,各端薄实现不抽共享包):
 *  1. 启动时按租户上下文拉取 `GET /api/auth/tenant-providers`(≤3s 超时,失败静默,
 *     绝不阻塞登录页渲染);
 *  2. 租户上下文优先级:deep link / 启动参数(`ihui://...?tenant=...` / `tenantId`)
 *     → API 基址子域名 → 空(走平台默认租户);解析失败不猜、不静默提到别的租户;
 *  3. 把后端 providers 按 platform 映射到登录按钮实际使用的 appId / agentId / scope /
 *     extra;仅当运行时配置缺失 / 该平台未配置 / 请求失败时,才回退编译期 `EXPO_PUBLIC_*`
 *     (单租户兜底,见下方 COMPILE_FALLBACK 注释);
 *  4. 客户端不落 secret —— 接口本身也不下发 secret(仅 appId + extra 元数据)。
 */
import { API_BASE_URL } from './config'
import * as Linking from '@/platform/linking'

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

const TENANT_PROVIDERS_PATH = '/api/auth/tenant-providers'
/** 取数超时:登录页不等它,3s 收不住就按失败走编译期兜底。 */
export const TENANT_PROVIDERS_TIMEOUT_MS = 3000

const TENANT_QUERY_KEYS = ['tenant', 'tenantId', 'tenant_id'] as const
/** 子域名保留段(与后端 tenant.ts 同一清单):这些不是租户 slug。 */
const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'admin', 'file', 'bsm', 'ai'])

/**
 * RN OAuth 平台键 → 后端 provider.platform 键。
 * 后端 wechat / wechat_mp 两条在 RN 原生微信 SDK 侧同归于 `wechat`。
 * google / github / alipay 当前没有后端租户行,空数组表示运行时不覆盖,直接走编译期兜底。
 */
const PLATFORM_TO_BACKEND: Record<string, readonly string[]> = {
  feishu: ['feishu'],
  dingtalk: ['dingtalk'],
  enterpriseWechat: ['wecom'],
  wechat: ['wechat', 'wechat_mp'],
  google: [],
  github: [],
  alipay: [],
}

/** 租户标识合法性:slug 或 UUID 形态,拒绝空格 / 斜杠 / 编码注入。 */
function normalizeTenantId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) return null
  return value
}

/** 从深链 query 解租户(`tenant` / `tenantId` / `tenant_id`)。非 http(s) 链无解即 null。 */
export function tenantFromQuery(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    for (const key of TENANT_QUERY_KEYS) {
      const candidate = normalizeTenantId(parsed.searchParams.get(key))
      if (candidate) return candidate
    }
  } catch {
    /* 非标准 URL:不猜租户 */
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
 * 深链 / 启动参数 query → API 基址子域名 → null(平台默认租户)。
 */
export function resolveTenantIdentifier(input: {
  initialUrl?: string | null
  apiBaseUrl?: string
}): string | null {
  const fromLink = tenantFromQuery(input.initialUrl)
  if (fromLink) return fromLink
  return tenantFromBaseUrl(input.apiBaseUrl)
}

async function readInitialUrl(): Promise<string | null> {
  try {
    const url = await Linking.getInitialURL()
    return typeof url === 'string' ? url : null
  } catch {
    return null
  }
}

/** 线上取值:读当前深链 + 配置的 API 基址;任一步失败都落到 null,不抛给登录页。 */
export async function resolveLiveTenantIdentifier(): Promise<string | null> {
  const initialUrl = await readInitialUrl()
  return resolveTenantIdentifier({ initialUrl, apiBaseUrl: API_BASE_URL })
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

export interface FetchTenantProvidersOptions {
  tenantId?: string | null
  timeoutMs?: number
  /** 测试注入:替换全局 fetch;线上走 RN 全局 fetch。 */
  fetchImpl?: typeof fetch
  apiBaseUrl?: string
}

/**
 * 拉取租户 providers。任何失败(网络 / 超时 / 非 2xx / 坏 JSON)都返回 null,
 * 由上层按"运行时缺失"走编译期兜底,绝不向上抛错阻塞登录页。
 */
export async function fetchTenantProviders(
  options: FetchTenantProvidersOptions = {},
): Promise<TenantProvidersPayload | null> {
  const base = (options.apiBaseUrl ?? API_BASE_URL).replace(/\/+$/, '')
  const url = `${base}${TENANT_PROVIDERS_PATH}`
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? TENANT_PROVIDERS_TIMEOUT_MS,
  )

  const headers: Record<string, string> = {}
  if (options.tenantId) headers['X-Tenant-Id'] = options.tenantId

  try {
    const fetchImpl = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined)
    if (!fetchImpl) return null
    const response = await fetchImpl(url, { method: 'GET', headers, signal: controller.signal })
    if (!response.ok) return null
    const json = (await response.json()) as unknown
    return extractPayload(json)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ---- 模块级缓存:登录页挂载时预取一次,点击按钮时同步读缓存 ----
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
      const tenantId = await resolveLiveTenantIdentifier()
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
 * 编译期兜底(单租户兜底):运行时配置缺失 / 该平台未配置 / 请求失败时,
 * 回退到构建期内联的 `EXPO_PUBLIC_*`。这些只承载默认租户的第三方客户端标识;
 * secret 只存后端,客户端这里一个密钥都不落。
 */
interface CompileFallback {
  appId: string
  agentId: string
  scope: string
  redirectUri: string
}

function compileFallback(platform: string): CompileFallback {
  switch (platform) {
    case 'feishu':
      return {
        appId: process.env.EXPO_PUBLIC_FEISHU_APP_ID ?? '',
        agentId: '',
        scope: '',
        redirectUri: '',
      }
    case 'dingtalk':
      return {
        appId: process.env.EXPO_PUBLIC_DINGTALK_CLIENT_ID ?? '',
        agentId: '',
        scope: 'openid',
        redirectUri: '',
      }
    case 'enterpriseWechat':
      return {
        appId: process.env.EXPO_PUBLIC_WECOM_CORP_ID ?? '',
        agentId: process.env.EXPO_PUBLIC_WECOM_AGENT_ID ?? '',
        scope: '',
        redirectUri: '',
      }
    case 'wechat':
      return {
        appId: process.env.EXPO_PUBLIC_WECHAT_APP_ID ?? '',
        agentId: '',
        scope: '',
        redirectUri: '',
      }
    case 'google':
      return {
        appId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '',
        agentId: '',
        scope: '',
        redirectUri: '',
      }
    case 'github':
      return {
        appId: process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID ?? '',
        agentId: '',
        scope: '',
        redirectUri: '',
      }
    case 'alipay':
      return {
        appId: process.env.EXPO_PUBLIC_ALIPAY_APP_ID ?? '',
        agentId: '',
        scope: '',
        redirectUri: '',
      }
    default:
      return { appId: '', agentId: '', scope: '', redirectUri: '' }
  }
}

export interface ResolvedProviderConfig {
  appId: string
  agentId: string
  scope: string
  redirectUri: string
  enabled: boolean
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
 * 解析某登录平台最终使用的客户端配置。
 *
 * 取舍口径:
 *  - 后端 `source=tenant` 的行:只有 `enabled && configured && appId` 齐备才采用运行时值;
 *    缺一则判 `none` —— 不回退编译期 env,避免把默认租户的标识带到显式关停该平台的租户;
 *  - `source=platform_env`(后端 env 兜底行)或运行时整包缺失:继续走编译期兜底链;
 *  - 编译期 env 也为空:`none`,按钮走现有"未配置"分支。
 */
export function resolveProviderConfig(
  platform: string,
  providers: readonly RuntimeProvider[] | null = getCachedTenantProviders()?.providers ?? null,
): ResolvedProviderConfig {
  const fallback = compileFallback(platform)
  const row = providers ? findRuntimeRow(platform, providers) : undefined

  if (row && row.source === 'tenant') {
    if (row.enabled && row.configured && row.appId) {
      return {
        appId: row.appId,
        agentId: row.extra.agent_id ?? '',
        scope: row.extra.scope ?? '',
        redirectUri: row.extra.redirect_uri ?? '',
        enabled: true,
        source: 'runtime',
      }
    }
    return { appId: '', agentId: '', scope: '', redirectUri: '', enabled: false, source: 'none' }
  }

  if (fallback.appId) {
    return {
      appId: fallback.appId,
      agentId: fallback.agentId,
      scope: fallback.scope,
      redirectUri: fallback.redirectUri,
      enabled: true,
      source: 'fallback',
    }
  }
  return { appId: '', agentId: '', scope: '', redirectUri: '', enabled: false, source: 'none' }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
