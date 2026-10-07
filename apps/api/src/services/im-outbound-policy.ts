// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * IM 出站/入站投递策略(2026-09-29 立,台账号 G-815413 / 815415 / 815416 / 815417)。
 *
 * 为什么单独成文件:票面明令「退避/熔断/分段必须是**一份**策略,禁止散在路由里」。
 * 上游 `packages/services/src/bots/` 的同族实现已整读,数值与判据逐条对应如下,
 * 每条常量都写明依据 —— 凭直觉写的数字下一轮无法判断是不是被顺手改过。
 *
 * 本模块**不碰网络、不碰 DB、不碰 Redis、不读环境变量**:
 * 传输由调用方(`apps/api/src/routes/im-gateway.ts`)以回调注入,
 * 时钟与定时器同理 —— 于是每条判据都能在构造面上成对钉死(正例 + "旧写法会怎样"的反例),
 * 也满足 AGENTS §5 测试隔离铁律(用例不得对生产 PG 8810 / Redis 8811 产生副作用)。
 */
import { createHash } from 'node:crypto'
import { t } from './i18n-outbound.js'

// ------ 常量(唯一真相源)------

/**
 * 单次出站请求的 deadline(罩住「发出请求 → 响应体消费结束」整段)。
 * 依据:与改造前 `im-gateway.ts` `doFetch` 的 10s **逐字同值** —— 本票只要求把罩子延长到
 * 响应体消费结束(见 `providers/providerRequest.ts:29-40`),不改超时语义。
 */
export const OUTBOUND_REQUEST_TIMEOUT_MS = 10_000

/**
 * 长文本单段上限(字符数)。
 * 依据:上游 `replyFormatter.ts:270-286` 按 3500 分段、优先在 `\n`/空格断。
 * 我方刻意用**字符数**而不是上游 `feishuProvider.ts:1083-1090` 的"硬字节切"——
 * 字节切会把多字节中文劈成半个字,且那一处**没有任何标记**,读者看不出内容被切断
 * (票面「刻意不抄」点名的就是它)。硬切在本模块只允许**带标记**发生(见 HARD_CUT_MARK)。
 */
export const OUTBOUND_MAX_CHARS_PER_SEGMENT = 3500

/**
 * 单次出站允许投递的最大段数。超出即折叠:发前 N 段,最后一段**显式告知剩余段数**。
 * 依据:我方自定,写在此处当唯一档 —— 10 段 × 3500 字 = 35,000 字,再长就已经不是
 * "一条 IM 消息"而是文档,应当由上层改走文件/链接而不是把队列打满。
 */
export const OUTBOUND_MAX_SEGMENTS_PER_SEND = 10

/** 硬切接缝处附加在**左段末尾**的标记(有标记才允许硬切,禁止静默截断)。 */
export const OUTBOUND_HARD_CUT_MARK = t('apiOutbound.hardCutMark')

/** 折叠时追加在最后一段末尾的告知模板(把"剩余没发"这件事说给用户,不静默丢尾)。
 *  G-1058621:locale 由调用方按目标订阅用户语言传入;缺省(undefined)仍渲染 zh-CN,
 *  与改造前逐字同值 —— 界下零行为变化。 */
export function outboundFoldNotice(omittedSegmentCount: number, locale?: string): string {
  return t('apiOutbound.foldNotice', { count: omittedSegmentCount }, locale)
}

/**
 * 一次投递最多实际发出的请求次数(**含有界**:上游 `botsService.ts:665` /
 * `:3846-3849` 的退避是有界重试,不是 while-true)。
 * 依据:与熔断阈值同档(3) —— 连着三次都失败就该转熔断,不该再多试一次。
 */
export const OUTBOUND_RETRY_MAX_ATTEMPTS = 3

/** 退避基数与上限(指数 250 → 500 → 1000 …,封顶 4000ms,总等待有界)。 */
export const OUTBOUND_BACKOFF_BASE_MS = 250
export const OUTBOUND_BACKOFF_CAP_MS = 4_000

/**
 * 连续失败多少次转熔断(上游 `botsService.ts:216` / `:3838-3844`:连续 3 次 ⇒ 熔断)。
 * 熔断期间**不再打平台**,直接回可分辨结论,避免把故障期变成对平台的稳定轰炸。
 */
export const OUTBOUND_CIRCUIT_FAILURE_THRESHOLD = 3

/** 熔断打开多久后半开放一次探测(探测在飞期间后续请求仍按"打开"处理)。 */
export const OUTBOUND_CIRCUIT_OPEN_MS = 60_000

/**
 * 入站去重标记的存活时间。
 * 依据:上游 `botsService.ts:672` / `:2051-2073` 的 TTL 2min —— IM 平台的重投窗口
 * 通常以秒计(飞书/微信 3s、几秒后重试),2min 覆盖住整个重投期,又不至于把
 * 用户"隔一会儿发同一条"误判成重复。
 */
export const INBOUND_DEDUP_TTL_MS = 120_000

/** 去重键前缀(Redis 命名空间;内存兜底档也用它当键前缀,保证两档同形)。 */
export const INBOUND_DEDUP_KEY_PREFIX = 'im:inbound:dedup'

// ------ G-815416 ①:可分辨的投递结论 ------

/**
 * 投递结论。`sent: boolean` 之所以不够:「平台明确拒绝」「没读到响应体」
 * 「2xx 但业务码非 0」「2xx 且 code=0 但没回 message_id」在上报里全被压成 false,
 * 而其中最后两型的处置动作完全不同(前者该改内容,后者该查平台回执字段)。
 */
export type ImDeliveryStatus =
  | 'delivered'
  | 'partial'
  | 'business-rejected'
  | 'no-receipt'
  | 'http-error'
  | 'transport-error'
  | 'circuit-open'

export interface ImDeliveryOutcome {
  /** 是否可作为"已投递"记账(= status==='delivered')。 */
  ok: boolean
  status: ImDeliveryStatus
  /** 失败原因(可诊断、可归因;成功时为 undefined)。 */
  reason?: string
  /** 平台回执的消息 id(有则落库,便于事后核对)。 */
  providerMessageId?: string
  /** 是否值得再试一次(只有这一档参与重试;业务拒绝不参与)。 */
  retryable: boolean
  /** 实际发出的请求次数(折叠/熔断为 0 或已发段数,由调用方补)。 */
  attempts: number
}

/** HTTP 状态码 ⇒ 是否值得重试。429/408/5xx 是暂时性;其余 4xx 是永久拒绝。 */
export function isRetryableHttpStatus(status: number): boolean {
  if (status === 408 || status === 425 || status === 429) return true
  return status >= 500
}

/** 本地就能判定的拒绝(配置缺失等):从未发出请求 ⇒ attempts=0,不参与重试。 */
export function localRejection(reason: string): ImDeliveryOutcome {
  return { ok: false, status: 'business-rejected', reason, retryable: false, attempts: 0 }
}

/** 从平台响应体里取业务码:各平台字段名不同(code / errcode / errno),取第一个数值。 */
function readBusinessCode(json: Record<string, unknown>): number | undefined {
  for (const key of ['code', 'errcode', 'errno'] as const) {
    const v = json[key]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v !== '' && Number.isFinite(Number(v))) return Number(v)
  }
  return undefined
}

/** 从平台响应体里取回执 id(上游 `botsService.ts:3817-3820` 同族字段)。 */
function readProviderMessageId(json: Record<string, unknown>): string | undefined {
  const direct = ['message_id', 'messageId', 'msg_id', 'id'] as const
  for (const key of direct) {
    const v = json[key]
    if (typeof v === 'string' && v.length > 0) return v
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  // 飞书/Lark 的 data.message_id 形态
  const data = json.data
  if (data && typeof data === 'object') {
    const nested = readProviderMessageId(data as Record<string, unknown>)
    if (nested) return nested
  }
  return undefined
}

/**
 * 把「HTTP 状态 + 响应体文本」折成可分辨结论。
 *
 * 两条必须判红的一型(上游证据):
 *  - `feishuProvider.ts:1183`:HTTP 2xx **仍可能业务拒绝**(body 里 code≠0)⇒ 旧写法
 *    `resp.ok` 会把它记成"已投递",账面全绿而用户根本没收到。
 *  - `botsService.ts:3817-3820`:`code=0` 但**没回 message_id** 也算失败 ⇒ 拿不到回执
 *    就无法事后核对,记成成功等于伪造证据。它 retryable=false:消息很可能**已经**发出去了,
 *    自动重试会产出重复消息,只能显式上报由人判。
 */
export function interpretPlatformResponse(status: number, bodyText: string): ImDeliveryOutcome {
  const httpOk = status >= 200 && status < 300
  const parsed = parseJsonObject(bodyText)

  if (!httpOk) {
    const code = parsed ? readBusinessCode(parsed) : undefined
    const detail = code !== undefined ? ` code=${code}` : ''
    return {
      ok: false,
      status: 'http-error',
      reason: t('apiOutbound.httpError', { status, detail }),
      retryable: isRetryableHttpStatus(status),
      attempts: 1,
    }
  }

  if (parsed) {
    const code = readBusinessCode(parsed)
    if (code !== undefined && code !== 0) {
      const msg =
        typeof parsed.msg === 'string'
          ? parsed.msg
          : typeof parsed.errmsg === 'string'
            ? parsed.errmsg
            : undefined
      return {
        ok: false,
        status: 'business-rejected',
        reason: t('apiOutbound.businessRejected', { code, msg: msg ? ` ${msg}` : '' }),
        retryable: false,
        attempts: 1,
      }
    }
    const providerMessageId = readProviderMessageId(parsed)
    if (!providerMessageId) {
      return {
        ok: false,
        status: 'no-receipt',
        reason: t('apiOutbound.noReceipt'),
        retryable: false,
        attempts: 1,
      }
    }
    return {
      ok: true,
      status: 'delivered',
      providerMessageId,
      retryable: false,
      attempts: 1,
    }
  }

  // 2xx 且响应体不是 JSON(通用 webhook 常见:回 "ok" 空串)—— 没有可分辨依据,按 delivered
  // 记账但**不带回执**,并在原因位留一句"无回执",便于下一轮把这一档收紧成判红。
  return {
    ok: true,
    status: 'delivered',
    reason: undefined,
    retryable: false,
    attempts: 1,
  }
}

function parseJsonObject(bodyText: string): Record<string, unknown> | undefined {
  const trimmed = bodyText.trim()
  if (!trimmed.startsWith('{')) return undefined
  try {
    const json = JSON.parse(trimmed) as unknown
    return json && typeof json === 'object' && !Array.isArray(json)
      ? (json as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  }
}

/** 传输层异常(含 deadline 在响应体阶段触发)⇒ 一律 retryable:没拿到任何平台结论。 */
export function classifyTransportError(err: unknown): ImDeliveryOutcome {
  const e = err as { name?: string; message?: string }
  const timedOut =
    e?.name === 'AbortError' ||
    (typeof e?.message === 'string' &&
      (e.message.includes('超时') || e.message.includes('timeout')))
  return {
    ok: false,
    status: 'transport-error',
    reason: timedOut
      ? t('apiOutbound.deliveryTimeout')
      : t('apiOutbound.deliveryError', { message: e?.message ?? 'unknown' }),
    retryable: true,
    attempts: 1,
  }
}

// ------ G-815416 ②:有界退避 + 熔断 ------

/** 第 attempt 次(从 1 计)失败之后应等待的毫秒数:指数、封顶、**无随机**(可测)。 */
export function computeBackoffDelayMs(
  attempt: number,
  baseMs = OUTBOUND_BACKOFF_BASE_MS,
  capMs = OUTBOUND_BACKOFF_CAP_MS,
): number {
  if (!Number.isFinite(attempt) || attempt < 1) return 0
  const raw = baseMs * 2 ** (attempt - 1)
  return Math.min(raw, capMs)
}

export type CircuitDecision =
  { allowed: true; halfOpen: boolean } | { allowed: false; retryAfterMs: number }

interface CircuitEntry {
  consecutiveFailures: number
  openedAt: number | null
  probeInFlight: boolean
}

/**
 * 连续失败熔断器(键级)。三条判据都有成对用例:
 *  - 连着 N 次失败 ⇒ 打开;
 *  - 打开期内不允许,半开只放**一个**探测(探测在飞时后续仍拒);
 *  - 一次成功 ⇒ 计数清零并关闭(否则这条链永远打不开)。
 */
export class OutboundCircuitBreaker {
  private readonly entries = new Map<string, CircuitEntry>()
  private readonly failureThreshold: number
  private readonly openMs: number
  private readonly now: () => number

  constructor(opts: { failureThreshold?: number; openMs?: number; now?: () => number } = {}) {
    this.failureThreshold = opts.failureThreshold ?? OUTBOUND_CIRCUIT_FAILURE_THRESHOLD
    this.openMs = opts.openMs ?? OUTBOUND_CIRCUIT_OPEN_MS
    this.now = opts.now ?? (() => Date.now())
  }

  /** 熔断键:按「用户 × 平台」隔离,一个平台的故障不该关掉别人的另一条链路。 */
  static keyFor(userId: string, platform: string): string {
    return `${userId}::${platform}`
  }

  private entryOf(key: string): CircuitEntry {
    let e = this.entries.get(key)
    if (!e) {
      e = { consecutiveFailures: 0, openedAt: null, probeInFlight: false }
      this.entries.set(key, e)
    }
    return e
  }

  decision(key: string): CircuitDecision {
    const e = this.entryOf(key)
    if (e.openedAt === null) return { allowed: true, halfOpen: false }
    const elapsed = this.now() - e.openedAt
    if (elapsed >= this.openMs) {
      if (e.probeInFlight) {
        return { allowed: false, retryAfterMs: 1 }
      }
      e.probeInFlight = true
      return { allowed: true, halfOpen: true }
    }
    return { allowed: false, retryAfterMs: this.openMs - elapsed }
  }

  recordFailure(key: string): void {
    const e = this.entryOf(key)
    e.probeInFlight = false
    e.consecutiveFailures += 1
    if (e.consecutiveFailures >= this.failureThreshold) {
      e.openedAt = this.now()
    }
  }

  recordSuccess(key: string): void {
    const e = this.entryOf(key)
    e.consecutiveFailures = 0
    e.openedAt = null
    e.probeInFlight = false
  }

  snapshot(key: string): { consecutiveFailures: number; opened: boolean } {
    const e = this.entryOf(key)
    return { consecutiveFailures: e.consecutiveFailures, opened: e.openedAt !== null }
  }

  reset(): void {
    this.entries.clear()
  }
}

/** 进程级单例(与旧 `doFetch` 同为"每次请求即发"的形态,不引入新的持久状态)。 */
export const imOutboundCircuitBreaker = new OutboundCircuitBreaker()

export function circuitOpenOutcome(retryAfterMs: number): ImDeliveryOutcome {
  return {
    ok: false,
    status: 'circuit-open',
    reason: t('apiOutbound.circuitOpen', { seconds: Math.ceil(retryAfterMs / 1000) }),
    retryable: false,
    attempts: 0,
  }
}

// ------ G-815417:长文本分段(边界优先 + 有标记硬切 + 折叠计数)------

export type SegmentSeam = 'newline' | 'space' | 'hard-cut'

export interface PlannedSegment {
  text: string
  /** 这一段与**上一段**之间的接缝类型;首段为 null。 */
  seam: SegmentSeam | null
}

export interface TextSegmentPlan {
  segments: PlannedSegment[]
  /** 无边界可用而被迫硬切的次数(>0 时每一处都有 OUTBOUND_HARD_CUT_MARK 标记)。 */
  hardCutCount: number
}

/** 找一个不超过 limit 的断点:优先 `\n`,其次空格,都没有则硬切(调用方负责加标记)。 */
function pickCutIndex(chunk: string, limit: number): { index: number; seam: SegmentSeam } {
  const window = chunk.slice(0, limit)
  const nl = window.lastIndexOf('\n')
  if (nl >= 0) return { index: nl + 1, seam: 'newline' }
  const sp = window.lastIndexOf(' ')
  if (sp >= 0) return { index: sp + 1, seam: 'space' }
  return { index: limit, seam: 'hard-cut' }
}

/**
 * 按 `maxChars` 规划分段。三条不变量(测试逐条钉死):
 *  ① **不丢尾**:`segments.map(s => s.text).join('') === text`(一个字符都不增不减,
 *     换行/空格留在前一段末尾 ⇒ 划分是无损的);
 *  ② 每段长度 ≤ maxChars;
 *  ③ 无边界的那一段按 hard-cut 切开,并被计入 `hardCutCount`(渲染层据此补标记)。
 */
export function planTextSegments(
  text: string,
  maxChars = OUTBOUND_MAX_CHARS_PER_SEGMENT,
): TextSegmentPlan {
  const limit = Math.max(1, Math.floor(maxChars))
  if (text.length === 0) return { segments: [], hardCutCount: 0 }
  if (text.length <= limit) return { segments: [{ text, seam: null }], hardCutCount: 0 }

  const segments: PlannedSegment[] = []
  let rest = text
  let hardCutCount = 0
  let previousSeam: SegmentSeam | null = null
  while (rest.length > 0) {
    if (rest.length <= limit) {
      segments.push({ text: rest, seam: previousSeam })
      rest = ''
      break
    }
    const cut = pickCutIndex(rest, limit)
    const piece = rest.slice(0, cut.index)
    if (piece.length === 0) {
      // 理论上不可达(limit ≥ 1),真到了也必须前进一个字符,否则死循环
      segments.push({ text: rest.slice(0, 1), seam: previousSeam })
      rest = rest.slice(1)
      previousSeam = 'hard-cut'
      hardCutCount += 1
      continue
    }
    segments.push({ text: piece, seam: previousSeam })
    rest = rest.slice(piece.length)
    if (cut.seam === 'hard-cut') hardCutCount += 1
    previousSeam = cut.seam
  }
  return { segments, hardCutCount }
}

export interface RenderedOutbound {
  /** 实际要逐段发出的文本(已补硬切标记;折叠时最后一段带剩余段数告知)。 */
  messages: string[]
  /** 折叠掉的段数(未投递的尾部段数;>0 时最后一条消息已写明)。 */
  omittedSegmentCount: number
  hardCutCount: number
  /** 是否全部段落都会发出(false ⇒ 有内容因折叠而未投递)。 */
  complete: boolean
}

/**
 * 把分段计划渲染成可发送文本数组。
 * 段数超过 `maxSegments` 时**折叠**:只发前 N 段,并在最后一段追加"剩余 N 段未发送"的
 * 显式告知 —— 静默丢尾是伪造完整性,与 §5e「失败必须响」同一条禁令。
 */
export function renderOutboundSegments(
  plan: TextSegmentPlan,
  opts: { maxSegments?: number; hardCutMark?: string; notice?: (omitted: number) => string } = {},
): RenderedOutbound {
  const maxSegments = Math.max(1, Math.floor(opts.maxSegments ?? OUTBOUND_MAX_SEGMENTS_PER_SEND))
  const hardCutMark = opts.hardCutMark ?? OUTBOUND_HARD_CUT_MARK
  const notice = opts.notice ?? outboundFoldNotice

  const marked = plan.segments.map((seg, i) => {
    const needsMark = seg.seam === 'hard-cut' && i > 0 && hardCutMark.length > 0
    return needsMark ? seg.text + hardCutMark : seg.text
  })
  const omitted = Math.max(0, marked.length - maxSegments)
  const kept = marked.slice(0, maxSegments)
  if (omitted > 0 && kept.length > 0) {
    kept[kept.length - 1] = (kept[kept.length - 1] as string) + notice(omitted)
  }
  return {
    messages: kept,
    omittedSegmentCount: omitted,
    hardCutCount: plan.hardCutCount,
    complete: omitted === 0,
  }
}

// ------ G-815415:入站去重键 + 存储(claim / release)------

export interface InboundDedupInput {
  platform: string
  /** 归属用户(由服务端验签结果算出,不得取请求体自报值 —— 见 G-815418)。 */
  userId: string
  chatId?: string
  fromUserId?: string
  platformMessageId?: string
  text?: string
}

/** 稳定哈希(sha256 十六进制前 16 位足够区分同会话内的两条同文消息)。 */
export function hashInboundText(text: string | undefined): string {
  return createHash('sha256')
    .update(text ?? '')
    .digest('hex')
    .slice(0, 16)
}

/**
 * 稳定消息 id:平台带了就用平台的,**没带**时按「发送者 + 正文哈希」推出一个可复现的 id。
 * 旧写法是 `?? randomUUID()` —— 同一条重投每次都换一个 id,于是二次落库、二次入队、
 * LLM 回两遍(票 G-815415 的病根)。可复现是这里的唯一要求,不是"好看"。
 */
export function deriveInboundMessageId(input: InboundDedupInput): string {
  if (input.platformMessageId && input.platformMessageId.length > 0) {
    return input.platformMessageId
  }
  return `derived:${input.fromUserId ?? 'unknown'}:${hashInboundText(input.text)}`
}

/**
 * 上游 `botsService.ts:2005-2016` 的键形如
 * `botId::provider::(chatId|providerUserId)::providerMessageId`。
 * 我方对应:`platform::userId::(chatId|fromUserId)::消息标识`,其中消息标识:
 *  - 平台带了消息 id ⇒ 用它(最精确);
 *  - **没带** ⇒ 用 `deriveInboundMessageId` 的"发送者 + 正文哈希"稳定值(见上)。
 */
export function buildInboundDedupKey(input: InboundDedupInput): string {
  const scope =
    input.chatId && input.chatId.length > 0 ? input.chatId : (input.fromUserId ?? 'unknown')
  return `${INBOUND_DEDUP_KEY_PREFIX}::${input.platform}::${input.userId}::${scope}::msg:${deriveInboundMessageId(input)}`
}

export type DedupClaim = 'claimed' | 'duplicate' | 'unknown'

/**
 * 去重存储出口。两条实现:
 *  - `createRedisDedupStore`:SET NX PX,多实例共享(Redis 不可用时命令抛错 ⇒ 'unknown');
 *  - `createMemoryDedupStore`:单机兜底 + 测试用,不跨进程(容量有界,防泄漏)。
 * 'unknown' 是**独立第三态**:它不等于"重复"(那会静默丢消息),也不等于"首次"
 * (那会让重投落两遍)。调用方按票面要求把它当"未判定"处理并如实上报。
 */
export interface InboundDedupStore {
  claim(key: string, ttlMs: number): Promise<DedupClaim>
  release(key: string): Promise<void>
}

export interface DedupRedisLike {
  set(key: string, value: string, mode: string, ttlMs: number, flag: string): Promise<unknown>
  del(key: string): Promise<unknown>
}

export function createRedisDedupStore(redis: DedupRedisLike): InboundDedupStore {
  return {
    async claim(key, ttlMs) {
      try {
        const res = await redis.set(key, '1', 'PX', ttlMs, 'NX')
        return res === null || res === undefined ? 'duplicate' : 'claimed'
      } catch {
        return 'unknown'
      }
    },
    async release(key) {
      try {
        await redis.del(key)
      } catch {
        /* 撤回失败不改变结论:标记会随 TTL 自己消失 */
      }
    },
  }
}

export interface MemoryDedupStore extends InboundDedupStore {
  /** 当前未被回收的标记数(容量测试用)。 */
  size(): number
}

/** 内存兜底档:带 TTL 的最小实现,容量上限防止无界增长。 */
export function createMemoryDedupStore(
  opts: { now?: () => number; maxEntries?: number } = {},
): MemoryDedupStore {
  const now = opts.now ?? (() => Date.now())
  const maxEntries = opts.maxEntries ?? 5_000
  const marks = new Map<string, number>()

  function sweep(): void {
    const t = now()
    for (const [k, expireAt] of marks) {
      if (expireAt <= t) marks.delete(k)
    }
  }

  return {
    async claim(key, ttlMs) {
      sweep()
      const existing = marks.get(key)
      if (existing !== undefined && existing > now()) return 'duplicate'
      if (marks.size >= maxEntries && existing === undefined) {
        // 容量已满且这是新键:宁可放行(可能重复落库)也不静默丢消息
        marks.set(key, now() + ttlMs)
        return 'claimed'
      }
      marks.set(key, now() + ttlMs)
      return 'claimed'
    },
    async release(key) {
      marks.delete(key)
    },
    size() {
      sweep()
      return marks.size
    },
  }
}

export interface InboundIntakeSteps {
  /** 落库(失败 ⇒ 本次 intake 没成立)。 */
  persist: () => Promise<void>
  /** 交给下游消费队列(ai-service im_bridge)。 */
  handoff: () => Promise<{ queued: boolean; reason?: string }>
}

export interface InboundIntakeResult {
  disposition: 'accepted' | 'duplicate' | 'failed-released'
  /** 去重判不出(Redis 命令失败):放行但必须上报,不得当成"重复"吞掉。 */
  dedupUndetermined: boolean
  queued: boolean
  queueReason?: string
}

/**
 * 入站 intake 的唯一流程(claim → persist → handoff,失败撤回)。
 *
 * 为什么把这段从路由里提出来:票面要求的是「**含失败撤回那一半**」,而撤回是否真的发生
 * 只有在能被用例驱动的流程里才判得出来 —— 留在 handler 里就等于"散文规矩",下一轮谁都能
 * 顺手删掉而测试一片绿(本仓最高频失效型)。
 *
 * 撤回的**不对称**是设计:落库失败 ⇒ 撤回(让平台重投进得来);落库成功而入队失败 ⇒ **不**撤回
 * (行已经在库里,撤回会让重投再落一行,而 im_messages 对 platformMessageId 没有唯一索引可挡),
 * 但这件事通过 `queued:false` 明写在响应里,不像旧写法那样静默 return。
 */
export async function runInboundIntake(
  store: InboundDedupStore,
  key: string,
  ttlMs: number,
  steps: InboundIntakeSteps,
): Promise<InboundIntakeResult> {
  const claim = await store.claim(key, ttlMs)
  if (claim === 'duplicate') {
    return { disposition: 'duplicate', dedupUndetermined: false, queued: false }
  }
  try {
    await steps.persist()
  } catch (e) {
    await store.release(key)
    throw e
  }
  const handed = await steps.handoff()
  return {
    disposition: 'accepted',
    dedupUndetermined: claim === 'unknown',
    queued: handed.queued,
    queueReason: handed.reason,
  }
}

// ------ G-815417 ② + G-815416 ③:出站编排(有界重试 + 退避 + 熔断 + 分段)的唯一执行处 ------

export interface OutboundPlan<T> {
  /** 逐份要发出的对象(短消息/非文本消息只有一份,与改造前逐字节同形)。 */
  items: T[]
  /** 分段渲染结果;未发生分段时为 null。 */
  rendered: RenderedOutbound | null
}

/**
 * 把一条出站消息规划成「若干份实际要发的消息」。
 * 只有 `messageType==='text'` 且文本超上限才分段;其余形态**原样一份**
 * (卡片/图片没有"按字数断句"的语义,硬分段会把载荷切坏)。
 * 泛型是为了让调用方拿回自己那个消息类型,而不是被降级成一个宽形状。
 */
export function planOutboundMessages<T extends ImOutboundMessageLike>(
  message: T,
  opts: { maxChars?: number; maxSegments?: number; locale?: string } = {},
): OutboundPlan<T> {
  const maxChars = opts.maxChars ?? OUTBOUND_MAX_CHARS_PER_SEGMENT
  const isPlainText = message.messageType === 'text' && typeof message.text === 'string'
  if (!isPlainText || !message.text || message.text.length <= maxChars) {
    return { items: [message], rendered: null }
  }
  // G-1058621:硬切标记与折叠告知都嵌进**出站正文**,必须按目标用户语言取词;
  // locale 缺省时两次取词与模块常量 OUTBOUND_HARD_CUT_MARK/outboundFoldNotice 同键同参
  // ⇒ 渲染值逐字相同(界下零行为变化,由测试钉住)。
  const rendered = renderOutboundSegments(planTextSegments(message.text, maxChars), {
    maxSegments: opts.maxSegments,
    hardCutMark: t('apiOutbound.hardCutMark', undefined, opts.locale),
    notice: (omitted) => outboundFoldNotice(omitted, opts.locale),
  })
  // 展开 + 覆盖 text 的结果就是 T 本身(只有正文字段被换掉),这里的一次断言是给泛型用的,
  // 不是给"字段可能不匹配"用的。
  return { items: rendered.messages.map((text) => ({ ...message, text }) as T), rendered }
}

/** 路由侧需要的最小消息形状(不绑 `@ihui/types`,便于构造面用例直接喂)。 */
export interface ImOutboundMessageLike {
  messageType: string
  text?: string
}

export interface DeliverWithPolicyDeps<T> {
  /** 发**一份**并返回结论(传输细节在调用方;这里重写的 `attempts` 是"第几次")。 */
  sendItem: (item: T) => Promise<ImDeliveryOutcome>
  circuit: OutboundCircuitBreaker
  circuitKey: string
  maxAttempts?: number
  sleep?: (ms: number) => Promise<void>
}

export interface DeliveryReport {
  outcome: ImDeliveryOutcome
  /** 逐段结论(熔断时每一份都同形;折叠时被折叠的那份根本不在数组里,由 omittedSegmentCount 说明)。 */
  perSegment: ImDeliveryOutcome[]
  attempts: number
}

const noSleep = async (): Promise<void> => undefined

/** 单份:最多 maxAttempts 次,失败之间按 computeBackoffDelayMs 等待;不可重试立即返回。 */
async function deliverSingleItem<T>(
  item: T,
  deps: DeliverWithPolicyDeps<T>,
  maxAttempts: number,
  sleep: (ms: number) => Promise<void>,
): Promise<ImDeliveryOutcome> {
  let last: ImDeliveryOutcome | undefined
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await deps.sendItem(item)
    last = { ...res, attempts: attempt }
    if (res.ok) return last
    if (!res.retryable) return last
    if (attempt < maxAttempts) await sleep(computeBackoffDelayMs(attempt))
  }
  return last ?? classifyTransportError(new Error(t('apiOutbound.noRequestAttempted')))
}

/**
 * 出站投递的唯一编排出口:熔断判定 → 逐份有界重试 → 熔断记账 → 折叠结论。
 * 路由侧**只调它**,不得再抄一份循环/退避(两处各写一遍必然漂移)。
 */
export async function deliverWithPolicy<T>(
  items: T[],
  deps: DeliverWithPolicyDeps<T>,
): Promise<DeliveryReport> {
  const maxAttempts = Math.max(1, Math.floor(deps.maxAttempts ?? OUTBOUND_RETRY_MAX_ATTEMPTS))
  const sleep = deps.sleep ?? noSleep
  const perSegment: ImDeliveryOutcome[] = []

  if (items.length === 0) {
    const nothing = {
      ok: false,
      status: 'business-rejected' as const,
      reason: t('apiOutbound.noSegments'),
      retryable: false,
      attempts: 0,
    }
    return { outcome: nothing, perSegment: [], attempts: 0 }
  }

  const decision = deps.circuit.decision(deps.circuitKey)
  if (!decision.allowed) {
    const open = circuitOpenOutcome(decision.retryAfterMs)
    return { outcome: open, perSegment: items.map(() => ({ ...open })), attempts: 0 }
  }

  let attempts = 0
  let failed: ImDeliveryOutcome | undefined
  for (const item of items) {
    const res = await deliverSingleItem(item, deps, maxAttempts, sleep)
    attempts += res.attempts
    perSegment.push(res)
    if (!res.ok) {
      failed = res
      break
    }
  }

  if (!failed) {
    deps.circuit.recordSuccess(deps.circuitKey)
    const receipts = perSegment
      .map((r) => r.providerMessageId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
    return {
      outcome: {
        ok: true,
        status: 'delivered',
        providerMessageId: receipts[0],
        retryable: false,
        attempts,
      },
      perSegment,
      attempts,
    }
  }

  deps.circuit.recordFailure(deps.circuitKey)
  return { outcome: { ...failed, attempts }, perSegment, attempts }
}

/**
 * 折叠那一支的收尾:前面的段都发出去了,但尾部没发 ⇒ 结论**不得**记成 delivered。
 * 静默把 partial 当成功,就是票面「账面绿而用户少收了半条消息」的那一型。
 */
export function applyFoldToOutcome(
  outcome: ImDeliveryOutcome,
  omittedSegmentCount: number,
): ImDeliveryOutcome {
  if (omittedSegmentCount <= 0) return outcome
  const reason = t('apiOutbound.foldReason', { count: omittedSegmentCount })
  if (!outcome.ok) return { ...outcome, reason: `${outcome.reason ?? ''}；${reason}` }
  return { ok: false, status: 'partial', reason, retryable: false, attempts: outcome.attempts }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
