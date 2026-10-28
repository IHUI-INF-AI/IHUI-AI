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
 * chat 反代契约现状(2026-10-23 更新):
 * - HTTP 直连**未实证**:反代端点 POST gateway.qoder.com.cn .../sse/agent_chat_generation
 *   (SSE 响应,错误包在 data:{headers,body,statusCodeValue} wrapper)要求内嵌 HMAC/wasm
 *   计算的 Signature 头,服务端无法复现(直连实证 403 "Signature invalid")⇒
 *   单段式三件套(buildChatRequest/translateStreamChunk/translateNonStream)一律明确抛错,
 *   绝不返回假成功;
 * - 本机桥接**已实证**(两条通路,共用同一条"绝不冒充可用"口径):
 *   ① 常驻桥(默认):SDK 包成 127.0.0.1 上的 OpenAI 兼容端点,executeChat 转发
 *      (见 qoder-bridge-client.ts / scripts/qoder-chat-bridge.mjs);
 *   ② CLI 桥(显式选择):spawn 官方 CLI + SDK query() 取流(见 qoder-cli-bridge.ts),
 *      门控(QODER_BRIDGE_ENABLED=1,或非生产下 runner/SDK/CLI 路径齐备)开启时优先;
 * - QODER_BRIDGE_ENABLED=0 是 chat **总开关**:两条通路一并关闭,executeChat 不定义,
 *   转发层落到三件套如实抛"契约未实证"(2026-10-23 合并两个独立实现时定的唯一口径)。
 * 接入号池的账号可被调度器续期/健康检查;转发链路调 chat 时按上述两条路径如实得到结果或错误。
 */
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import { isProductionGuard } from '../../config/index.js'
import { extractTokenExpiry } from '../relay-account-format.js'
import {
  describeQoderBridgeFailure,
  ensureQoderBridge,
  getQoderBridgeEndpoint,
} from '../qoder-bridge-client.js'
import type {
  AdapterAccountContext,
  AdapterCallOptions,
  ChatExecuteOptions,
  ModelListCallOptions,
  NormalizedChatRequest,
  QuotaCallOptions,
  RelayModelListResult,
  RelayQuotaResult,
  RelayUpstreamAdapter,
  StreamState,
  TokenRefreshResult,
  TranslatedChunk,
  UpstreamChatResult,
  UpstreamHttpRequest,
} from '../relay-upstream-adapters.js'
import {
  isQoderBridgeEnabled,
  preflightQoderBridge,
  qoderCliChatChunks,
  renderQoderPrompt,
} from './qoder-cli-bridge.js'
import { listQoderModels } from './qoder-models.js'

// =============================================================================
// 端点常量(实证值;非生产档允许 env 覆写指向假上游,供 tests 真跑协议线)
// =============================================================================

function endpoint(name: string, fallback: string): string {
  // 档位判定走 config 出口(守门语义见 config/index.ts 头注):production 下端点覆写不生效
  if (isProductionGuard) return fallback
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

/** extraMetadata.cosy 的键 → Cosy-* 请求头(与 checkin_qoder.COSY_HEADER_KEYS 同序)。
 * 2026-10-23 修:cosy 落库键以蛇形为正(对齐 checkin_qoder device_map["cosy"] 契约,
 * 键位错配曾让 Cosy-MachineToken/Code/Type 头整族缺失 → refresh 被上游拒),
 * 读取面同时兼容历史行里的驼峰键。 */
const COSY_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ['machine_token', 'Cosy-MachineToken'],
  ['machine_code', 'Cosy-MachineCode'],
  ['machine_type', 'Cosy-MachineType'],
  ['version', 'Cosy-Version'],
]

function cosyValue(cosy: Record<string, unknown>, keys: readonly string[]): string {
  for (const k of keys) {
    const v = cosy[k]
    if (typeof v === 'string' && v.trim()) {
      // HTTP 头必须 ASCII(RFC 7230):非 ASCII(如中文主机名"服务器")会被底层
      // encode('ascii') 抛 UnicodeEncodeError(ai-service 侧已因此致 id=5 每日签到
      // 全挂)。此处同样剔除非可打印 ASCII;清洗后为空则继续找下一个候选键。
      const safe = v
        .trim()
        .replace(/[^\x20-\x7e]/g, '')
        .trim()
      if (safe) return safe
    }
  }
  return ''
}

/** chat 契约未实证的统一错误(转发层按普通上游错误处理,不刷新不重试) */
export const QODER_CHAT_CONTRACT_UNVERIFIED =
  'QODER_CHAT_CONTRACT_UNVERIFIED: Qoder chat 必须经本机桥(executeChat)执行,三件套直连通道未实证'

/** Qoder 上游非鉴权失败(带 HTTP 状态码;消息截断防泄漏) */
class QoderUpstreamError extends Error {
  readonly statusCode: number
  constructor(statusCode: number, message: string) {
    super(message.slice(0, 500))
    this.name = 'QoderUpstreamError'
    this.statusCode = statusCode
  }
}

// =============================================================================
// chat ↔ 本机桥(2026-10-23 打通)
// =============================================================================
//
// 为什么必须走本机桥:chat 真实端点 `/algo/api/v2/service/pro/sse/agent_chat_generation`
// 要求 **umid 设备签名**(resources/umid/runtime-info.exe + sgsdk.dll 生成,外部不可复刻)。
// 官方 Agent SDK 的 worker 自己会签名,鉴权走 `jobToken`
// (worker 侧 applyExternalToken(token,"host-job-token")) —— 即 IDE 把 device token
// 交给 worker 的官方通道,**不需要 PAT、不需要浏览器授权**。
//
// 实测(2026-10-23,两次真实回复+真实计费):
//   result="pong" / "我是 Qoder,…" , subtype=success, credits=0.87 / 2.48
//
// 安全:桥内 `options.tools=[]` 已清空工具面(不传会挂 18 个本机工具);
//      cwd 固定为空目录,阻断 AGENTS.md 等上下文外泄。

/**
 * 网关对外模型名 → 上游裸名。
 * 中转站对外用 `provider/model` 形态(如 `qoder/auto`,与 workbuddy/xxx 同族),
 * 而 SDK 的 `options.model` 只认上游自己的名字(`auto` / 具体模型 id),
 * 带前缀传过去会被当成不存在的模型 —— 故在出网前剥掉第一段前缀。
 */
function upstreamModelName(model: string): string {
  const m = (model ?? '').trim()
  if (!m) return 'auto'
  const slash = m.indexOf('/')
  return slash >= 0 ? m.slice(slash + 1) || 'auto' : m
}

/** 桥请求体:只保留桥会消费的字段,采样参数透传(桥当前忽略,不伪造生效) */
function buildBridgeBody(req: NormalizedChatRequest): Record<string, unknown> {
  const messages = Array.isArray(req.messages)
    ? req.messages
        .filter((m) => m && typeof m.role === 'string')
        .map((m) => ({ role: m.role, content: m.content }))
    : []
  const body: Record<string, unknown> = {
    model: upstreamModelName(req.model),
    messages,
    stream: req.stream === true,
  }
  if (typeof req.temperature === 'number') body.temperature = req.temperature
  if (typeof req.maxTokens === 'number') body.max_tokens = req.maxTokens
  if (typeof req.topP === 'number') body.top_p = req.topP
  if (Array.isArray(req.stop) && req.stop.length > 0) body.stop = req.stop
  if (typeof req.seed === 'number') body.seed = req.seed
  if (typeof req.presencePenalty === 'number') body.presence_penalty = req.presencePenalty
  if (typeof req.frequencyPenalty === 'number') body.frequency_penalty = req.frequencyPenalty
  return body
}

/** 桥 → OpenAI chunk 异步序列(桥已输出 OpenAI 帧,这里只做 SSE 拆帧 + 错误上抛) */
async function* parseBridgeSse(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<Record<string, unknown>> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl = buffer.indexOf('\n')
      while (nl >= 0) {
        const raw = buffer.slice(0, nl).replace(/\r$/, '')
        buffer = buffer.slice(nl + 1)
        nl = buffer.indexOf('\n')
        if (!raw.startsWith('data:')) continue
        const payload = raw.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        let obj: unknown
        try {
          obj = JSON.parse(payload)
        } catch {
          continue
        }
        if (!obj || typeof obj !== 'object') continue
        const err = (obj as Record<string, unknown>)['error']
        if (err && typeof err === 'object') {
          const msg = (err as Record<string, unknown>)['message']
          throw new QoderUpstreamError(502, `Qoder 桥上流错误: ${String(msg ?? 'unknown')}`)
        }
        yield obj as Record<string, unknown>
      }
    }
    // 收尾残留(无换行结尾的最后一行)
    const tail = buffer.trim()
    if (tail.startsWith('data:')) {
      const payload = tail.slice(5).trim()
      if (payload && payload !== '[DONE]') {
        try {
          const obj = JSON.parse(payload) as Record<string, unknown>
          if (!obj['error']) yield obj
        } catch {
          /* ignore */
        }
      }
    }
  } finally {
    try {
      await reader.cancel()
    } catch {
      /* ignore */
    }
  }
}

// =============================================================================
// 适配器(2026-10-23:chat 走 executeChat→本机桥;refresh/quota/健康检查仍直连 openapi)
// =============================================================================

/**
 * chat 总开关(2026-10-23 合并两个独立实现时定的唯一口径):
 * QODER_BRIDGE_ENABLED=0 显式关闭**全部** chat 通路(常驻桥 + CLI),适配器不定义
 * executeChat,转发层落到三件套如实抛 QODER_CHAT_CONTRACT_UNVERIFIED。
 */
const QODER_CHAT_DISABLED = process.env.QODER_BRIDGE_ENABLED?.trim() === '0'

/**
 * 路径 ①:常驻本机桥(SDK 包成 127.0.0.1 的 OpenAI 兼容端点)。
 * 转发层检测到 executeChat 就不会调三件套;桥未就绪时先等一次启动
 * (Electron 冷启动 ~7s),仍失败则如实抛 503,绝不伪造成功。
 */
async function executeChatViaResidentBridge(
  ctx: AdapterAccountContext,
  req: NormalizedChatRequest,
  opts: ChatExecuteOptions,
): Promise<UpstreamChatResult> {
  const ep = getQoderBridgeEndpoint() ?? (await ensureQoderBridge())
  if (!ep) throw new QoderUpstreamError(503, describeQoderBridgeFailure())

  const token = ctx.credentials.token
  if (!token) throw new QoderUpstreamError(401, 'Qoder 账号缺少 device token')

  // jobToken 的 expiresAt 只是 worker 侧本地预检(要求 >= 1e12 毫秒);
  // 真实有效期由上游判定,过期会以 401 回来并触发 refresh —— 缺失时给 1h 占位。
  const expRaw = ctx.row.tokenExpiresAt
  const expiresAt =
    expRaw instanceof Date && Number.isFinite(expRaw.getTime())
      ? expRaw.getTime()
      : Date.now() + 3_600_000

  const doFetch = opts.fetchImpl ?? fetch
  const res = await doFetch(`${ep.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'x-qoder-token-exp': String(expiresAt),
      'x-qoder-bridge-key': ep.key,
      accept: req.stream ? 'text/event-stream' : 'application/json',
    },
    body: JSON.stringify(buildBridgeBody(req)),
    signal: opts.signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new QoderUpstreamError(
      res.status,
      `Qoder 桥 HTTP ${res.status}${text ? `: ${text}` : ''}`,
    )
  }

  if (req.stream === true && res.body) {
    return { stream: parseBridgeSse(res.body) }
  }
  return { completion: (await res.json()) as Record<string, unknown> }
}

export const qoderAdapter: RelayUpstreamAdapter = {
  providerCode: 'qoder',

  // 路径 ① 常驻桥(默认)。QODER_BRIDGE_ENABLED=0 时两条通路都不定义 executeChat。
  ...(QODER_CHAT_DISABLED ? {} : { executeChat: executeChatViaResidentBridge }),

  /** 鉴权失败判据:401/403 交给转发层触发 refresh 后重试 */
  isAuthError(err: unknown): boolean {
    return err instanceof QoderUpstreamError && (err.statusCode === 401 || err.statusCode === 403)
  },

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

  // ── 路径 ②:CLI 桥(显式门控开启时优先于常驻桥;两者都关则 executeChat 不定义,
  //    转发层落到上面三件套如实抛"契约未实证" —— HTTP 直连仍未实证,不改口径)──
  ...(isQoderBridgeEnabled()
    ? {
        /**
         * 对话转发:spawn Qoder 官方 CLI + SDK query() 取流(协议/预检/互斥/杀进程
         * 见 qoder-cli-bridge.ts)。预检失败(未配置/CLI 缺失)在返回流之前抛
         * statusCode 0 ⇒ 转发层按 network 冷却自愈,绝不假成功。
         * opts.proxyUrl/fetchImpl 不适用:CLI 自管网络出口。
         * 非流式(req.stream=false)本地聚合(CLI 只有流,与 trae 同做法)。
         */
        async executeChat(
          _ctx: AdapterAccountContext,
          req: NormalizedChatRequest,
          opts: ChatExecuteOptions,
        ): Promise<UpstreamChatResult> {
          preflightQoderBridge()
          const stream = qoderCliChatChunks({
            prompt: renderQoderPrompt(req),
            model: req.model,
            signal: opts.signal,
          })
          if (req.stream) return { stream }
          let content = ''
          let usage: Record<string, unknown> | null = null
          let finishReason = 'stop'
          let id = ''
          const created = Math.floor(Date.now() / 1000)
          for await (const chunk of stream) {
            if (typeof chunk.id === 'string' && chunk.id !== '') id = chunk.id
            const u = chunk.usage
            if (u !== null && typeof u === 'object') usage = u as Record<string, unknown>
            const choices = chunk.choices
            if (Array.isArray(choices)) {
              for (const raw of choices) {
                const ch = raw as { delta?: Record<string, unknown>; finish_reason?: string | null }
                const deltaContent = ch.delta?.content
                if (typeof deltaContent === 'string') content += deltaContent
                if (typeof ch.finish_reason === 'string' && ch.finish_reason !== '') {
                  finishReason = ch.finish_reason
                }
              }
            }
          }
          return {
            completion: {
              id: id !== '' ? id : 'chatcmpl-qoder',
              object: 'chat.completion',
              created,
              model: req.model,
              choices: [
                { index: 0, message: { role: 'assistant', content }, finish_reason: finishReason },
              ],
              usage: usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            },
          }
        },
      }
    : {}),

  /**
   * token 自刷新:POST {base}/api/v1/deviceToken/refresh,body 带 refresh_token
   * (实证:checkin_qoder.qoder_refresh_token + 2026-10-23 真机回包)。
   * 双 base 回退判据与 _api_call 同:网络错/超时/404 = 端点不对换下一个;
   * 401 等其余非 2xx = 结论,抛错由调度器计数。
   * 2026-10-23 真机实证 200 回包:{device_token(新票opaque), refresh_token(轮转),
   * expires_at(真实ISO,约30天), refresh_token_expires_at} —— 到期真源取响应
   * expires_at;缺该字段才退 JWT exp / 24h 兜底(临期刷新+401自愈双保险)。
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
        // 2026-10-23 真机实证:200 响应形状是
        // {device_token(新票,27字符opaque), refresh_token(轮转新值), token_type:"Bearer",
        //  expires_at(真实ISO到期), refresh_token_expires_at, created_at}
        // —— 不是 token/accessToken(参考实现 checkin_qoder 同样没认这个键,一并修正)
        const token = pickTokenField(body, ['device_token', 'token', 'accessToken', 'access_token'])
        if (!token) throw new QoderUpstreamError(0, 'Qoder refresh 响应无 token')
        const newRt = pickTokenField(body, ['refresh_token', 'refreshToken']) || rt
        // 到期真源优先级:响应 expires_at(真实 ISO)> 新票 JWT exp(没有)> null(未知)。
        // 不许编造兜底时刻:之前给 now+24h,于是"上游没给"和"上游给了"在库里长得一样。
        const expFrom = (b: unknown, keys: readonly string[]): Date | null => {
          const o = b !== null && typeof b === 'object' ? (b as Record<string, unknown>) : {}
          for (const k of keys) {
            const v = o[k]
            if (typeof v === 'string' && v.trim()) {
              const d = new Date(v)
              if (!Number.isNaN(d.getTime())) return d
            }
          }
          return null
        }
        const expiresAt =
          expFrom(body, ['expires_at', 'expiresAt']) ?? extractTokenExpiry(token) ?? null
        return {
          token,
          refreshToken: newRt,
          expiresAt,
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
  ): Promise<{ ok: boolean; error?: string; indeterminate?: boolean; authFailed?: boolean }> {
    try {
      const res = await resolveFetchImpl(opts ?? {})(`${QODER_QUOTA_BASE}${PATH_QUOTA}`, {
        method: 'GET',
        headers: quotaRequestHeaders(ctx),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        // 401 = 上游明确拒收凭据 → down + 收敛到期列;5xx/429 等属未判定,保留 unknown
        const rejected = qoderAdapter.isAuthFailure(res.status, text)
        return {
          ok: false,
          indeterminate: !rejected,
          authFailed: rejected,
          error: `quota HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}${
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
  },

  /**
   * Add-on Credits 余额按需查询(管理面点查,不进轮询)。永不抛,失败归 ok:false。
   * 键序与本仓参考实现 apps/ai-service/app/services/checkin_qoder.py 的
   * qoder_query_credits 同源(data 包裹 → addOnQuota / add_on_quota → remaining)。
   * 线上实证 2026-10-23:号池两枚在册 qoder 号真跑该端点 ⇒ 200 且 remaining 可读(100 与 388)。
   * 仍按防御解析:认不出 remaining ⇒ ok:false「未判定」,不得把解析不出来冒充成余额 0。
   */
  async getQuota(ctx: AdapterAccountContext, opts?: QuotaCallOptions): Promise<RelayQuotaResult> {
    try {
      const res = await resolveFetchImpl(opts ?? {})(`${QODER_QUOTA_BASE}${PATH_QUOTA}`, {
        method: 'GET',
        headers: quotaRequestHeaders(ctx),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return {
          ok: false,
          // 与 isAuthFailure 同源判定(401 = 会话死),供承载层触发自愈
          authFailed: qoderAdapter.isAuthFailure(res.status, text),
          error: `quota HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
        }
      }
      const remaining = extractAddOnRemaining(await res.json().catch(() => null))
      if (remaining === null) {
        return { ok: false, error: 'quota 响应未含 addOnQuota.remaining ⇒ 未判定(不读成零)' }
      }
      return { ok: true, quota: { remaining, unit: 'Qoder credits' } }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  },

  /**
   * 富模型清单(2026-10-27 立;契约见 RelayModelListResult)。
   * 调 listQoderModels(spawn 本机 CLI --list-models),永不抛,失败归 ok:false。
   * ctx 不用于取凭据:CLI 用本机登录态(清单语义 = 本机 CLI 登录态的当前用户,
   * 不是号池账号),scope 字段如实标注;取证:上游无 models HTTP 端点
   * (docs/RELAY_QODER_LISTMODELS_EVIDENCE.md),CLI 是唯一客户端同源通路。
   */
  async listModelsDetailed(
    _ctx: AdapterAccountContext,
    _opts?: ModelListCallOptions,
  ): Promise<RelayModelListResult> {
    try {
      const r = listQoderModels()
      if (!r.ok) return { ok: false, error: r.error }
      const models = [
        ...(r.auto ? [{ name: 'auto' }] : []),
        ...r.official.map((name) => ({ name, id: name })),
        ...r.custom.map((c) => ({ name: c.name, id: c.idPrefix, idTruncated: true as const })),
      ]
      return {
        ok: true,
        scope: r.scope,
        models,
      }
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
      // 蛇形键为正;历史行的驼峰键兼容读取(machine_token / machineToken)
      const camel = mapKey.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase())
      const v = cosyValue(c, [mapKey, camel])
      if (v) headers[header] = v
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

/** 配额端点请求头:健康检查与余额查询共用一份,防两处漂移 */
function quotaRequestHeaders(ctx: AdapterAccountContext): Record<string, string> {
  return {
    accept: 'application/json',
    'user-agent': USER_AGENT,
    authorization: `Bearer ${ctx.credentials.token}`,
    ...buildCosyHeaders(ctx),
  }
}

/**
 * 取 add-on credits 余额(与 checkin_qoder.qoder_query_credits 同键序:
 * 先剥 data 包裹,再认 addOnQuota / add_on_quota 的 remaining 数值)。
 * 认不出 ⇒ null(未判定),绝不回落成 0 —— 0 在面板上读成"积分已耗尽"。
 */
export function extractAddOnRemaining(body: unknown): number | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null
  const o = body as Record<string, unknown>
  const inner =
    o['data'] !== null && typeof o['data'] === 'object' && !Array.isArray(o['data'])
      ? (o['data'] as Record<string, unknown>)
      : o
  const raw = inner['addOnQuota'] ?? inner['add_on_quota']
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const remaining = (raw as Record<string, unknown>)['remaining']
  if (typeof remaining !== 'number' || !Number.isFinite(remaining)) return null
  return Math.trunc(remaining)
}
