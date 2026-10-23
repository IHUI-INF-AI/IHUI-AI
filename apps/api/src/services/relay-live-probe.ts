// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 反代号池「真上游联调探针」实现(2026-10-22 立,env-gated)。
 *
 * 背景:现有单测全部 mock fetch,从未打过真实上游;示例号已全部过期。
 * 本模块提供有真号时逐平台验证连通性的探针:
 *   checkHealth → 最小 chat 非流式往返(1 token)→ 流式 SSE 首包。
 * 无 RELAY_LIVE_PROBE=1 时零影响:模块导入不产生任何网络调用,
 * runLiveProbe 也只读 env 做门控判断。
 *
 * 复用契约:scripts/relay-live-probe.ts(CLI)与 tests/relay-live-probe.test.ts
 * (vitest)都 import 本文件,不复制探针逻辑。
 *
 * 探针只按 RelayUpstreamAdapter 接口契约调用(checkHealth / buildChatRequest /
 * executeChat / translateStreamChunk / translateNonStream / isAuthFailure /
 * classifyUpstreamFailure),不依赖任何适配器内部实现细节:
 * - 定义了 executeChat 的平台(Trae 多段式)→ 直接走 executeChat;
 * - 否则走通用单请求路径 buildChatRequest → fetch → 翻译(与转发层同款分流)。
 *
 * 安全红线:凭证 JSON 只从环境变量读、只在内存里用;探针输出与错误信息
 * 一律不回显 token / AK / SK / DPoP 私钥(上游 body 截断透传,与转发层同口径)。
 */
import type { AiRelayAccountPool } from '@ihui/database'
import {
  getRelayAdapter,
  type AdapterAccountContext,
  type NormalizedChatRequest,
  type RelayUpstreamAdapter,
  type StreamState,
} from './relay-upstream-adapters.js'
import { registerAllRelayAdapters } from './upstream-adapters/index.js'

// =============================================================================
// 环境变量与门控
// =============================================================================

export const PROBE_PROVIDERS = ['trae', 'workbuddy', 'codearts'] as const
export type ProbeProvider = (typeof PROBE_PROVIDERS)[number]

/** 总开关:必须显式 =1 才运行 */
export const PROBE_ENABLE_ENV = 'RELAY_LIVE_PROBE'
/** 每请求超时上限(ms,缺省 20000;假凭据下保证快速失败不挂死) */
export const PROBE_TIMEOUT_ENV = 'RELAY_PROBE_TIMEOUT_MS'
/** 各平台凭据 env(值为凭据 JSON 串;缺该变量的平台跳过并提示) */
export const PROBE_CRED_ENV: Record<ProbeProvider, string> = {
  trae: 'RELAY_PROBE_TRAE_CRED',
  workbuddy: 'RELAY_PROBE_WORKBUDDY_CRED',
  codearts: 'RELAY_PROBE_CODEARTS_CRED',
}

const DEFAULT_TIMEOUT_MS = 20_000

/** Trae 上游支持 model="auto";WorkBuddy/CodeArts 无通用缺省,凭据必须自带 model */
const DEFAULT_MODELS: Record<ProbeProvider, string> = {
  trae: 'auto',
  workbuddy: '',
  codearts: '',
}

export function isProbeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[PROBE_ENABLE_ENV] === '1'
}

export function probeTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env[PROBE_TIMEOUT_ENV])
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS
}

// =============================================================================
// 凭据 JSON → 适配器上下文
// =============================================================================

/**
 * 凭据 JSON 形状(token 必填,其余可选):
 * { token, uid?, name?, refreshToken?, cookies?, secrets?, extraMetadata?, proxyUrl?, model?, tokenExpiresAt? }
 * - Trae: token=Cloud-IDE-JWT;model 缺省 "auto";web 号须带 cookies(含 sessionid)才测得全链路
 * - WorkBuddy: token=access token;extraMetadata.domain 决定 CN/global realm;model 必填
 * - CodeArts: token=security_token;secrets 需 accessKeyId/secretAccessKey/dpopPrivateKeyJwk/
 *   codeVerifier/domainId 等;model 必填(大小写敏感)
 */
export interface ProbeCredential {
  token: string
  uid?: string
  name?: string
  refreshToken?: string | null
  cookies?: Array<Record<string, unknown>>
  secrets?: Record<string, unknown>
  extraMetadata?: Record<string, unknown>
  proxyUrl?: string | null
  model?: string
  tokenExpiresAt?: string
}

export function parseProbeCredential(raw: string, provider: ProbeProvider): ProbeCredential {
  const envName = PROBE_CRED_ENV[provider]
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    throw new Error(`${envName} 不是合法 JSON 凭据串`)
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error(`${envName} 必须是凭据 JSON 对象`)
  }
  const cred = obj as ProbeCredential
  if (typeof cred.token !== 'string' || cred.token.trim() === '') {
    throw new Error(`${envName} 缺少非空 token 字段`)
  }
  return cred
}

/** 凭据 → 最小可用 AdapterAccountContext(row 只填适配器会读的字段) */
export function buildAccountContext(
  provider: ProbeProvider,
  cred: ProbeCredential,
): AdapterAccountContext {
  const row = {
    providerCode: provider,
    uid: typeof cred.uid === 'string' && cred.uid.trim() ? cred.uid.trim() : `probe-${provider}`,
    name: cred.name ?? `live-probe-${provider}`,
    extraMetadata: cred.extraMetadata ?? {},
    proxyUrl: cred.proxyUrl ?? null,
    tokenExpiresAt: cred.tokenExpiresAt ? new Date(cred.tokenExpiresAt) : null,
  } as unknown as AiRelayAccountPool
  return {
    row,
    credentials: {
      token: cred.token.trim(),
      refreshToken: cred.refreshToken ?? null,
      // web 号(cookie 换票)必须带上 cookies,否则测不到续票/带 cookie 的转发全链路
      cookies: Array.isArray(cred.cookies)
        ? cred.cookies.filter((c) => c && typeof c === 'object')
        : [],
      secrets: cred.secrets ?? {},
    },
  }
}

function resolveProbeModel(provider: ProbeProvider, cred: ProbeCredential): string {
  const m = typeof cred.model === 'string' ? cred.model.trim() : ''
  if (m) return m
  const d = DEFAULT_MODELS[provider]
  if (d) return d
  throw new Error(
    `${PROBE_CRED_ENV[provider]} 凭据缺少 model(${provider} 探针必须指定探测用模型 id)`,
  )
}

// =============================================================================
// 结果类型
// =============================================================================

export type ProbeStepStatus = 'pass' | 'fail' | 'skip'

/** 探针步骤的错误分类:适配器富分类 + 探针自身的 timeout/network/parse/empty */
export type ProbeFailureKind =
  | 'auth'
  | 'credit'
  | 'session_dead'
  | 'risk'
  | 'rate'
  | 'not_found'
  | 'request'
  | 'server'
  | 'client'
  | 'network'
  | 'timeout'
  | 'parse'
  | 'empty'
  | 'none'

export interface ProbeStepOutcome {
  status: ProbeStepStatus
  ms: number
  kind: ProbeFailureKind
  error?: string
  detail?: string
}

export interface ProbeResult {
  provider: ProbeProvider
  credEnv: string
  note?: string
  health: ProbeStepOutcome
  nonStream: ProbeStepOutcome
  stream: ProbeStepOutcome
  overall: ProbeStepStatus
}

export interface ProbeReport {
  enabled: boolean
  timeoutMs: number
  results: ProbeResult[]
}

export interface ProbeOptions {
  timeoutMs?: number
}

function passStep(ms: number, detail?: string): ProbeStepOutcome {
  return { status: 'pass', ms, kind: 'none', detail }
}
function failStep(ms: number, kind: ProbeFailureKind, error: string): ProbeStepOutcome {
  return { status: 'fail', ms, kind, error }
}
function skipStep(detail: string): ProbeStepOutcome {
  return { status: 'skip', ms: 0, kind: 'none', detail }
}

function skipResult(provider: ProbeProvider, note: string): ProbeResult {
  return {
    provider,
    credEnv: PROBE_CRED_ENV[provider],
    note,
    health: skipStep(note),
    nonStream: skipStep(note),
    stream: skipStep(note),
    overall: 'skip',
  }
}

// =============================================================================
// 错误与超时
// =============================================================================

class ProbeTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProbeTimeoutError'
  }
}

/** 带分类的探针业务失败(HTTP 非 2xx / 空结果 / 解析失败等) */
class ProbeFailError extends Error {
  readonly kind: ProbeFailureKind
  constructor(kind: ProbeFailureKind, message: string) {
    super(message)
    this.name = 'ProbeFailError'
    this.kind = kind
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ProbeTimeoutError(`${label} 超时(>${ms}ms)`)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function errorToStep(ms: number, err: unknown, adapter?: RelayUpstreamAdapter): ProbeStepOutcome {
  if (err instanceof ProbeFailError) return failStep(ms, err.kind, err.message)
  if (err instanceof ProbeTimeoutError) return failStep(ms, 'timeout', err.message)
  const name = (err as { name?: unknown })?.name
  if (name === 'AbortError') return failStep(ms, 'timeout', '请求被超时中止(AbortError)')
  const msg = err instanceof Error ? err.message : String(err)
  // executeChat 路径抛出的鉴权异常(Trae 等)按契约 isAuthError 归入 auth,而非笼统 network
  if (adapter?.isAuthError?.(err)) return failStep(ms, 'auth', msg.slice(0, 300))
  return failStep(ms, 'network', msg.slice(0, 300))
}

/** HTTP 失败分类:优先适配器富分类 → isAuthFailure → 状态码粗分(同转发层回退口径) */
function classifyHttpFailure(
  adapter: RelayUpstreamAdapter,
  status: number,
  bodyText: string,
): ProbeFailureKind {
  const rich = adapter.classifyUpstreamFailure?.(status, bodyText)
  if (rich) return rich.kind
  if (adapter.isAuthFailure(status, bodyText)) return 'auth'
  if (status === 404) return 'not_found'
  if (status === 429) return 'rate'
  if (status >= 500) return 'server'
  return 'client'
}

/** checkHealth 无状态码可分类:按错误文案做最小启发(auth 类走自愈语义,其余 server) */
function classifyHealthErrorText(text: string): ProbeFailureKind {
  return /401|403|unauthor|authentication|鉴权|token/i.test(text) ? 'auth' : 'server'
}

// =============================================================================
// SSE 行读取(探针自带最小实现,语义对齐转发层 readSseDataLines)
// =============================================================================

async function* readSseDataLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).replace(/\r$/, '')
        buffer = buffer.slice(nl + 1)
        if (line.trimStart().startsWith('data:')) yield line
      }
    }
    buffer += decoder.decode()
    const tail = buffer.replace(/\r$/, '').trimStart()
    if (tail.startsWith('data:')) yield tail
  } finally {
    reader.releaseLock()
  }
}

// =============================================================================
// 结果摘要(不回显任何凭证)
// =============================================================================

function firstChoice(chunk: Record<string, unknown>): Record<string, unknown> | null {
  const choices = Array.isArray(chunk.choices) ? chunk.choices : []
  const first = choices[0]
  return first && typeof first === 'object' && !Array.isArray(first)
    ? (first as Record<string, unknown>)
    : null
}

function chunkPreview(chunk: Record<string, unknown>): string {
  const choice = firstChoice(chunk)
  const delta =
    choice && typeof choice.delta === 'object' && choice.delta !== null
      ? (choice.delta as Record<string, unknown>)
      : null
  const content = typeof delta?.content === 'string' ? delta.content : ''
  const reasoning = typeof delta?.reasoning_content === 'string' ? delta.reasoning_content : ''
  const finish = typeof choice?.finish_reason === 'string' ? choice.finish_reason : ''
  const parts: string[] = []
  const text = content || reasoning
  if (text) parts.push(`content="${text.slice(0, 60)}"`)
  if (finish) parts.push(`finish=${finish}`)
  if (chunk.usage && typeof chunk.usage === 'object') parts.push('usage=有')
  return parts.join(' ') || '(无增量首帧)'
}

function completionPreview(completion: Record<string, unknown>): string {
  const choice = firstChoice(completion)
  const message =
    choice && typeof choice.message === 'object' && choice.message !== null
      ? (choice.message as Record<string, unknown>)
      : null
  const content = typeof message?.content === 'string' ? message.content : ''
  const finish = typeof choice?.finish_reason === 'string' ? choice.finish_reason : ''
  const hasToolCalls = Array.isArray(message?.tool_calls) && message.tool_calls.length > 0
  const parts: string[] = []
  if (content) parts.push(`content="${content.slice(0, 60)}"`)
  if (hasToolCalls) parts.push('tool_calls=有')
  if (finish) parts.push(`finish=${finish}`)
  if (completion.usage && typeof completion.usage === 'object') parts.push('usage=有')
  return parts.join(' ') || '(空 completion)'
}

// =============================================================================
// 单平台探针
// =============================================================================

function makeProbeRequest(model: string, stream: boolean): NormalizedChatRequest {
  return {
    model,
    messages: [{ role: 'user', content: 'ping' }],
    stream,
    maxTokens: 1,
  }
}

/** 通用单请求路径(WorkBuddy/CodeArts):buildChatRequest → fetch → 翻译 */
async function chatViaSingleRequest(
  adapter: RelayUpstreamAdapter,
  ctx: AdapterAccountContext,
  model: string,
  stream: boolean,
  timeoutMs: number,
): Promise<string> {
  const httpReq = adapter.buildChatRequest(ctx, makeProbeRequest(model, stream))
  const res = await globalThis.fetch(httpReq.url, {
    method: httpReq.method,
    headers: httpReq.headers,
    body:
      httpReq.rawBody ?? (httpReq.body !== undefined ? JSON.stringify(httpReq.body) : undefined),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new ProbeFailError(
      classifyHttpFailure(adapter, res.status, text),
      `上游 HTTP ${res.status}: ${text.slice(0, 200) || '(空响应体)'}`,
    )
  }
  const ct = res.headers.get('content-type') ?? ''

  if (stream) {
    if (!res.body) throw new ProbeFailError('empty', '流式响应无 body')
    const state: StreamState = {}
    let preview = ''
    try {
      for await (const line of readSseDataLines(res.body)) {
        if (line.includes('[DONE]')) break
        const translated = adapter.translateStreamChunk(ctx, line, state)
        if (!translated) continue
        preview = chunkPreview(translated.openaiChunk)
        break
      }
    } finally {
      await res.body.cancel().catch(() => {})
    }
    if (!preview) throw new ProbeFailError('empty', 'SSE 流未产生任何可翻译帧')
    return `首帧 ${preview}`
  }

  // 非流式:上游强制流式(WorkBuddy)时聚合到首个有结论的帧即可
  if (ct.includes('text/event-stream')) {
    if (!res.body) throw new ProbeFailError('empty', '流式响应无 body')
    const state: StreamState = {}
    let content = ''
    let finish = ''
    try {
      for await (const line of readSseDataLines(res.body)) {
        if (line.includes('[DONE]')) break
        const translated = adapter.translateStreamChunk(ctx, line, state)
        if (!translated) continue
        const choice = firstChoice(translated.openaiChunk)
        const delta =
          choice && typeof choice.delta === 'object' && choice.delta !== null
            ? (choice.delta as Record<string, unknown>)
            : null
        if (typeof delta?.content === 'string') content += delta.content
        if (typeof choice?.finish_reason === 'string' && choice.finish_reason)
          finish = choice.finish_reason
        if (translated.done || finish) break
      }
    } finally {
      await res.body.cancel().catch(() => {})
    }
    if (!content && !finish) throw new ProbeFailError('empty', '强制流式响应未聚合出内容')
    return `聚合(SSE→completion) content="${content.slice(0, 60)}"${finish ? ` finish=${finish}` : ''}`
  }

  let json: unknown
  try {
    json = await res.json()
  } catch (err) {
    throw new ProbeFailError(
      'parse',
      `上游 JSON 解析失败: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  return completionPreview(adapter.translateNonStream(ctx, json))
}

/** 多段式路径(Trae):executeChat 整体执行 */
async function chatViaExecuteChat(
  adapter: RelayUpstreamAdapter,
  ctx: AdapterAccountContext,
  model: string,
  stream: boolean,
  timeoutMs: number,
): Promise<string> {
  const executeChat = adapter.executeChat
  if (!executeChat) throw new ProbeFailError('server', '适配器未实现 executeChat')
  const result = await executeChat.call(adapter, ctx, makeProbeRequest(model, stream), {
    signal: AbortSignal.timeout(timeoutMs),
    proxyUrl: ctx.row.proxyUrl,
  })
  if (stream) {
    if (!result.stream) throw new ProbeFailError('empty', 'executeChat 未返回流式序列')
    let preview = ''
    for await (const chunk of result.stream) {
      preview = chunkPreview(chunk)
      break // for-await 提前 break 会触发 generator.return → 适配器收尾(如 Trae stop)
    }
    if (!preview) throw new ProbeFailError('empty', '流式序列未产生任何 chunk')
    return `首帧 ${preview}`
  }
  if (!result.completion) throw new ProbeFailError('empty', 'executeChat 未返回 completion')
  return completionPreview(result.completion)
}

async function probeChat(
  adapter: RelayUpstreamAdapter,
  ctx: AdapterAccountContext,
  model: string,
  stream: boolean,
  timeoutMs: number,
): Promise<ProbeStepOutcome> {
  const t0 = Date.now()
  const label = stream ? '流式 SSE 首包' : '非流式 chat'
  try {
    const detail = await withTimeout(
      adapter.executeChat
        ? chatViaExecuteChat(adapter, ctx, model, stream, timeoutMs)
        : chatViaSingleRequest(adapter, ctx, model, stream, timeoutMs),
      timeoutMs + 5_000, // 兜底:覆盖收尾(如 Trae stop)不受 signal 约束的等待
      label,
    )
    return passStep(Date.now() - t0, detail)
  } catch (err) {
    return errorToStep(Date.now() - t0, err, adapter)
  }
}

async function probeHealth(
  adapter: RelayUpstreamAdapter,
  ctx: AdapterAccountContext,
  timeoutMs: number,
): Promise<ProbeStepOutcome> {
  const t0 = Date.now()
  try {
    // checkHealth 契约无 signal:用超时竞速兜底,探针本身不挂死
    const res = await withTimeout(
      adapter.checkHealth(ctx, { proxyUrl: ctx.row.proxyUrl }),
      timeoutMs,
      '健康检查',
    )
    const ms = Date.now() - t0
    if (!res.ok) {
      // 未判定(上游 5xx/网络)不等于凭据失效:探针标 skip,不判 fail
      if (res.indeterminate === true) {
        return skipStep(`健康检查未判定(上游取不到): ${res.error ?? '无判定依据'}`)
      }
      return failStep(ms, classifyHealthErrorText(res.error ?? ''), res.error ?? '健康检查失败')
    }
    return passStep(ms)
  } catch (err) {
    return errorToStep(Date.now() - t0, err)
  }
}

/** 对单平台执行完整探针(健康 → 非流式 → 流式);任何一步失败不中断后续诊断 */
export async function probeProvider(
  provider: ProbeProvider,
  cred: ProbeCredential,
  opts: ProbeOptions = {},
): Promise<ProbeResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  registerAllRelayAdapters()
  const base: ProbeResult = {
    provider,
    credEnv: PROBE_CRED_ENV[provider],
    health: skipStep('未执行'),
    nonStream: skipStep('未执行'),
    stream: skipStep('未执行'),
    overall: 'fail',
  }
  const adapter = getRelayAdapter(provider)
  if (!adapter) {
    const step = failStep(0, 'server', `适配器 ${provider} 未注册`)
    return { ...base, health: step, nonStream: step, stream: step }
  }
  let ctx: AdapterAccountContext
  let model: string
  try {
    ctx = buildAccountContext(provider, cred)
    model = resolveProbeModel(provider, cred)
  } catch (err) {
    const step = failStep(0, 'request', err instanceof Error ? err.message : String(err))
    return { ...base, health: step, nonStream: step, stream: step }
  }
  const health = await probeHealth(adapter, ctx, timeoutMs)
  const nonStream = await probeChat(adapter, ctx, model, false, timeoutMs)
  const stream = await probeChat(adapter, ctx, model, true, timeoutMs)
  const overall: ProbeStepStatus = [health, nonStream, stream].every((s) => s.status !== 'fail')
    ? 'pass'
    : 'fail'
  return { provider, credEnv: PROBE_CRED_ENV[provider], health, nonStream, stream, overall }
}

// =============================================================================
// 全平台编排
// =============================================================================

/**
 * 读 env 编排全平台探针。未开启 RELAY_LIVE_PROBE=1 → 直接返回空报告(零网络)。
 * 缺凭据 env 的平台标记 skip 并在报告中提示。
 */
export async function runLiveProbe(
  env: NodeJS.ProcessEnv = process.env,
  opts: ProbeOptions = {},
): Promise<ProbeReport> {
  const timeoutMs = opts.timeoutMs ?? probeTimeoutMs(env)
  if (!isProbeEnabled(env)) return { enabled: false, timeoutMs, results: [] }
  const results: ProbeResult[] = []
  for (const provider of PROBE_PROVIDERS) {
    const raw = env[PROBE_CRED_ENV[provider]]
    if (!raw) {
      results.push(skipResult(provider, `未设置 ${PROBE_CRED_ENV[provider]},跳过`))
      continue
    }
    try {
      const cred = parseProbeCredential(raw, provider)
      results.push(await probeProvider(provider, cred, { timeoutMs }))
    } catch (err) {
      const step = failStep(0, 'request', err instanceof Error ? err.message : String(err))
      results.push({
        provider,
        credEnv: PROBE_CRED_ENV[provider],
        health: step,
        nonStream: step,
        stream: step,
        overall: 'fail',
      })
    }
  }
  return { enabled: true, timeoutMs, results }
}

// =============================================================================
// 报告输出(纯函数,便于测试)
// =============================================================================

function stepCell(s: ProbeStepOutcome): string {
  if (s.status === 'skip') return 'SKIP'
  return `${s.status.toUpperCase()}(${s.ms}ms)`
}

function firstProblem(result: ProbeResult): ProbeStepOutcome | null {
  for (const s of [result.health, result.nonStream, result.stream]) {
    if (s.status === 'fail') return s
  }
  return null
}

function oneLine(text: string, max = 100): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

export function formatProbeReport(report: ProbeReport): string {
  const lines: string[] = []
  lines.push('== 反代号池真上游联调探针(relay-live-probe)==')
  lines.push(
    `探针开关: ${report.enabled ? '已开启' : '未开启'} | 每请求超时: ${report.timeoutMs}ms`,
  )
  if (!report.enabled) {
    lines.push(
      `提示: 设置 ${PROBE_ENABLE_ENV}=1 并按平台设置 ${Object.values(PROBE_CRED_ENV).join(' / ')} 后重试。`,
    )
    return lines.join('\n')
  }
  const header = ['平台', '健康', '非流式', '流式', '错误分类', '说明'].map((h) => h.padEnd(12))
  lines.push(header.join(' | ').trimEnd())
  lines.push('-'.repeat(96))
  let passed = 0
  let failed = 0
  let skipped = 0
  for (const r of report.results) {
    if (r.overall === 'skip') skipped += 1
    else if (r.overall === 'pass') passed += 1
    else failed += 1
    const problem = firstProblem(r)
    const note =
      r.note ?? problem?.error ?? r.nonStream.detail ?? r.stream.detail ?? r.health.detail ?? ''
    const cells = [
      r.provider.padEnd(12),
      stepCell(r.health).padEnd(12),
      stepCell(r.nonStream).padEnd(12),
      stepCell(r.stream).padEnd(12),
      (problem ? problem.kind : r.overall === 'skip' ? '-' : 'none').padEnd(12),
      oneLine(note),
    ]
    lines.push(cells.join(' | ').trimEnd())
  }
  lines.push('-'.repeat(96))
  lines.push(`总体: ${passed} 平台通过 / ${failed} 失败 / ${skipped} 跳过(缺凭据)`)
  if (skipped > 0) {
    lines.push(
      `跳过的平台凭据 env: ${report.results
        .filter((r) => r.overall === 'skip')
        .map((r) => r.credEnv)
        .join(', ')}`,
    )
  }
  return lines.join('\n')
}

/** 退出码:任一执行平台失败 → 1;全通过或全跳过/未开启 → 0 */
export function probeExitCode(report: ProbeReport): number {
  if (!report.enabled) return 0
  return report.results.some((r) => r.overall === 'fail') ? 1 : 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
