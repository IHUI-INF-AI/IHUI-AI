// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 对外游标分页(O10b)—— 不透明游标编解码 + 列表分页内核(纯函数,零 I/O)。
 *
 * 为什么是不透明游标:`/v1` 是 OpenAI/Anthropic 兼容面,`after` 历史上直接收内部资源 id
 * (`asst_<uuid>` / `batch_<uuid>` ...)。把它原样回传给第三方等于把内部 id 形态写进别人的
 * 集成代码里,将来换 id 方案就是破坏性变更。这里把它包成签名游标,内部形态可自由演进。
 *
 * 游标格式(单段,可直接放进 URL,无 padding 无特殊字符):
 *   `cr1_<body>.<sig>`
 *   body = base64url(JSON `[内部id, 归属指纹]`)
 *   归属指纹 = HMAC-SHA256(secret, "ihui-open-cursor-v1|owner|<kind>|<ownerKey>") 前 16 字符
 *   sig    = HMAC-SHA256(secret, "ihui-open-cursor-v1|sig|<body>") 前 22 字符
 * 两段都 keyed 在服务端密钥上:归属指纹让 **A 的游标在 B 的请求里必然解不开**
 * (`foreign-scope`),签名让客户端无法自造/篡改游标。`kind` 把列表族也绑进来,
 * 所以「threads/:id/messages 的第 2 页游标」拿到「threads/:id/runs」上同样不可复用。
 *
 * 与既有 `page/pageSize`(`routes/admin/_shared.ts:20`)的关系:**并存,不是替换**。
 * 本模块只服务 `/v1` 对外面;`page/pageSize` 是内部 admin 面的契约,一个字节都不碰。
 * 与 `/v1` 既有 `limit`/`after`(裸 id)的关系同样向后兼容:不带 `page_format=cursor`
 * 时走调用方原有的校验与分页判据,响应不新增任何键(逐字节不变);带 `page_format=cursor`
 * 才产出 `next_cursor`,并且 `limit` 改为夹紧而非 400。
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

/** 游标前缀,一眼可辨;同时用于「这是游标还是旧的裸 id」的判定。 */
export const CURSOR_PREFIX = 'cr1'
/** 开启游标分页的查询参数名(不传 = 旧行为,逐字节不变)。 */
export const PAGE_FORMAT_PARAM = 'page_format'
/** 该参数目前唯一的取值;将来要别的形态再扩枚举,不留 `boolean` 那种语义空洞。 */
export const CURSOR_PAGE_FORMAT = 'cursor'

/** HMAC 派生域分隔,免得密钥在别处被复用时游标能互相顶替。 */
const DOMAIN = 'ihui-open-cursor-v1'
/** 归属指纹截断长度(16 字符 base64url = 96 bit,防伪足够,且不是安全边界而是防串用)。 */
const OWNER_DIGEST_CHARS = 16
/** 签名截断长度(22 字符 ≈ 132 bit)。 */
const SIGNATURE_CHARS = 22
/** `after` 之外允许的最大长度,防把超长串塞进 Redis 扫描。 */
const MAX_TOKEN_CHARS = 512

/** 列表族标识:游标跨族不可复用,故必须进指纹。 */
export const CURSOR_KIND = {
  assistants: 'assistants',
  threadMessages: 'thread-messages',
  threadRuns: 'thread-runs',
  runSteps: 'run-steps',
  batches: 'batches',
} as const
export type CursorKind = (typeof CURSOR_KIND)[keyof typeof CURSOR_KIND]

/**
 * 归属绑定。`ownerKey` 必须与该列表**实际的过滤维度**一致:
 * assistants 按 userId 集合取,threads 子族按 thread 归属,batches 按 `_apiKeyId` 扫。
 * 维度取错不会导致越权(路由自己有归属校验),只会让游标在语义上不绑定足够的信息。
 */
export interface CursorBinding {
  readonly kind: CursorKind
  readonly ownerKey: string
}

export type CursorReject = 'malformed' | 'signature' | 'foreign-scope'
export type CursorDecode = { ok: true; id: string } | { ok: false; reason: CursorReject }

/** 分页请求(路由层解析出来的内核入参)。 */
export interface PageRequest {
  /** 本页条数(已过调用方的校验/夹紧) */
  readonly limit: number
  /** 锚点 = 上一页最后一条的**内部 id**;null 表示从头开始 */
  readonly afterId: string | null
}

/** `has_more` 的两条既有判据,各自服务不同路由,刻意都保留(改任一条都会动旧响应)。 */
export type HasMoreRule =
  /** 集合里锚点之后还有剩余 → true(assistants / messages / runs / steps 既有语义) */
  | 'beyond-page'
  /** 本页填满 → true(batches 既有语义:SCAN 提前收口,拿不到总长度,只能看填满与否) */
  | 'page-full'

export interface PageOptions<T> {
  readonly request: PageRequest
  readonly idOf: (item: T) => string
  readonly hasMoreRule: HasMoreRule
  /** 传了才产出 `next_cursor`;null = 游标模式关闭(响应与今天逐字节一致)。 */
  readonly cursor?: { binding: CursorBinding; secret: string } | null
}

export interface PageOutcome<T> {
  readonly data: T[]
  readonly first_id: string | null
  readonly last_id: string | null
  readonly has_more: boolean
  /** 仅游标模式且还有下一页时非 null。 */
  readonly next_cursor: string | null
  /** `afterId` 给了却不在集合里(记录已过期 / 锚点被删)。旧模式按既有行为从头取。 */
  readonly anchor_missing: boolean
}

function hmacDigest(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message).digest('base64url')
}

function ownerDigest(binding: CursorBinding, secret: string): string {
  return hmacDigest(secret, `${DOMAIN}|owner|${binding.kind}|${binding.ownerKey}`).slice(
    0,
    OWNER_DIGEST_CHARS,
  )
}

function signatureOf(body: string, secret: string): string {
  return hmacDigest(secret, `${DOMAIN}|sig|${body}`).slice(0, SIGNATURE_CHARS)
}

/** 定长摘要,长度不等直接 false(不喂 timingSafeEqual,它会抛)。 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
}

/** 是不是本模块产出的游标(旧客户端传的裸 id 一律 false,走旧路径)。 */
export function isCursorToken(raw: string): boolean {
  return raw.startsWith(`${CURSOR_PREFIX}_`)
}

/** 产出游标。调用方只在 `has_more` 为真时给它。 */
export function encodeCursor(input: {
  id: string
  binding: CursorBinding
  secret: string
}): string {
  const body = Buffer.from(
    JSON.stringify([input.id, ownerDigest(input.binding, input.secret)]),
    'utf8',
  ).toString('base64url')
  return `${CURSOR_PREFIX}_${body}.${signatureOf(body, input.secret)}`
}

/**
 * 解开游标,拿到内部 id。三种失败分开:结构坏 / 签名不对(被改过)/ 归属不匹配
 * (别人的游标,或别的列表族的游标)。对外一律 400,分类只用于日志与测试断言。
 */
export function decodeCursor(token: string, binding: CursorBinding, secret: string): CursorDecode {
  if (!isCursorToken(token) || token.length > MAX_TOKEN_CHARS)
    return { ok: false, reason: 'malformed' }
  const rest = token.slice(CURSOR_PREFIX.length + 1)
  const dot = rest.lastIndexOf('.')
  if (dot <= 0 || dot === rest.length - 1) return { ok: false, reason: 'malformed' }
  const body = rest.slice(0, dot)
  const signature = rest.slice(dot + 1)
  if (!safeEqual(signatureOf(body, secret), signature)) return { ok: false, reason: 'signature' }
  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  const fields: unknown[] = Array.isArray(payload) ? payload : []
  const id = fields[0]
  const digest = fields[1]
  if (fields.length !== 2 || typeof id !== 'string' || id === '' || typeof digest !== 'string') {
    return { ok: false, reason: 'malformed' }
  }
  if (!safeEqual(digest, ownerDigest(binding, secret))) {
    return { ok: false, reason: 'foreign-scope' }
  }
  return { ok: true, id }
}

/** 游标模式是否开启(只认显式声明,不猜「after 长得像游标」,好让旧路径零分支)。 */
export function wantsCursorPageFormat(query: Record<string, unknown>): boolean {
  return query[PAGE_FORMAT_PARAM] === CURSOR_PAGE_FORMAT
}

/**
 * 解析 `after`:游标串→解出内部 id(解不开就报错,**绝不**降级成「从头开始」,
 * 那会把翻页翻成重复数据);裸 id→原样透传(旧客户端行为);缺省→从头。
 */
export function resolveAfter(
  raw: unknown,
  binding: CursorBinding,
  secret: string,
): { ok: true; afterId: string | null } | { ok: false; message: string } {
  if (raw === undefined || raw === null || raw === '') return { ok: true, afterId: null }
  if (typeof raw !== 'string') return { ok: false, message: 'Invalid cursor' }
  if (isCursorToken(raw)) {
    const decoded = decodeCursor(raw, binding, secret)
    if (decoded.ok) return { ok: true, afterId: decoded.id }
    return { ok: false, message: 'Invalid or expired cursor' }
  }
  return { ok: true, afterId: raw }
}

/**
 * 游标模式下的 `limit`:非法值回落到默认,越界**夹紧**(新契约,不再是 400)。
 * 旧模式不走这里 —— 它保留调用方原有的 Zod/Ajv 校验,响应逐字节不变。
 */
export function clampLimit(raw: unknown, limits: { def: number; max: number }): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return limits.def
  return Math.min(limits.max, Math.max(1, Math.trunc(parsed)))
}

/**
 * 分页内核。锚点定位 + 切页 + `has_more` + 下一页游标,一次算清。
 * 锚点找不到时 `startIdx` 保持 0 —— 这是旧路径既有的行为,必须保留;
 * 新路径靠 `anchor_missing` 让路由改判 400。
 */
export function pageOf<T>(items: readonly T[], options: PageOptions<T>): PageOutcome<T> {
  const { limit, afterId } = options.request
  let startIdx = 0
  let anchorMissing = false
  if (afterId !== null) {
    const idx = items.findIndex((item) => options.idOf(item) === afterId)
    if (idx >= 0) startIdx = idx + 1
    else anchorMissing = true
  }
  const data = items.slice(startIdx, startIdx + limit)
  const hasMore =
    options.hasMoreRule === 'page-full' ? data.length === limit : startIdx + limit < items.length
  const first = data[0]
  const last = data[data.length - 1]
  const cursor = options.cursor ?? null
  return {
    data,
    first_id: first === undefined ? null : options.idOf(first),
    last_id: last === undefined ? null : options.idOf(last),
    has_more: hasMore,
    next_cursor:
      cursor !== null && hasMore && last !== undefined
        ? encodeCursor({ id: options.idOf(last), binding: cursor.binding, secret: cursor.secret })
        : null,
    anchor_missing: anchorMissing,
  }
}

/** 游标模式的分页请求解析(旧模式由各路由文件用自己的 schema,互不影响)。 */
export function readCursorPageRequest(input: {
  query: Record<string, unknown>
  binding: CursorBinding
  secret: string
  limits: { def: number; max: number }
}): { ok: true; request: PageRequest } | { ok: false; message: string } {
  const after = resolveAfter(input.query.after, input.binding, input.secret)
  if (!after.ok) return after
  return {
    ok: true,
    request: { limit: clampLimit(input.query.limit, input.limits), afterId: after.afterId },
  }
}

/**
 * 把分页内核产出的游标拼进响应。
 * 关掉游标模式时 `next_cursor` 为 null,这里就**一个键都不加** —— 旧响应的键集合
 * 与键序逐字节不变,是本次改造的回归底线。
 * 泛型透传信封类型:调用方的 `first_id: string | null` 这类精确形状不会被擦成
 * `Record<string, unknown>`,路由返回值照样受 tsc 约束。
 */
export function withNextCursor<E extends object>(
  envelope: E,
  nextCursor: string | null,
): E & { next_cursor?: string } {
  return nextCursor === null ? envelope : { ...envelope, next_cursor: nextCursor }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
