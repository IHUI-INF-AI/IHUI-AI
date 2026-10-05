// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Internal Service Token 鉴权(2026-07-24 立)。
 *
 * 用途:ai-service 等内部服务通过 HTTP 调用 API 端点(如 /api/memory)时,
 * 无需用户 JWT,改用 X-Internal-Service-Token + X-User-Id 头鉴权。
 *
 * 设计:
 * - token 与 config.AI_CALLBACK_SECRET 共用(单一密钥,减少配置项)
 * - 为空(未配置)时拒绝所有 internal token 请求(强制配置后才可用)
 * - X-User-Id 必须为有效 UUID 或数字字符串(防注入),成功后注入 request.userId
 *
 * 与 checkAuth 协同:checkAuthOrInternalService 先尝试 JWT,失败降级 internal token。
 */
import type { FastifyRequest, FastifyReply } from 'fastify'
import { createHash, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { config } from '../config/index.js'
import { error } from '../utils/response.js'
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
 * 通道档位(2026-10-06 接线,票档契约早已由 `internal-service-ticket.ts` 定死,
 * 由 `tests/internal-service-ticket.test.ts` 逐条钉住):
 *
 * - `ticket`  **只**认短期票。老门彻底关掉(测试「ticket 档:常驻密钥被拒」钉这一条)。
 * - `dual`    两档并存(默认)。老门留着是为了兼容窗口,**不是**兜底 ——
 *             票判失败时**绝不**回落老通道(见下)。
 * - `legacy`  回到改造前形态,只用于应急回退;它保的是"能进",不是"安全"。
 *
 * 为什么票判失败不回落:`internal-service-ticket.ts` 顶部第 3 条依据写的是
 * "兼容窗口里有一条**独立、显式、按配置**的旧通道"。若票判失败就自动回落,
 * 那条通道就不是"显式配置"的,而是"检查失败时的默认行为"——
 * 正是本仓记过最多次的失效形态:兜底表现得像功能正常。
 */
function internalAuthMode(): 'ticket' | 'dual' | 'legacy' {
  // 读 env 而不是只读 config:档位切换是**运维面**的动作(改 env 重启即生效),
  // 而 config 是导入期求值的快照。两者在生产同源;测试要靠运行期切档
  // (vi.resetModules 不会重跑 mock 工厂),所以这里以 env 为准、config 兜底。
  const raw =
    process.env.INTERNAL_SERVICE_AUTH_MODE ??
    (config as unknown as { INTERNAL_SERVICE_AUTH_MODE?: string }).INTERNAL_SERVICE_AUTH_MODE
  const v = (raw ?? 'dual').trim().toLowerCase()
  return v === 'ticket' || v === 'legacy' ? v : 'dual'
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

  // 允许 UUID(如 6b8cd0f6-546f-44c8-853a-5f96edbe08be)或数字字符串(防注入)
  if (!requestedUserId || !/^[a-zA-Z0-9-]{1,128}$/.test(requestedUserId)) {
    reply.status(400).send(error(400, 'Valid X-User-Id header required'))
    return false
  }

  return await injectVerifiedUser(request, reply, requestedUserId)
}

/**
 * 主体已由上游(验票 or 常驻密钥比对)确认后,统一做"用户存在 + 活跃"校验与注入。
 *
 * 抽出来是因为两条通道的**后续**判据必须逐字一致:票档不是特权通道,
 * 它省掉的只是"那把常驻密钥从哪来",省不掉"这个主体是不是活跃用户"。
 */
async function injectVerifiedUser(
  request: FastifyRequest,
  reply: FastifyReply,
  requestedUserId: string,
): Promise<boolean> {
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
  return !!(request.headers[INTERNAL_TOKEN_HEADER]) || !!request.headers[INTERNAL_TICKET_HEADER]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
