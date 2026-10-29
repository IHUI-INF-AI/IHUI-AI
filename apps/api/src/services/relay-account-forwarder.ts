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
 * - 选号:priority asc → 有效权重 desc → lastUsedAt asc(未用优先),跳过冷却中的号;上限 3 号 failover
 *   (O93 起策略钮与打分住 relay-pool-policy.ts 单源:weighted_random / 闲置加权 / 临期优先 /
 *   积分地板 / 跨域互兜,默认档保持上述既有顺序;过滤排空一律回落未过滤集并留标签)
 * - 会话亲和:affinityKey(apiKeyId)+model → 同账号,30 分钟 TTL(Trae 多轮上下文连续性靠它;
 *   30–60 分钟是社区风控实践中"同会话不致跨号漂移"的下限)
 * - 多实例协同(2026-10-22):冷却/亲和走 relay-account-shared-state(Redis 优先、
 *   内存兜底);连续失败计数仍为进程级(计数是启发式,不要求跨实例一致)
 * - failover 全量回放:换号/401 自愈一律用完整 messages 数组重建请求重放,不截断;
 *   流式场景下失败号从不向客户端吐过字节,新号 SSE 从头开始、不断流
 * - 双执行路径:适配器定义 executeChat(多段式协议,如 Trae remote 两步会话)直接整体执行;
 *   否则走通用单请求路径 buildChatRequest → fetch → translateStreamChunk/translateNonStream
 * - 401 自愈:鉴权失败 → 适配器 refreshToken → 回写号池 → 重试一次(对标码道 token 自动续期)
 * - 熔断分层(超越码道的单一冷却):
 *   · 连续 3 败 → 60s 冷却;rate → max(60s, 上游 Retry-After/x-ratelimit-reset),封顶 1h;
 *     credit → 12h;risk(4015/4019/4010/4013)→ 30m 起、连续命中翻倍;
 *     session_dead → 永久摘除(tempUnschedulable)
 *     冷却到期时间经 shared-state 跨实例共享(Redis 优先、内存兜底)
 *   · 请求级错误(参数非法/超长/审核)不罚号(直接透传失败,不计数不冷却)
 * - 账号级并发上限(2026-10-22):同一账号在途请求默认 ≤3,超出则 failover 到下一候选
 *   (上游对单账号并发极敏感;这是与"每账号独立代理出口"配套的第二道指纹护栏)
 * - 全局在途并发闸(O93,对标 pool.max_in_flight_global):钮值住 relay-pool-policy,
 *   计数住 relay-account-shared-state(Redis INCR/DECR + TTL 安全网、内存兜底);
 *   达上限像冷却一样跳过该候选,绝不排队久等(关闭档零 Redis 往返)
 * - 出口代理:行.proxyUrl → undici ProxyAgent(按 URL 缓存连接池,每号独立出口 IP 降风控)
 * - 流式:上游 SSE 帧逐帧 adapter.translateStreamChunk → OpenAI chunk 重封装 + [DONE];
 *   executeChat 的 chunk 序列合成同款 SSE Response,pipeChannelStream 原样消费
 * - 非流式:上游若强制流式(WorkBuddy),按 content-type 自动聚合 SSE → chat.completion
 *
 * 记账诚实性(2026-10-26 立,审计缺陷 1):流式的「成功」判定**不在拿到响应头时**。
 * 头到 ≠ 号活着把答案说完——半包/断流曾被 recordSuccess 直接洗成 healthy,健康四档与
 * 用量账本因此在读假数。现行口径:StreamTerminal(收尾句柄)由流构造器写入、由用量 tap
 * 读取,判据只在这一处落(§0.6);正常收尾才记成功,断流走既有失败分类记 ok:false,
 * 并计数 relay_stream_interrupt_total{provider_code}。断流坐实不了「凭据失效」:
 * 无 HTTP 状态/业务码的文案匹配不得把号判成票死(见 kindForStreamInterrupt)。
 * 非流式路径不变:body 在 finish 前已读完,那一刻就是「正常收尾」。
 *
 * 上游限流退避(2026-10-26 立,审计缺陷 2):429 的冷却时长改读上游自己的声明
 * (`Retry-After` 秒数或 HTTP-date、`x-ratelimit-reset` 秒数或 epoch),
 * 采用值 = max(RATE_COOLDOWN_MS, 上游秒数) 封顶 RATE_COOLDOWN_MAX_MS,采用的秒数写进
 * 错误消息与日志便于归因;取不到头 ⇒ 保持常量(绝不读成 0,0 = 立刻放号回去再撞一次)。
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
  recordRelayStreamInterrupt,
  snapshotRelayStreamInterrupts,
} from '../plugins/business-metrics.js'
import { logger } from '../utils/logger.js'
import { assertRelayEgressSafe, directEgressDispatcher } from '../utils/relay-egress-guard.js'
import { decryptAccountCredentials } from './relay-account-pool-service.js'
import { isRelayProviderCode, type RelayProviderCode } from './relay-account-format.js'
import {
  clearAccountCooldown,
  getAccountsInCooldown,
  getSessionAffinity,
  setAccountCooldown,
  setSessionAffinity,
  tryAcquireGlobalInflight,
  type GlobalInflightHandle,
} from './relay-account-shared-state.js'
import {
  domainKeyOfRow,
  readRelayPoolPolicy,
  selectPoolOrdered,
  type RelayPoolPolicy,
} from './relay-pool-policy.js'
import { recordAccountUsage } from './relay-account-usage.js'
import { pickProxyForAccount, reportProxyFailure, reportProxySuccess } from './relay-proxy-pool.js'
import { resolveModelAlias } from './relay-model-catalog.js'
import {
  applyStopToCompletion,
  createStopTruncator,
  truncateAtStops,
} from './relay-stop-truncate.js'
import {
  getRelayAdapter,
  normalizeStopSequences,
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
/** 积分耗尽/日上限:12h 冷却(对标 workbuddy CoolHard) */
const CREDIT_COOLDOWN_MS = 12 * 60 * 60 * 1000
/** 风控命中(4015/4019/4010/4013):30 分钟起冷却,连续命中翻倍,封顶 6h */
const RISK_COOLDOWN_MS = 30 * 60 * 1000
const RISK_COOLDOWN_MAX_MS = 6 * 60 * 60 * 1000
/** 上游限流:60s 软冷却基线(对标 workbuddy CoolSoft);上游自己给了退避时刻就按更长的来 */
const RATE_COOLDOWN_MS = 60_000
/** 上游退避封顶:一句 `Retry-After: 31536000` 不该把号池锁一年(与 RISK_COOLDOWN_MAX_MS 同族) */
const RATE_COOLDOWN_MAX_MS = 60 * 60 * 1000
/** 会话亲和 TTL:30 分钟(同一会话在多轮间保持同号,降低跨号指纹漂移) */
const AFFINITY_TTL_MS = 30 * 60 * 1000
/** 单账号在途请求上限(可选 env 覆盖;超限时换号,不打满上游) */
const ACCOUNT_MAX_INFLIGHT = (() => {
  const n = Number(process.env.IHUI_RELAY_ACCOUNT_MAX_INFLIGHT)
  return Number.isFinite(n) && n >= 1 ? Math.min(8, Math.floor(n)) : 3
})()
/** 模型→平台反查缓存 TTL */
const PROVIDER_CACHE_TTL_MS = 60_000
/** 反查缓存键上限(客户端可传任意模型名,必须封顶防内存增长) */
const PROVIDER_CACHE_MAX = 1_000
/** ProxyAgent 缓存上限(代理池位有限,超限逐出最旧并关闭连接池) */
const PROXY_AGENT_MAX = 64
/** 上游响应头超时:只约束「拿到响应」这一段,流式正文不受影响 */
const UPSTREAM_TIMEOUT_MS = 120_000

/**
 * 流式收尾句柄(2026-10-26 记账诚实性的唯一载体)。
 *
 * 写入者 = 流构造器(`chunksToSseResponse` / `translateSseResponse`),读取者 = 用量 tap。
 * 构造器在 enqueue 收尾帧 / 抛错**之前**先把结论写定,故 tap 观察到流终结时必读到定局。
 * 判据只在这一处落(§0.6 单一真相源):tap 不另起一套「看到 [DONE] 才算好」的解析。
 */
interface StreamTerminal {
  /** 收尾结论:null = 尚未定局(流还没读完);true = 上游给出合法收尾;false = 断流/半包 */
  endedCleanly: boolean | null
  /** 断流的原始异常(上游抛错才有;纯截断 ⇒ undefined,按网络级断流处理) */
  error?: unknown
}

function newStreamTerminal(): StreamTerminal {
  return { endedCleanly: null }
}

/** 流终结结论:成功记账只认这两档,没有第三种("没判"不写成"判过") */
type StreamOutcome = 'clean' | 'interrupted'

/**
 * 「这轮算不算成功」的唯一判定(2026-10-26 把口径从「拿到响应头」挪到「流正常收尾」):
 * ① tap 读流自身抛错 ⇒ interrupted;② 收尾句柄未定局或明确没看到收尾帧 ⇒ interrupted;
 * ③ 其余(含非流式:body 已在内存,读完即定局)⇒ clean。
 */
function judgeStreamOutcome(tapError: unknown, terminal?: StreamTerminal): StreamOutcome {
  if (tapError !== undefined) return 'interrupted'
  if (!terminal) return 'clean'
  return terminal.endedCleanly === true ? 'clean' : 'interrupted'
}

/**
 * 流式断流计数:记账出口在 `plugins/business-metrics.ts`(家族 `ihui_relay_stream_interrupt_total{provider_code}`,
 * 与 `ihui_relay_upstream_fallback_total` 同族同节拍)。本文件只留**判据**(什么算"没说完")与现读转发,
 * 不再自持一份 Map(§0.6 单一真相源;上一版因并行写席禁改 metrics 才临时落在这里)。
 */
export function getStreamInterruptCounts(): Record<string, number> {
  return snapshotRelayStreamInterrupts()
}

type FailureKind =
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

/** 账号级连续失败计数(进程级启发式;冷却到期本身走 shared-state 跨实例共享) */
const failureCounts = new Map<string, number>()
/** 账号级在途请求计数(进程级;多实例各自限流,叠加后仍显著低于上游耐受线) */
const inflightByAccount = new Map<string, number>()

function tryAcquireAccount(id: string): boolean {
  const cur = inflightByAccount.get(id) ?? 0
  if (cur >= ACCOUNT_MAX_INFLIGHT) return false
  inflightByAccount.set(id, cur + 1)
  return true
}

function releaseAccount(id: string): void {
  const cur = inflightByAccount.get(id) ?? 0
  if (cur <= 1) inflightByAccount.delete(id)
  else inflightByAccount.set(id, cur - 1)
}
/** 模型→平台反查缓存 */
const providerCache = new Map<
  string,
  { providers: Array<{ providerCode: RelayProviderCode; configId: number }>; expiresAt: number }
>()
/** proxyUrl → ProxyAgent(连接池复用) */
const proxyAgents = new Map<string, ProxyAgent>()

function getProxyAgent(proxyUrl: string): ProxyAgent {
  let agent = proxyAgents.get(proxyUrl)
  if (!agent) {
    if (proxyAgents.size >= PROXY_AGENT_MAX) {
      const oldestKey = proxyAgents.keys().next().value
      if (oldestKey !== undefined) {
        const oldest = proxyAgents.get(oldestKey)
        proxyAgents.delete(oldestKey)
        void Promise.resolve(oldest?.close()).catch(() => {})
      }
    }
    agent = new ProxyAgent(proxyUrl)
    proxyAgents.set(proxyUrl, agent)
  }
  return agent
}

/**
 * 账号级 fetch:两条分支都先过首跳复检；直连再挂**连接期守卫**（真防 DNS rebinding 的那一层）。
 *
 * 为什么直连必须走包 undici 的 Agent 而不是内置 globalThis.fetch:连接期钩子（connect.lookup）
 * 装在 dispatcher 上,而 Node 内置 fetch 用的是它自己那份 undici 实例,外部 Agent 递进去不认。
 * 所以这一行的 dispatcher 就是守卫 ② 的接线点,挪不得。
 * 桩面纪律:测本函数请用 undici 的 fetch 桩 —— tests/relay-account-forwarder.test.ts 已改成
 * "配过 undici 桩就用它,否则转交当时的 global fetch 桩",不要反过来改生产出口迁就旧桩。
 *
 * 覆盖边界（写破）:走账号代理时本机不解析目标（由代理解析）,那一分支只有首跳复检 ① 在守。
 */
function poolFetch(proxyUrl: string | null | undefined): typeof fetch {
  const agent = proxyUrl ? getProxyAgent(proxyUrl) : directEgressDispatcher()
  const f: typeof fetch = async (input, init) => {
    await assertRelayEgressSafe(input)
    // undici 的 RequestInit 是全局 RequestInit 的超集(dispatcher 为附加可选字段)
    return undiciFetch(input as string, {
      ...(init ?? {}),
      dispatcher: agent,
    }) as unknown as Response
  }
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
  // 键上限:任意客户端模型名都能进缓存,必须封顶(逐出最早插入项)
  if (!providerCache.has(rawModel) && providerCache.size >= PROVIDER_CACHE_MAX) {
    const oldestKey = providerCache.keys().next().value
    if (oldestKey !== undefined) providerCache.delete(oldestKey)
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
  opts: { policy?: RelayPoolPolicy; rng?: () => number } = {},
): Promise<{ rows: AiRelayAccountPool[]; fallbacks: string[] }> {
  // 双池隔离:请求带用户身份时 = 该用户的个人池 ∪ 运营池(个人池优先,运营池兜底);
  // 无身份(匿名/渠道 key)= 仅运营池。用户自己的账号绝不服务他人请求。
  const ownerCond = req.userId
    ? or(isNull(aiRelayAccountPool.ownerUserId), eq(aiRelayAccountPool.ownerUserId, req.userId))
    : isNull(aiRelayAccountPool.ownerUserId)
  const rows = await dbRead
    .select()
    .from(aiRelayAccountPool)
    .where(
      and(
        ownerCond,
        inArray(aiRelayAccountPool.providerCode, providerCodes),
        eq(aiRelayAccountPool.isEnabled, true),
        eq(aiRelayAccountPool.tempUnschedulable, false),
      ),
    )
    .orderBy(
      sql`case when ${aiRelayAccountPool.ownerUserId} is null then 1 else 0 end`,
      asc(aiRelayAccountPool.priority),
      desc(aiRelayAccountPool.weight),
    )

  // 冷却跨实例共享(shared-state:Redis 优先、内存兜底);读失败已在内部降级,不会抛
  const cooling = await getAccountsInCooldown(rows.map((r) => r.id))
  const usable = rows.filter((r) => !cooling.has(r.id))

  // 会话亲和读取前置到策略管线之前:亲和账号所在域是跨域互兜唯一的「请求域」取材
  // (号池表无 realm/domain 列;域判据 = workbuddy 行 extraMetadata.domain,单源
  // relay-pool-policy.domainKeyOfRow → workbuddy-protocol.resolveRealm)。
  const aKey = affinityKeyOf(req, rawModel)
  const hitId = aKey ? await getSessionAffinity(aKey) : null

  const policy = opts.policy ?? readRelayPoolPolicy()
  let requestedDomain: 'cn' | 'global' | null = null
  if (policy.crossDomainFallback && hitId) {
    const hitRow = rows.find((r) => r.id === hitId)
    requestedDomain = hitRow ? domainKeyOfRow(hitRow) : null
  }
  // 选号管线(credit_floor → 域过滤 → 确定性/加权随机排序;过滤回空即回落并带标签)
  const sel = selectPoolOrdered(usable, { policy, rng: opts.rng, requestedDomain })
  const ordered = sel.rows

  // 亲和命中且仍在候选 → 置顶(多轮上下文连续优先于负载均衡;失效则自然 failover)
  if (hitId) {
    const idx = ordered.findIndex((r) => r.id === hitId)
    if (idx > 0) {
      const row = ordered[idx]
      if (row) {
        ordered.splice(idx, 1)
        ordered.unshift(row)
      }
    }
  }
  if (sel.fallbacks.length > 0) {
    // §0.3「没判/判不了」必须喊出来:过滤会排空候选 ⇒ 已回落未过滤集,留标签问责
    logger.warn('[relay-account-forwarder] 号池策略过滤回空,已回落未过滤候选集', {
      model: rawModel,
      fallbacks: sel.fallbacks.join(','),
      poolSize: usable.length,
    })
  }
  return { rows: ordered.slice(0, MAX_ACCOUNT_CANDIDATES), fallbacks: sel.fallbacks }
}

// =============================================================================
// 上游退避头(Retry-After / x-ratelimit-reset)
// =============================================================================

/** 秒数 ≥ 此值按「epoch 秒」解(GitHub 形 x-ratelimit-reset),否则按「距今 delta 秒」 */
const EPOCH_SECONDS_FLOOR = 1_000_000_000

/** 退避方案的归因短语(进 lastErrorMessage / ForwardResult.reason,便于事后问责) */
export interface RateBackoff {
  /** 最终采用的冷却毫秒 */
  ms: number
  /** 采用了多少秒 + 依据(上游给的真值 / 封顶 / 常量) */
  note: string
}

/** 读一枚响应头:兼容 Headers 实例与纯对象(适配器错误上挂的原始头) */
function headerOf(headers: unknown, name: string): string | null {
  if (!headers) return null
  const asHeaders = headers as { get?: (k: string) => string | null }
  if (typeof asHeaders.get === 'function') {
    try {
      return asHeaders.get(name) ?? null
    } catch {
      return null
    }
  }
  const rec = headers as Record<string, unknown>
  for (const k of Object.keys(rec)) {
    if (k.toLowerCase() !== name) continue
    const v = rec[k]
    if (typeof v === 'string') return v
    if (Array.isArray(v) && typeof v[0] === 'string') return v[0]
  }
  return null
}

/**
 * 单枚退避头 → 毫秒。
 * 合法形态:`delay-seconds`(含小数)、HTTP-date、epoch 秒。
 * 非法形态/已过期 ⇒ null(= 未判定),**不得读成 0**——0 会当场放号回去再撞一次限流。
 */
function parseBackoffSeconds(raw: string | null, nowMs: number): number | null {
  if (raw === null) return null
  const text = raw.trim()
  if (!text) return null
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const n = Number(text)
    if (!Number.isFinite(n) || n < 0) return null
    if (n >= EPOCH_SECONDS_FLOOR) {
      const deltaMs = n * 1000 - nowMs
      return deltaMs > 0 ? deltaMs : null
    }
    return n * 1000
  }
  const at = Date.parse(text)
  if (!Number.isFinite(at)) return null
  const deltaMs = at - nowMs
  return deltaMs > 0 ? deltaMs : null
}

/** 两张上游退避头取更长的那枚;一张可用都没有 ⇒ null(调用侧保持常量) */
export function extractUpstreamBackoffMs(headers: unknown, nowMs = Date.now()): number | null {
  const candidates = [
    parseBackoffSeconds(headerOf(headers, 'retry-after'), nowMs),
    parseBackoffSeconds(headerOf(headers, 'x-ratelimit-reset'), nowMs),
  ].filter((v): v is number => v !== null)
  if (candidates.length === 0) return null
  return Math.max(...candidates)
}

/**
 * 429 冷却方案:采用值 = `max(RATE_COOLDOWN_MS, 上游声明)` 封顶 `RATE_COOLDOWN_MAX_MS`。
 * 上游没给/给了不可用的形态 ⇒ 常量,并在结论里写明依据(不静默、不谎报为上游意图)。
 */
export function planRateBackoff(headers: unknown, nowMs = Date.now()): RateBackoff {
  const upstreamMs = extractUpstreamBackoffMs(headers, nowMs)
  const constantNote = `退避=${RATE_COOLDOWN_MS / 1000}s(上游未给可用 Retry-After)`
  if (upstreamMs === null) {
    if (
      headerOf(headers, 'retry-after') !== null ||
      headerOf(headers, 'x-ratelimit-reset') !== null
    )
      logger.warn('[relay-account-forwarder] 上游退避头形态不可用,回落常量冷却', {
        retryAfter: headerOf(headers, 'retry-after'),
        ratelimitReset: headerOf(headers, 'x-ratelimit-reset'),
      })
    return { ms: RATE_COOLDOWN_MS, note: constantNote }
  }
  const ms = Math.min(Math.max(RATE_COOLDOWN_MS, upstreamMs), RATE_COOLDOWN_MAX_MS)
  const upstreamS = Math.round(upstreamMs / 1000)
  const adoptedS = Math.round(ms / 1000)
  const clamped = ms < upstreamMs
  logger.warn('[relay-account-forwarder] 按上游退避头冷却', {
    upstreamSeconds: upstreamS,
    adoptedSeconds: adoptedS,
    clampedByCeiling: clamped,
  })
  return {
    ms,
    note: `退避=${adoptedS}s(上游声明 ${upstreamS}s${clamped ? `,按上限 ${RATE_COOLDOWN_MAX_MS / 1000}s 截断` : ''})`,
  }
}

/** 仅 rate 类需要上游退避;其余类别返回 undefined(不替无关失败编造退避依据) */
function rateBackoffFor(
  kind: FailureKind,
  headers: unknown,
  nowMs = Date.now(),
): RateBackoff | undefined {
  return kind === 'rate' ? planRateBackoff(headers, nowMs) : undefined
}

/** 适配器抛错上若挂了原始响应头则取用;取不到 ⇒ null ⇒ 回落常量 */
function headersOfThrown(err: unknown): unknown {
  return (err as { headers?: unknown } | null | undefined)?.headers ?? null
}

// =============================================================================
// 结果记录(熔断 + 亲和 + DB 计数)
// =============================================================================

function recordSuccess(
  row: AiRelayAccountPool,
  req: UpstreamForwardRequest,
  rawModel: string,
): void {
  failureCounts.delete(row.id)
  // shared-state 写入的内存穿透部分是同步的(void 仅指 Redis 往返不阻塞响应路径)
  void clearAccountCooldown(row.id)
  const aKey = affinityKeyOf(req, rawModel)
  if (aKey) void setSessionAffinity(aKey, row.id, AFFINITY_TTL_MS)
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

function recordFailure(
  row: AiRelayAccountPool,
  kind: FailureKind,
  reason: string,
  backoff?: RateBackoff,
): void {
  // 请求级错误(参数非法/超长/审核拦截):不罚号
  if (kind === 'request') return
  const now = Date.now()
  if (kind === 'not_found') {
    // 上游偶发 404 抖动:短冷却但不累计错误(防雪崩,对标 workbuddy ErrNotFound)
    void setAccountCooldown(row.id, now + RATE_COOLDOWN_MS)
  } else {
    const failures = (failureCounts.get(row.id) ?? 0) + 1
    failureCounts.set(row.id, failures)
    if (kind === 'credit') void setAccountCooldown(row.id, now + CREDIT_COOLDOWN_MS)
    else if (kind === 'risk')
      // 风控冷却:30m 起、连续命中线性翻倍,封顶 6h;与 credit 一样不自动重放
      void setAccountCooldown(
        row.id,
        now + Math.min(RISK_COOLDOWN_MS * Math.max(1, failures), RISK_COOLDOWN_MAX_MS),
      )
    else if (kind === 'rate')
      // 上游说几秒就退避几秒(封顶 RATE_COOLDOWN_MAX_MS);上游没说 ⇒ 常量
      void setAccountCooldown(row.id, now + (backoff?.ms ?? RATE_COOLDOWN_MS))
    else if (failures >= BREAKER_FAILURES)
      void setAccountCooldown(row.id, now + BREAKER_COOLDOWN_MS)
  }

  const set: Record<string, unknown> = {
    consecutiveFailures: sql`${aiRelayAccountPool.consecutiveFailures} + 1`,
    lastErrorMessage: reason.slice(0, 500),
    updatedAt: new Date(),
  }
  if (kind === 'session_dead') {
    // 会话彻底失效(如需人工重登):永久摘除,等 admin/重新导入恢复
    set.tempUnschedulable = true
    set.healthStatus = 'down'
    // 与健康降级同一次写:到期列收敛到当下,不让未来时刻继续冒充可用证据
    set.tokenExpiresAt = new Date()
  } else if (kind === 'auth') {
    // 上游明确拒收凭据(401/403);换票若也失败,到期列同样收敛到当下
    set.tokenExpiresAt = new Date()
  } else if (kind === 'credit') {
    set.tempUnschedulable = true
    set.healthStatus = 'degraded'
  } else if (kind === 'risk') {
    // 风控命中不永久摘除(冷却到期自动恢复),但健康度降级,让 admin 面板可见
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
  if (status === 404) return 'not_found'
  if (status === 400 || status === 413 || status === 422) return 'request'
  if (status >= 500) return 'server'
  return 'client'
}

/**
 * executeChat 抛出异常的语义分类:优先取错误携带的 HTTP 状态走富分类;
 * 无状态时再喂给适配器的文本分类(仅采信非 client 的明确结论),否则按网络错误。
 */
function classifyThrownError(adapter: RelayUpstreamAdapter, err: unknown): FailureKind {
  const statusCode =
    typeof (err as { statusCode?: unknown })?.statusCode === 'number'
      ? (err as { statusCode: number }).statusCode
      : 0
  // TraeUpstreamError 的业务码不在 message 里(已被打码/截断),直接喂给分类器
  const upstreamCode = (err as { upstreamCode?: unknown })?.upstreamCode
  if (typeof upstreamCode === 'number' || typeof upstreamCode === 'string') {
    const byCode = classifyFailure(adapter, 0, `code:${String(upstreamCode)}`)
    if (byCode !== 'client') return byCode
  }
  const msg = err instanceof Error ? err.message : String(err)
  if (statusCode > 0) return classifyFailure(adapter, statusCode, msg)
  const rich = (adapter as RelayUpstreamAdapter & FailureClassifiable).classifyUpstreamFailure
  if (rich) {
    try {
      const kind = rich.call(adapter, 0, msg).kind
      if (kind !== 'client') return kind
    } catch {
      /* 分类异常 → 视为网络错误 */
    }
  }
  return 'network'
}

/**
 * 断流的失败分类(2026-10-26):**沿用 classifyThrownError,不另造第二套分类**,
 * 只补一条证据下限——「半途断流」证明不了「票死了」。
 * 因此:结论是 auth / session_dead(两者会收敛 tokenExpiresAt、甚至写 healthStatus=down)
 * 而错误既没带 HTTP 状态、也没带上游业务码时,一律降为 network:
 * 那只是「这个号本轮失败」,不是「这张票作废」。
 */
function kindForStreamInterrupt(adapter: RelayUpstreamAdapter, err: unknown): FailureKind {
  if (err === undefined) return 'network' // 纯截断(上游静默关连接):网络级断流
  const kind = classifyThrownError(adapter, err)
  if (kind !== 'auth' && kind !== 'session_dead') return kind
  const statusCode =
    typeof (err as { statusCode?: unknown })?.statusCode === 'number'
      ? (err as { statusCode: number }).statusCode
      : 0
  const hasStructuredEvidence =
    statusCode > 0 || (err as { upstreamCode?: unknown })?.upstreamCode !== undefined
  return hasStructuredEvidence ? kind : 'network'
}

/** 区分「上游响应超时」与「客户端断开」:仅约束响应头阶段,流式正文不受限 */
function withUpstreamTimeout(parent: AbortSignal | undefined): {
  signal: AbortSignal
  timedOut: () => boolean
  clear: () => void
} {
  const controller = new AbortController()
  let fired = false
  const timer = setTimeout(() => {
    fired = true
    controller.abort()
  }, UPSTREAM_TIMEOUT_MS)
  timer.unref?.()
  const onParentAbort = (): void => controller.abort()
  if (parent) {
    if (parent.aborted) controller.abort()
    else parent.addEventListener('abort', onParentAbort, { once: true })
  }
  return {
    signal: controller.signal,
    timedOut: () => fired,
    clear: () => {
      clearTimeout(timer)
      parent?.removeEventListener('abort', onParentAbort)
    },
  }
}

// =============================================================================
// 401 自愈刷新
// =============================================================================

/** 同账号并发刷新合并:refresh token 轮换制下并发刷新会互相覆盖,可能把号刷死 */
const refreshInFlight = new Map<string, Promise<AiRelayAccountPool | null>>()

/** 刷新单账号凭证并回写号池;返回合并后的新行(供就地重试),失败返回 null */
async function refreshRowInPlace(
  row: AiRelayAccountPool,
  adapter: RelayUpstreamAdapter,
): Promise<AiRelayAccountPool | null> {
  if (!adapter.refreshToken) return null
  const existing = refreshInFlight.get(row.id)
  if (existing) return existing
  const task = doRefreshRowInPlace(row, adapter).finally(() => {
    refreshInFlight.delete(row.id)
  })
  refreshInFlight.set(row.id, task)
  return task
}

async function doRefreshRowInPlace(
  row: AiRelayAccountPool,
  adapter: RelayUpstreamAdapter,
): Promise<AiRelayAccountPool | null> {
  const startedAt = new Date()
  try {
    const credentials = decryptAccountCredentials(row)
    const result = await adapter.refreshToken!({ row, credentials }, { proxyUrl: row.proxyUrl })
    if (!result) return null
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
        lastRefreshAt: startedAt,
        refreshFailureCount: 0,
        // 换票成功 = 凭据版本前进(与 relay-account-pool-scheduler.refreshOne 同口径):
        // 号池↔签到同步只按版本差补推,不涨版本 ⇒ 签到侧永远拿不到新票。
        credVersion: sql`${aiRelayAccountPool.credVersion} + 1`,
        lastErrorMessage: null,
        updatedAt: startedAt,
      })
      .where(eq(aiRelayAccountPool.id, row.id))
      .catch(() => {})
    return {
      ...row,
      tokenEnc,
      refreshTokenEnc,
      tokenExpiresAt: result.expiresAt,
      lastRefreshAt: startedAt,
      credVersion: (row.credVersion ?? 0) + 1,
    }
  } catch (e) {
    // 失败也要落账:refreshFailureCount 是管理面「该补池了」的判据,不能永远为 0
    const failures = (row.refreshFailureCount ?? 0) + 1
    const msg = e instanceof Error ? e.message : String(e)
    // 上游明确拒收换票(401/403 等结构化判定)→ 到期列收敛到当下,与失败计数同一次写;
    // 网络/5xx 不确定失败不碰该列。
    const authRejected = adapter.isAuthError?.(e) === true
    await db
      .update(aiRelayAccountPool)
      .set({
        refreshFailureCount: failures,
        lastRefreshAt: startedAt,
        lastErrorMessage: msg.slice(0, 500),
        ...(failures >= 3 ? { healthStatus: 'degraded' } : {}),
        ...(authRejected ? { tokenExpiresAt: new Date() } : {}),
        updatedAt: startedAt,
      })
      .where(eq(aiRelayAccountPool.id, row.id))
      .catch(() => {})
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

/** 严格判定终止帧:payload 恰好为 [DONE](内容里出现 "[DONE]" 字样不得误判) */
function isSseDone(line: string): boolean {
  return line.slice(line.indexOf(':') + 1).trim() === '[DONE]'
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
function chunksToSseResponse(
  stream: AsyncIterable<Record<string, unknown>>,
  terminal: StreamTerminal,
): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
        }
        // 适配器生成器正常结束 = 这一轮说完了(唯一可用的收尾证据;抛错走下面 catch)
        terminal.endedCleanly = true
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        terminal.endedCleanly = false
        terminal.error = err
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
  stop: string | string[] | undefined,
  terminal: StreamTerminal,
): Response {
  const encoder = new TextEncoder()
  const state: StreamState = {}
  const truncator = createStopTruncator(stop)
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let stopped = false
      let flushed = false
      // 上游是否给出了合法收尾([DONE] / finish_reason / 适配器判定 done / 命中 stop 序列)
      let sawTerminalFrame = false
      let lastChunk: Record<string, unknown> | null = null
      const emit = (chunk: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
      }
      try {
        for await (const line of readSseDataLines(upstream)) {
          if (isSseDone(line)) {
            sawTerminalFrame = true
            break
          }
          const translated = adapter.translateStreamChunk(ctx, line, state)
          if (!translated) continue
          const chunk = translated.openaiChunk
          lastChunk = chunk
          const choices = Array.isArray(chunk.choices) ? chunk.choices : []
          // 收尾帧判定与 stop 截断互不影响:任何一帧带非空 finish_reason 即「上游把话说完」
          for (const raw of choices) {
            const choice = asRecord(raw)
            if (choice && typeof choice.finish_reason === 'string' && choice.finish_reason)
              sawTerminalFrame = true
          }
          let reachesEnd = translated.done === true
          if (translated.done === true) sawTerminalFrame = true
          if (truncator) {
            for (const raw of choices) {
              const choice = asRecord(raw)
              const delta = choice ? asRecord(choice.delta) : null
              if (!choice || !delta) continue
              if (typeof delta.content === 'string') {
                const r = truncator.push(delta.content)
                delta.content = r.text
                if (r.matched) {
                  choice.finish_reason = 'stop'
                  stopped = true
                  // 命中 stop 序列 = 按协议收尾(不是断流),尾巴丢弃是预期截断
                  sawTerminalFrame = true
                }
              }
              if (typeof choice.finish_reason === 'string' && choice.finish_reason)
                reachesEnd = true
            }
            // 结束帧前把 holdback 的尾巴补进正文(命中 stop 时丢弃尾巴)
            if (!stopped && reachesEnd && !flushed) {
              const f = truncator.flush()
              flushed = true
              if (f.text && choices.length > 0) {
                const first = asRecord(choices[0])
                const delta = first ? asRecord(first.delta) : null
                if (delta)
                  delta.content = `${typeof delta.content === 'string' ? delta.content : ''}${f.text}`
              }
            }
          }
          emit(chunk)
          if (stopped || translated.done) break
        }
        if (truncator && !stopped && !flushed) {
          const f = truncator.flush()
          if (f.text) {
            const base =
              lastChunk && typeof lastChunk.id === 'string'
                ? {
                    id: lastChunk.id,
                    object: lastChunk.object ?? 'chat.completion.chunk',
                    created: lastChunk.created,
                    model: lastChunk.model,
                  }
                : { object: 'chat.completion.chunk' }
            emit({
              ...base,
              choices: [{ index: 0, delta: { content: f.text }, finish_reason: 'stop' }],
            })
          }
        }
        // 收尾结论必须在 enqueue 合成 [DONE] 之前写定:tap 看到 DONE 就收手,再晚读不到证据。
        // 上游没给收尾帧而流自己结束 = 半包(此前正是这一格被记成成功)。
        terminal.endedCleanly = sawTerminalFrame
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        terminal.endedCleanly = false
        terminal.error = err
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

export interface ToolCallSlot {
  id?: string
  type?: string
  name?: string
  args: string
}

/**
 * 合并 tool_calls 分片:后续分片常带空 id/name,不能覆盖首次非空值;
 * arguments 按到达顺序拼接。抽成纯函数是为了能被单测直接钉住(曾出现 name 被空串覆盖)。
 */
export function mergeToolCallDelta(slot: ToolCallSlot, tc: Record<string, unknown>): void {
  if (typeof tc.id === 'string' && tc.id) slot.id = tc.id
  if (typeof tc.type === 'string' && tc.type) slot.type = tc.type
  const fn = asRecord(tc.function)
  if (!fn) return
  if (typeof fn.name === 'string' && fn.name && !slot.name) slot.name = fn.name
  if (typeof fn.arguments === 'string') slot.args += fn.arguments
}

/** 上游强制流式时的网关侧聚合:SSE 帧 → chat.completion(delta/tool_calls/usage 合并) */
async function aggregateSseToCompletion(
  upstream: ReadableStream<Uint8Array>,
  adapter: RelayUpstreamAdapter,
  ctx: AdapterAccountContext,
  model: string,
  stop?: string | string[],
): Promise<Record<string, unknown>> {
  const state: StreamState = {}
  let id = ''
  let created = Math.floor(Date.now() / 1000)
  let content = ''
  let reasoning = ''
  let finishReason: string | null = null
  let usage: Record<string, unknown> | null = null
  const toolSlots = new Map<number, ToolCallSlot>()

  for await (const line of readSseDataLines(upstream)) {
    if (isSseDone(line)) break
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
      mergeToolCallDelta(slot, tc)
      toolSlots.set(idx, slot)
    }
    if (translated?.done) break
  }

  const message: Record<string, unknown> = { role: 'assistant', content }
  // stop 本地截断(上游数组形态收下但不生效):聚合后按首个命中位置截断并改 finish_reason
  const truncated = truncateAtStops(content, stop)
  if (truncated.matched) {
    message.content = truncated.text
    finishReason = 'stop'
  }
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
// 用量 tap:从响应流提取 OpenAI usage 字段(不消费主路径 body)+ 流收尾结论
// =============================================================================

interface UsagePair {
  promptTokens: number
  completionTokens: number
  reasoningTokens: number
  cachedTokens: number
}

const ZERO_USAGE: UsagePair = {
  promptTokens: 0,
  completionTokens: 0,
  reasoningTokens: 0,
  cachedTokens: 0,
}

function extractUsage(json: unknown): UsagePair | null {
  const rec = asRecord(json)
  const usage = rec ? asRecord(rec.usage) : null
  if (!usage) return null
  const p = typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0
  const c = typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0
  if (!p && !c) return null
  // OpenAI 标准嵌套形状;Trae 适配器已在注入前归一成同一形状(trae-protocol extractUsage)
  const ctd = asRecord(usage.completion_tokens_details)
  const ptd = asRecord(usage.prompt_tokens_details)
  return {
    promptTokens: p,
    completionTokens: c,
    reasoningTokens: typeof ctd?.reasoning_tokens === 'number' ? ctd.reasoning_tokens : 0,
    cachedTokens: typeof ptd?.cached_tokens === 'number' ? ptd.cached_tokens : 0,
  }
}

/** SSE data: 行 → JSON(非 JSON/[DONE] → null) */
function parseDataLine(line: string): unknown {
  const payload = line.slice(line.indexOf(':') + 1).trim()
  if (!payload || payload === '[DONE]') return null
  try {
    return JSON.parse(payload)
  } catch {
    return null
  }
}

/**
 * 包裹响应以提取 usage,onUsage **恰好调用一次**,并同时给出收尾结论
 * (`clean` / `interrupted`,判据见 judgeStreamOutcome)。
 * - SSE:body.tee(),tap 支路异步解析,主路零延迟零消费;
 * - JSON(Response.json 构造,body 已在内存):clone().text() 解析,原响应直接透传。
 * tap 自身的异常不再被吞成"成功"——它正是断流的证据,只影响结论、不影响主链路。
 */
function tapAccountUsage(
  resp: Response,
  terminal: StreamTerminal | undefined,
  onUsage: (u: UsagePair, outcome: StreamOutcome) => void,
): Response {
  const ct = resp.headers.get('content-type') ?? ''
  if (ct.includes('text/event-stream')) {
    if (!resp.body) {
      onUsage(ZERO_USAGE, judgeStreamOutcome(undefined, terminal))
      return resp
    }
    const [pass, tap] = resp.body.tee()
    void (async () => {
      let last: UsagePair | null = null
      let tapError: unknown
      try {
        for await (const line of readSseDataLines(tap)) {
          if (isSseDone(line)) break
          const u = extractUsage(parseDataLine(line))
          if (u) last = u
        }
      } catch (err) {
        // 断流证据(tap 支路抛错 = 主流同一处抛错);仍要回调一次,否则并发额度还不出去
        tapError = err
      }
      onUsage(last ?? ZERO_USAGE, judgeStreamOutcome(tapError, terminal))
    })()
    return new Response(pass, {
      status: resp.status,
      statusText: resp.statusText,
      headers: resp.headers,
    })
  }
  void resp
    .clone()
    .text()
    .then((text) => {
      let u: UsagePair = ZERO_USAGE
      try {
        const parsed = extractUsage(JSON.parse(text))
        if (parsed) u = parsed
      } catch {
        /* 非 JSON 体按 0/0 记 */
      }
      onUsage(u, judgeStreamOutcome(undefined, terminal))
    })
    .catch((err: unknown) => onUsage(ZERO_USAGE, judgeStreamOutcome(err, terminal)))
  return resp
}

// =============================================================================
// 单账号尝试
// =============================================================================

interface AccountAttempt {
  ok: boolean
  kind?: FailureKind
  response?: Response
  latencyMs?: number
  latencyTrusted?: boolean
  reason?: string
  httpStatus?: number
  /**
   * 流式尝试的收尾句柄(非流式 = undefined)。
   * 有它 ⇒ 「成功」记账必须等流正常收尾才落(见 forwardToAccountPool 的 settle);
   * 没有 ⇒ body 已在内存/已读完,finish 当场记账就是诚实的。
   */
  terminal?: StreamTerminal
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
  // OpenAI 兼容面:JSON mode 与 seed 必须透传,否则账号池路径语义弱于渠道路径
  if (req.responseFormat !== undefined) norm.responseFormat = req.responseFormat
  if (req.seed !== undefined) norm.seed = req.seed
  // reasoning_effort / stop(2026-10-22 协议补全):Trae 落 custom_model,stop 走本地截断
  if (req.reasoningEffort !== undefined) norm.reasoningEffort = req.reasoningEffort
  const stops = normalizeStopSequences(req.stop)
  if (stops !== undefined) norm.stop = stops
  // 采样面与工具开关(2026-10-23):上游实测均接受,账号池不再静默丢弃
  if (req.topP !== undefined) norm.topP = req.topP
  if (req.presencePenalty !== undefined) norm.presencePenalty = req.presencePenalty
  if (req.frequencyPenalty !== undefined) norm.frequencyPenalty = req.frequencyPenalty
  if (req.parallelToolCalls !== undefined) norm.parallelToolCalls = req.parallelToolCalls
  if (req.user !== undefined) norm.user = req.user
  if (req.serviceTier !== undefined) norm.serviceTier = req.serviceTier
  if (req.topK !== undefined) norm.topK = req.topK
  if (req.repetitionPenalty !== undefined) norm.repetitionPenalty = req.repetitionPenalty
  if (req.logitBias !== undefined) norm.logitBias = req.logitBias
  if (req.affinityKey) norm.conversationId = req.affinityKey
  return norm
}

async function attemptWithAccount(
  adapter: RelayUpstreamAdapter,
  row: AiRelayAccountPool,
  req: UpstreamForwardRequest,
  rawModel: string,
  opts: { upstreamModel: string; proxy: string | null },
): Promise<AccountAttempt> {
  const started = startStopwatch()
  /**
   * 非流式(不带 terminal):body 已读完/在内存 ⇒ 当场记成功,语义与改造前逐字一致。
   * 流式(带 terminal):只交回收尾句柄,**不记成功** —— 「拿到响应头」不等于「号把话说完」,
   * 成功判定挪到流正常收尾那一格(审计缺陷 1)。
   */
  const finish = (resp: Response, terminal?: StreamTerminal): AccountAttempt => {
    const sample = started.stop()
    if (!terminal) recordSuccess(row, req, rawModel)
    return {
      ok: true,
      response: resp,
      latencyMs: sample.perfMs,
      latencyTrusted: sample.trustworthy,
      ...(terminal ? { terminal } : {}),
    }
  }
  const fail = (
    kind: FailureKind,
    reason: string,
    httpStatus?: number,
    backoff?: RateBackoff,
  ): AccountAttempt => {
    recordFailure(row, kind, reason, backoff)
    return { ok: false, kind, reason, httpStatus }
  }

  // 上游模型名 = 模型目录别名映射结果(无映射原样透传);网关对外语义仍是 rawModel
  const normReq = toNormalized(req, opts.upstreamModel)
  // 出口代理 = 账号自带 proxyUrl 优先,否则代理池轮换(池空/异常降级直连)
  const doFetch = poolFetch(opts.proxy)

  // ── 路径 A:多段式协议(executeChat 自带 fetch/会话编排)──
  if (adapter.executeChat) {
    const credentials = decryptAccountCredentials(row)
    const ctx: AdapterAccountContext = { row, credentials }
    const timed = withUpstreamTimeout(req.signal)
    try {
      const result = await adapter.executeChat(ctx, normReq, {
        signal: timed.signal,
        proxyUrl: opts.proxy,
        fetchImpl: doFetch,
      })
      if (result.stream) {
        const terminal = newStreamTerminal()
        return finish(chunksToSseResponse(result.stream, terminal), terminal)
      }
      if (result.completion) return finish(Response.json(result.completion))
      return fail('server', 'executeChat 返回空结果')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // 上游超时与客户端断开必须区分:前者罚号/可 failover,后者立即终止
      if (timed.timedOut()) return fail('network', `上游响应超时(${UPSTREAM_TIMEOUT_MS}ms)`)
      if (adapter.isAuthError?.(err)) {
        const refreshed = await refreshRowInPlace(row, adapter)
        if (refreshed) {
          const retryTimed = withUpstreamTimeout(req.signal)
          try {
            const retry = await adapter.executeChat(
              { row: refreshed, credentials: decryptAccountCredentials(refreshed) },
              normReq,
              { signal: retryTimed.signal, proxyUrl: refreshed.proxyUrl, fetchImpl: doFetch },
            )
            if (retry.stream) {
              const retryTerminal = newStreamTerminal()
              return finish(chunksToSseResponse(retry.stream, retryTerminal), retryTerminal)
            }
            if (retry.completion) return finish(Response.json(retry.completion))
          } catch (err2) {
            if (retryTimed.timedOut()) {
              return fail('network', `刷新后上游响应超时(${UPSTREAM_TIMEOUT_MS}ms)`)
            }
            const retryKind = classifyThrownError(adapter, err2)
            return fail(
              retryKind,
              `刷新后重试仍失败: ${err2 instanceof Error ? err2.message : msg}`,
              undefined,
              rateBackoffFor(retryKind, headersOfThrown(err2)),
            )
          } finally {
            retryTimed.clear()
          }
          return fail('server', 'executeChat 刷新重试返回空结果')
        }
        return fail('auth', `鉴权失败且刷新未成功: ${msg}`)
      }
      const thrownKind = classifyThrownError(adapter, err)
      return fail(thrownKind, msg, undefined, rateBackoffFor(thrownKind, headersOfThrown(err)))
    } finally {
      timed.clear()
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
  const timed = withUpstreamTimeout(req.signal)
  try {
    resp = await doFetch(httpReq.url, {
      method: httpReq.method,
      headers: httpReq.headers,
      body:
        httpReq.rawBody ?? (httpReq.body !== undefined ? JSON.stringify(httpReq.body) : undefined),
      signal: timed.signal,
    })
  } catch (err) {
    if (timed.timedOut()) return fail('network', `上游响应超时(${UPSTREAM_TIMEOUT_MS}ms)`)
    if ((err as Error)?.name === 'AbortError') throw err // 客户端断开:上抛由主循环终止
    return fail('network', `上游网络错误: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    timed.clear() // 响应头已到:正文流式阶段不再受超时约束
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
          const retryTimed = withUpstreamTimeout(req.signal)
          let retryResp: Response
          try {
            retryResp = await doFetch(retryReq.url, {
              method: retryReq.method,
              headers: retryReq.headers,
              body:
                retryReq.rawBody ??
                (retryReq.body !== undefined ? JSON.stringify(retryReq.body) : undefined),
              signal: retryTimed.signal,
            })
          } finally {
            retryTimed.clear()
          }
          if (retryResp.ok && retryResp.body) {
            return await consumeUpstreamResponse(
              retryResp,
              adapter,
              retryCtx,
              req,
              rawModel,
              finish,
              fail,
            )
          }
          const retryText = await safeText(retryResp)
          const retryFailKind = classifyFailure(adapter, retryResp.status, retryText)
          const retryBackoff = rateBackoffFor(retryFailKind, retryResp.headers)
          return fail(
            retryFailKind,
            `刷新后仍失败: 上游 ${retryResp.status}${retryBackoff ? ` ${retryBackoff.note}` : ''}`,
            retryResp.status,
            retryBackoff,
          )
        } catch (err) {
          if ((err as Error)?.name === 'AbortError' && !req.signal?.aborted) {
            // 重试段的超时(时刻已过)同样按网络类罚号
            return fail('network', `刷新后上游响应超时(${UPSTREAM_TIMEOUT_MS}ms)`)
          }
          if ((err as Error)?.name === 'AbortError') throw err
          const thrownKind = classifyThrownError(adapter, err)
          return fail(
            thrownKind,
            `刷新后重试异常: ${err instanceof Error ? err.message : String(err)}`,
            undefined,
            rateBackoffFor(thrownKind, headersOfThrown(err)),
          )
        }
      }
    }
    const backoff = rateBackoffFor(kind, resp.headers)
    return fail(
      kind,
      `上游 ${resp.status}: ${bodyText.slice(0, 200) || '(空响应体)'}${backoff ? ` ${backoff.note}` : ''}`,
      resp.status,
      backoff,
    )
  }

  return consumeUpstreamResponse(resp, adapter, ctx, req, rawModel, finish, fail)
}

/** 2xx 响应消费:流式逐帧翻译 / 非流式 JSON 或强制流式聚合 */
async function consumeUpstreamResponse(
  resp: Response,
  adapter: RelayUpstreamAdapter,
  ctx: AdapterAccountContext,
  req: UpstreamForwardRequest,
  rawModel: string,
  finish: (r: Response, terminal?: StreamTerminal) => AccountAttempt,
  fail: (
    kind: FailureKind,
    reason: string,
    httpStatus?: number,
    backoff?: RateBackoff,
  ) => AccountAttempt,
): Promise<AccountAttempt> {
  const body = resp.body
  // 2xx 但不可消费/不可解析 = 上游服务异常,必须罚号(否则坏上游永远健康)
  if (!body) return fail('server', '上游响应无 body', resp.status)
  if (req.stream) {
    // 流式:成功记账交回收尾句柄,不在这里落(半包/断流曾被这一格洗成 healthy)
    const terminal = newStreamTerminal()
    return finish(translateSseResponse(body, adapter, ctx, req.stop, terminal), terminal)
  }
  const ct = resp.headers.get('content-type') ?? ''
  if (ct.includes('text/event-stream')) {
    // 上游拒绝非流式(WorkBuddy):网关侧聚合成 chat.completion
    try {
      const completion = await aggregateSseToCompletion(body, adapter, ctx, rawModel, req.stop)
      return finish(Response.json(completion))
    } catch (err) {
      return fail(
        'server',
        `上游流聚合失败: ${err instanceof Error ? err.message : String(err)}`,
        resp.status,
      )
    }
  }
  let json: unknown
  try {
    json = await resp.json()
  } catch (err) {
    return fail(
      'server',
      `上游 JSON 解析失败: ${err instanceof Error ? err.message : ''}`,
      resp.status,
    )
  }
  try {
    const completion = adapter.translateNonStream(ctx, json)
    applyStopToCompletion(completion, req.stop)
    return finish(Response.json(completion))
  } catch (err) {
    return fail(
      'server',
      `响应翻译失败: ${err instanceof Error ? err.message : String(err)}`,
      resp.status,
    )
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
    // 上游静默忽略的语义参数不在这里"假装支持":候选数 >1 / logprobs 直接交回 ai-service 链路
    if (req.n !== undefined && req.n > 1) return null
    if (req.logprobs === true) return null
    const providers = await resolvePoolProviders(rawModel)
    if (providers.length === 0) return null
    // 选号策略每请求现读(env 旋钮单源 relay-pool-policy,默认档 = 既有确定性行为)
    const policy = readRelayPoolPolicy()
    const selection = await selectAccountCandidates(
      req,
      rawModel,
      providers.map((p) => p.providerCode),
      { policy },
    )
    const candidates = selection.rows
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
      // 模型别名映射 + 代理池取号(两服务内部全吞异常,不会抛)
      const alias = await resolveModelAlias(row.providerCode, rawModel)
      const upstreamModel = alias?.upstreamModel ?? rawModel
      // 账号级并发闸:超限直接换下一候选,绝不把同一账号打满(上游风控的首要触发面)
      if (!tryAcquireAccount(row.id)) {
        lastError = `账号 ${row.name} 并发已达上限(${ACCOUNT_MAX_INFLIGHT})`
        continue
      }
      // 全局在途闸(O93,pool.max_in_flight_global 对标):达上限像冷却一样跳过该候选,
      // 不排队久等;关闭档(maxInFlightGlobal<=0)零 Redis 往返。全候选都被闸挡下 ⇒
      // 本请求以带标签的失败结论回绝(调用方回退 ai-service,不是硬中断)。
      let globalHandle: GlobalInflightHandle | null = null
      if (policy.maxInFlightGlobal > 0) {
        globalHandle = await tryAcquireGlobalInflight(policy.maxInFlightGlobal)
        if (!globalHandle) {
          releaseAccount(row.id)
          lastError = `号池全局并发已达上限(${policy.maxInFlightGlobal})`
          continue
        }
      }
      let released = false
      const releaseOnce = (): void => {
        if (released) return
        released = true
        releaseAccount(row.id)
        if (globalHandle) void globalHandle.release()
      }
      const proxy = await pickProxyForAccount({ id: row.id, proxyUrl: row.proxyUrl })
      let attempt: AccountAttempt
      try {
        attempt = await attemptWithAccount(adapter, row, req, rawModel, {
          upstreamModel,
          proxy,
        })
      } catch (err) {
        releaseOnce()
        if ((err as Error)?.name === 'AbortError') {
          return { ok: false, reason: 'client aborted' } // 客户端断开:不记失败账
        }
        attempt = {
          ok: false,
          kind: 'network',
          reason: err instanceof Error ? err.message : String(err),
        }
      }
      if (attempt.ok && attempt.response) {
        const terminal = attempt.terminal
        const isStream = terminal !== undefined
        // 非流式:代理成功照旧当场记(body 已读完,没有"之后才断"这一格)
        if (proxy && !isStream) void reportProxySuccess(proxy)
        // 用量台账:tap 响应流提取 usage(恰好一次;无 usage 记 0/0),永不阻塞/影响主路径
        // 流式的成功/失败记账与代理上报一并落在这一格:判据 = 收尾结论,不是响应头
        const response = tapAccountUsage(attempt.response, terminal, (u, outcome) => {
          releaseOnce() // 流结束/断开时归还并发额度(tap 保证恰好一次)
          if (!isStream || outcome === 'clean') {
            if (isStream) {
              // 「流正常收尾」才回血 + 续亲和(审计缺陷 1 的正解)
              recordSuccess(row, req, rawModel)
              if (proxy) void reportProxySuccess(proxy)
            }
            void recordAccountUsage({
              accountId: row.id,
              providerCode: row.providerCode,
              model: rawModel,
              promptTokens: u.promptTokens,
              completionTokens: u.completionTokens,
              reasoningTokens: u.reasoningTokens,
              cachedTokens: u.cachedTokens,
              ok: true,
              latencyMs: attempt.latencyMs ?? 0,
            })
            return
          }
          // ── 断流 / 半包 ─────────────────────────────────────────────────────────
          // 客户端主动断开不是号的账(与主循环 AbortError「不记失败账」同口径),但仍要计数?
          // 不:relay_stream_interrupt_total 量的是「上游没把话说完」,客户端断开混进去会顶掉
          // 这一格的可归因性,故断开只归还额度、不进任何账。
          if (req.signal?.aborted === true) return
          recordRelayStreamInterrupt(row.providerCode)
          const kind = kindForStreamInterrupt(adapter, terminal?.error)
          const detail =
            terminal?.error instanceof Error
              ? terminal.error.message
              : terminal?.error !== undefined
                ? String(terminal?.error)
                : '上游未给收尾帧([DONE]/finish_reason)即结束 = 半包'
          recordFailure(row, kind, `上游流中断(未正常收尾): ${detail}`)
          logger.warn('[relay-account-forwarder] 流式断流:本轮改判失败,不记成功', {
            accountId: row.id,
            providerCode: row.providerCode,
            model: rawModel,
            kind,
            interruptTotal: snapshotRelayStreamInterrupts()[row.providerCode] ?? 0,
            reason: detail,
          })
          // 断流属代理/网络级证据:代理腿半途断了不能被记成"这路子好走"
          if (proxy) void reportProxyFailure(proxy)
          void recordAccountUsage({
            accountId: row.id,
            providerCode: row.providerCode,
            model: rawModel,
            promptTokens: u.promptTokens,
            completionTokens: u.completionTokens,
            reasoningTokens: u.reasoningTokens,
            cachedTokens: u.cachedTokens,
            ok: false,
            latencyMs: attempt.latencyMs ?? 0,
          })
        })
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
          response,
          channel,
          latencyMs: attempt.latencyMs ?? 0,
          latencyTrusted: attempt.latencyTrusted ?? false,
        }
      }
      lastError = attempt.reason ?? lastError
      if (attempt.httpStatus !== undefined) lastHttpStatus = attempt.httpStatus
      releaseOnce() // 失败号已无在途流,立即归还额度,后续请求可继续探测
      // 代理级失败(网络/上游 5xx)才计代理失败;账号级问题(auth/credit…)不动代理
      if (proxy && (attempt.kind === 'network' || attempt.kind === 'server')) {
        void reportProxyFailure(proxy)
      }
      void recordAccountUsage({
        accountId: row.id,
        providerCode: row.providerCode,
        model: rawModel,
        promptTokens: 0,
        completionTokens: 0,
        ok: false,
        latencyMs: 0,
      })
    }
    return { ok: false, reason: lastError, lastHttpStatus }
  } catch {
    return null // 账号池链路任何异常 → 调用方继续回退 ai-service
  }
}

export const __test__ = {
  mergeToolCallDelta,
  // ── 上游退避头(判据单源:镜像测试直接用生产实现,不复制第二份判据/常量)──
  extractUpstreamBackoffMs,
  planRateBackoff,
  rateBackoffFor,
  headerOf,
  RATE_COOLDOWN_MS,
  RATE_COOLDOWN_MAX_MS,
  // ── 流式收尾诚实性 ──
  newStreamTerminal,
  judgeStreamOutcome,
  kindForStreamInterrupt,
  // ── 出网复检(档位判据住在 utils/relay-egress-guard.ts,此处只暴露接线入口)──
  poolFetch,
  // ── 选号(O93):策略管线接线入口(policy 与 rng 注入 ⇒ 用例无需碰 env/时钟)──
  selectAccountCandidates,
  readRelayPoolPolicy,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
