// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ZCode(智谱,Electron 桌面 + TUI 三合一,GLM Coding Plan)上游适配器(2026-10-27 立)。
 *
 * 上游协议要点(出处:智谱/Z.ai 公开文档 + 社区口径;**chat 面未本机实弹实证**,
 * 构造按公开文档写实,响应异常一律未判定,不冒绿):
 * - 双域名(2026-10-27 核):国内 BigModel = open.bigmodel.cn,国际 Z.ai = api.z.ai;
 *   GLM Coding Plan 走专属 /api/coding/paas/v4 面(通用 /api/paas/v4 是资源包/余额面,
 *   两类端点不能混用 —— 官方文档明示),Anthropic 协议面 /api/anthropic 是 ZCode 默认,
 *   网关转发用 OpenAI 兼容面。
 * - chat:POST /api/coding/paas/v4/chat/completions,Bearer 鉴权(账号 oauth access_token
 *   / zcodejwttoken / 项目 API Key 均可作 Bearer,服务端映射定哪枚)。
 * - 业务错误帧:{"error":{"code":"1000","message":"身份验证失败"}}(公开文档错误码:
 *   1000 = 身份验证失败(Key 无效/过期/用错站点),1001 = Header 未收到 Authorization;
 *   国内站 Key 打到 api.z.ai 或反之也会 1000)。
 * - 余额端点:GET /api/coding/paas/v4/users/me/balance(旧版资源接口,字段随账号/Key
 *   类型可变;2026-10-27 起仅作参考,**额度/健康检查升级为 zcode-plan 通道**:
 *   GET https://zcode.z.ai/api/v1/zcode-plan/billing/balance?app_version=3.16.3,
 *   实弹 200 + plans[]/entitlements[],票 = zcodejwttoken,X-Device-Mid 等头必带)。
 * - 刷新:ZCode OAuth token 的刷新端点未实证 ⇒ 本适配器不实现 refreshToken,
 *   401 自愈依赖重新导入号池,绝不猜端点。
 * - 凭证映射(服务端 mapZcodeImport,主会话集成):token←oauth:bigmodel:access_token
 *   (或 zcodejwttoken/项目 Key),raw 其余字段进 secretsEnc 直通。
 * - 提取器(2026-10-27):credentials.json 值为 enc:v1: AES-256-GCM 密文,解密配方见
 *   scripts/lib/zcode-auth-extract.mjs(实弹闭环)。
 */
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import { createHash } from 'node:crypto'
import type {
  AdapterAccountContext,
  AdapterCallOptions,
  NormalizedChatRequest,
  QuotaCallOptions,
  RelayQuotaResult,
  RelayUpstreamAdapter,
  StreamState,
  TranslatedChunk,
  UpstreamHttpRequest,
} from '../relay-upstream-adapters.js'

// =============================================================================
// 端点与常量(改端点只改这里;双域名常量都是公开文档口径)
// =============================================================================

const BASE_CN = 'https://open.bigmodel.cn'
const BASE_GLOBAL = 'https://api.z.ai'
/** GLM Coding Plan 专属 OpenAI 兼容面(与通用资源包面 /api/paas/v4 不能混用) */
const CHAT_PATH = '/api/coding/paas/v4/chat/completions'
/**
 * 套餐/余额查询面(coding 域旧版资源接口;通用域同路径 /api/paas/v4/users/me/balance
 * 查现金余额。2026-10-27 起额度/健康检查走 zcode-plan 通道(PLAN_*),此常量保留作
 * 后备参考;实弹复核:该路径对 zcodejwttoken 亦 401,不再作为主通道)。
 */
const BALANCE_PATH = '/api/coding/paas/v4/users/me/balance'
void BALANCE_PATH

// —— zcode-plan 通道(2026-10-27 实弹闭环,对齐 ZCode 桌面端同款)——
/** 套餐端点真身(app.asar buildZCodeEndpointUrls + 运行日志 url 双源;bigmodel.cn 直打 ⇒ 404 NOT_FOUND) */
const PLAN_BASE = 'https://zcode.z.ai'
const PLAN_BALANCE_PATH = '/api/v1/zcode-plan/billing/balance'
const PLAN_APP_VERSION = '3.16.3'

/**
 * plan 票 = zcodejwttoken:实弹实证 balance 端点只认它
 * (oauth access_token ⇒ 401;zcodejwttoken ⇒ 200 + plans[])。
 * 导入槽位首位是 oauth:bigmodel:access_token(chat paas/v4 用),故这里显式回读 credentialMap。
 */
function planJwt(ctx: AdapterAccountContext): string {
  const cm = ctx.credentials.secrets?.['credentialMap']
  const jwt = cm && typeof cm === 'object' ? (cm as Record<string, unknown>)['zcodejwttoken'] : null
  return typeof jwt === 'string' && jwt.trim() !== '' ? jwt.trim() : ctx.credentials.token
}

/**
 * X-Device-Mid 账号级稳定标识(O72 整改@2026-10-28)。
 *
 * 原实现每请求 `randomUUID()` ⇒ 同一号池账号每次调用都向上游出示一台"全新设备",
 * 这本身就是风控异常触发器(真实客户端的设备 mid 是装机期固定值)。取值序:
 *  1) row.deviceId —— 导入时随账号带的真实客户端设备 id(明文列,非机密),优先原样透传;
 *  2) 无存储材料时由账号自身内部标识确定性派生(row.id,退化 row.uid):
 *     sha256 域分隔摘要 → 格式化为 UUID 8-4-4-4-12(版本位 4、variant 位 8..b,
 *     形态与真 UUID 一致)。row.id 是服务端内部 uuid,上游从未取得
 *     ⇒ 派生值对上游不可反推、也绝不落任何机密;两档都满足"跨请求稳定、账号间互异"。
 */
interface DeviceMidRow {
  id?: string | null
  uid?: string | null
  deviceId?: string | null
}

function uuidFromSeed(seed: string): string {
  const h = createHash('sha256').update(`zcode-mid:v1:${seed}`).digest('hex').slice(0, 32)
  // variant nibble 必须落 8..b(高两位=10):保留低两位,置 0x8
  const variant = (((Number.parseInt(h.slice(16, 17), 16) & 0x3) | 0x8) >>> 0).toString(16)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

export function zcodeDeviceMid(row: DeviceMidRow): string {
  const stored = typeof row.deviceId === 'string' ? row.deviceId.trim() : ''
  if (stored) return stored
  const seed =
    typeof row.id === 'string' && row.id
      ? row.id
      : typeof row.uid === 'string' && row.uid
        ? row.uid
        : ''
  if (!seed)
    throw new Error('ZCode X-Device-Mid 未判定:账号行既无 deviceId 存储材料也无 id/uid 可派生')
  return uuidFromSeed(seed)
}

/** zcode-plan 请求头(实弹实证:缺 X-Device-Mid/X-ZCode-App-Version ⇒ 400 parameter error) */
function planHeaders(jwt: string, deviceMid: string): Record<string, string> {
  return {
    accept: 'application/json',
    authorization: `Bearer ${jwt}`,
    'user-agent': `ZCode/${PLAN_APP_VERSION}`,
    'X-Device-Mid': deviceMid,
    'X-ZCode-App-Version': PLAN_APP_VERSION,
    'X-Platform': 'windows-x64',
    'X-Client-Language': 'zh-CN',
    'X-Client-Timezone': 'Asia/Shanghai',
    'X-Os-Category': 'windows',
  }
}

/** balance 信封(实弹形状):{code:0,msg,data:{server_time,plans:[{plan_id,name,status,ends_at,entitlements:[…]}]}} */
interface ZcodePlanBalanceEnvelope {
  code?: number
  msg?: string
  data?: {
    plans?: Array<{
      plan_id?: string
      name?: string
      status?: string
      ends_at?: number
      entitlements?: Array<{ show_name?: string; unit_type?: string; grant_units?: number }>
    }>
  }
}

// =============================================================================
// fetch 解析(测试缝 > 账号级代理 > 全局直连;对齐 codearts/trae 同款做法)
// =============================================================================

const proxyAgentCache = new Map<string, ProxyAgent>()

function makeProxiedFetch(proxyUrl: string): typeof fetch {
  let agent = proxyAgentCache.get(proxyUrl)
  if (!agent) {
    agent = new ProxyAgent(proxyUrl)
    proxyAgentCache.set(proxyUrl, agent)
  }
  const dispatcher = agent
  // 必须用 npm undici 自身的 fetch:Node 内置 fetch 与 npm undici 的 Dispatcher 不互通
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
// 账号区域与凭证读取
// =============================================================================

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * 账号区域:secrets.region(提取器已把 region 带进 raw,映射后落 secrets)>
 * extraMetadata.region > 'cn' 兜底(主仓在 CN;region 判不出落国内域,显式决策留痕)。
 */
function resolveRegion(ctx: AdapterAccountContext): 'cn' | 'global' {
  const secrets = (ctx.credentials.secrets ?? {}) as Record<string, unknown>
  if (str(secrets['region']) === 'global') return 'global'
  const extra = ctx.row.extraMetadata as Record<string, unknown> | null | undefined
  if (extra && str(extra['region']) === 'global') return 'global'
  return 'cn'
}

function regionBase(ctx: AdapterAccountContext): string {
  return resolveRegion(ctx) === 'global' ? BASE_GLOBAL : BASE_CN
}

// =============================================================================
// chat 请求构造(OpenAI 兼容面,Bearer 鉴权)
// =============================================================================

function buildChatRequest(
  ctx: AdapterAccountContext,
  req: NormalizedChatRequest,
): UpstreamHttpRequest {
  const token = ctx.credentials.token
  if (!token) throw new Error('ZCode 账号缺少 token(oauth access_token / jwt / 项目 Key 未导入)')
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
    accept: req.stream ? 'text/event-stream' : 'application/json',
  }
  const body: Record<string, unknown> = {
    model: req.model,
    messages: req.messages,
    stream: req.stream,
  }
  if (typeof req.temperature === 'number') body['temperature'] = req.temperature
  if (typeof req.maxTokens === 'number') body['max_tokens'] = req.maxTokens
  if (typeof req.topP === 'number') body['top_p'] = req.topP
  if (req.tools !== undefined) body['tools'] = req.tools
  if (req.toolChoice !== undefined) body['tool_choice'] = req.toolChoice
  if (req.responseFormat !== undefined) body['response_format'] = req.responseFormat
  if (req.seed !== undefined) body['seed'] = req.seed
  if (req.stop !== undefined) body['stop'] = req.stop
  return {
    url: `${regionBase(ctx)}${CHAT_PATH}`,
    method: 'POST',
    headers,
    rawBody: JSON.stringify(body),
  }
}

// =============================================================================
// 流式/非流式翻译(error 业务错误帧识别;其余原样透传)
// =============================================================================

/**
 * 智谱业务错误帧:{"error":{"code":"1000","message":"…"}}(1000=身份验证失败,
 * 1001=缺 Authorization;公开文档口径)。识别为终止帧,由转发层转成失败,不得当成功。
 */
function extractErrorFrame(obj: Record<string, unknown>): TranslatedChunk | null {
  const err = obj['error']
  if (!err || typeof err !== 'object' || Array.isArray(err)) return null
  const rec = err as Record<string, unknown>
  const code = rec['code']
  if (code === undefined || code === null || code === '') return null
  return {
    openaiChunk: {
      error: {
        code: String(code),
        message: typeof rec['message'] === 'string' ? rec['message'] : '',
        type: 'upstream_error',
      },
    },
    done: true,
  }
}

function translateStreamChunk(
  _ctx: AdapterAccountContext,
  rawFrame: string,
  _state: StreamState,
): TranslatedChunk | null {
  let s = rawFrame.trim()
  if (s.startsWith('data:')) s = s.slice(5).trim()
  if (!s || s === '[DONE]') return null // [DONE] 由转发层统一补发
  let obj: unknown
  try {
    obj = JSON.parse(s)
  } catch {
    return null // 心跳/注释等非 JSON 帧:忽略
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null
  const rec = obj as Record<string, unknown>
  return extractErrorFrame(rec) ?? { openaiChunk: rec }
}

function translateNonStream(
  _ctx: AdapterAccountContext,
  responseBody: unknown,
): Record<string, unknown> {
  if (responseBody && typeof responseBody === 'object' && !Array.isArray(responseBody)) {
    const err = extractErrorFrame(responseBody as Record<string, unknown>)
    if (err) {
      const e = err.openaiChunk['error'] as { code: string; message: string }
      throw new Error(`智谱上游业务错误 ${e.code}: ${e.message}`)
    }
  }
  return responseBody as Record<string, unknown>
}

// =============================================================================
// 认证失败判定(公开文档错误码:1000=身份验证失败,1001=缺 Authorization)
// =============================================================================

/** 常见认证失效文案(HTTP 直连错误体/SSE 中途帧都可能出现) */
const AUTH_BODY_MARKERS = [
  '身份验证失败',
  'invalid api key',
  'unauthorized',
  'authentication failed',
]

function isAuthFailure(statusCode: number, bodyText: string): boolean {
  if (statusCode === 401 || statusCode === 403) return true
  // error.code 数字形匹配(1000/1001),避免把 10029 之类误吞
  if (/"code"\s*:\s*"?100[01]"?\b/.test(bodyText)) return true
  const lower = bodyText.toLowerCase()
  return AUTH_BODY_MARKERS.some((m) => lower.includes(m))
}

// =============================================================================
// 富错误分级(转发层据此决定罚不罚号)
// =============================================================================

/** 额度/余额/欠费类文案(剔裸 insufficient,防 "Insufficient privileges" 误判) */
const CREDIT_RE =
  /(余额不足|欠费|额度|insufficient (balance|credit|quota)|quota exceeded|out of credit|payment required)/i

function classifyUpstreamFailure(
  statusCode: number,
  bodyText: string,
): {
  kind: 'auth' | 'credit' | 'session_dead' | 'rate' | 'not_found' | 'request' | 'server' | 'client'
} {
  if (/"code"\s*:\s*"?1000"?\b/.test(bodyText)) return { kind: 'auth' } // 身份验证失败
  if (statusCode === 402 || CREDIT_RE.test(bodyText)) return { kind: 'credit' } // 402 insufficient balance = 资源包/余额耗尽(社区实证口径)
  if (isAuthFailure(statusCode, bodyText)) return { kind: 'auth' } // 1001 / 401/403
  if (statusCode === 404) return { kind: 'not_found' }
  if (statusCode === 429) return { kind: 'rate' }
  if (statusCode >= 500) return { kind: 'server' }
  return { kind: 'client' }
}

// =============================================================================
// 额度点查与健康检查(zcode-plan 通道,2026-10-27 实弹闭环;zcodejwttoken 票)
// =============================================================================

async function getQuota(
  ctx: AdapterAccountContext,
  opts?: QuotaCallOptions,
): Promise<RelayQuotaResult> {
  try {
    const url = `${PLAN_BASE}${PLAN_BALANCE_PATH}?app_version=${PLAN_APP_VERSION}`
    const res = await resolveFetchImpl(opts ?? {})(url, {
      method: 'GET',
      headers: planHeaders(planJwt(ctx), zcodeDeviceMid(ctx.row)),
    })
    const text = await res.text().catch(() => '')
    if (!res.ok) {
      return {
        ok: false,
        ...(zcodeAdapter.isAuthFailure(res.status, text) ? { authFailed: true } : {}),
        error: `billing/balance HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
      }
    }
    let env: ZcodePlanBalanceEnvelope
    try {
      env = JSON.parse(text) as ZcodePlanBalanceEnvelope
    } catch {
      return { ok: false, error: 'billing/balance 200 但响应非 JSON ⇒ 未判定(不猜字段读成数字)' }
    }
    if (env.code !== 0) {
      return {
        ok: false,
        error: `billing/balance 业务拒绝 code=${env.code}${env.msg ? ` msg=${env.msg}` : ''}`,
      }
    }
    const plans = env.data?.plans ?? []
    const active = plans.filter((p) => p.status === 'active')
    if (plans.length === 0) {
      return {
        ok: false,
        error: 'billing/balance 200/code=0 但 plans 空 ⇒ 无生效套餐(如实报,不编数字)',
      }
    }
    const packs = active.flatMap((p) =>
      (p.entitlements ?? []).map((e) => ({
        // 形状里无 remaining ⇒ 只报发放量(limit)与到期,不编剩余数字
        name: e.show_name ?? 'entitlement',
        limit: e.grant_units ?? undefined,
        endAt: p.ends_at ? new Date(p.ends_at * 1000).toISOString() : undefined,
      })),
    )
    const first = active[0] ?? plans[0]
    if (!first) {
      return { ok: false, error: 'billing/balance 200/code=0 但无任何套餐 ⇒ 未判定' }
    }
    return {
      ok: true,
      quota: {
        // 形状里无 remaining/used 数字字段(仅 grant_units 发放量)⇒ 不编数字,只报档名与权益包
        subscriptionName: first.name ?? first.plan_id ?? undefined,
        unit: first.entitlements?.[0]?.unit_type,
        resetsAt: first.ends_at ? new Date(first.ends_at * 1000).toISOString() : undefined,
        packs,
      },
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `套餐点查失败: ${msg}` }
  }
}

async function checkHealth(
  ctx: AdapterAccountContext,
  opts?: AdapterCallOptions,
): Promise<{ ok: boolean; error?: string; indeterminate?: boolean; authFailed?: boolean }> {
  try {
    // 轻量检查 = zcode-plan billing/balance(GET,不消耗对话配额;实弹实证零消耗)
    const url = `${PLAN_BASE}${PLAN_BALANCE_PATH}?app_version=${PLAN_APP_VERSION}`
    const res = await resolveFetchImpl(opts ?? {})(url, {
      method: 'GET',
      headers: planHeaders(planJwt(ctx), zcodeDeviceMid(ctx.row)),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      const rejected = zcodeAdapter.isAuthFailure(res.status, text)
      return {
        ok: false,
        indeterminate: !rejected,
        authFailed: rejected,
        error: `billing/balance HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}${
          rejected ? '' : '(未判定)'
        }`,
      }
    }
    const text = await res.text().catch(() => '')
    try {
      const env = JSON.parse(text) as ZcodePlanBalanceEnvelope
      if (env.code !== 0) {
        return {
          ok: false,
          indeterminate: true,
          error: `billing/balance 200 但业务 code=${env.code}${env.msg ? ` msg=${env.msg}` : ''}(未判定)`,
        }
      }
    } catch {
      return { ok: false, indeterminate: true, error: 'billing/balance 200 但响应非 JSON(未判定)' }
    }
    return { ok: true }
  } catch (e) {
    return {
      ok: false,
      indeterminate: true,
      error: `${e instanceof Error ? e.message : String(e)}(未判定)`,
    }
  }
}

// =============================================================================
// 导出
// =============================================================================

export const zcodeAdapter: RelayUpstreamAdapter = {
  // 集成点:主会话需把 'zcode' 加进 RELAY_PROVIDERS(relay-account-format.ts);
  // 此处断言只为让本文件独立可编译,不改动既有文件。
  providerCode: 'zcode' as RelayUpstreamAdapter['providerCode'],
  buildChatRequest,
  translateStreamChunk,
  translateNonStream,
  // refreshToken 不实现:ZCode OAuth 刷新端点未实证,绝不猜端点(401 自愈靠重新导入)
  checkHealth,
  getQuota,
  // listModels 不实现:模型清单端点未实证(健康检查走余额端点)
  isAuthFailure,
  classifyUpstreamFailure,
}

// §22c 镜像测试唯一出口:派生逻辑只有上面这一份实现,测试直用,不得复制判据。
export const __test__ = { zcodeDeviceMid, uuidFromSeed }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
