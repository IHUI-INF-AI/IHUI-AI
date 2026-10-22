// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 第三方 AI IDE 账号池转发器(2026-10-22 立,对标码道网关 CodeArtsGateway)。
 *
 * 定位:/v1 公开链路在「渠道 key 池无候选」时回落到账号池(trae/workbuddy/codearts),
 * 由 relay-upstream-forwarder.forwardToChannel 在 candidates.length===0 处调用。
 * 返回形状与渠道路径完全一致(ForwardResult),v1-public 消费端零改动。
 *
 * 设计(对标 + 超越码道):
 * - 模型→平台反查:join ai_model_config(_models),providerCode ∈ RELAY_PROVIDERS 且启用;60s 进程缓存
 * - 选号:priority asc → weight desc → lastUsedAt asc(未用优先),跳过进程冷却中的号;上限 3 号 failover
 * - 会话亲和:affinityKey(apiKeyId)+model → 同账号,10 分钟 TTL(Trae 多轮上下文连续性靠它)
 * - 双执行路径:适配器定义 executeChat(多段式协议,如 Trae remote 两步会话)直接整体执行;
 *   否则走通用单请求路径 buildChatRequest → fetch → translateStreamChunk/translateNonStream
 * - 401 自愈:鉴权失败 → 适配器 refreshToken → 回写号池 → 重试一次(对标码道 token 自动续期)
 * - 熔断分层(超越码道的单一冷却):
 *   · 进程级:连续 3 败 → 60s 冷却;rate → 60s;credit → 12h;session_dead → 永久摘除(tempUnschedulable)
 *   · 请求级错误(参数非法/超长/审核)不罚号(直接透传失败,不计数不冷却)
 * - 出口代理:行.proxyUrl → undici ProxyAgent(按 URL 缓存连接池,每号独立出口 IP 降风控)
 * - 流式:上游 SSE 帧逐帧 adapter.translateStreamChunk → OpenAI chunk 重封装 + [DONE];
 *   executeChat 的 chunk 序列合成同款 SSE Response,pipeChannelStream 原样消费
 * - 非流式:上游若强制流式(WorkBuddy),按 content-type 自动聚合 SSE → chat.completion
 *
 * 永不抛错:一切异常折叠为 ForwardFailure/null,调用方继续回退 ai-service(双通道韧性)。
 */
import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import {
  aiModelConfig,
  aiModelConfigModels,
  aiRelayAccountPool,
  type AiRelayAccountPool,
} from '@ihui/database'
import { db, dbRead } from '../db/index.js'
import { encryptField } from '../utils/crypto.js'
import { startStopwatch } from '../utils/elapsed-ms.js'
import {
  decryptAccountCredentials,
  isRelayProviderCode,
  type RelayProviderCode,
} from './relay-account-pool-service.js'
import {
  getRelayAdapter,
  type AdapterAccountContext,
  type NormalizedChatRequest,
  type RelayUpstreamAdapter,
  type StreamState,
} from './relay-upstream-adapters.js'
import type { SelectedChannelKey } from './relay-channel-router.js'
import type { ForwardResult, UpstreamForwardRequest } from './relay-upstream-forwarder.js'

// =============================================================================
// 常量与进程内状态
// =============================================================================

const MAX_ACCOUNT_CANDIDATES = 3
/** 进程级熔断:连续失败阈值 / 冷却时长 */
const BREAKER_FAILURES = 3
const BREAKER_COOLDOWN_MS = 60_000
/** 积分耗尽:12h 冷却(对标 workbuddy CoolHard) */
const CREDIT_COOLDOWN_MS = 12 * 60 * 60 * 1000
/** 上游限流:60s 软冷却(对标 workbuddy CoolSoft) */
const RATE_COOLDOWN_MS = 60_000
/** 会话亲和 TTL */
const AFFINITY_TTL_MS = 10 * 60 * 1000
/** 模型→平台反查缓存 TTL */
const PROVIDER_CACHE_TTL_MS = 60_000

type FailureKind =
  | 'auth'
  | 'credit'
  | 'session_dead'
  | 'rate'
  | 'not_found'
  | 'request'
  | 'server'
  | 'client'
  | 'network'

interface BreakerEntry {
  failures: number
  cooldownUntil: number
}

/** 账号级进程熔断表(账号数量有限,不做 LRU) */
const breaker = new Map<string, BreakerEntry>()
/** 会话亲和表:key = affinityKey|model */
const affinity = new Map<string, { accountId: string; expiresAt: number }>()
/** 模型→可用平台反查缓存 */
const providerCache = new Map<
  string,
  { providers: Array<{ providerCode: RelayProviderCode; configId: number }>; expiresAt: number }
>()
/** proxyUrl → ProxyAgent(连接池复用) */
const proxyAgents = new Map<string, ProxyAgent>()

function getProxyAgent(proxyUrl: string): ProxyAgent {
  let agent = proxyAgents.get(proxyUrl)
  if (!agent) {
    agent = new ProxyAgent(proxyUrl)
    proxyAgents.set(proxyUrl, agent)
  }
  return agent
}

/** 账号级 fetch:有 proxyUrl 走 undici ProxyAgent,否则全局直连 */
function poolFetch(proxyUrl: string | null | undefined): typeof fetch {
  if (!proxyUrl) return globalThis.fetch.bind(globalThis)
  const agent = getProxyAgent(proxyUrl)
  const f: typeof fetch = (input, init) =>
    // undici 的 RequestInit 是全局 RequestInit 的超集(dispatcher 为附加可选字段)
    undiciFetch(input as string, {
      ...(init ?? {}),
      dispatcher: agent,
    }) as unknown as Promise<Response>
  return f
}

// =============================================================================
// 模型 → 平台反查
// =============================================================================

async function resolvePoolProviders(
  rawModel: string,
): Promise<Array<{ providerCode: RelayProviderCode; configId: number }>> {
  const cached = providerCache.get(rawModel)
  if (cached && cached.expiresAt > Date.now()) return cached.providers
  let providers: Array<{ providerCode: RelayProviderCode; configId: number }> = []
  try {
    const rows = await dbRead
      .select({
        providerCode: aiModelConfig.providerCode,
        configId: sql<number>`min(${aiModelConfig.id})`,
      })
      .from(aiModelConfig)
      .innerJoin(aiModelConfigModels, eq(aiModelConfigModels.configId, aiModelConfig.id))
      .where(
        and(
          eq(aiModelConfig.enabled, true),
          eq(aiModelConfigModels.modelId, rawModel),
          or(isNull(aiModelConfigModels.enabled), eq(aiModelConfigModels.enabled, true)),
        ),
      )
      .groupBy(aiModelConfig.providerCode)
    providers = rows.flatMap((r) =>
      isRelayProviderCode(r.providerCode)
        ? [{ providerCode: r.providerCode, configId: Number(r.configId) }]
        : [],
    )
  } catch {
    providers = []
  }
  providerCache.set(rawModel, { providers, expiresAt: Date.now() + PROVIDER_CACHE_TTL_MS })
  return providers
}

// =============================================================================
// 选号(候选过滤 + 排序 + 亲和)
// =============================================================================

function affinityKeyOf(req: UpstreamForwardRequest, rawModel: string): string | null {
  const base = req.affinityKey ?? req.userId
  return base ? `${base}|${rawModel}` : null
}

async function selectAccountCandidates(
  req: UpstreamForwardRequest,
  rawModel: string,
  providerCodes: RelayProviderCode[],
): Promise<AiRelayAccountPool[]> {
  const rows = await dbRead
    .select()
    .from(aiRelayAccountPool)
    .where(
      and(
        inArray(aiRelayAccountPool.providerCode, providerCodes),
        eq(aiRelayAccountPool.isEnabled, true),
        eq(aiRelayAccountPool.tempUnschedulable, false),
      ),
    )
    .orderBy(asc(aiRelayAccountPool.priority), desc(aiRelayAccountPool.weight))

  const now = Date.now()
  const usable = rows.filter((r) => {
    const b = breaker.get(r.id)
    return !b || b.cooldownUntil <= now
  })
  // 同优先级同权重:最久未用优先(null = 从未用过,排最前)
  usable.sort(
    (a, b) =>
      a.priority - b.priority ||
      b.weight - a.weight ||
      (a.lastUsedAt?.getTime() ?? 0) - (b.lastUsedAt?.getTime() ?? 0),
  )

  // 亲和命中且仍可用 → 置顶(多轮上下文连续;失效则自然 failover 到下一候选)
  const aKey = affinityKeyOf(req, rawModel)
  if (aKey) {
    const hit = affinity.get(aKey)
    if (hit && hit.expiresAt > now) {
      const idx = usable.findIndex((r) => r.id === hit.accountId)
      if (idx > 0) {
        const row = usable[idx]
        if (row) {
          usable.splice(idx, 1)
          usable.unshift(row)
        }
      }
    } else if (hit) {
      affinity.delete(aKey)
    }
  }
  return usable.slice(0, MAX_ACCOUNT_CANDIDATES)
}

// =============================================================================
// 结果记录(熔断 + 亲和 + DB 计数)
// =============================================================================

function recordSuccess(
  row: AiRelayAccountPool,
  req: UpstreamForwardRequest,
  rawModel: string,
): void {
  breaker.delete(row.id)
  const aKey = affinityKeyOf(req, rawModel)
  if (aKey) affinity.set(aKey, { accountId: row.id, expiresAt: Date.now() + AFFINITY_TTL_MS })
  void db
    .update(aiRelayAccountPool)
    .set({
      consecutiveFailures: 0,
      healthStatus: 'healthy',
      lastUsedAt: new Date(),
      totalCalls: sql`${aiRelayAccountPool.totalCalls} + 1`,
      lastErrorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(aiRelayAccountPool.id, row.id))
    .catch(() => {})
}

function recordFailure(row: AiRelayAccountPool, kind: FailureKind, reason: string): void {
  // 请求级错误(参数非法/超长/审核拦截):不罚号
  if (kind === 'request') return
  const now = Date.now()
  const entry = breaker.get(row.id) ?? { failures: 0, cooldownUntil: 0 }
  if (kind === 'not_found') {
    // 上游偶发 404 抖动:短冷却但不累计错误(防雪崩,对标 workbuddy ErrNotFound)
    entry.cooldownUntil = now + RATE_COOLDOWN_MS
  } else {
    entry.failures += 1
    if (kind === 'credit') entry.cooldownUntil = now + CREDIT_COOLDOWN_MS
    else if (kind === 'rate') entry.cooldownUntil = now + RATE_COOLDOWN_MS
    else if (entry.failures >= BREAKER_FAILURES) entry.cooldownUntil = now + BREAKER_COOLDOWN_MS
  }
  breaker.set(row.id, entry)

  const set: Record<string, unknown> = {
    consecutiveFailures: sql`${aiRelayAccountPool.consecutiveFailures} + 1`,
    lastErrorMessage: reason.slice(0, 500),
    updatedAt: new Date(),
  }
  if (kind === 'session_dead') {
    // 会话彻底失效(如需人工重登):永久摘除,等 admin/重新导入恢复
    set.tempUnschedulable = true
    set.healthStatus = 'down'
  } else if (kind === 'credit') {
    set.tempUnschedulable = true
    set.healthStatus = 'degraded'
  }
  void db
    .update(aiRelayAccountPool)
    .set(set)
    .where(eq(aiRelayAccountPool.id, row.id))
    .catch(() => {})
}

// =============================================================================
// 错误分类
// =============================================================================

/** 适配器可选实现的富分类接口(结构化类型,不进共享接口文件) */
interface FailureClassifiable {
  classifyUpstreamFailure?(status: number, bodyText: string): { kind: FailureKind }
}

function classifyFailure(
  adapter: RelayUpstreamAdapter,
  status: number,
  bodyText: string,
): FailureKind {
  const rich = (adapter as RelayUpstreamAdapter & FailureClassifiable).classifyUpstreamFailure
  if (rich) {
    try {
      return rich.call(adapter, status, bodyText).kind
    } catch {
      /* 富分类异常 → 回落基础分类 */
    }
  }
  if (adapter.isAuthFailure(status, bodyText)) return 'auth'
  if (status === 429) return 'rate'
  if (status >= 500) return 'server'
  return 'client'
}

// =============================================================================
// 401 自愈刷新
// =============================================================================

/** 刷新单账号凭证并回写号池;返回合并后的新行(供就地重试),失败返回 null */
async function refreshRowInPlace(
  row: AiRelayAccountPool,
  adapter: RelayUpstreamAdapter,
): Promise<AiRelayAccountPool | null> {
  if (!adapter.refreshToken) return null
  try {
    const credentials = decryptAccountCredentials(row)
    const result = await adapter.refreshToken({ row, credentials }, { proxyUrl: row.proxyUrl })
    if (!result) return null
    const now = new Date()
    const tokenEnc = encryptField(result.token)
    const refreshTokenEnc =
      result.refreshToken !== undefined && result.refreshToken !== null
        ? encryptField(result.refreshToken)
        : row.refreshTokenEnc
    await db
      .update(aiRelayAccountPool)
      .set({
        tokenEnc,
        refreshTokenEnc,
        tokenExpiresAt: result.expiresAt,
        lastRefreshAt: now,
        refreshFailureCount: 0,
        updatedAt: now,
      })
      .where(eq(aiRelayAccountPool.id, row.id))
      .catch(() => {})
    return {
      ...row,
      tokenEnc,
      refreshTokenEnc,
      tokenExpiresAt: result.expiresAt,
      lastRefreshAt: now,
    }
  } catch {
    return null
  }
}

// =============================================================================
// SSE 工具:帧行读取 / OpenAI 流合成 Response / 聚合
// =============================================================================

/** 按行迭代上游 SSE 的 data: 行(跨 chunk 缓冲;\r 归一) */
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

function sseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  }
}

/** executeChat 的 OpenAI chunk 序列 → 标准 SSE Response(供 pipeChannelStream 原样消费) */
function chunksToSseResponse(stream: AsyncIterable<Record<string, unknown>>): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        controller.error(err)
        return
      }
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: sseHeaders() })
}

/** 上游 SSE → 逐帧 translateStreamChunk → OpenAI SSE(WorkBuddy 类透传平台零损耗) */
function translateSseResponse(
  upstream: ReadableStream<Uint8Array>,
  adapter: RelayUpstreamAdapter,
  ctx: AdapterAccountContext,
): Response {
  const encoder = new TextEncoder()
  const state: StreamState = {}
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const line of readSseDataLines(upstream)) {
          if (line.includes('[DONE]')) break
          const translated = adapter.translateStreamChunk(ctx, line, state)
          if (!translated) continue
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(translated.openaiChunk)}\n\n`))
          if (translated.done) break
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        controller.error(err)
        return
      }
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: sseHeaders() })
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

/** 上游强制流式时的网关侧聚合:SSE 帧 → chat.completion(delta/tool_calls/usage 合并) */
async function aggregateSseToCompletion(
  upstream: ReadableStream<Uint8Array>,
  adapter: RelayUpstreamAdapter,
  ctx: AdapterAccountContext,
  model: string,
): Promise<Record<string, unknown>> {
  const state: StreamState = {}
  let id = ''
  let created = Math.floor(Date.now() / 1000)
  let content = ''
  let reasoning = ''
  let finishReason: string | null = null
  let usage: Record<string, unknown> | null = null
  interface Slot {
    id?: string
    type?: string
    name?: string
    args: string
  }
  const toolSlots = new Map<number, Slot>()

  for await (const line of readSseDataLines(upstream)) {
    if (line.includes('[DONE]')) break
    const translated = adapter.translateStreamChunk(ctx, line, state)
    if (!translated) continue
    const chunk = translated.openaiChunk
    if (typeof chunk.id === 'string' && !id) id = chunk.id
    if (typeof chunk.created === 'number') created = chunk.created
    const u = asRecord(chunk.usage)
    if (u) usage = u
    const choices = Array.isArray(chunk.choices) ? chunk.choices : []
    const first = asRecord(choices[0])
    if (!first) continue
    if (typeof first.finish_reason === 'string' && first.finish_reason)
      finishReason = first.finish_reason
    const delta = asRecord(first.delta) ?? asRecord(first.message)
    if (!delta) continue
    if (typeof delta.content === 'string') content += delta.content
    if (typeof delta.reasoning_content === 'string') reasoning += delta.reasoning_content
    const tcs = Array.isArray(delta.tool_calls) ? delta.tool_calls : []
    for (let i = 0; i < tcs.length; i++) {
      const tc = asRecord(tcs[i])
      if (!tc) continue
      const idx = typeof tc.index === 'number' ? tc.index : i
      const slot = toolSlots.get(idx) ?? { args: '' }
      if (typeof tc.id === 'string') slot.id = tc.id
      if (typeof tc.type === 'string') slot.type = tc.type
      const fn = asRecord(tc.function)
      if (fn) {
        if (typeof fn.name === 'string') slot.name = fn.name
        if (typeof fn.arguments === 'string') slot.args += fn.arguments
      }
      toolSlots.set(idx, slot)
    }
    if (translated?.done) break
  }

  const message: Record<string, unknown> = { role: 'assistant', content }
  if (reasoning) message.reasoning_content = reasoning
  if (toolSlots.size > 0) {
    message.tool_calls = [...toolSlots.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([idx, s]) => ({
        index: idx,
        id: s.id ?? `call_${randomUUID().slice(0, 8)}`,
        type: s.type ?? 'function',
        function: { name: s.name ?? '', arguments: s.args },
      }))
  }
  const completion: Record<string, unknown> = {
    id: id || `chatcmpl-${randomUUID()}`,
    object: 'chat.completion',
    created,
    model,
    choices: [{ index: 0, message, finish_reason: finishReason ?? 'stop' }],
  }
  if (usage) completion.usage = usage
  return completion
}

async function safeText(resp: Response): Promise<string> {
  try {
    return (await resp.text()).slice(0, 4000)
  } catch {
    return ''
  }
}

// =============================================================================
// 单账号尝试
// =============================================================================

interface AccountAttempt {
  ok: boolean
  response?: Response
  latencyMs?: number
  latencyTrusted?: boolean
  reason?: string
  httpStatus?: number
}

function toNormalized(req: UpstreamForwardRequest, rawModel: string): NormalizedChatRequest {
  const norm: NormalizedChatRequest = {
    model: rawModel,
    // content 缺省归一为 null(assistant 纯 tool_calls 消息;JSON 序列化语义不变)
    messages: (req.messages ?? []).map((m) => ({ content: null, ...m })),
    stream: req.stream,
  }
  if (req.temperature !== undefined) norm.temperature = req.temperature
  if (req.maxTokens !== undefined) norm.maxTokens = req.maxTokens
  if (req.tools !== undefined) norm.tools = req.tools
  if (req.toolChoice !== undefined) norm.toolChoice = req.toolChoice
  if (req.affinityKey) norm.conversationId = req.affinityKey
  return norm
}

async function attemptWithAccount(
  adapter: RelayUpstreamAdapter,
  row: AiRelayAccountPool,
  req: UpstreamForwardRequest,
  rawModel: string,
): Promise<AccountAttempt> {
  const started = startStopwatch()
  const finish = (resp: Response): AccountAttempt => {
    const sample = started.stop()
    recordSuccess(row, req, rawModel)
    return {
      ok: true,
      response: resp,
      latencyMs: sample.perfMs,
      latencyTrusted: sample.trustworthy,
    }
  }
  const fail = (kind: FailureKind, reason: string, httpStatus?: number): AccountAttempt => {
    recordFailure(row, kind, reason)
    return { ok: false, reason, httpStatus }
  }

  const normReq = toNormalized(req, rawModel)
  const doFetch = poolFetch(row.proxyUrl)

  // ── 路径 A:多段式协议(executeChat 自带 fetch/会话编排)──
  if (adapter.executeChat) {
    const credentials = decryptAccountCredentials(row)
    const ctx: AdapterAccountContext = { row, credentials }
    try {
      const result = await adapter.executeChat(ctx, normReq, {
        signal: req.signal,
        proxyUrl: row.proxyUrl,
        fetchImpl: doFetch,
      })
      if (result.stream) return finish(chunksToSseResponse(result.stream))
      if (result.completion) return finish(Response.json(result.completion))
      return fail('server', 'executeChat 返回空结果')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (adapter.isAuthError?.(err)) {
        const refreshed = await refreshRowInPlace(row, adapter)
        if (refreshed) {
          try {
            const retry = await adapter.executeChat(
              { row: refreshed, credentials: decryptAccountCredentials(refreshed) },
              normReq,
              { signal: req.signal, proxyUrl: refreshed.proxyUrl, fetchImpl: doFetch },
            )
            if (retry.stream) return finish(chunksToSseResponse(retry.stream))
            if (retry.completion) return finish(Response.json(retry.completion))
          } catch (err2) {
            return fail('auth', `刷新后重试仍失败: ${err2 instanceof Error ? err2.message : msg}`)
          }
          return fail('server', 'executeChat 刷新重试返回空结果')
        }
        return fail('auth', `鉴权失败且刷新未成功: ${msg}`)
      }
      return fail('network', msg)
    }
  }

  // ── 路径 B:通用单请求(buildChatRequest → fetch → 翻译)──
  let ctx: AdapterAccountContext
  let httpReq: ReturnType<RelayUpstreamAdapter['buildChatRequest']>
  try {
    ctx = { row, credentials: decryptAccountCredentials(row) }
    httpReq = adapter.buildChatRequest(ctx, normReq)
  } catch (err) {
    return fail('client', `构造上游请求失败: ${err instanceof Error ? err.message : String(err)}`)
  }

  let resp: Response
  try {
    resp = await doFetch(httpReq.url, {
      method: httpReq.method,
      headers: httpReq.headers,
      body:
        httpReq.rawBody ?? (httpReq.body !== undefined ? JSON.stringify(httpReq.body) : undefined),
      signal: req.signal,
    })
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err // 客户端断开:上抛由主循环终止
    return fail('network', `上游网络错误: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!resp.ok || !resp.body) {
    const bodyText = await safeText(resp)
    const kind = resp.ok ? 'server' : classifyFailure(adapter, resp.status, bodyText)
    // 401 自愈:刷新凭证 → 重建请求 → 重试一次
    if (kind === 'auth' && adapter.refreshToken) {
      const refreshed = await refreshRowInPlace(row, adapter)
      if (refreshed) {
        try {
          const retryCtx: AdapterAccountContext = {
            row: refreshed,
            credentials: decryptAccountCredentials(refreshed),
          }
          const retryReq = adapter.buildChatRequest(retryCtx, normReq)
          const retryResp = await doFetch(retryReq.url, {
            method: retryReq.method,
            headers: retryReq.headers,
            body:
              retryReq.rawBody ??
              (retryReq.body !== undefined ? JSON.stringify(retryReq.body) : undefined),
            signal: req.signal,
          })
          if (retryResp.ok && retryResp.body) {
            return await consumeUpstreamResponse(
              retryResp,
              adapter,
              retryCtx,
              req,
              rawModel,
              finish,
            )
          }
          const retryText = await safeText(retryResp)
          return fail(
            classifyFailure(adapter, retryResp.status, retryText),
            `刷新后仍失败: 上游 ${retryResp.status}`,
            retryResp.status,
          )
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') throw err
          return fail(
            'network',
            `刷新后重试异常: ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      }
    }
    return fail(kind, `上游 ${resp.status}: ${bodyText.slice(0, 200) || '(空响应体)'}`, resp.status)
  }

  return consumeUpstreamResponse(resp, adapter, ctx, req, rawModel, finish)
}

/** 2xx 响应消费:流式逐帧翻译 / 非流式 JSON 或强制流式聚合 */
async function consumeUpstreamResponse(
  resp: Response,
  adapter: RelayUpstreamAdapter,
  ctx: AdapterAccountContext,
  req: UpstreamForwardRequest,
  rawModel: string,
  finish: (r: Response) => AccountAttempt,
): Promise<AccountAttempt> {
  const body = resp.body
  if (!body) return { ok: false, reason: '上游响应无 body' }
  if (req.stream) {
    return finish(translateSseResponse(body, adapter, ctx))
  }
  const ct = resp.headers.get('content-type') ?? ''
  if (ct.includes('text/event-stream')) {
    // 上游拒绝非流式(WorkBuddy):网关侧聚合成 chat.completion
    const completion = await aggregateSseToCompletion(body, adapter, ctx, rawModel)
    return finish(Response.json(completion))
  }
  let json: unknown
  try {
    json = await resp.json()
  } catch (err) {
    return { ok: false, reason: `上游 JSON 解析失败: ${err instanceof Error ? err.message : ''}` }
  }
  try {
    return finish(Response.json(adapter.translateNonStream(ctx, json)))
  } catch (err) {
    return {
      ok: false,
      reason: `响应翻译失败: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// =============================================================================
// 主入口
// =============================================================================

/**
 * 账号池转发主入口。forwardToChannel 在无渠道候选时调用。
 * 永不抛错(客户端主动断开 AbortError 除外 → 折叠为失败终止)。
 */
export async function forwardToAccountPool(
  req: UpstreamForwardRequest,
  rawModel: string,
): Promise<ForwardResult> {
  try {
    if (req.endpoint && req.endpoint !== 'chat') return null // 账号池仅 chat
    const providers = await resolvePoolProviders(rawModel)
    if (providers.length === 0) return null
    const candidates = await selectAccountCandidates(
      req,
      rawModel,
      providers.map((p) => p.providerCode),
    )
    if (candidates.length === 0) return null

    const configIdByProvider = new Map<string, number>(
      providers.map((p) => [p.providerCode, p.configId]),
    )
    let lastError = 'no account candidate succeeded'
    let lastHttpStatus: number | undefined

    for (const row of candidates) {
      const adapter = getRelayAdapter(row.providerCode)
      if (!adapter) {
        lastError = `平台 ${row.providerCode} 适配器未注册`
        continue
      }
      let attempt: AccountAttempt
      try {
        attempt = await attemptWithAccount(adapter, row, req, rawModel)
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          return { ok: false, reason: 'client aborted' }
        }
        attempt = { ok: false, reason: err instanceof Error ? err.message : String(err) }
      }
      if (attempt.ok && attempt.response) {
        const channel: SelectedChannelKey = {
          keyPoolId: row.id,
          apiKey: '',
          baseUrl: '',
          providerCode: row.providerCode,
          configId: configIdByProvider.get(row.providerCode) ?? 0,
          groupId: 'account-pool',
          groupName: `账号池:${row.name}`,
        }
        return {
          ok: true,
          response: attempt.response,
          channel,
          latencyMs: attempt.latencyMs ?? 0,
          latencyTrusted: attempt.latencyTrusted ?? false,
        }
      }
      lastError = attempt.reason ?? lastError
      if (attempt.httpStatus !== undefined) lastHttpStatus = attempt.httpStatus
    }
    return { ok: false, reason: lastError, lastHttpStatus }
  } catch {
    return null // 账号池链路任何异常 → 调用方继续回退 ai-service
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
