// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O10② 外部 run 句柄 —— 对外只交这一个串,内部标识一律不出去。
 *
 * 形状与 `utils/cursor-page.ts` 同一套 HMAC 域分隔约定(**模式复用,不是第二份实现**:
 * 两者语义与生命周期完全不同 —— 游标是"翻到哪儿了",句柄是"这个资源是谁";
 * 混用就是跨类型攻击面,所以 DOMAIN 与 wire 前缀都不同,由测试互相钉死)。
 *
 *   runh_<body>.<sig>
 *   body = base64url(JSON [内部 runId, 归属指纹, 到期秒])
 *   归属指纹 = HMAC-SHA256(secret, "ihui-run-handle-v1|owner|<ownerKey>") 前 16 字符
 *   sig    = HMAC-SHA256(secret, "ihui-run-handle-v1|sig|<body>") 前 22 字符
 *
 * 三条设计判据:
 * 1. **不可猜/不可遍历**:body 里的内部 runId 是 uuidv4(122 bit 熵),外层再叠 132 bit
 *    HMAC 签名 —— 自造或篡改必签不过,顺序递增更无从谈起(不像 `run_1`、`run_2`)。
 * 2. **归属绑死**:A 的句柄在 B 的请求里必然解成 `foreign-owner`,而不是"能读到别人东西"。
 * 3. **不带 session_id**:句柄只承载 runId + 归属指纹 + 到期时间;内部 `session_id`
 *    既不进 body 也不出现在任何对外结构里(测试按字符串级断言)。
 *
 * 失败分成两类,处置**相反**,不能并:
 * - `malformed` / `signature` / `expired` → 400(客户端给错了东西,该改请求);
 * - `foreign-owner` → 由路由回 404(对外不承认该资源存在,免得句柄变成存在性探针)。
 * 两类都不是 500 —— 鉴权层后面的 fail-open 崩溃正是 AGENTS §5 记过的那类事故。
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

/** wire 前缀,一眼可辨,且刻意与游标的 `cr1_` 不同。 */
export const RUN_HANDLE_PREFIX = 'runh'
/** HMAC 派生域分隔;与 cursor-page 的 `ihui-open-cursor-v1` 不同域,故两者永不互认。 */
const DOMAIN = 'ihui-run-handle-v1'
/** 归属指纹截断(16 字符 base64url ≈ 96 bit,防伪足够;它是防串用不是加密边界)。 */
const OWNER_DIGEST_CHARS = 16
/** 签名截断(22 字符 ≈ 132 bit)。 */
const SIGNATURE_CHARS = 22
/** 句柄最大长度,挡住把超长串塞进解析路径。 */
const MAX_TOKEN_CHARS = 512
/** 缺省有效期:句柄不该比它能指的东西活得更久。 */
export const DEFAULT_RUN_HANDLE_TTL_SECONDS = 7 * 24 * 3600

export type RunHandleReject = 'malformed' | 'signature' | 'expired' | 'foreign-owner'
export type RunHandleParse = { ok: true; runId: string } | { ok: false; reason: RunHandleReject }

function hmacDigest(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message).digest('base64url')
}

function ownerDigest(ownerKey: string, secret: string): string {
  return hmacDigest(secret, `${DOMAIN}|owner|${ownerKey}`).slice(0, OWNER_DIGEST_CHARS)
}

function signatureOf(body: string, secret: string): string {
  return hmacDigest(secret, `${DOMAIN}|sig|${body}`).slice(0, SIGNATURE_CHARS)
}

/** 定长摘要比较;长度不等直接 false(timingSafeEqual 不等长会抛)。 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
}

export interface IssueRunHandleInput {
  /** 内部 runId(uuidv4 或既有 `run_<uuid>` 去掉前缀后的值)。 */
  runId: string
  /** 归属维度,必须与鉴权身份一致(如 `user:42`),不得取客户端可控值。 */
  ownerKey: string
  secret: string
  /** 服务端时钟,注入以便测试到期语义。 */
  nowSeconds?: number
  ttlSeconds?: number
}

/** 签发句柄。纯函数,零 I/O。 */
export function issueRunHandle(input: IssueRunHandleInput): string {
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const ttlSeconds = input.ttlSeconds ?? DEFAULT_RUN_HANDLE_TTL_SECONDS
  const expiresAt = nowSeconds + ttlSeconds
  const body = Buffer.from(
    JSON.stringify([input.runId, ownerDigest(input.ownerKey, input.secret), expiresAt]),
    'utf8',
  ).toString('base64url')
  return `${RUN_HANDLE_PREFIX}_${body}.${signatureOf(body, input.secret)}`
}

/**
 * 解析句柄并校验归属。**不查库** —— 签名与归属都在本地判定;
 * 资源是否存在由调用方再取一次记录(取不到 → 404)。
 */
export function parseRunHandle(
  token: unknown,
  input: { ownerKey: string; secret: string; nowSeconds?: number },
): RunHandleParse {
  if (typeof token !== 'string') return { ok: false, reason: 'malformed' }
  const head = `${RUN_HANDLE_PREFIX}_`
  if (!token.startsWith(head) || token.length > MAX_TOKEN_CHARS) {
    return { ok: false, reason: 'malformed' }
  }
  const rest = token.slice(head.length)
  const dot = rest.lastIndexOf('.')
  if (dot <= 0 || dot === rest.length - 1) return { ok: false, reason: 'malformed' }
  const body = rest.slice(0, dot)
  const signature = rest.slice(dot + 1)
  if (!safeEqual(signatureOf(body, input.secret), signature)) {
    return { ok: false, reason: 'signature' }
  }
  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  const fields: unknown[] = Array.isArray(payload) ? payload : []
  const runId = fields[0]
  const digest = fields[1]
  const expiresAt = fields[2]
  if (
    fields.length !== 3 ||
    typeof runId !== 'string' ||
    runId === '' ||
    typeof digest !== 'string' ||
    typeof expiresAt !== 'number'
  ) {
    return { ok: false, reason: 'malformed' }
  }
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (expiresAt <= nowSeconds) return { ok: false, reason: 'expired' }
  if (!safeEqual(digest, ownerDigest(input.ownerKey, input.secret))) {
    return { ok: false, reason: 'foreign-owner' }
  }
  return { ok: true, runId }
}

/** 分类→HTTP 的映射只有一处真相,路由与测试都读它,免得两边各写一遍判序。 */
export const RUN_HANDLE_REJECT_STATUS = {
  malformed: 400,
  signature: 400,
  expired: 400,
  'foreign-owner': 404,
} as const
export type RunHandleRejectStatus = (typeof RUN_HANDLE_REJECT_STATUS)[RunHandleReject]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
