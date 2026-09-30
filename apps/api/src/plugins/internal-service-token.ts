// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Internal Service Token 鉴权(2026-07-24 立)。
 *
 * 用途:ai-service 等内部服务通过 HTTP 调用 API 端点(如 /api/memory)时,
 * 无需用户 JWT,改用内部凭据 + X-User-Id 头鉴权。
 *
 * 凭据形态(2026-09-27 起两档并存,由 INTERNAL_SERVICE_AUTH_MODE 裁决):
 * - **新档**:`x-internal-service-ticket` = 短期一次性票(HS256 JWT,复用 JWT_SECRET,
 *   带 exp + aud/type 用途绑定 + jti 单次使用)。判据与实现在 `./internal-service-ticket.ts`。
 * - **旧档**:`x-internal-service-token` 与 config.AI_CALLBACK_SECRET 常数时间比较。
 *   这把密钥**常驻、无 TTL、可无限重放**,正是要被新档替掉的东西;留着它只为过渡期
 *   不打断内部通道(两侧不同时上线是硬风险)。默认档 `dual`,翻 `ticket` 的判据在本文件末尾。
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
  describeTicketFailure,
  verifyInternalServiceTicket,
  type InternalTicketScope,
  type RedisSetNxLike,
  type ReplayStore,
} from './internal-service-ticket.js'

const INTERNAL_TOKEN_HEADER = 'x-internal-service-token'
const USER_ID_HEADER = 'x-user-id'

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
 * 单次使用登记表的取用点:从请求所在实例拿 Redis (`plugins/redis.ts` 的 `server.redis`)。
 *
 * 类型上 `FastifyInstance.redis` 声明为必有,但**未注册该插件的实例上它是 undefined**
 * (单元用例、以及 redis 插件在 server.ts 里的注册顺序晚于本中间件的场合)。
 * 所以这里按"可能不在"处理,取不到就交给 `verifyInternalServiceTicket` 判
 * `replay_store_unavailable` —— 那是 fail-closed,不是"没有登记表就当作可用"。
 */
function resolveReplayStore(request: FastifyRequest): ReplayStore | null {
  const server = request.server as unknown as { redis?: RedisSetNxLike }
  const redis = server.redis
  if (!redis || typeof redis.set !== 'function') return null
  return createRedisReplayStore(redis)
}

/**
 * 校验 internal service 凭据 + 注入 userId。成功返回 true,失败发送 401/400 并返回 false。
 *
 * P0 安全修复(2026-08-02):原先仅校验 X-User-Id 格式就直接注入 request.userId,
 * 一旦 internal secret 泄露,攻击者可冒充任意用户。现增加用户存在 + 活跃校验,
 * 并补审计日志(caller IP + userId + endpoint),把"单点泄露即全用户冒充"收敛为
 * "仅能冒充存在且活跃的用户,且每次调用留痕"。
 *
 * 一次性短期票(2026-09-27,承第三十八批的计时维):判定分两条凭据通道,由
 * `config.INTERNAL_SERVICE_AUTH_MODE` 决定放开哪几条 ——
 *  · 带 `x-internal-service-ticket` → **只**走验票(过期/跨用途/重放/状态不可用一律拒);
 *    票判失败**绝不回落到常驻密钥**,否则一次坏票就换来一条无限重放的老路。
 *  · 不带票 → `dual`/`legacy` 走原常驻密钥比较;`ticket` 档直接拒。
 * 两条通道都只解决"你是谁",主体一致性另判一票:**票的 `sub` 必须等于 `X-User-Id`**,
 * 否则一张给 A 签的票不能拿去当 B 用(旧通道没有这一维,是因为旧凭据本来就不区分主体)。
 */
export async function checkInternalServiceToken(
  request: FastifyRequest,
  reply: FastifyReply,
  options?: { scope?: InternalTicketScope },
): Promise<boolean> {
  const token = request.headers[INTERNAL_TOKEN_HEADER] as string | undefined
  const requestedUserId = request.headers[USER_ID_HEADER] as string | undefined
  const ticket = request.headers[INTERNAL_TICKET_HEADER] as string | undefined
  const mode = config.INTERNAL_SERVICE_AUTH_MODE
  /** 凭据替哪个用户说话(只有票能给出这个答案;常驻密钥不区分主体)。 */
  let assertedSubject: string | null = null

  if (ticket) {
    const verdict = await verifyInternalServiceTicket(ticket, {
      store: resolveReplayStore(request),
      expectedScope: options?.scope,
      maxTtlSeconds: config.INTERNAL_SERVICE_TICKET_MAX_TTL_SECONDS,
    })
    if (!verdict.ok) {
      // 内部审计留原因;对客户端只有**一个**形状 —— 不得把"票不存在/已用过/用途不对"
      // 差异回显出去,否则这个端点变成"哪些票号有效"的预言机。
      request.log.warn(
        { reason: describeTicketFailure(verdict), ip: request.ip, endpoint: request.url },
        '[internal-token] internal ticket rejected',
      )
      reply.status(401).send(error(401, 'Invalid internal service token'))
      return false
    }
    assertedSubject = verdict.userId
  } else if (mode === 'ticket') {
    // 只认票的一档:旧头不再被接受。**翻到这一档之前必须先量出"还有人在发旧头"= 0**,
    // 判据与验收命令写在文件末尾注释里。
    request.log.warn({ ip: request.ip, endpoint: request.url }, '[internal-token] ticket required')
    reply.status(401).send(error(401, 'Internal service token not configured'))
    return false
  } else {
    // 未配置 internal secret 时拒绝(强制配置后才可用)
    if (!config.AI_CALLBACK_SECRET) {
      reply.status(401).send(error(401, 'Internal service token not configured'))
      return false
    }

    // 必须是常数时间比较:明文 `!==` 会在"前缀对多少"上分叉,给离线枚举密钥留计时侧信道。
    // (旧写法 `token !== config.AI_CALLBACK_SECRET` 不得加回 —— 由镜像测试按源码面钉住。)
    if (!token || !secretsEqual(token, config.AI_CALLBACK_SECRET)) {
      reply.status(401).send(error(401, 'Invalid internal service token'))
      return false
    }
  }

  // 允许 UUID(如 6b8cd0f6-546f-44c8-853a-5f96edbe08be)或数字字符串(防注入)
  if (!requestedUserId || !/^[a-zA-Z0-9-]{1,128}$/.test(requestedUserId)) {
    reply.status(400).send(error(400, 'Valid X-User-Id header required'))
    return false
  }

  // 跨主体拒绝:票是"替 sub 这个人来的"的凭据,X-User-Id 与 sub 不等即越权。
  if (assertedSubject !== null && assertedSubject !== requestedUserId) {
    request.log.warn(
      { assertedSubject, requestedUserId, ip: request.ip, endpoint: request.url },
      '[internal-token] ticket subject mismatch',
    )
    reply.status(401).send(error(401, 'Invalid internal service token'))
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
 * 检测请求是否携带 internal service 凭据(用于 checkAuthOrInternalService 分流)。
 *
 * **两种凭据头任一在位都算**:只认旧头的话,一个"只带票、不带常驻密钥"的请求
 * 会走 JWT 分支拿 401 —— 于是"把密钥换成短期票"这件事在分流层就永远做不到。
 * 这条判据同时被 `plugins/auth.ts:259` 与 `plugins/require-permission.ts:100` 两个
 * 分流点使用,所以一处改齐两处;**不得**把票的那一半摘回。
 */
export function hasInternalServiceToken(request: FastifyRequest): boolean {
  return !!request.headers[INTERNAL_TOKEN_HEADER] || !!request.headers[INTERNAL_TICKET_HEADER]
}

/*
 * ── 何时可以把 INTERNAL_SERVICE_AUTH_MODE 从 `dual` 翻成 `ticket`(可验判据,勿凭感觉翻)──
 *
 * 唯一前置:**现网已没有任何调用方依赖常驻密钥**。量法两条,都要成立:
 *
 *  1) 发票侧已全部改发新头(代码面,静态可判,零副作用):
 *       git grep -c 'x-internal-service-ticket' -- apps/ai-service/app
 *     必须 ≥ 1,且下面每一处常驻密钥出口都已在同一枚提交里带上票:
 *       apps/ai-service/app/services/api_tools_bridge.py   internal_headers()
 *       apps/ai-service/app/services/mcp_server.py         _edu_internal_headers()
 *       apps/ai-service/app/services/im_bridge.py          headers["x-internal-service-token"]
 *       apps/ai-service/app/services/codebase_indexer.py   (本票未动 —— 见交付报告"按住未做")
 *  2) 运行面"只靠常驻密钥过关"的计数为 0:翻档前在 `dual` 档跑满一个完整发布周期
 *     (含最长的那条内部链路被真实触发过 —— 索引/MCP/IM 桥各至少一次),然后按日志聚合:
 *       计 `'[internal-token] internal service call'` 且**不含**票的行
 *     (即 legacy 通道命中数)。判据 = 0 才允许翻。取数口径必须现读,不得引用本注释。
 *
 * 为什么默认停在 `dual`:`dual` 相对改动前**没有放开任何新的可重放面**(常驻密钥本来就通过),
 * 所以它可以立刻上线而不需要与发票侧约定顺序;而 `ticket` 一旦翻早了,
 * 症状是内部通道整条 401 —— 与本次要修的"泄露即永久可用"相比,那是把安全问题换成事故。
 * 反过来,`dual` 不是终态:常驻密钥仍在位 = 那把钥匙泄露后仍可在窗口外被无限使用。
 * 本文件的改动只是把"必须双改才有解"这个死结打开,**翻档那一票仍需在途**,不得读成已收口。
 */
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
