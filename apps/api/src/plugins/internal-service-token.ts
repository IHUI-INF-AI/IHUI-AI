// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Internal Service Token 鉴权(2026-07-24 立)。
 *
 * 用途:ai-service 等内部服务通过 HTTP 调用 API 端点(如 /api/memory)时,
 * 无需用户 JWT,改用短期票(默认档)或 X-Internal-Service-Token + X-User-Id 头鉴权。
 *
 * 设计:
 * - 默认只认一次性短期票(签名 + TTL + 用途 + 单次使用,密钥为可轮换的 JWT_SECRET)
 * - 老门(常驻密钥)仅在 `dual`/`legacy` 显式档位下可用,且身份头必须
 *   `X-Internal-Service-Signature` + `X-Internal-Service-Timestamp` 签名校验
 * - token 与 config.AI_CALLBACK_SECRET 共用(单一密钥,减少配置项)
 * - 为空(未配置)时拒绝所有 internal token 请求(强制配置后才可用)
 * - 主体必须是 uuid 形态(`users.id` 是 uuid 列;形状闸在 `injectVerifiedUser`,
 *   早于任何 SQL),再校验存在 + 活跃,成功后注入 request.userId
 *
 * 与 checkAuth 协同:checkAuthOrInternalService 先尝试 JWT,失败降级 internal token。
 */
import type { FastifyRequest, FastifyReply } from 'fastify'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { config, isProductionGuard } from '../config/index.js'
import { logger } from '../utils/logger.js'
import { error } from '../utils/response.js'
import { isUuidString } from '../utils/uuid.js'
import { db } from '../db/index.js'
import { users } from '@ihui/database'
import {
  INTERNAL_TICKET_HEADER,
  createRedisReplayStore,
  verifyInternalServiceTicket,
  type InternalTicketScope,
  type RedisSetNxLike,
} from './internal-service-ticket.js'

const INTERNAL_TOKEN_HEADER = 'x-internal-service-token'
const USER_ID_HEADER = 'x-user-id'
/**
 * 老通道身份签名头(2026-11-05 增补)。
 *
 * 老通道原先"持全局密钥 + 自报 X-User-Id ⇒ 直接采信身份"。这正是 F-03 的敞口:
 * 身份头由调用方自由填写,密钥泄露 = 任意活跃用户身份。现在身份头必须带
 * `HMAC-SHA256(AI_CALLBACK_SECRET, "legacy-v1\n<userId>\n<timestamp>")`,
 * 且 timestamp 落在 ±300s 窗口内 —— 缺签名/签名错/时间戳过期一律 401,
 * 不再有"未签名身份头直接采信"的分支。
 *
 * 领域前缀 `legacy-v1` 防止该 HMAC 被挪去签别的凭据;时间戳窗口用于压住
 * 被抓包重放的窗口。**残余风险**:签名与验签都用同一把 `AI_CALLBACK_SECRET`,
 * 因此持有该密钥的人仍能为任意 userId 自签通过(old 门的固有形态)。这正是
 * 默认档必须是 ticket、生产禁止 legacy 的原因;老通道只应作为非生产应急口。
 */
const LEGACY_TIMESTAMP_HEADER = 'x-internal-service-timestamp'
const LEGACY_SIGNATURE_HEADER = 'x-internal-service-signature'
const LEGACY_SIGNATURE_CONTEXT = 'legacy-v1'
const LEGACY_SIGNATURE_MAX_SKEW_SECONDS = 300

/**
 * 通道档位(2026-10-06 接线,2026-11-05 默认收口):
 *
 * - `ticket`  **只**认短期票。老门彻底关掉(默认档,强校验 + 密钥可轮换)。
 * - `dual`    两档并存,**必须由显式环境变量开启**;启动打显著告警。仅兼容窗口使用。
 * - `legacy`  回到改造前形态,只用于应急回退;它保的是"能进",不是"安全"。
 *             **生产环境 + legacy ⇒ 启动直接失败(fail-closed)**。
 *
 * 为什么默认不再是 dual:`dual` 放行的是"持一把不轮换的全局密钥 ⇒ 可自报 `x-user-id`",
 * 即拿到密钥就等于拿到任意活跃用户身份。把它做成默认,等于把这个通道当成常态。
 * 现在只有显式配置才能打开它,且启动日志会把这件事喊出来。
 *
 * 为什么票判失败不回落:`internal-service-ticket.ts` 顶部第 3 条依据写的是
 * "兼容窗口里有一条**独立、显式、按配置**的旧通道"。若票判失败就自动回落,
 * 那条通道就不是"显式配置"的,而是"检查失败时的默认行为"——
 * 正是本仓记过最多次的失效形态:兜底表现得像功能正常。
 */
export type InternalAuthMode = 'ticket' | 'dual' | 'legacy'

/** 缺省档位 = 只认短期票。这是安全的一档,也是唯一不依赖运维记性的档位。 */
export const DEFAULT_INTERNAL_AUTH_MODE: InternalAuthMode = 'ticket'

/**
 * 解析档位。未知值(含未配置)一律落回 `ticket`,而不是旧版的 `dual` ——
 * 拼错档位名只该把老门关得更死,不该静默把老门打开。
 */
export function resolveInternalAuthMode(raw: unknown): InternalAuthMode {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
  return v === 'ticket' || v === 'dual' || v === 'legacy' ? v : DEFAULT_INTERNAL_AUTH_MODE
}

function rawInternalAuthMode(): unknown {
  // 读 env 而不是只读 config:档位切换是**运维面**的动作(改 env 重启即生效),
  // 而 config 是导入期求值的快照。两者在生产同源;测试要靠运行期切档
  // (vi.resetModules 不会重跑 mock 工厂),所以这里以 env 为准、config 兜底。
  const fromEnv = process.env.INTERNAL_SERVICE_AUTH_MODE
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return fromEnv
  return (config as unknown as { INTERNAL_SERVICE_AUTH_MODE?: string }).INTERNAL_SERVICE_AUTH_MODE
}

function internalAuthMode(): InternalAuthMode {
  return resolveInternalAuthMode(rawInternalAuthMode())
}

/**
 * 启动期档位守卫(2026-11-05 立)。
 *
 * 两条硬约束:
 *   1. 生产 + `legacy` ⇒ **抛错**,由启动链 `process.exit(1)`。老通道在生产里没有
 *      "临时用一下"的空间:它默认放行任意活跃用户身份,不能靠运维自觉。
 *   2. `dual` 是显式兼容档 ⇒ 启动时打显著告警,点名"老门仍在 + 收口动作是什么"。
 *
 * 纯函数形态(参数可注入)是为了让"生产 + legacy 启动失败"能被行为测试钉住,
 * 而不是只能靠读源码相信。
 */
export function assertInternalAuthModeAtStartup(
  opts: { mode?: unknown; isProduction?: boolean } = {},
): InternalAuthMode {
  const mode = opts.mode === undefined ? internalAuthMode() : resolveInternalAuthMode(opts.mode)
  const isProd =
    typeof opts.isProduction === 'boolean' ? opts.isProduction : Boolean(isProductionGuard)

  if (mode === 'legacy' && isProd) {
    throw new Error(
      'INTERNAL_SERVICE_AUTH_MODE=legacy 在生产环境被禁止:老通道只凭全局密钥 + 自报身份头放行,' +
        '拿到密钥即可冒充任意活跃用户。生产必须使用 ticket(默认)或显式 dual 兼容档。',
    )
  }
  if (mode === 'dual') {
    logger.warn(
      '⚠️ [internal-auth] 内部服务鉴权处于 dual 兼容档:老通道仍接受全局密钥 + 已签名身份头。' +
        '该档只用于兼容窗口;调用方全部改发短期票后应收口为 INTERNAL_SERVICE_AUTH_MODE=ticket。',
      { event: 'internal_auth_mode_dual' },
    )
  }
  if (mode === 'legacy') {
    logger.warn(
      '⚠️ [internal-auth] 内部服务鉴权处于 legacy 应急档(仅非生产允许):' +
        '老通道是唯一入口,它保的是"能进"而不是"安全"。',
      { event: 'internal_auth_mode_legacy' },
    )
  }
  return mode
}

/**
 * 老门(常驻共享密钥)使用留痕(2026-11-01 立)。
 *
 * 为什么必须量:这道门放行的是"**持一把不轮换的全局密钥 ⇒ 可自报 `x-user-id`**"——
 * 拿到密钥就等于拿到任意用户身份,而不是"这一个调用方的身份"。新通道(短期票)
 * 每票绑定主体与 TTL,所以正确姿势是把它关掉。但 `INTERNAL_SERVICE_AUTH_MODE=ticket`
 * 是一个会造成内部调用链 401 的运维动作,**没有证据不能翻**(本仓刚在
 * `auth-default-deny` 上抓到过一次"加固把第一方回环调用整片 401"的实测教训)。
 * 留着这道门的唯一理由只能是"还有调用方只发老头",那就让它自己报出来:
 * 每个 (方法+路径) 60s 一条,带累计次数;连续一个完整流量周期读不到 ⇒ 才有资格关。
 * 日志走 `utils/logger.js` 那一道 sink 级脱敏闸(2026-11-01),不会把凭据写进盘。
 */
let legacyDoorUses = 0
const legacyDoorLastLoggedAt = new Map<string, number>()
const LEGACY_DOOR_LOG_INTERVAL_MS = 60_000

function noteLegacyDoorUse(request: FastifyRequest): void {
  legacyDoorUses += 1
  const endpoint = `${request.method} ${(request.url.split('?')[0] ?? request.url) || '/'}`
  const now = Date.now()
  const prev = legacyDoorLastLoggedAt.get(endpoint)
  if (prev !== undefined && now - prev < LEGACY_DOOR_LOG_INTERVAL_MS) return
  legacyDoorLastLoggedAt.set(endpoint, now)
  logger.warn(
    `[internal-auth] 老门(常驻共享密钥)仍在使用: ${endpoint} —— ` +
      '持该密钥即可自报 x-user-id;关闭出路:该调用方改发短期票后把 INTERNAL_SERVICE_AUTH_MODE=ticket',
    { event: 'internal_auth_legacy_door_used', endpoint, legacyDoorUses },
  )
}

/** 累计计数(供测试与健康面读取;不做绝对断言,只断增量)。 */
export function internalAuthLegacyDoorUses(): number {
  return legacyDoorUses
}

/** 票档的 TTL 封顶由验票侧读配置(缺省 300,见 MAX_TICKET_TTL_SECONDS)。 */
function ticketMaxTtlSeconds(): number | undefined {
  const raw = (config as unknown as { INTERNAL_SERVICE_TICKET_MAX_TTL_SECONDS?: number })
    .INTERNAL_SERVICE_TICKET_MAX_TTL_SECONDS
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : undefined
}

/**
 * 从 fastify 实例取 redis 插件当单次使用登记表。
 *
 * 取不到就返回 null —— `verifyInternalServiceTicket` 对 null 一律 `replay_store_unavailable`
 * (fail-closed,理由见该文件顶部三条依据),**不在这里**做任何"没共享状态就跳过检查"的兜底。
 */
function resolveReplayStore(request: FastifyRequest) {
  const redis = (request.server as unknown as { redis?: RedisSetNxLike }).redis
  if (!redis || typeof redis.set !== 'function') return null
  return createRedisReplayStore(redis)
}

/**
 * 常数时间比较两把凭据(2026-09-27 立,第三十八批)。
 *
 * 为什么不是直接 `timingSafeEqual(a, b)`:两把长度不等时它会**抛错**,而且即便不抛,
 * 逐字节比较的耗时仍与"公共前缀长度"相关。先把两边各 SHA-256 成固定 32 字节再比,
 * 于是既没有长度泄漏、也没有早退 —— 这是 Node 侧比对共享密钥的标准形态。
 *
 * 这一格修的是"计时侧信道"而不是"泄露即无害":真正的敞口是这把密钥**常驻、无 TTL、
 * 可无限重放**(任一次 env dump / 代理访问日志命中即永久可用),那半属于双侧改造
 * (发票方 `apps/ai-service` 与验票方必须同批改),登记在 PROJECT_PLAN 等 owner 拍顺序;
 * 本函数只把"比较本身不随前缀长度分叉"这一维钉住,不改任何契约。
 */
export function secretsEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(ha, hb)
}

type LegacyIdentityVerdict =
  'ok' | 'missing_signature' | 'bad_timestamp_shape' | 'stale_timestamp' | 'bad_signature'

/**
 * 校验老通道的自报身份头(2026-11-05)。
 *
 * 判据顺序刻意是"先有密钥、再验身份签名":全局密钥那一道仍在(与旧契约一致),
 * 新增的是"身份头本身也必须可验证"。返回值只供日志分档,响应侧一律同一个 401。
 * 签名用常数时间比较(`secretsEqual`),时间戳不允许非数字/超窗。
 */
function verifyLegacyIdentityHeaders(
  request: FastifyRequest,
  userId: string,
): LegacyIdentityVerdict {
  const rawTimestamp = request.headers[LEGACY_TIMESTAMP_HEADER]
  const rawSignature = request.headers[LEGACY_SIGNATURE_HEADER]
  const timestamp = Array.isArray(rawTimestamp) ? rawTimestamp[0] : rawTimestamp
  const signature = Array.isArray(rawSignature) ? rawSignature[0] : rawSignature
  if (!timestamp || !signature) return 'missing_signature'
  if (!/^\d{1,10}$/.test(timestamp)) return 'bad_timestamp_shape'

  const timestampSeconds = Number(timestamp)
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSeconds - timestampSeconds) > LEGACY_SIGNATURE_MAX_SKEW_SECONDS) {
    return 'stale_timestamp'
  }

  const expected = createHmac('sha256', config.AI_CALLBACK_SECRET)
    .update(`${LEGACY_SIGNATURE_CONTEXT}\n${userId}\n${timestamp}`, 'utf8')
    .digest('hex')
  return secretsEqual(signature.toLowerCase(), expected) ? 'ok' : 'bad_signature'
}

/**
 * 校验 internal service token + 注入 userId。
 * 成功返回 true,失败发送 401 并返回 false。
 *
 * P0 安全修复(2026-08-02):原先仅校验 X-User-Id 格式就直接注入 request.userId,
 * 一旦 internal secret 泄露,攻击者可冒充任意用户。现增加用户存在 + 活跃校验,
 * 并补审计日志(caller IP + userId + endpoint),把"单点泄露即全用户冒充"收敛为
 * "仅能冒充存在且活跃的用户,且每次调用留痕"。
 */
export async function checkInternalServiceToken(
  request: FastifyRequest,
  reply: FastifyReply,
  opts?: { scope?: InternalTicketScope; userId?: string | null },
): Promise<boolean> {
  const requestedUserId = opts?.userId ?? (request.headers[USER_ID_HEADER] as string | undefined)
  const mode = internalAuthMode()

  // ── 票档(优先):带票请求一律先走验票,不与老门混在一条判据里 ──
  // 顺序不能反:老门是"有一把常驻密钥就过",若先判它,任何一张伪造的票都会因为
  // "顺便带了把对的旧密钥"而被放过 —— 分流判据就分不出两档凭据了。
  const rawTicket = request.headers[INTERNAL_TICKET_HEADER] as string | undefined
  if (mode !== 'legacy' && rawTicket) {
    const verdict = await verifyInternalServiceTicket(rawTicket, {
      store: resolveReplayStore(request),
      expectedScope: opts?.scope,
      maxTtlSeconds: ticketMaxTtlSeconds(),
    })
    // 票判失败**直接拒**,不回落老通道(理由见 internalAuthMode 上方注释)。
    if (!verdict.ok) {
      request.log.warn(
        { reason: verdict.reason, ip: request.ip, endpoint: request.url },
        '[internal-token] internal service ticket rejected',
      )
      reply.status(401).send(error(401, 'Invalid internal service ticket'))
      return false
    }
    // 票里带的 userId 是签发时封进去的主体;它与 x-user-id 头同时存在时必须一致,
    // 否则攻击者可以拿自己那张票配别人的 x-user-id 去冒用。
    if (requestedUserId && requestedUserId !== verdict.userId) {
      request.log.warn(
        { ip: request.ip, endpoint: request.url },
        '[internal-token] ticket subject does not match X-User-Id',
      )
      reply.status(401).send(error(401, 'Subject mismatch'))
      return false
    }
    return await injectVerifiedUser(request, reply, verdict.userId)
  }

  // `ticket` 档下走到这里 = 只带老门没带票 ⇒ 老门已关,拒。
  if (mode === 'ticket') {
    reply.status(401).send(error(401, 'Internal service token not accepted (ticket-only mode)'))
    return false
  }

  // ── 老通道(常驻密钥)──
  const token = request.headers[INTERNAL_TOKEN_HEADER] as string | undefined

  // 未配置 internal secret 时拒绝(强制配置后才可用)
  if (!config.AI_CALLBACK_SECRET) {
    reply.status(401).send(error(401, 'Internal service token not configured'))
    return false
  }

  // 必须是常数时间比较:明文本比较会在"前缀对多少"上分叉,给离线枚举密钥留计时侧信道。
  // (第三十八批锁:直接拿 env 值做相等比较的旧写法不得加回 —— 由镜像测试按源码面钉住。)
  if (!token || !secretsEqual(token, config.AI_CALLBACK_SECRET)) {
    reply.status(401).send(error(401, 'Invalid internal service token'))
    return false
  }

  // 预筛:头里必须是一段可打印的 id(挡掉换行/控制字符这类日志与注入面)。
  // **它不是归属判据** —— 主体能不能落到 `users.id` 由 `injectVerifiedUser` 的 uuid 形状闸
  // 与随后的"存在 + 活跃"查询决定,两道都在 SQL 之前/之内,不放这里重复一份。
  if (!requestedUserId || !/^[a-zA-Z0-9-]{1,128}$/.test(requestedUserId)) {
    reply.status(400).send(error(400, 'Valid X-User-Id header required'))
    return false
  }

  // 身份头收口(2026-11-05):密钥对了还不够 —— 自报身份必须自带签名,否则
  // "持全局密钥 ⇒ 冒充任意活跃用户"这条通道原样保留。没有未签名身份头的放行分支。
  const identityVerdict = verifyLegacyIdentityHeaders(request, requestedUserId)
  if (identityVerdict !== 'ok') {
    request.log.warn(
      { reason: identityVerdict, ip: request.ip, endpoint: request.url },
      '[internal-token] legacy identity header rejected (signature required)',
    )
    reply.status(401).send(error(401, 'Invalid internal service identity signature'))
    return false
  }

  // 关掉这道门之前,得先知道"还有谁在用它"—— 依据只能来自这里(2026-11-01)。
  noteLegacyDoorUse(request)
  return await injectVerifiedUser(request, reply, requestedUserId)
}

/**
 * 主体已由上游(验票 or 常驻密钥比对)确认后,统一做"用户存在 + 活跃"校验与注入。
 *
 * 抽出来是因为两条通道的**后续**判据必须逐字一致:票档不是特权通道,
 * 它省掉的只是"那把常驻密钥从哪来",省不掉"这个主体是不是活跃用户"。
 *
 * 形状闸(2026-10-28 立,必须在进 SQL 之前):`users.id` 是 `uuid` 列,任何非 uuid 形态
 * 的主体都会让 Postgres 抛 `22P02 invalid input syntax for type uuid`,而这条链没有兜住它
 * ⇒ 一枚"结构上不可能存在的主体"在响应与监控上长成了 500。
 * 一手实测(本机 8802,同一形出站请求):
 *   - `x-user-id: system-worker` / `x-user-id: 1` ⇒ **500**(DrizzleQueryError←22P02)
 *   - 合法 uuid 形态但库里没有 ⇒ 401 User not found(查询真跑了)
 * 现在两种脏形态都在**零查询**的前提下归位 401,与 `routes/internal-tool-invocation-ledger.ts`
 * 的 401 词汇同档;判据仍只有一份(`utils/uuid.ts` 的 `isUuidString`,§0.6)。
 * 闸放在这个出口是因为两条通道都汇到这里:票档的 `sub` 与老通道的 `X-User-Id` 头
 * 都可能是脏的 —— 只在老通道那条正则前拦,票档照样外溢成 DB 错。
 */
async function injectVerifiedUser(
  request: FastifyRequest,
  reply: FastifyReply,
  requestedUserId: string,
): Promise<boolean> {
  // 长度在收窄**之前**取:isUuidString 声明为 `value is string`,对已是 string 的入参做
  // 否定判断时 TS 把分支内类型收窄成 never(排除 string 后为空集),分支里直接写
  // requestedUserId.length 会报 TS2339。运行时语义完全等价(string.length 无副作用),
  // 不动 isUuidString 的签名 —— 它是 §0.6 单一真相源,被多处引用。
  const subjectLength = requestedUserId.length
  if (!isUuidString(requestedUserId)) {
    // 不打印主体原文:它未经任何形状约束(票档的 sub 是签名载荷,老通道那条正则也允许
    // 任意字母数字串),日志面按 log-sanitizer 之外再留一道"不把外来串原样写进日志"的余量。
    request.log.warn(
      { subjectLength, ip: request.ip, endpoint: request.url },
      '[internal-token] subject not uuid-shaped, rejected before any query',
    )
    reply.status(401).send(error(401, 'Verified UUID principal required'))
    return false
  }

  // 验证用户存在且活跃(防 X-User-Id 欺骗:internal secret 泄露后不能冒充任意/已注销用户)
  const [user] = await db
    .select({ id: users.id, status: users.status, roleId: users.roleId })
    .from(users)
    .where(eq(users.id, requestedUserId))
    .limit(1)

  if (!user) {
    request.log.warn(
      { requestedUserId, ip: request.ip, endpoint: request.url },
      '[internal-token] X-User-Id not found',
    )
    reply.status(401).send(error(401, 'User not found'))
    return false
  }

  if (user.status !== 1) {
    request.log.warn(
      { requestedUserId, status: user.status, ip: request.ip, endpoint: request.url },
      '[internal-token] X-User-Id not active',
    )
    reply.status(403).send(error(403, 'User not active'))
    return false
  }

  // 注入 userId(已验证存在且活跃) + legacy 数值角色(供权限中间件管理员豁免判定,
  // 与 JWT 链路 jwtPayload.roleId 同源同语义:AI 对话链管理员无需另建 RBAC 绑定)
  request.userId = user.id
  request.internalUserRoleId = user.roleId ?? 0

  // 审计日志:记录内部服务调用(caller IP + userId + endpoint),便于事后追溯
  request.log.info(
    { userId: user.id, ip: request.ip, endpoint: request.url, method: request.method },
    '[internal-token] internal service call',
  )

  return true
}

/**
 * 检测请求是否携带**任一种**内部凭据头(用于 checkAuthOrInternalService / require-permission 分流)。
 *
 * 两个头都要认:只认老头的话,一张合法票会被分流判据当成"没有内部凭据"而掉进
 * 用户 JWT 分支 —— 票档验票代码根本没机会跑。少认一半 = 票档等于没接。
 */
export function hasInternalServiceToken(request: FastifyRequest): boolean {
  return !!request.headers[INTERNAL_TOKEN_HEADER] || !!request.headers[INTERNAL_TICKET_HEADER]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
