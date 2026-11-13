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
 * - 刷新(2026-11-06 起已实现,§0.12 逆向-复现-超越第③步):出处 = 本机 MiniMax Code 3.1.10
 *   的 app.asar 字符串取证(@mavis/oauth-core 的 endpoint-config.js / contracts.js /
 *   oauth-client.js / auth-core.js)。端点 = `POST {accountOrigin}/oauth2/token`,
 *   form-urlencoded 五字段,除 Accept/Content-Type 外**不带任何头**(无设备证明、无签名,
 *   当年卡住 Trae 的 ECDSA 那一型在此不存在);cn=`account.minimax.cn`,en=`account.minimax.io`。
 *   ⚠ 上游 refresh_token 是**轮换型**:号池若抢在客户端之前刷,旧 rt 立刻 invalid_grant,
 *   而客户端只在 `invalid_grant + HTTP 400` 这一档销毁会话 ⇒ 会把机主的桌面端直接顶下线。
 *   因此本平台的续期策略必须与 trae/qoder 同档登记为 client-first(判据在
 *   `relay-account-pool-scheduler.ts` 的 CLIENT_FIRST_FLAGS,同批已加 minimax 档)。
 *   未实证面(不冒绿):新票 expires_in 真值、旧 rt 二用是否恒返 400、上游是否校验 Origin/UA。
 * - 实弹核验(2026-11-06 本机,机主单独授权):
 *   ① 对照组一把明显假的 rt ⇒ `400 invalid_grant`;② 本机现役号的真 rt ⇒ 同一个码;
 *   ③ 同一枚号的 access 票打本适配器已实证的余量端点 ⇒ `401 {"error":"invalid access token"}`。
 *   读法:两条独立端点都拒这枚号的凭据 ⇒ 判「这枚号在上游已失效」成立;
 *   但**「我方请求形状对活号也正确」仍未证** —— 本机已无活号可作正向对照,该格留给
 *   下一枚真登录的号(届时 refreshOne 成功即自动补上这格证据:成功会写 credVersion+1 并清零失败计数)。
 *   副作用如实记:那次实验把该行 refreshFailureCount 推到 2、并按 authRejected 语义把到期列收敛到
 *   实验时刻 —— 在"凭据已被上游拒"这个事实下,收敛是真阴性,不回滚。
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
  TokenRefreshResult,
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
      // 按量 key(sk-…)打余量端点本身就不被接受 ⇒ 401/403 不能证明票死,只记未判定;
      // 其余凭证的 401/403 仍按鉴权失效处理。
      const payAsYouGo = str(ctx.credentials.token).startsWith('sk-')
      const rejected = minimaxAdapter.isAuthFailure(res.status, text)
      const authFailed = rejected && !((res.status === 401 || res.status === 403) && payAsYouGo)
      return {
        ok: false,
        indeterminate: !authFailed,
        authFailed,
        error: `token_plan/remains HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}${
          authFailed ? '' : '(未判定)'
        }`,
      }
    }
    // 2xx 不等于可用:MiniMax 业务错误帧同样走 200(base_resp.status_code≠0)。
    const text = await res.text().catch(() => '')
    let env: MiniMaxEnvelope | null = null
    try {
      const parsed: unknown = JSON.parse(text)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        env = parsed as MiniMaxEnvelope
      }
    } catch {
      env = null
    }
    if (!env) {
      return {
        ok: false,
        indeterminate: true,
        error: `token_plan/remains 200 但响应非 JSON(前 200 字: ${text.slice(0, 200)}) ⇒ 未判定`,
      }
    }
    const biz = env.base_resp?.status_code
    if (typeof biz !== 'number' || biz === 0) return { ok: true }
    if (biz === 1004) {
      return {
        ok: false,
        indeterminate: false,
        authFailed: true,
        error: '上游业务状态 1004(无效 token)',
      }
    }
    // 1008=余额不足 / 1039=限流等:不当成坏号,只记未判定
    return {
      ok: false,
      indeterminate: true,
      error: `上游业务状态 ${biz}(${env.base_resp?.status_msg ?? '无明细'}) ⇒ 未判定`,
    }
  } catch (e) {
    return {
      ok: false,
      indeterminate: true,
      error: `${e instanceof Error ? e.message : String(e)}(未判定)`,
    }
  }
}

// =============================================================================
// OAuth 续票(2026-11-06 立)
// 只复现**协议行为**(端点落点 / 请求面 / 响应硬校验 / 失败分档),不搬对方源码。
// =============================================================================

/** 账号面 origin(与 api 面不同域:api 走 minimaxi.com,账号面走 minimax.cn / .io) */
const OAUTH_ACCOUNT_CN = 'https://account.minimax.cn'
const OAUTH_ACCOUNT_GLOBAL = 'https://account.minimax.io'
const OAUTH_TOKEN_PATH = '/oauth2/token'
/** 客户端硬校验的三项常量;池内 secrets 有原值时优先用它自己的(secrets 就是导入时那台机的原样) */
const OAUTH_CLIENT_ID = 'mcode-public'
const OAUTH_SCOPE = 'agent.default'
const OAUTH_AUDIENCE = 'agent-backend'

/**
 * 刷新失败载体。status/code 是「票死没死」的两要件;message 只许含状态码与 OAuth 错误码,
 * 永不含凭据,也不转述上游 error_description(有的服务端会把 token 值原样写回描述里,
 * 而 lastErrorMessage 是明文列)。
 */
class MinimaxRefreshError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'MinimaxRefreshError'
    this.status = status
    this.code = code
  }
}

/** 「票已死」的唯一形态(取证:客户端自己也只在这一档销毁会话,其余档保留会话) */
export function isDeadGrantError(status: number, code: string): boolean {
  return status === 400 && code === 'invalid_grant'
}

/** OAuth 错误码取法:标准形 `{"error":"invalid_grant"}`,也接 `{"error":{"code":…}}` 包装形 */
function pickOAuthErrorCode(body: unknown): string {
  if (body === null || typeof body !== 'object') return ''
  const raw = (body as Record<string, unknown>).error
  if (typeof raw === 'string') return raw.trim()
  if (raw !== null && typeof raw === 'object') {
    const c = (raw as Record<string, unknown>).code
    if (typeof c === 'string') return c.trim()
  }
  return ''
}

/**
 * grant 响应 → 票面(纯函数)。四条硬校验与取证到的 parseTokenGrant 同语义:
 * access_token 在场 ∧ token_type=bearer ∧ expires_in>0 ∧ scope 集含 agent.default;
 * refresh_token 缺省 ⇒ 沿用旧值(上游允许不回新 rt,清空就是丢号)。
 * 任一条不过 = invalid_token_response:不当成功、不写票(§0.3 形状不符是未判定,不是失效)。
 */
export function parseMinimaxTokenGrant(
  body: unknown,
  nowMs: number,
  fallbackRefreshToken: string | null,
): TokenRefreshResult {
  const o = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const token = str(o.access_token)
  const tokenType = str(o.token_type).toLowerCase()
  const expiresIn = typeof o.expires_in === 'number' ? o.expires_in : Number(str(o.expires_in))
  const scopeField = o.scope
  const scopes = Array.isArray(scopeField)
    ? scopeField.map(str).filter(Boolean)
    : str(scopeField).split(/\s+/).filter(Boolean)
  if (!token) {
    throw new MinimaxRefreshError(
      200,
      'invalid_token_response',
      'MiniMax oauth2/token 响应缺 access_token(未判定,不写票)',
    )
  }
  if (tokenType !== 'bearer') {
    throw new MinimaxRefreshError(
      200,
      'invalid_token_response',
      `MiniMax oauth2/token token_type=${tokenType || '(空)'} 非 bearer(未判定,不写票)`,
    )
  }
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new MinimaxRefreshError(
      200,
      'invalid_token_response',
      'MiniMax oauth2/token expires_in 非正数(未判定,不写票)',
    )
  }
  if (!scopes.includes(OAUTH_SCOPE)) {
    throw new MinimaxRefreshError(
      200,
      'invalid_token_response',
      `MiniMax oauth2/token scope 集不含 ${OAUTH_SCOPE}(未判定,不写票)`,
    )
  }
  return {
    token,
    refreshToken: str(o.refresh_token) || fallbackRefreshToken || null,
    expiresAt: new Date(nowMs + expiresIn * 1000),
    expiresIn,
  }
}

/** 续票端点:env 显式给定时整体接管(与客户端同档),否则按 region 落账号面 origin */
function oauthTokenEndpoint(ctx: AdapterAccountContext): string {
  const override = str(process.env.MCODE_OAUTH_TOKEN_ENDPOINT)
  if (override) return override
  const base = resolveRegion(ctx) === 'global' ? OAUTH_ACCOUNT_GLOBAL : OAUTH_ACCOUNT_CN
  return `${base}${OAUTH_TOKEN_PATH}`
}

async function refreshToken(
  ctx: AdapterAccountContext,
  opts?: AdapterCallOptions,
): Promise<TokenRefreshResult | null> {
  const rt = ctx.credentials.refreshToken
  if (!rt) return null
  const secrets = (ctx.credentials.secrets ?? {}) as Record<string, unknown>
  const clientId = str(secrets.clientId) || OAUTH_CLIENT_ID
  const audience = str(secrets.audience) || OAUTH_AUDIENCE
  const poolScopes = Array.isArray(secrets.scopes) ? secrets.scopes.map(str).filter(Boolean) : []
  const scope = poolScopes.length > 0 ? poolScopes.join(' ') : OAUTH_SCOPE
  const doFetch = resolveFetchImpl(opts ?? {})
  let res: Response
  try {
    res = await doFetch(oauthTokenEndpoint(ctx), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: rt,
        client_id: clientId,
        scope,
        audience,
      }).toString(),
    })
  } catch (e) {
    throw new MinimaxRefreshError(
      0,
      'network',
      `MiniMax oauth2/token 请求未送达:${e instanceof Error ? e.message : String(e)}`.slice(0, 300),
    )
  }
  const text = await res.text().catch(() => '')
  let body: unknown = null
  try {
    body = JSON.parse(text) as unknown
  } catch {
    body = null
  }
  if (!res.ok) {
    const code = pickOAuthErrorCode(body) || `http_${res.status}`
    throw new MinimaxRefreshError(
      res.status,
      code,
      `MiniMax oauth2/token HTTP ${res.status} code=${code}`,
    )
  }
  if (body === null) {
    throw new MinimaxRefreshError(
      res.status,
      'invalid_token_response',
      'MiniMax oauth2/token 响应体不是 JSON(未判定,不写票)',
    )
  }
  return parseMinimaxTokenGrant(body, Date.now(), rt)
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
  refreshToken,
  checkHealth,
  getQuota,
  // listModels 不实现:模型清单端点未实证(健康检查走余量端点)
  isAuthFailure,
  classifyUpstreamFailure,
  /**
   * 只有「票已死」这一档才算鉴权失效(上游明确拒收凭据 ⇒ 调度器据此收敛到期列);
   * 网络类/5xx/形状不符一律 false(未判定 ≠ 失效,§0.3)。
   */
  isAuthError(err: unknown): boolean {
    return err instanceof MinimaxRefreshError && isDeadGrantError(err.status, err.code)
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
