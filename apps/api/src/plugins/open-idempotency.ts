// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyReply, FastifyRequest, RouteOptions } from 'fastify'
import fp from 'fastify-plugin'
import { config } from '../config/index.js'
import { normalizeHeader } from '../utils/http-normalize.js'

/**
 * O10 开放面通用幂等重放保护 —— 带 `Idempotency-Key` 的写请求只执行一次,重发拿到首次结果。
 *
 * 形态照 `plugins/payment-idempotency.ts`(支付域那套 SETNX 状态机),差异在两处刻意的选择:
 *
 * 1. **可选,不是强制**。能力目录每条 scope 带 `idempotencyRequired`,但本层只在客户端**确实
 *    带了** `Idempotency-Key` 时才生效;不带 → 整条链路零改动。理由:OpenAI 官方 SDK 不发这个头,
 *    强制要求会直接打断标准客户端互操作(`capability-guard.ts:109-115` 同结论,它只登记不 400)。
 * 2. **Redis 不可用时 fail-open**(放行 + warn + 计数),而**不是**沿用支付域那套 fail-closed。
 *    两条判据不同,不要合并:支付回调的失败模式权衡是"重复扣款 vs 少收一笔",放行才是事故;
 *    开放面的写请求失败后果是"这个 key 白丢一次幂等保护",而拦下来的代价是**合法客户端整体不可用**
 *    (Redis 抖动 30s 会把所有带 key 的写请求打成 409)。配额/限流那条链路的降级判据是
 *    `API_KEY_RATE_LIMIT_FAIL_MODE`(它按 risk/billable 决定 503),与本层无关,各管各的。
 *
 * 键:`idem:<凭据维度>:<capability.scope>:<客户端 key>`。凭据维度取 `apiKey.id`,人 JWT 取
 * `userId`,并各带 `key:` / `user:` 前缀 —— 两域即便字符串撞车也互不命中,且 A 的 key
 * 永远无法消费 B 的重放槽位。无凭据(匿名)不启用:没有隔离维度的重放缓存等于跨租户串响应。
 *
 * 生命周期:preHandler `SET NX PX` 抢槽 → 抢到放行,响应跑完后 onSend 把
 * `{statusCode, contentType, body}` 回写同键;没抢到则看对方状态 —— 已完成 = 原样重放,
 * 进行中 = 409。任何"没写下结果"的收口(4xx/5xx、流式、超大体、Redis 中途失联)都在
 * onResponse 删键释放,绝不留孤儿锁把后续重试锁死到 TTL。
 *
 * 不做:run 句柄(异步任务重取)与游标分页 —— 那是另两块骨头,刻意留给后续。
 */

/** 键前缀。与支付域的 `idempotency:payment:` 分开命名空间,便于运维按前缀清理/统计。 */
const KEY_PREFIX = 'idem:'
/** 天然幂等的读方法:重放它们没有价值,只会白占一次 Redis 往返。 */
const IDEMPOTENT_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
/** 缓存记录没带 content-type 时的兜底值;只缓存 JSON,SSE / 文件流一律旁路。 */
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'
/** 单条响应缓存上限。超过它宁可不缓存 —— 别为省一次重算把 Redis 当对象存储用。 */
const MAX_CACHED_BYTES = 256 * 1024
/**
 * Redis 往返的硬截止时间。ioredis 在本项目配置下 `maxRetriesPerRequest: null`(BullMQ 要求),
 * 断连时命令**入队挂起而非 reject** —— 不加截止就等于把"fail-open"实现成"fail-hang",
 * 比拦人更糟。超时按 Redis 不可用处置。
 */
const REDIS_DEADLINE_MS = 1000
/** 客户端 key 的长度上限,与 capability-guard 注入时用的截断保持一致。 */
const MAX_CLIENT_KEY_LEN = 200

/** 落在 Redis 里的两条状态。认不出的一律并进 Probe 的 'unreadable',处置见 preHandler 尾部。 */
interface InflightRecord {
  status: 'processing'
  ts: number
}
interface CompletedRecord {
  status: 'completed'
  ts: number
  statusCode: number
  contentType: string
  body: string
}
type StoredRecord = InflightRecord | CompletedRecord

/** 槽位探针的三态(处置彼此相反,所以不能并成一态,详见 inspect 的注释)。 */
type Probe =
  { state: 'missing' } | { state: 'unreadable' } | { state: 'record'; record: StoredRecord }

/** 本次请求持有的槽位。`recorded` = onSend 已把结果写回同键,onResponse 就不该再删。 */
export interface IdempotencyHold {
  key: string
  recorded: boolean
}

export interface OpenIdempotencyCounters {
  /** 抢到槽位、正常进入 handler 的次数 */
  acquired: number
  /** 命中已完成记录、原样重放的次数 */
  replayed: number
  /** 命中进行中记录、回 409 的次数 */
  inProgressRejected: number
  /** Redis 不可用/超时 → fail-open 放行的次数(健康度信号,该涨的时候找运维) */
  failOpen: number
  /** 响应不可缓存(非 JSON / 流式 / 超大)→ 释放槽位的次数 */
  releasedUnrecorded: number
}

export interface OpenIdempotencyApi {
  counters: OpenIdempotencyCounters
  ttlSeconds: number
}

declare module 'fastify' {
  interface FastifyInstance {
    openIdempotency: OpenIdempotencyApi
  }
  interface FastifyRequest {
    /** 本请求是否持有开放面幂等槽位,由 preHandler 抢中时挂上,onSend/onResponse 据此收口。 */
    openIdempotencyHold?: IdempotencyHold
  }
}

/** `Promise.race` 包一层:把"永不 reject 的 ioredis 命令"翻译成可判定的成/败。 */
type Outcome<T> = { ok: true; value: T } | { ok: false; error: unknown }

async function withinDeadline<T>(task: Promise<T>, deadlineMs: number): Promise<Outcome<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const value = await Promise.race([
      task,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('idempotency redis deadline exceeded')),
          deadlineMs,
        )
      }),
    ])
    return { ok: true, value }
  } catch (error) {
    return { ok: false, error }
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

function parseRecord(raw: string): StoredRecord | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined
  const rec = parsed as Record<string, unknown>
  const ts = typeof rec.ts === 'number' ? rec.ts : 0
  if (rec.status === 'processing') return { status: 'processing', ts }
  if (
    rec.status === 'completed' &&
    typeof rec.body === 'string' &&
    typeof rec.statusCode === 'number'
  ) {
    return {
      status: 'completed',
      ts,
      statusCode: rec.statusCode,
      contentType: typeof rec.contentType === 'string' ? rec.contentType : JSON_CONTENT_TYPE,
      body: rec.body,
    }
  }
  return undefined
}

/** 凭据维度:机器 key 优先(它是计费与归属的主体),其次人 JWT。都没有 = 不启用。 */
function credentialScopeOf(request: FastifyRequest): string | undefined {
  const apiKeyId = request.apiKey?.id
  if (apiKeyId) return `key:${apiKeyId}`
  const userId = request.userId
  if (userId) return `user:${userId}`
  return undefined
}

/**
 * 客户端幂等键。首选 `request.idempotencyKey`(能力闸已 trim + 截断 200);
 * 兜底自己读头 —— 走 `declareCapability` / `requireAnyCapability` 那几条族不经过
 * `enforceCapability`,那个字段没人写,不能因此让一个老实带 key 的客户端白跑。
 */
function clientKeyOf(request: FastifyRequest): string | undefined {
  if (request.idempotencyKey) return request.idempotencyKey
  const raw = normalizeHeader(request.headers['idempotency-key'])
  return raw ? raw.slice(0, MAX_CLIENT_KEY_LEN) : undefined
}

/** 流式请求不占槽:它压根不会走 onSend,锁只能干等自己烂到 TTL,反而把重试堵死。 */
function wantsStreaming(request: FastifyRequest): boolean {
  const body = request.body
  if (typeof body !== 'object' || body === null) return false
  return (body as { stream?: unknown }).stream === true
}

function isEligible(request: FastifyRequest): boolean {
  if (IDEMPOTENT_SAFE_METHODS.has(request.method)) return false
  if (request.capability?.idempotencyRequired !== true) return false
  if (wantsStreaming(request)) return false
  return clientKeyOf(request) !== undefined && credentialScopeOf(request) !== undefined
}

/** 只对对外协议面挂链条 —— 别的内部路由一个字节都不该因为本层多跑一次。 */
const OPEN_PREFIXES = ['/api/', '/v1/'] as const
function isOpenSurfaceUrl(url: string | undefined): boolean {
  const path = (url ?? '').split('?')[0] ?? ''
  if (path === '/api' || path === '/v1') return true
  return OPEN_PREFIXES.some((prefix) => path.startsWith(prefix))
}

function payloadToText(payload: unknown): string | undefined {
  if (typeof payload === 'string') return payload
  if (Buffer.isBuffer(payload)) return payload.toString('utf8')
  // Readable / AsyncIterable / null:流式或零长度,不缓存
  return undefined
}

function contentTypeOf(reply: FastifyReply): string | undefined {
  const header = reply.getHeader('content-type')
  if (Array.isArray(header)) return typeof header[0] === 'string' ? header[0] : undefined
  return typeof header === 'string' ? header : undefined
}

/** 撞车的回答只有一种形状,抽出来免得三个分支各抄一遍、将来改漏一处。 */
async function sendInProgress(reply: FastifyReply): Promise<void> {
  await reply.status(409).send({
    code: 409,
    message: '相同 Idempotency-Key 的请求正在处理中,请稍后重试',
    errorCode: 'IDEMPOTENCY_IN_PROGRESS',
  })
}

const openIdempotencyPlugin: FastifyPluginAsync = async (server) => {
  const ttlSeconds = config.IDEMPOTENCY_TTL_SECONDS
  const ttlMs = ttlSeconds * 1000
  const counters: OpenIdempotencyCounters = {
    acquired: 0,
    replayed: 0,
    inProgressRejected: 0,
    failOpen: 0,
    releasedUnrecorded: 0,
  }

  // 同一类降级最多 10s 一条日志:Redis 真挂的时候,每请求一条会把日志刷爆反而看不见现场。
  let lastWarnAt = 0
  function warnThrottled(error: unknown, reason: string): void {
    const now = Date.now()
    if (now - lastWarnAt < 10_000) return
    lastWarnAt = now
    server.log.warn({ err: error, reason, ttlSeconds }, 'open idempotency degraded, failing open')
  }

  async function claim(key: string): Promise<'claimed' | 'taken' | 'unavailable'> {
    const result = await withinDeadline(
      server.redis.set(
        key,
        JSON.stringify({ status: 'processing', ts: Date.now() }),
        'PX',
        ttlMs,
        'NX',
      ),
      REDIS_DEADLINE_MS,
    )
    if (!result.ok) {
      counters.failOpen += 1
      warnThrottled(result.error, 'claim')
      return 'unavailable'
    }
    return result.value === 'OK' ? 'claimed' : 'taken'
  }

  /**
   * 抢槽失败后看一眼槽里到底躺着什么。三态分开,因为它们的处置**相反**:
   * - `missing`:键在 claim 与 get 之间刚好蒸发 → 槽位真空着,该重抢;
   * - `record` :读到了认得的状态 → 按 completed / processing 分流;
   * - `unreadable`:键在但读不懂(超时、脏数据)→ 见 preHandler 尾部的判据。
   */
  async function inspect(key: string): Promise<Probe> {
    const result = await withinDeadline(server.redis.get(key), REDIS_DEADLINE_MS)
    if (!result.ok) return { state: 'unreadable' }
    if (result.value === null) return { state: 'missing' }
    const record = parseRecord(result.value)
    return record ? { state: 'record', record } : { state: 'unreadable' }
  }

  async function release(key: string): Promise<void> {
    const result = await withinDeadline(server.redis.del(key), REDIS_DEADLINE_MS)
    if (!result.ok) warnThrottled(result.error, 'release')
  }

  async function store(
    request: FastifyRequest,
    reply: FastifyReply,
    payload: unknown,
  ): Promise<void> {
    const hold = request.openIdempotencyHold
    if (!hold) return
    const contentType = contentTypeOf(reply)
    const statusCode = reply.statusCode
    // 只缓存 2xx/3xx:4xx/5xx 不缓存也不重放,让客户端带同一个 key 立刻重试能真跑一遍。
    if (statusCode >= 400 || !contentType?.includes('application/json')) {
      counters.releasedUnrecorded += 1
      return
    }
    const body = payloadToText(payload)
    if (body === undefined || Buffer.byteLength(body) > MAX_CACHED_BYTES) {
      counters.releasedUnrecorded += 1
      return
    }
    const record: CompletedRecord = {
      status: 'completed',
      ts: Date.now(),
      statusCode,
      contentType,
      body,
    }
    const result = await withinDeadline(
      server.redis.set(hold.key, JSON.stringify(record), 'PX', ttlMs),
      REDIS_DEADLINE_MS,
    )
    if (!result.ok) {
      warnThrottled(result.error, 'store')
      counters.releasedUnrecorded += 1
      return
    }
    hold.recorded = true
  }

  async function preHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!isEligible(request)) return
    const owner = credentialScopeOf(request)
    const clientKey = clientKeyOf(request)
    const scope = request.capability?.scope
    if (!owner || !clientKey || !scope) return
    const key = `${KEY_PREFIX}${owner}:${scope}:${clientKey}`

    const takeSlot = (slotKey: string): void => {
      counters.acquired += 1
      request.openIdempotencyHold = { key: slotKey, recorded: false }
    }

    const first = await claim(key)
    if (first === 'claimed') {
      takeSlot(key)
      return
    }
    if (first === 'unavailable') return

    const probe = await inspect(key)
    if (probe.state === 'record') {
      const current = probe.record
      if (current.status === 'completed') {
        counters.replayed += 1
        await reply.status(current.statusCode).type(current.contentType).send(current.body)
        return
      }
      counters.inProgressRejected += 1
      await sendInProgress(reply)
      return
    }
    if (probe.state === 'unreadable') {
      // 'unreadable':键在但读不懂(脏数据 / 读超时)。它**有可能**正是别人还在跑的那一把,
      // 放行的代价是双计费,而本层存在的全部理由就是挡双跑 —— 所以宁可 409。
      // 不会永久毒化:脏键最多滞留 ttlSeconds 自行蒸发,重试从头跑;此处留一条 warn 存现场。
      server.log.warn(
        { key, ttlSeconds },
        'open idempotency slot unreadable, rejecting as in-progress',
      )
      counters.inProgressRejected += 1
      await sendInProgress(reply)
      return
    }
    // 剩下只有 'missing':上一个请求刚好在 claim 与 get 之间蒸发了,槽位此刻真空着 —— 赌一次
    // 重抢。SET NX 是原子的,并发里最多一个赢家,不会因此双跑;仍抢不到就是有人抢先落了槽。
    if ((await claim(key)) === 'claimed') {
      takeSlot(key)
      return
    }
    counters.inProgressRejected += 1
    await sendInProgress(reply)
  }

  function attachToRoute(routeOptions: RouteOptions): void {
    if (!isOpenSurfaceUrl(routeOptions.url)) return
    const existing = routeOptions.preHandler
    if (existing === undefined) {
      routeOptions.preHandler = [preHandler]
      return
    }
    if (Array.isArray(existing)) {
      // 追加到**末尾**:Fastify 的组合规则是 实例级钩子 → 路由自身 preHandler 数组,
      // 挂在这儿才严格晚于 requireApiKeyAuth / requireCapability / openCapabilityGateway,
      // 那时 request.capability 与 request.apiKey 才可能已经躺好(和 rls-context 同一招)。
      routeOptions.preHandler = [...existing, preHandler]
      return
    }
    routeOptions.preHandler = [existing, preHandler]
  }

  async function onSend(
    request: FastifyRequest,
    reply: FastifyReply,
    payload: unknown,
  ): Promise<unknown> {
    if (request.openIdempotencyHold) {
      // onSend 是最后一棒:这里的 payload 就是客户端真正收到的字节,缓存它才叫"原样重放"。
      await store(request, reply, payload)
    }
    return payload
  }

  server.addHook('onRoute', attachToRoute)
  server.addHook('onSend', onSend)
  server.addHook('onResponse', async (request: FastifyRequest) => {
    const hold = request.openIdempotencyHold
    if (!hold || hold.recorded) return
    // 没刻上结果的门票不能留着咬人 —— 一律释放,让下一次重试从头真跑一遍。
    await release(hold.key)
  })

  server.decorate('openIdempotency', { counters, ttlSeconds })
}

export const openIdempotency = fp(openIdempotencyPlugin, {
  name: 'open-idempotency',
  fastify: '5.x',
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
