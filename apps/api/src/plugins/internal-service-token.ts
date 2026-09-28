// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
): Promise<boolean> {
  const token = request.headers[INTERNAL_TOKEN_HEADER] as string | undefined
  const requestedUserId = request.headers[USER_ID_HEADER] as string | undefined

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

  // 允许 UUID(如 6b8cd0f6-546f-44c8-853a-5f96edbe08be)或数字字符串(防注入)
  if (!requestedUserId || !/^[a-zA-Z0-9-]{1,128}$/.test(requestedUserId)) {
    reply.status(400).send(error(400, 'Valid X-User-Id header required'))
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
 * 检测请求是否携带 internal service token header(用于 checkAuthOrInternalService 分流)。
 */
export function hasInternalServiceToken(request: FastifyRequest): boolean {
  return !!request.headers[INTERNAL_TOKEN_HEADER]
}
