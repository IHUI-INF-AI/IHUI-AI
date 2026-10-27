// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MiniMax(MiniMax Code CLI,命令 mcode)上游适配器(2026-10-27 立)。
 *
 * 上游协议要点(出处:MiniMax 开放平台公开文档 + 社区调研;**chat 面未本机实弹实证**,
 * 构造按公开文档写实,响应异常一律未判定,不冒绿):
 * - 双域名(公开文档口径,2026-10-27 核):国内 = api.minimaxi.com(注意官方拼写
 *   minimaxi,多一个 i),国际 = api.minimax.io;跨区 key 互不认(文档明示)。
 * - chat:POST /v1/chat/completions,OpenAI 兼容(Bearer 鉴权),另有 /anthropic
 *   Anthropic 兼容面 —— 网关转发用 OpenAI 兼容面。
 * - 业务错误帧:HTTP 200 也可能带 {"base_resp":{"status_code":<非0>,"status_msg":…}}
 *   (MiniMax 特有信封,社区文档口径)。status_code:1004 = 无效 key/认证失败,
 *   1008 = 余额不足,1039 = 限流 —— 三者均为**公开社区口径,未本机实证**。
 * - 凭证两类:pay-as-you-go(sk-api-…,走账户余额)与 Token Plan 订阅键(sk-cp-…,
 *   走套餐配额);额度端点只认订阅键(按量 key 会 401/403,社区调研口径)。
 * - 刷新:mcode 的 OAuth 刷新端点(auth.json 里 accessToken/refreshToken/expiresAtMs)
 *   **未实证**(CLI 内部行为,无公开文档)⇒ 本适配器不实现 refreshToken,
 *   401 自愈依赖重新导入号池,绝不猜端点。
 * - 凭证映射(服务端 mapMinimaxImport,主会话集成):token←accessToken,
 *   refreshTokenEnc←refreshToken,secretsEnc←JSON{clientId,audience,region,…};
 *   到期←expiresAtMs(上游给的真值)。
 */
import { ProxyAgent, fetch as undiciFetch } from 'undici'
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
// 端点与常量(改端点只改这里;双域名常量都是公开文档口径,未本机实弹)
// =============================================================================

const BASE_CN = 'https://api.minimaxi.com'
const BASE_GLOBAL = 'https://api.minimax.io'
const CHAT_PATH = '/v1/chat/completions'
/**
 * OAuth 会话票余量端点(2026-10-27 双源实证升级):
 * ① mcode 桌面端 app.asar 字符串取证 —— OPEN_PLATFORM_ORIGINS{cn:www.minimaxi.com,
 *    en:platform.minimax.io} + GET /v1/api/openplatform/coding_plan/remains,
 *    鉴权 = Bearer <OAuth accessToken>;
 * ② 本机实弹(真号 OAuth token)—— api.minimaxi.com 线 200 +
 *    {"model_remains":null,"base_resp":{"status_code":2062,"status_msg":
 *    "no active token plan subscription"}} = 鉴权通过、免费号无活跃套餐。
 * 响应形状:model_remains 数组(null=无套餐;会员号解析从模型名聚合 used/remaining);
 * base_resp.status_code 非 0 即业务拒绝(如实带码)。
 * 注意旧口径 /v1/token_plan/remains 是 API Secret Key 通道(实弹 1004 "carry the
 * API secret key"),OAuth 票调它必失败,不得再用。
 */
const QUOTA_PATH = '/v1/api/openplatform/coding_plan/remains'

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
 * extraMetadata.region > 'cn' 兜底。region 判不出时落国内域名(主仓在 CN),
 * 双域名常量都保留,错了只换 host,不换语义 —— 此兜底是显式决策,注释留痕。
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
  if (!token) throw new Error('MiniMax 账号缺少 accessToken(tokenEnc 未导入)')
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
// 流式/非流式翻译(base_resp 业务错误帧识别;其余原样透传)
// =============================================================================

/**
 * MiniMax 业务错误帧:{"base_resp":{"status_code":<非0>,"status_msg":…}}。
 * status_code = 0(或缺失)不算错误帧。1004=认证失败、1008=余额不足、1039=限流
 * (公开社区口径,未本机实证;分类语义见 classifyUpstreamFailure)。
 */
function extractBaseRespError(obj: Record<string, unknown>): TranslatedChunk | null {
  const base = obj['base_resp']
  if (!base || typeof base !== 'object' || Array.isArray(base)) return null
  const code = (base as Record<string, unknown>)['status_code']
  if (typeof code !== 'number' || code === 0) return null
  const msg = (base as Record<string, unknown>)['status_msg']
  return {
    openaiChunk: {
      error: {
        code: String(code),
        message: typeof msg === 'string' ? msg : '',
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
  return extractBaseRespError(rec) ?? { openaiChunk: rec }
}

function translateNonStream(
  _ctx: AdapterAccountContext,
  responseBody: unknown,
): Record<string, unknown> {
  if (responseBody && typeof responseBody === 'object' && !Array.isArray(responseBody)) {
    const err = extractBaseRespError(responseBody as Record<string, unknown>)
    if (err) {
      const e = err.openaiChunk['error'] as { code: string; message: string }
      throw new Error(`MiniMax 上游业务错误 ${e.code}: ${e.message}`)
    }
  }
  return responseBody as Record<string, unknown>
}

// =============================================================================
// 认证失败判定(公开社区口径:base_resp.status_code 1004 = 无效 key;未本机实证)
// =============================================================================

/** 常见认证失效文案(HTTP 直连错误体/SSE 中途帧都可能出现) */
const AUTH_BODY_MARKERS = ['invalid api key', 'authentication failed', 'unauthorized']

function isAuthFailure(statusCode: number, bodyText: string): boolean {
  if (statusCode === 401 || statusCode === 403) return true
  // base_resp.status_code:1004(无效 key)—— 数字形匹配,避免把 41004 之类误吞
  if (/"status_code"\s*:\s*1004\b/.test(bodyText)) return true
  const lower = bodyText.toLowerCase()
  return AUTH_BODY_MARKERS.some((m) => lower.includes(m))
}

// =============================================================================
// 富错误分级(转发层据此决定罚不罚号;码值=公开社区口径,未本机实证)
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
  if (/"status_code"\s*:\s*1004\b/.test(bodyText)) return { kind: 'auth' }
  if (/"status_code"\s*:\s*1008\b/.test(bodyText)) return { kind: 'credit' } // 余额不足(社区口径)
  if (/"status_code"\s*:\s*1039\b/.test(bodyText)) return { kind: 'rate' } // 限流(社区口径)
  if (statusCode === 402 || CREDIT_RE.test(bodyText)) return { kind: 'credit' }
  if (isAuthFailure(statusCode, bodyText)) return { kind: 'auth' }
  if (statusCode === 404) return { kind: 'not_found' }
  if (statusCode === 429) return { kind: 'rate' }
  if (statusCode >= 500) return { kind: 'server' }
  return { kind: 'client' }
}

// =============================================================================
// 额度点查与健康检查(GET /v1/api/openplatform/coding_plan/remains;2026-10-27 实弹)
// =============================================================================

/** MiniMax 信封:base_resp.status_code 非 0 = 业务拒绝;载荷 = model_remains 数组 */
interface MiniMaxEnvelope {
  model_remains?: unknown
  base_resp?: { status_code?: number; status_msg?: string }
}

async function getQuota(
  ctx: AdapterAccountContext,
  opts?: QuotaCallOptions,
): Promise<RelayQuotaResult> {
  try {
    const url = `${regionBase(ctx)}${QUOTA_PATH}`
    const res = await resolveFetchImpl(opts ?? {})(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${ctx.credentials.token}`,
      },
    })
    const text = await res.text().catch(() => '')
    if (!res.ok) {
      return {
        ok: false,
        ...(minimaxAdapter.isAuthFailure(res.status, text) ? { authFailed: true } : {}),
        error: `coding_plan/remains HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
      }
    }
    let env: MiniMaxEnvelope
    try {
      env = JSON.parse(text) as MiniMaxEnvelope
    } catch {
      return {
        ok: false,
        error: `余量端点 200 但响应非 JSON(前 200 字: ${text.slice(0, 200)}) ⇒ 未判定`,
      }
    }
    const biz = env.base_resp?.status_code
    if (typeof biz === 'number' && biz !== 0) {
      return {
        ok: false,
        error: `上游业务拒绝 status_code=${biz}(${env.base_resp?.status_msg ?? '无明细'})——如 2062=无活跃套餐(免费号如实无余量)`,
      }
    }
    const rows = Array.isArray(env.model_remains) ? env.model_remains : null
    if (!rows) {
      const keys = env && typeof env === 'object' ? Object.keys(env) : []
      return {
        ok: false,
        error: `余量端点 200 但 model_remains 非数组,响应键=[${keys.join(',')}] ⇒ 未判定(不猜字段)`,
      }
    }
    // model_remains 行形状未取得非空样例(免费号恒 null)⇒ 逐行字段不猜:
    // 能安全读出的字段直读,读不出的整行原样进 error 供 admin 点查喂形状。
    let used = 0
    let remaining = 0
    let shapeUnknown = false
    for (const row of rows) {
      if (!row || typeof row !== 'object') {
        shapeUnknown = true
        continue
      }
      const rec = row as Record<string, unknown>
      const rem = rec['remain'] ?? rec['remaining'] ?? rec['remains']
      const u = rec['used'] ?? rec['usage'] ?? rec['consume']
      if (typeof rem === 'number') remaining += rem
      else shapeUnknown = true
      if (typeof u === 'number') used += u
    }
    if (shapeUnknown) {
      return {
        ok: false,
        error: `model_remains 行字段形状未实证(行数=${rows.length},样例键=[${rows
          .slice(0, 2)
          .map((r) => (r && typeof r === 'object' ? Object.keys(r as object).join('|') : typeof r))
          .join('; ')}]) ⇒ 未判定(不猜字段读成数字)`,
      }
    }
    return {
      ok: true,
      quota: { used, remaining, unit: 'token plan 余量' },
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `余量点查失败: ${msg}` }
  }
}

async function checkHealth(
  ctx: AdapterAccountContext,
  opts?: AdapterCallOptions,
): Promise<{ ok: boolean; error?: string; indeterminate?: boolean; authFailed?: boolean }> {
  try {
    // 轻量检查 = 复用余量端点(GET,不消耗对话配额;注意按量 key 会 401,社区口径)
    const url = `${regionBase(ctx)}${QUOTA_PATH}`
    const res = await resolveFetchImpl(opts ?? {})(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${ctx.credentials.token}`,
      },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      const rejected = minimaxAdapter.isAuthFailure(res.status, text)
      return {
        ok: false,
        indeterminate: !rejected,
        authFailed: rejected,
        error: `token_plan/remains HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}${
          rejected ? '' : '(未判定)'
        }`,
      }
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

export const minimaxAdapter: RelayUpstreamAdapter = {
  // 集成点:主会话需把 'minimax' 加进 RELAY_PROVIDERS(relay-account-format.ts);
  // 此处断言只为让本文件独立可编译,不改动既有文件。
  providerCode: 'minimax' as RelayUpstreamAdapter['providerCode'],
  buildChatRequest,
  translateStreamChunk,
  translateNonStream,
  // refreshToken 不实现:mcode OAuth 刷新端点未实证,绝不猜端点(401 自愈靠重新导入)
  checkHealth,
  getQuota,
  // listModels 不实现:模型清单端点未实证(健康检查走余量端点)
  isAuthFailure,
  classifyUpstreamFailure,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
