// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 内部服务短期票 (internal service ticket) —— 验票侧的唯一出口。
 *
 * 立因 (PROJECT_PLAN 第五十二批·⑤ / 第三十八批续):
 * `apps/api/src/plugins/internal-service-token.ts` 原先把 `X-Internal-Service-Token`
 * 与常驻密钥 `AI_CALLBACK_SECRET` 直接比对。第三十八批只修了**计时维**
 * (`secretsEqual` 常数时间),票面剩下的那一半 —— **密钥常驻、无 TTL、无轮转 ⇒ 泄露一次即
 * 永久可用、可无限重放** —— 一直没动。本模块把它换成带过期 + 用途绑定 + 单次使用的票。
 *
 * 三条设计约束 (为什么长成这样,而不是另起一套):
 * 1. **不自造第三套 HMAC 方案**:签名/验签复用仓内既有 JWT 设施 —— 密钥出口
 *    `@ihui/auth` 的 `getJwtSecret()`(HS256,`JWT_SECRET` 两侧共享,ai-service 的
 *    `app/core/jwt_auth.py` 就是靠它验用户 token),裸 jose 的先例是本包
 *    `apps/api/src/services/totp-service.ts:364`(同样是"为另一用途签一枚 JWT")。
 *    新增的只有 claim 形状,没有新的密钥体系。
 * 2. **跨用途必须拒**:用户 access/refresh token 与内部票**同一把密钥、同一个 issuer**。
 *    所以内部票必须带两道用户 token 不可能带的标记 —— `aud = 'ihui-internal-service'`
 *    (用户 token 的 aud 是 `ihui-ai-users`)且 `type = 'internal-service-ticket'`
 *    (access 无 type、refresh 是 `'refresh'`)。两道各自独立成立,少一道就是一枚用户
 *    token 被当成内部凭据用。刻意**不校验 iss**:那要在本文件抄一份 `packages/auth`
 *    的 `ISSUER`(它未导出),两处算同一件事必漂移,而 aud+type 已经足够判别用途。
 * 3. **TTL 由验票侧封顶**:发票方误签一枚 30 天的票,不能让"短期票"这个前提失效。
 *
 * 单次使用落在共享状态上 (`ReplayStore`),见 `consumeOnce` 的失败口径:
 * **共享状态拿不到 ⇒ 拒票 (fail-closed)**。依据写在 `createRedisReplayStore` 上方。
 */
import { createHash, randomUUID } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'

/** 验票侧读取的请求头。发票方 (`apps/ai-service/app/core/internal_ticket.py`) 写同名头。 */
export const INTERNAL_TICKET_HEADER = 'x-internal-service-ticket'

/** 内部票专用 audience —— 与用户 token 的 `ihui-ai-users` 刻意不同 (设计约束 2)。 */
export const INTERNAL_TICKET_AUDIENCE = 'ihui-internal-service'

/** 内部票 type claim 值。用户 access token 无此 claim、refresh token 是 `'refresh'`。 */
export const INTERNAL_TICKET_TYPE = 'internal-service-ticket'

/**
 * 用途 (scope) 封闭集。票必须声明它替谁、去干什么,验票方按调用点要求匹配。
 * 做成封闭集而不是自由字符串:"任何用途"的票等于没有用途绑定。
 */
export const INTERNAL_TICKET_SCOPES = [
  'ai-callback', // LLM 回调写入
  'codebase-index', // 索引服务读写 chunks
  'im-bridge', // IM 桥接代发
  'mcp-edu', // MCP 教育管理接口
  'api-tools', // api_tools_bridge 通用工具面
  'memory', // /api/memory
  'self-evolution', // clawdbot 自进化回写
  'registry-sync', // 注册表漂移检测
] as const

export type InternalTicketScope = (typeof INTERNAL_TICKET_SCOPES)[number]

function isInternalTicketScope(v: unknown): v is InternalTicketScope {
  return typeof v === 'string' && (INTERNAL_TICKET_SCOPES as readonly string[]).includes(v)
}

/** 一次一密:每张票的 jti 都是新随机值。 */
function newJti(): string {
  return randomUUID()
}

/**
 * 签发一枚内部服务短期票。
 *
 * 导出给**测试与同侧自调用**用:生产发票方是 ai-service (Python,`internal_ticket.py`),
 * 它签的票必须能被这里验过 —— 两侧共用 `JWT_SECRET` 与同一份 claim 形状,
 * 所以本函数同时充当"跨语言契约的可执行一侧"(另一侧的快照测试在
 * `apps/ai-service/tests/test_internal_ticket.py`)。
 *
 * @throws JWT_SECRET 未配置/强度不足时由 `getJwtSecret()` 抛出 (调用方按模式决定是否兜底)。
 */
export async function mintInternalServiceTicket(input: {
  userId: string
  scope: InternalTicketScope
  ttlSeconds?: number
  jti?: string
}): Promise<string> {
  const { getJwtSecret } = await import('@ihui/auth')
  const ttl = clampTicketTtl(input.ttlSeconds ?? 60)
  const jti = input.jti ?? newJti()
  return await new SignJWT({ type: INTERNAL_TICKET_TYPE, scope: input.scope, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.userId)
    .setAudience(INTERNAL_TICKET_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(getJwtSecret())
}

/**
 * TTL 封顶:**由验票侧决定**,不是由发票侧决定。
 * 发票方误配一个很大的值 (或直接签一枚长效票) 时,"短期"这个前提必须还成立。
 * 上限 300s 的依据:内部服务调用是同步 HTTP,秒级足够;再长就不再是"一次性票"而是缓存。
 */
const MAX_TICKET_TTL_SECONDS = 300
const DEFAULT_TICKET_TTL_SECONDS = 60

function clampTicketTtl(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TICKET_TTL_SECONDS
  return Math.min(Math.floor(raw), MAX_TICKET_TTL_SECONDS)
}

/** 验票结论。失败原因只给内部日志用,对客户端一律同一个 401 形状 (见调用方)。 */
export type TicketVerifyResult =
  | {
      ok: true
      userId: string
      scope: InternalTicketScope
      jti: string
      /** 剩余有效期 (秒),用于给重放键定 TTL。 */
      remainingSeconds: number
    }
  | {
      ok: false
      reason:
        | 'secret_unavailable'
        | 'malformed'
        | 'expired'
        | 'wrong_audience'
        | 'wrong_type'
        | 'missing_subject'
        | 'missing_jti'
        | 'bad_scope'
        | 'scope_mismatch'
        | 'too_long_lived'
        | 'replayed'
        | 'replay_store_unavailable'
    }

/**
 * 单次使用登记表。生产实现是 Redis (两侧共享的那台),测试注入内存替身。
 * **一律禁止测试连生产 Redis(8811)** —— 见 AGENTS §5 测试隔离铁律,所以它是注入点而不是模块内单例。
 */
export interface ReplayStore {
  /** `'consumed'` = 这次是第一次见到该 jti;`'replayed'` = 见过。抛错 = 共享状态不可用。 */
  consume(jti: string, ttlSeconds: number): Promise<'consumed' | 'replayed'>
}

/**
 * Redis 实现:一次 `SET key 1 EX ttl NX`,原子地"见过就没有第二次"。
 * 键里存的是 jti 的 SHA-256 而不是 jti 原文 —— 与 `packages/auth/src/blacklist.ts:49`
 * 把 token 指纹化后才落 Redis 是同一条纪律 (凭据句柄不进共享存储)。
 *
 * **共享状态拿不到时 fail-closed(本票唯一必须拍的点,依据如下)**:
 *  1. 重放检查是"一次性"这条性质的**全部实现**。fail-open 等于把票降级成
 *     "60 秒有效的常驻密钥" —— 攻击者只要让 Redis 不可用 (它本来就是拒绝服务的一部分)
 *     就能拿回本票要消除的那一格,而这个降级**没有任何人能观察到**。
 *  2. AGENTS §5 已对同类情形表过态:"fail-open 直接崩在鉴权层后面,比 401 更难发现"。
 *     本处是鉴权面,同一条判据成立。
 *  3. fail-closed **不会**把安全性修复变成可用性事故 —— 因为兼容窗口里有一条**独立、
 *     显式、按配置**的旧通道 (`INTERNAL_SERVICE_AUTH_MODE=legacy`)。通道要保活时的出路是
 *     运维改一档并留下配置记录,而不是"检查失败时悄悄什么都不查"。
 *     后者正是本仓记过最多次的失效形态:兜底表现得像功能正常。
 */
export interface RedisSetNxLike {
  set(key: string, value: string, expiryMode: 'EX', ttlSeconds: number, mode: 'NX'): Promise<unknown>
}

export const JTI_KEY_PREFIX = 'ihui:internal-ticket:jti:'

export function fingerprintTicketId(jti: string): string {
  return createHash('sha256').update(jti, 'utf8').digest('hex')
}

export function createRedisReplayStore(redis: RedisSetNxLike): ReplayStore {
  return {
    async consume(jti: string, ttlSeconds: number): Promise<'consumed' | 'replayed'> {
      const key = `${JTI_KEY_PREFIX}${fingerprintTicketId(jti)}`
      const res = await redis.set(key, '1', 'EX', Math.max(1, ttlSeconds), 'NX')
      return res === 'OK' ? 'consumed' : 'replayed'
    },
  }
}

/**
 * 验一枚内部票:签名 → 用途 (aud/type/scope) → 时效 → 单次使用。
 *
 * 判序是刻意的,**重放在最后一步之前必须全部判完**:
 * 先 consume 再判 scope 的话,一次"scope 写错"的调用会把那张票烧掉,
 * 于是合法调用方重试时读到的就是 `replayed` —— 把配置错误伪装成重放攻击。
 *
 * @param expectedScope 调用点声明的用途;票的 scope 与之不等 ⇒ `scope_mismatch` (跨用途拒绝)。
 * @param store 单次使用登记表;为 null 表示共享状态未配置 ⇒ 一律 `replay_store_unavailable`。
 */
export async function verifyInternalServiceTicket(
  raw: string,
  deps: {
    store: ReplayStore | null
    expectedScope?: InternalTicketScope
    nowSeconds?: number
    maxTtlSeconds?: number
  },
): Promise<TicketVerifyResult> {
  const { getJwtSecret } = await import('@ihui/auth')
  let secret: Uint8Array
  try {
    secret = getJwtSecret()
  } catch {
    return { ok: false, reason: 'secret_unavailable' }
  }

  let payload: Record<string, unknown>
  try {
    // jose 的 audience 选项会**强制** aud 存在且等值 ⇒ 用户 access token 在这一层就被拒。
    const verified = await jwtVerify(raw, secret, {
      audience: INTERNAL_TICKET_AUDIENCE,
      algorithms: ['HS256'],
    })
    payload = verified.payload as Record<string, unknown>
  } catch (err) {
    const code = (err as { code?: unknown })?.code
    const claim = (err as { claim?: unknown })?.claim
    if (code === 'ERR_JWT_EXPIRED') return { ok: false, reason: 'expired' }
    // aud 不符必须单独认出来,不能糊进 malformed。jose 对这一档抛的是
    // ERR_JWT_CLAIM_VALIDATION_FAILED + claim='aud',**消息文本是 `unexpected "aud" claim value`**
    // (实测 jose v6:既不含 "audience" 也不含 "audience" 的完整拼写差异)——
    // 所以判据认的是结构化字段 `claim === 'aud'`,不是消息正则。
    // 认错的后果不是"分类不好看":审计日志会把"用户 access token 打到内部面上"
    // 这件事记成"一坨不是 JWT 的东西",跨用途冒用的取证线索当场断掉。
    if (code === 'ERR_JWT_CLAIM_VALIDATION_FAILED' && claim === 'aud') {
      return { ok: false, reason: 'wrong_audience' }
    }
    // 其余(签名不对 / 根本不是 JWT / 别的 claim 不过)一律按最严那档报,
    // 且**不得**因为分不清就放过:对客户端是同一个 401,只有内部日志区分。
    if (code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') return { ok: false, reason: 'malformed' }
    return { ok: false, reason: 'malformed' }
  }

  if (payload.type !== INTERNAL_TICKET_TYPE) return { ok: false, reason: 'wrong_type' }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    return { ok: false, reason: 'missing_subject' }
  }
  if (typeof payload.jti !== 'string' || payload.jti.length === 0) {
    return { ok: false, reason: 'missing_jti' }
  }
  if (!isInternalTicketScope(payload.scope)) return { ok: false, reason: 'bad_scope' }
  if (deps.expectedScope && payload.scope !== deps.expectedScope) {
    return { ok: false, reason: 'scope_mismatch' }
  }

  const now = deps.nowSeconds ?? Math.floor(Date.now() / 1000)
  const exp = typeof payload.exp === 'number' ? payload.exp : null
  if (exp === null) return { ok: false, reason: 'malformed' }
  const remainingSeconds = exp - now
  if (remainingSeconds <= 0) return { ok: false, reason: 'expired' }
  const maxTtl = deps.maxTtlSeconds ?? MAX_TICKET_TTL_SECONDS
  const iat = typeof payload.iat === 'number' ? payload.iat : null
  if (iat !== null && exp - iat > maxTtl) return { ok: false, reason: 'too_long_lived' }

  if (!deps.store) return { ok: false, reason: 'replay_store_unavailable' }
  try {
    const verdict = await deps.store.consume(payload.jti, remainingSeconds)
    if (verdict === 'replayed') return { ok: false, reason: 'replayed' }
  } catch {
    // fail-closed:见 createRedisReplayStore 上方三条依据。
    return { ok: false, reason: 'replay_store_unavailable' }
  }

  return {
    ok: true,
    userId: payload.sub,
    scope: payload.scope,
    jti: payload.jti,
    remainingSeconds,
  }
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
