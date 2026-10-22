// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder(CN 版 com.qodercn.app.*)上游适配器(2026-10-23 立)。
 *
 * 契约实证边界(照 ai-service checkin_qoder.py / 桌面端 checkin_capture.rs):
 * - token/refreshToken:auth.v1.dat 解出的 opaque 单段串(dt-/drt- 前缀,非 JWT);
 * - refresh 端点:POST {base}/api/v1/deviceToken/refresh,body 带 refresh_token
 *   (QODER_BASES 双备份:openapi.qoder.com.cn 优先、openapi.qoder.sh 兜底);
 * - 配额查询:GET {base}/api/v2/quota/usage(Bearer token + Cosy-* 设备头);
 * - Cosy-* 头族:clientType 固定 10、MachineOS 默认 x86_64_windows,
 *   MachineToken/Code/Type 来自导入时 extraMetadata.cosy(客户端 runtime-info.exe
 *   产出,缺失则不发力求,失败如实报告,不冒充可用)。
 *
 * chat 反代契约**未实证**(Qoder IDE 态的上游对话端点不在已实证面内)⇒
 * 单段式三件套(buildChatRequest/translateStreamChunk/translateNonStream)
 * 一律明确抛错,绝不返回假成功;接入号池的账号可被调度器续期/健康检查,
 * 转发链路会在调chat时如实得到"契约未实证"错误。
 */
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import type {
  AdapterAccountContext,
  AdapterCallOptions,
  NormalizedChatRequest,
  RelayUpstreamAdapter,
  StreamState,
  TokenRefreshResult,
  TranslatedChunk,
  UpstreamHttpRequest,
} from '../relay-upstream-adapters.js'

// =============================================================================
// 端点常量(实证值;非生产档允许 env 覆写指向假上游,供 tests 真跑协议线)
// =============================================================================

function endpoint(name: string, fallback: string): string {
  if (process.env.NODE_ENV === 'production') return fallback
  const v = process.env[name]?.trim()
  if (!v || !/^https?:\/\//.test(v)) return fallback
  return v.replace(/\/$/, '')
}

/** refresh 端点基址(CN 优先,国际兜底;与 checkin_qoder.QODER_BASES 同序) */
const QODER_REFRESH_BASES: readonly string[] = [
  endpoint('QODER_REFRESH_BASE', 'https://openapi.qoder.com.cn'),
  endpoint('QODER_REFRESH_BASE_2', 'https://openapi.qoder.sh'),
]
/** 配额查询基址(健康检查/额度观测) */
const QODER_QUOTA_BASE = endpoint('QODER_QUOTA_BASE', 'https://openapi.qoder.com.cn')

const PATH_REFRESH = '/api/v1/deviceToken/refresh'
const PATH_QUOTA = '/api/v2/quota/usage'
const USER_AGENT = 'Qoder/claim'
const CLIENT_TYPE_DEFAULT = '10'
const MACHINE_OS_DEFAULT = 'x86_64_windows'

/** extraMetadata.cosy 的键 → Cosy-* 请求头(与 checkin_qoder.COSY_HEADER_KEYS 同序) */
const COSY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ['machine_token', 'Cosy-MachineToken'],
  ['machine_code', 'Cosy-MachineCode'],
  ['machine_type', 'Cosy-MachineType'],
  ['version', 'Cosy-Version'],
]

/** chat 契约未实证的统一错误(转发层按普通上游错误处理,不刷新不重试) */
export const QODER_CHAT_CONTRACT_UNVERIFIED =
  'QODER_CHAT_CONTRACT_UNVERIFIED: Qoder 上游 chat 端点契约未实证(签到/配额/refresh 已实证),拒绝冒充可用'

/** Qoder 上游非鉴权失败(带 HTTP 状态码;消息截断防泄漏) */
export class QoderUpstreamError extends Error {
  readonly statusCode: number
  constructor(statusCode: number, message: string) {
    super(message.slice(0, 500))
    this.name = 'QoderUpstreamError'
    this.statusCode = statusCode
  }
}

// =============================================================================
// fetch 解析(测试缝 > 账号级代理 > 全局直连;与 trae-adapter 同优先级)
// =============================================================================

const proxyAgentCache = new Map<string, ProxyAgent>()

function makeProxiedFetch(proxyUrl: string): typeof fetch {
  let agent = proxyAgentCache.get(proxyUrl)
  if (!agent) {
    agent = new ProxyAgent(proxyUrl)
    proxyAgentCache.set(proxyUrl, agent)
  }
  const dispatcher = agent
  return ((input: string | URL, init?: RequestInit) =>
    undiciFetch(
      input as never,
      {
        ...(init ?? {}),
        dispatcher,
      } as never,
    ) as unknown as Promise<Response>) as unknown as typeof fetch
}

function resolveFetchImpl(opts: AdapterCallOptions): typeof fetch {
  if (opts.fetchImpl) return opts.fetchImpl
  if (opts.proxyUrl) return makeProxiedFetch(opts.proxyUrl)
  return globalThis.fetch.bind(globalThis)
}

// =============================================================================
// Cosy 设备头(风控面)
// =============================================================================

/** extraMetadata.cosy(导入时随账号落库)+ 行级 machineId → Cosy-* 请求头 */
export function buildCosyHeaders(ctx: AdapterAccountContext): Record<string, string> {
  const headers: Record<string, string> = {
    'Cosy-ClientType': CLIENT_TYPE_DEFAULT,
    'Cosy-MachineOS': MACHINE_OS_DEFAULT,
  }
  const extra = ctx.row.extraMetadata as Record<string, unknown> | null | undefined
  const cosy = extra?.['cosy']
  if (cosy !== null && typeof cosy === 'object' && !Array.isArray(cosy)) {
    const c = cosy as Record<string, unknown>
    for (const [mapKey, header] of COSY_HEADERS) {
      const v = c[mapKey]
      if (typeof v === 'string' && v.trim()) headers[header] = v.trim()
    }
  }
  const machineId = ctx.row.machineId
  if (machineId) headers['Cosy-MachineId'] = machineId
  return headers
}

/** 宽松取响应里的 token 字段(兼容 data 包裹;与 qoder_refresh_token 同键序) */
function pickTokenField(body: unknown, keys: readonly string[]): string {
  if (body === null || typeof body !== 'object') return ''
  const o = body as Record<string, unknown>
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  const data = o['data']
  if (data !== null && typeof data === 'object') return pickTokenField(data, keys)
  return ''
}

// =============================================================================
// 适配器
// =============================================================================

export const qoderAdapter: RelayUpstreamAdapter = {
  providerCode: 'qoder',

  buildChatRequest(_ctx: AdapterAccountContext, _req: NormalizedChatRequest): UpstreamHttpRequest {
    throw new Error(QODER_CHAT_CONTRACT_UNVERIFIED)
  },

  translateStreamChunk(
    _ctx: AdapterAccountContext,
    _rawFrame: string,
    _state: StreamState,
  ): TranslatedChunk | null {
    throw new Error(QODER_CHAT_CONTRACT_UNVERIFIED)
  },

  translateNonStream(_ctx: AdapterAccountContext, _responseBody: unknown): Record<string, unknown> {
    throw new Error(QODER_CHAT_CONTRACT_UNVERIFIED)
  },

  /**
   * token 自刷新:POST {base}/api/v1/deviceToken/refresh,body 带 refresh_token
   * (实证:checkin_qoder.qoder_refresh_token)。双 base 回退判据与 _api_call 同:
   * 网络错/超时/404 = 端点不对换下一个;401 等其余非 2xx = 结论,抛错由调度器计数。
   * 上游新 token 仍是 opaque 非 JWT,响应不带可解析 exp ⇒ expiresAt 保守兜底 24h
   * (临期刷新 + 401 自愈双保险,与 trae-adapter 同策略)。
   */
  async refreshToken(
    ctx: AdapterAccountContext,
    opts?: AdapterCallOptions,
  ): Promise<TokenRefreshResult | null> {
    const rt = ctx.credentials.refreshToken
    if (!rt) return null
    const doFetch = resolveFetchImpl(opts ?? {})
    let lastErr = ''
    for (const base of QODER_REFRESH_BASES) {
      try {
        const res = await doFetch(`${base}${PATH_REFRESH}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            accept: 'application/json',
            'user-agent': USER_AGENT,
            ...buildCosyHeaders(ctx),
          },
          body: JSON.stringify({ refresh_token: rt }),
        })
        if (res.status === 404) {
          lastErr = `404 @ ${base}`
          continue
        }
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new QoderUpstreamError(
            res.status,
            `Qoder deviceToken/refresh HTTP ${res.status}${text ? `: ${text}` : ''}`,
          )
        }
        const body: unknown = await res.json().catch(() => null)
        const token = pickTokenField(body, ['token', 'accessToken', 'access_token'])
        if (!token) throw new QoderUpstreamError(0, 'Qoder refresh 响应无 token')
        const newRt = pickTokenField(body, ['refreshToken', 'refresh_token']) || rt
        return {
          token,
          refreshToken: newRt,
          expiresAt: new Date(Date.now() + 24 * 3600_000),
        }
      } catch (e) {
        if (e instanceof QoderUpstreamError) throw e
        lastErr = e instanceof Error ? e.message : String(e)
        continue
      }
    }
    throw new QoderUpstreamError(0, `Qoder deviceToken/refresh 全部端点失败: ${lastErr}`)
  },

  /** 轻量健康检查:配额查询端点 200 = ok(不消耗对话配额) */
  async checkHealth(
    ctx: AdapterAccountContext,
    opts?: AdapterCallOptions,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await resolveFetchImpl(opts ?? {})(`${QODER_QUOTA_BASE}${PATH_QUOTA}`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'user-agent': USER_AGENT,
          authorization: `Bearer ${ctx.credentials.token}`,
          ...buildCosyHeaders(ctx),
        },
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return {
          ok: false,
          error: `quota HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
        }
      }
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  },

  isAuthFailure(statusCode: number, _bodyText: string): boolean {
    return statusCode === 401
  },

  /** 富分类(对标 checkin_qoder.qoder_classify_error 的 HTTP 面):401=会话死、429=限流;
   *  network 归入 client(接口只接受 8 类,与 trae-adapter 同) */
  classifyUpstreamFailure(statusCode: number, _bodyText: string) {
    if (statusCode === 401) return { kind: 'session_dead' as const }
    if (statusCode === 429) return { kind: 'rate' as const }
    if (statusCode === 404) return { kind: 'not_found' as const }
    if (statusCode >= 500 && statusCode <= 599) return { kind: 'server' as const }
    if (statusCode === 400 || statusCode === 413 || statusCode === 422)
      return { kind: 'request' as const }
    return { kind: 'client' as const }
  },
}
