import { randomUUID } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { Redis } from 'ioredis'
// 2026-07-24 国安级升级:argon2id 密码哈希(抗 GPU/ASIC),兼容老 bcrypt 透明升级
import { hashPassword, verifyPassword, upgradeHashIfNeeded } from '../utils/password-crypto.js'
import { verifyRefreshToken, createFamilyId, type JWTPayload } from '@ihui/auth'
import { authenticate } from '../plugins/auth.js'
import { issueTokenPair } from '../services/token-service.js'
import {
  findUserByPhone,
  findUserByAccount,
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  cancelUserAccount,
  findRefreshToken,
  revokeRefreshToken,
  revokeRefreshTokenFamily,
  revokeAllUserRefreshTokens,
  isSystemAdminUser,
} from '../db/queries.js'
import { getUserPermissions } from '../db/rbac-queries.js'
import { findInvitationByCode, markInvitationUsed } from '../db/promotion-queries.js'
import { earnPoints } from '../services/points-service.js'
import {
  recordLoginFailure,
  clearLoginFailures,
  getLockRemainingMs,
  ACCOUNT_LOCKOUT_CONFIG,
} from '../services/account-lockout.js'
import { success, error } from '../utils/response.js'
import { jscode2session, isWechatMiniConfigured } from '../services/oauth-providers.js'
import { findThirdPartyAccount, createThirdPartyBinding } from '../db/oauth-queries.js'
import { findUserPreferences, upsertUserPreference } from '../db/user-preferences-queries.js'
import { toUserFriendlyMessage } from '@ihui/shared'
import {
  codeStore,
  CODE_TTL_MS,
  CODE_RESEND_INTERVAL_MS,
  generateCode,
  cleanupExpiredCodes,
  verifyCode,
} from '../utils/code-store.js'
import { signChallengeToken, CHALLENGE_TOKEN_TTL_SECONDS } from '../services/totp-service.js'
import { evaluateLoginRisk } from '../services/risk-engine-service.js'
import { verifyTurnstile } from '../services/turnstile-service.js'
import { db } from '../db/index.js'
import { userDevices } from '@ihui/database'

// =============================================================================
// Zod schemas
// =============================================================================

const registerSchema = z.object({
  phone: z.string().length(11, '手机号必须为 11 位'),
  password: z.string().min(8, '密码至少 8 位').max(72, '密码最多 72 位'),
  code: z.string().optional(),
  invitationCode: z.string().optional(),
})

const loginSchema = z.object({
  account: z.string().min(1, '账号不能为空'),
  password: z.string().min(1, '密码不能为空'),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken 不能为空'),
})

const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken 不能为空'),
})

const sendCodeSchema = z.object({
  phone: z
    .string()
    .length(11, '手机号必须为 11 位')
    .regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  scene: z.enum(['register', 'login', 'reset', 'phone-binding']).optional().default('register'),
})

const resetPasswordSchema = z.object({
  phone: z
    .string()
    .length(11, '手机号必须为 11 位')
    .regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  code: z.string().length(6, '验证码必须为 6 位'),
  newPassword: z.string().min(8, '密码至少 8 位').max(72, '密码最多 72 位'),
})

const phoneLoginSchema = z.object({
  phone: z.string().min(1, '手机号不能为空'),
  password: z.string().min(1, '密码不能为空'),
})

const smsLoginSchema = z.object({
  phone: z
    .string()
    .length(11, '手机号必须为 11 位')
    .regex(/^1[3-9]\d{9}$/, '手机号格式不正确'),
  code: z.string().length(6, '验证码必须为 6 位'),
})

const wechatLoginSchema = z.object({
  code: z.string().min(1, '微信 code 不能为空'),
})

const loginPreferencesSchema = z.object({
  autoLogin: z.boolean().optional(),
  autoRenew: z.boolean().optional(),
})

const emailLoginQuerySchema = z.object({
  email: z.email({ error: '邮箱格式不正确' }),
})

// 注:emailLoginSchema 已迁移至 auth-extended.ts:190(loginByEmailSchema)
// 2026-07-24:删除 /login/email POST 重复路由时同步移除孤儿 schema 声明,避免 TS6133

// =============================================================================
// Token 签发辅助
// =============================================================================

const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60 // 30d
const ADMIN_ROLE_ID = 1 // 与 require-permission.ts 保持一致
const ADMIN_WILDCARD_PERMISSIONS = ['*:*:*']

async function buildTokenPair(user: {
  id: string
  phone: string | null
  roleId: number | null
  familyId: string
}): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
  refreshExpiresIn: number
}> {
  const payload: JWTPayload = {
    userId: user.id,
    phone: user.phone ?? '',
    familyId: user.familyId,
    roleId: user.roleId ?? 0,
  }

  const tokens = await issueTokenPair(payload)

  return {
    ...tokens,
    refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
  }
}

/**
 * 解析用户权限码数组。
 * - admin（roleId >= 1）返回通配符 ['*:*:*']，前端 HasPermi 直接放行所有
 * - 其他用户查 RBAC 表，无记录返回 []（前端 HasPermi 将拒绝）
 */
export async function resolveUserPermissions(
  userId: string,
  roleId: number | null,
): Promise<string[]> {
  if (roleId !== null && roleId >= ADMIN_ROLE_ID) return ADMIN_WILDCARD_PERMISSIONS
  return getUserPermissions(userId)
}

export function publicUser(
  user: {
    id: string
    phone: string | null
    email: string | null
    username: string | null
    nickname: string | null
    avatar: string | null
    bio: string | null
    gender: number | null
    birthday: string | null
    familyId: string | null
    roleId: number | null
    status: number | null
    isVip: number | null
    level: number | null
    inviteCode: string | null
    parentId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  },
  permissions: string[] = [],
) {
  return {
    id: user.id,
    phone: user.phone ?? '',
    email: user.email ?? '',
    username: user.username ?? '',
    nickname: user.nickname ?? '',
    avatar: user.avatar ?? '',
    bio: user.bio ?? '',
    gender: user.gender ?? 0,
    birthday: user.birthday ?? '',
    familyId: user.familyId ?? '',
    roleId: user.roleId ?? 0,
    status: user.status ?? 1,
    isVip: user.isVip ?? 0,
    level: user.level ?? 0,
    inviteCode: user.inviteCode ?? '',
    parentId: user.parentId ?? '',
    createdAt: user.createdAt ? user.createdAt.toISOString() : '',
    updatedAt: user.updatedAt ? user.updatedAt.toISOString() : '',
    permissions,
  }
}

/**
 * 解析用户登录偏好。autoLogin 默认 false,autoRenew 无记录默认 true(自动续期默认开启)。
 */
function parseLoginPreferences(list: { key: string; value: string | null }[]): {
  autoLogin: boolean
  autoRenew: boolean
} {
  const map = new Map(list.map((r) => [r.key, r.value]))
  const autoLogin = map.get('autoLogin') === '1'
  const autoRenewRaw = map.get('autoRenew')
  const autoRenew = autoRenewRaw === undefined ? true : autoRenewRaw === '1'
  return { autoLogin, autoRenew }
}

// =============================================================================
// QR 扫码登录
// =============================================================================

const QR_LOGIN_KEY_PREFIX = 'qr:login:'
const QR_LOGIN_TTL_SECONDS = 300 // 5 分钟,足够用户扫码确认

const qrTicketSchema = z.object({
  ticket: z.string().min(1, 'ticket 不能为空'),
})

/** QR 登录 token 对(与 buildTokenPair 返回结构一致) */
interface QrTokenPair {
  accessToken: string
  refreshToken: string
  expiresIn: number
  refreshExpiresIn: number
}

/**
 * QR 登录状态机(存储在 Redis value 中,JSON 序列化):
 * - pending: PC 端已生成二维码,等待移动端扫码确认
 * - confirmed: 移动端已确认,PC 端轮询可拿到 token 对 + userId
 */
type QrLoginState =
  | { status: 'pending'; userId: null; createdAt: string }
  | { status: 'confirmed'; userId: string; tokens: QrTokenPair; createdAt: string }

// =============================================================================
// 路由
// =============================================================================

export const authRoutes: FastifyPluginAsync = async (server) => {
  // P0-30 配套(2026-08-01):登录端点 Turnstile 人机验证
  // 覆盖 /login /login/sms /login/email,未配置 TURNSTILE_SECRET_KEY 时 verifyTurnstile 内部放行
  // 客户端未提供 turnstileToken 时放行(兼容未启用 Turnstile 的旧客户端)
  server.addHook('preHandler', async (request, reply) => {
    const loginPaths = new Set(['/login', '/login/sms', '/login/email'])
    const routeUrl = request.routeOptions?.url
    if (!routeUrl || !loginPaths.has(routeUrl)) return

    const body = request.body as Record<string, unknown> | undefined
    const token = body?.turnstileToken
    if (typeof token !== 'string' || !token) return

    try {
      const result = await verifyTurnstile(token, request.ip)
      if (!result.success) {
        return reply.code(403).send(error(403, '人机验证失败,请重试'))
      }
    } catch {
      return reply.code(403).send(error(403, '人机验证服务异常,请重试'))
    }
  })

  // POST /api/auth/send-code - 发送手机验证码
  server.post(
    '/send-code',
    {
      schema: {
        summary: '发送手机验证码',
        description: '向指定手机号发送 6 位数字验证码(5 分钟有效,60 秒内不可重发)',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['phone'],
          properties: {
            phone: { type: 'string', description: '手机号(11 位)' },
            scene: {
              type: 'string',
              enum: ['register', 'login', 'reset', 'phone-binding'],
              description: '场景',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          429: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
      config: {
        rateLimit: { max: 5, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const parsed = sendCodeSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { phone } = parsed.data

      cleanupExpiredCodes()
      const existing = codeStore.get(phone)
      const now = Date.now()
      if (existing && now - existing.sentAt < CODE_RESEND_INTERVAL_MS) {
        return reply.status(429).send(error(429, '验证码已发送,请 60 秒后重试'))
      }

      const code = generateCode()
      codeStore.set(phone, { code, expiresAt: now + CODE_TTL_MS, sentAt: now })

      // 生产环境应接入短信服务商;当前开发模式记录日志
      request.log.info({ phone, scene: parsed.data.scene }, '验证码已生成')

      // 开发模式(NODE_ENV !== production)返回验证码便于测试
      const isDev = process.env.NODE_ENV !== 'production'
      return reply.send(
        success(
          isDev
            ? { sent: true, code, expiresIn: CODE_TTL_MS / 1000 }
            : { sent: true, expiresIn: CODE_TTL_MS / 1000 },
        ),
      )
    },
  )

  // POST /api/auth/reset-password - 通过手机验证码重置密码
  server.post(
    '/reset-password',
    {
      schema: {
        summary: '重置密码',
        description: '通过手机号 + 验证码重置登录密码',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['phone', 'code', 'newPassword'],
          properties: {
            phone: { type: 'string', description: '手机号(11 位)' },
            code: { type: 'string', description: '验证码(6 位)' },
            newPassword: { type: 'string', description: '新密码(>=8 位,<=72 位)' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          403: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
      config: {
        // 2026-08-02 安全加固:密码重置端点配合账号锁定 + 验证码一次性,
        // 限流收紧到 3 次/分钟,避免与 5 次锁定的验证码爆破窗口错位。
        rateLimit: { max: 3, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const parsed = resetPasswordSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { phone, code, newPassword } = parsed.data

      // 2026-08-02 修复 P1:改用 verifyCode 统一入口,复用 admin bypass 与统一逻辑
      // 原实现直接读 codeStore.get(phone) 绕过 verifyCode 的测试 bypass 与自动删除
      const codeOk = await verifyCode(phone, code)
      if (!codeOk) {
        return reply.status(400).send(error(400, '验证码错误或已过期'))
      }

      // 查找用户
      const user = await findUserByPhone(phone)
      if (!user) {
        // 2026-07-24 安全加固:用户不存在时返回与验证码错误相同的消息
        // 防用户枚举攻击(CWE-204):攻击者无法通过响应区分"用户不存在"和"验证码错误"
        return reply.status(400).send(error(400, '验证码错误或已过期'))
      }

      if (await isSystemAdminUser(user.id)) {
        return reply.status(403).send(error(403, '系统内置管理员密码不可重置'))
      }

      // 更新密码
      const passwordHash = await hashPassword(newPassword)
      await updateUser(user.id, { passwordHash })

      // 2026-07-24 安全加固:密码重置后吊销所有 refresh token(防旧 token 继续使用)
      // 攻击场景:攻击者窃取了用户 refresh token,用户发现后重置密码,
      // 但旧 token 仍有效 → 攻击者仍可登录。必须吊销所有 token 迫使重新认证。
      await revokeAllUserRefreshTokens(user.id)

      // verifyCode 内部已自动删除验证码,无需手动 codeStore.delete(phone)

      return reply.send(success({ reset: true }))
    },
  )

  // POST /api/auth/register
  server.post(
    '/register',
    {
      schema: {
        summary: '用户注册',
        description: '手机号 + 密码注册,可选邀请码',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['phone', 'password'],
          properties: {
            phone: { type: 'string', description: '手机号(11 位)' },
            password: { type: 'string', description: '密码(>=6 位,<=72 位)' },
            code: { type: 'string', description: '验证码(可选)' },
            invitationCode: { type: 'string', description: '邀请码(可选)' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          409: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
      config: {
        // 2026-08-02 安全加固:注册端点收紧到 3 次/小时,防机器人批量刷号。
        rateLimit: { max: 3, timeWindow: '1 hour' },
      },
    },
    async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { phone, password } = parsed.data

      // 检查手机号是否已注册
      const existing = await findUserByPhone(phone)
      if (existing) {
        return reply.status(409).send(error(409, '该手机号已注册'))
      }
      request.skipResponseSanitization = true
      const passwordHash = await hashPassword(password)
      const familyId = createFamilyId()
      const nickname = `用户${phone.slice(-4)}`
      const user = await createUser({
        phone,
        passwordHash,
        nickname,
        familyId,
        roleId: 0,
        status: 1,
      })

      // 处理邀请码奖励（失败不阻塞注册）
      if (parsed.data.invitationCode) {
        try {
          const invitation = await findInvitationByCode(parsed.data.invitationCode)
          const now = new Date()
          if (
            invitation &&
            invitation.status === 'unused' &&
            (!invitation.expiresAt || invitation.expiresAt > now)
          ) {
            await markInvitationUsed({ id: invitation.id, inviteeId: user.id })

            if (invitation.rewardInvitee > 0) {
              try {
                await earnPoints(
                  user.id,
                  invitation.rewardInvitee,
                  'invitation_reward',
                  '邀请注册奖励',
                  invitation.id,
                )
              } catch (e) {
                request.log.warn({ err: e }, '邀请注册奖励(被邀请人)失败')
                // 被邀请人奖励失败不阻塞注册
              }
            }

            if (invitation.rewardInviter > 0) {
              try {
                await earnPoints(
                  invitation.inviterId,
                  invitation.rewardInviter,
                  'invitation_reward',
                  '邀请用户注册奖励',
                  invitation.id,
                )
              } catch (e) {
                request.log.warn({ err: e }, '邀请注册奖励(邀请人)失败')
                // 邀请人奖励失败不阻塞注册
              }
            }
          }
        } catch (e) {
          request.log.warn({ err: e }, '邀请码处理失败')
          // 邀请码无效或处理失败不阻塞注册
        }
      }

      const tokens = await buildTokenPair({
        id: user.id,
        phone: user.phone,
        roleId: user.roleId,
        familyId,
      })

      const permissions = await resolveUserPermissions(user.id, user.roleId)
      return reply.send(
        success({
          ...tokens,
          user: publicUser(user, permissions),
        }),
      )
    },
  )

  // POST /api/auth/login
  server.post(
    '/login',
    {
      schema: {
        summary: '用户登录',
        description: '账号(手机号/邮箱) + 密码登录',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['account', 'password'],
          properties: {
            account: { type: 'string', description: '账号(手机号或邮箱)' },
            password: { type: 'string', description: '密码' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          403: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          429: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
      config: {
        // 2026-08-02 安全加固:登录端点配合账号锁定(5 次/锁定),限流收紧到 5 次/分钟。
        rateLimit: { max: 5, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { account, password } = parsed.data
      const ip = request.ip

      // 账号/IP 锁定检查（防密码爆破）
      const lockRemaining = await getLockRemainingMs(account, ip)
      if (lockRemaining > 0) {
        const retryAfterSec = Math.ceil(lockRemaining / 1000)
        return reply
          .status(429)
          .header('Retry-After', String(retryAfterSec))
          .send(
            error(
              429,
              `登录失败次数过多，账号已被临时锁定 ${Math.ceil(retryAfterSec / 60)} 分钟后重试`,
            ),
          )
      }

      const user = await findUserByAccount(account)
      if (!user || !user.passwordHash) {
        await recordLoginFailure(account, ip)
        return reply.status(401).send(error(401, '用户不存在或密码错误'))
      }

      // 2026-07-24 国安级升级:argon2id 替代 bcrypt(抗 GPU/ASIC),兼容老 bcrypt 透明升级
      const ok = await verifyPassword(password, user.passwordHash)
      if (!ok) {
        const remaining = await recordLoginFailure(account, ip)
        if (remaining === 0) {
          return reply
            .status(429)
            .header('Retry-After', String(ACCOUNT_LOCKOUT_CONFIG.lockDurationSec))
            .send(
              error(
                429,
                `登录失败次数过多，账号已被临时锁定 ${Math.ceil(
                  ACCOUNT_LOCKOUT_CONFIG.lockDurationSec / 60,
                )} 分钟`,
              ),
            )
        }
        return reply
          .status(401)
          .send(error(401, `用户不存在或密码错误（剩余 ${remaining} 次重试机会）`))
      }

      if (user.status !== 1) {
        return reply.status(403).send(error(403, '账号已被禁用'))
      }

      // 登录成功 → 清空失败计数
      await clearLoginFailures(account, ip)

      // 2026-07-24 国安级升级:透明升级老 bcrypt 哈希到 argon2id(抗 GPU/ASIC)
      // 登录成功后自动迁移,用户无感知,无需强制重置密码
      // 2026-07-24 修复:system admin 等不可变用户(immutability trigger)updateUser 会抛
      // PostgresError 导致 login 500。改为 try/catch 容错,升级失败仅 log 不阻断登录流程。
      const upgradedHash = await upgradeHashIfNeeded(password, user.passwordHash)
      if (upgradedHash) {
        try {
          await updateUser(user.id, { passwordHash: upgradedHash })
          request.log.info({ userId: user.id }, '密码哈希已透明升级 bcrypt→argon2id')
        } catch (hashErr) {
          request.log.warn(
            { err: String(hashErr), userId: user.id },
            '密码哈希透明升级失败(可能是 system admin 不可变用户触发 trigger),跳过升级,登录流程继续',
          )
        }
      }

      // 风控评估：异常 IP / 异地登录检测（命中异地登录/异常 IP 时异步触发登录异常通知）
      const risk = evaluateLoginRisk({
        userId: String(user.id),
        ip: request.ip,
      })
      if (risk.action === 'DENY') {
        request.log.warn({ userId: user.id, ip: request.ip, hits: risk.hits }, '登录被风控拒绝')
        return reply.status(403).send(error(403, '登录请求被风控拦截，请联系客服'))
      }
      if (risk.action === 'CHALLENGE' || risk.action === 'REVIEW') {
        request.log.info(
          { userId: user.id, ip: request.ip, action: risk.action, hits: risk.hits },
          '登录风控触发',
        )
      }

      // 2FA 检查:若用户已启用 2FA,返回 challenge token(5min),前端走 /auth/2fa/login-verify 二次校验
      // 注意:必须 skipResponseSanitization,否则 challengeToken(JWT)会被响应脱敏层改写成 ***
      if (user.twoFactorEnabled) {
        const challengeToken = await signChallengeToken({
          userId: user.id,
          phone: user.phone ?? '',
          familyId: '', // challenge token 不绑定 family,login-verify 通过后新建
          roleId: user.roleId ?? 0,
        })
        request.skipResponseSanitization = true
        return reply.send(
          success({
            twoFactorRequired: true,
            challengeToken,
            expiresIn: CHALLENGE_TOKEN_TTL_SECONDS,
          }),
        )
      }

      request.skipResponseSanitization = true
      const familyId = createFamilyId()
      const tokens = await buildTokenPair({
        id: user.id,
        phone: user.phone,
        roleId: user.roleId,
        familyId,
      })

      const permissions = await resolveUserPermissions(user.id, user.roleId)

      // 登录成功 → upsert 设备指纹到 user_devices 表(从 x-device-fingerprint header 取)
      // 指纹为空时跳过(不阻塞登录);失败仅 log,不影响登录流程
      const fingerprintHeader = request.headers['x-device-fingerprint']
      const fingerprint = typeof fingerprintHeader === 'string' ? fingerprintHeader : undefined
      if (fingerprint) {
        try {
          const userAgent =
            typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : null
          await db
            .insert(userDevices)
            .values({
              userId: user.id,
              fingerprintHash: fingerprint,
              userAgent,
              ip: request.ip,
            })
            .onConflictDoUpdate({
              target: [userDevices.userId, userDevices.fingerprintHash],
              set: {
                lastSeenAt: new Date(),
                userAgent,
                ip: request.ip,
              },
            })
        } catch (devErr) {
          request.log.warn(
            { err: String(devErr), userId: user.id },
            'upsert 登录设备失败,跳过(不影响登录)',
          )
        }
      }

      return reply.send(
        success({
          ...tokens,
          user: publicUser(user, permissions),
        }),
      )
    },
  )

  // POST /api/auth/login/password — 小程序别名(手机号 + 密码)
  server.post(
    '/login/password',
    {
      schema: {
        summary: '手机号密码登录(小程序别名)',
        description: '与 /auth/login 相同,接受 phone 字段替代 account',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['phone', 'password'],
          properties: {
            phone: { type: 'string', description: '手机号' },
            password: { type: 'string', description: '密码' },
          },
        },
      },
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = phoneLoginSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { phone, password } = parsed.data
      const ip = request.ip

      const lockRemaining = await getLockRemainingMs(phone, ip)
      if (lockRemaining > 0) {
        const retryAfterSec = Math.ceil(lockRemaining / 1000)
        return reply
          .status(429)
          .header('Retry-After', String(retryAfterSec))
          .send(
            error(
              429,
              `登录失败次数过多，账号已被临时锁定 ${Math.ceil(retryAfterSec / 60)} 分钟后重试`,
            ),
          )
      }

      const user = await findUserByPhone(phone)
      if (!user || !user.passwordHash) {
        await recordLoginFailure(phone, ip)
        return reply.status(401).send(error(401, '用户不存在或密码错误'))
      }

      // 2026-07-24 国安级升级:argon2id 替代 bcrypt(抗 GPU/ASIC),兼容老 bcrypt
      const ok = await verifyPassword(password, user.passwordHash)
      if (!ok) {
        const remaining = await recordLoginFailure(phone, ip)
        if (remaining === 0) {
          return reply
            .status(429)
            .header('Retry-After', String(ACCOUNT_LOCKOUT_CONFIG.lockDurationSec))
            .send(
              error(
                429,
                `登录失败次数过多，账号已被临时锁定 ${Math.ceil(
                  ACCOUNT_LOCKOUT_CONFIG.lockDurationSec / 60,
                )} 分钟`,
              ),
            )
        }
        return reply
          .status(401)
          .send(error(401, `用户不存在或密码错误（剩余 ${remaining} 次重试机会）`))
      }

      if (user.status !== 1) {
        return reply.status(403).send(error(403, '账号已被禁用'))
      }

      await clearLoginFailures(phone, ip)

      // 风控评估（命中异地登录/异常 IP 时异步触发登录异常通知）
      const risk = evaluateLoginRisk({
        userId: String(user.id),
        ip: request.ip,
      })
      if (risk.action === 'DENY') {
        request.log.warn({ userId: user.id, ip: request.ip, hits: risk.hits }, '登录被风控拒绝')
        return reply.status(403).send(error(403, '登录请求被风控拦截，请联系客服'))
      }

      // 2FA 检查:若用户已启用 2FA,返回 challenge token(5min),前端走 /auth/2fa/login-verify 二次校验
      // 注意:必须 skipResponseSanitization,否则 challengeToken(JWT)会被响应脱敏层改写成 ***
      if (user.twoFactorEnabled) {
        const challengeToken = await signChallengeToken({
          userId: user.id,
          phone: user.phone ?? '',
          familyId: '',
          roleId: user.roleId ?? 0,
        })
        request.skipResponseSanitization = true
        return reply.send(
          success({
            twoFactorRequired: true,
            challengeToken,
            expiresIn: CHALLENGE_TOKEN_TTL_SECONDS,
          }),
        )
      }

      request.skipResponseSanitization = true
      const familyId = createFamilyId()
      const tokens = await buildTokenPair({
        id: user.id,
        phone: user.phone,
        roleId: user.roleId,
        familyId,
      })

      const permissions = await resolveUserPermissions(user.id, user.roleId)
      return reply.send(
        success({
          ...tokens,
          user: publicUser(user, permissions),
        }),
      )
    },
  )

  // POST /api/auth/login/sms — 小程序别名(手机号 + 验证码)
  server.post(
    '/login/sms',
    {
      schema: {
        summary: '手机号验证码登录(小程序别名)',
        description: '使用手机号 + 短信验证码登录,验证码通过 /auth/sms/send 获取',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['phone', 'code'],
          properties: {
            phone: { type: 'string', description: '手机号(11 位)' },
            code: { type: 'string', description: '短信验证码(6 位)' },
          },
        },
      },
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = smsLoginSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { phone, code } = parsed.data

      cleanupExpiredCodes()
      const stored = codeStore.get(phone)
      if (!stored || stored.code !== code || Date.now() > stored.expiresAt) {
        return reply.status(401).send(error(401, '验证码错误或已过期'))
      }

      const user = await findUserByPhone(phone)
      if (!user) {
        // 2026-07-24 安全加固:统一返回"验证码错误"防用户枚举(CWE-204)
        // 攻击者无法通过响应区分"用户未注册"和"验证码错误"
        return reply.status(401).send(error(401, '验证码错误或已过期'))
      }
      if (user.status !== 1) {
        return reply.status(403).send(error(403, '账号已被禁用'))
      }

      codeStore.delete(phone)

      request.skipResponseSanitization = true
      const familyId = createFamilyId()
      const tokens = await buildTokenPair({
        id: user.id,
        phone: user.phone,
        roleId: user.roleId,
        familyId,
      })

      const permissions = await resolveUserPermissions(user.id, user.roleId)
      return reply.send(
        success({
          ...tokens,
          user: publicUser(user, permissions),
        }),
      )
    },
  )

  // POST /api/auth/login/wechat — 小程序别名(微信登录)
  server.post(
    '/login/wechat',
    {
      schema: {
        summary: '微信登录(小程序别名)',
        description: '使用微信 code 登录,需配置微信开放平台 AppID/Secret',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['code'],
          properties: {
            code: { type: 'string', description: '微信授权 code' },
          },
        },
      },
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = wechatLoginSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      if (!isWechatMiniConfigured()) {
        return reply
          .status(501)
          .send(error(501, '微信小程序登录未配置,请配置 WX_MINI_APPID/WX_MINI_SECRET'))
      }
      const session = await jscode2session(parsed.data.code).catch(() => null)
      if (!session) {
        return reply.status(401).send(error(401, '微信登录失败: invalid code'))
      }
      const binding = await findThirdPartyAccount('wechat', session.openId)
      let user
      if (binding) {
        user = await findUserById(binding.userId)
        if (!user) return reply.status(404).send(error(404, '用户不存在'))
        if (user.status !== 1) return reply.status(403).send(error(403, '账号已被禁用'))
      } else {
        try {
          user = await createUser({
            nickname: '微信用户',
            familyId: createFamilyId(),
            roleId: 0,
            status: 1,
          })
        } catch (e) {
          request.log.error({ err: e }, '微信登录创建用户失败')
          return reply.status(500).send(error(500, '微信登录创建用户失败'))
        }
        await createThirdPartyBinding({
          userId: user.id,
          openId: session.openId,
          unionId: session.unionId,
          platform: 'wechat',
        })
      }
      request.skipResponseSanitization = true
      const familyId = createFamilyId()
      const tokens = await buildTokenPair({
        id: user.id,
        phone: user.phone,
        roleId: user.roleId,
        familyId,
      })
      const permissions = await resolveUserPermissions(user.id, user.roleId)
      return reply.send(
        success({
          ...tokens,
          user: publicUser(user, permissions),
        }),
      )
    },
  )

  // GET /api/auth/login/email — 三步登录第一步:校验邮箱存在 + 发送验证码
  server.get(
    '/login/email',
    {
      schema: {
        summary: '邮箱登录-校验邮箱并发送验证码',
        description: '校验邮箱是否已注册,存在则发送 6 位验证码(5 分钟有效,60 秒内不可重发)',
        tags: ['auth'],
        querystring: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', description: '邮箱地址' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          429: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = emailLoginQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { email } = parsed.data

      const user = await findUserByEmail(email)
      if (!user) {
        return reply.status(404).send(error(404, '邮箱未注册'))
      }

      cleanupExpiredCodes()
      const existing = codeStore.get(email)
      const now = Date.now()
      if (existing && now - existing.sentAt < CODE_RESEND_INTERVAL_MS) {
        return reply.status(429).send(error(429, '验证码已发送,请 60 秒后重试'))
      }

      const code = generateCode()
      codeStore.set(email, { code, expiresAt: now + CODE_TTL_MS, sentAt: now })
      request.log.info({ email }, '邮箱验证码已生成')

      const isDev = process.env.NODE_ENV !== 'production'
      return reply.send(
        success(
          isDev
            ? { sent: true, code, expiresIn: CODE_TTL_MS / 1000 }
            : { sent: true, expiresIn: CODE_TTL_MS / 1000 },
        ),
      )
    },
  )

  // POST /api/auth/login/email — 邮箱 + 验证码登录(三步登录最终步)
  // 2026-07-24:实现已迁移到 auth-extended.ts:254,此处删除避免 FastifyError 路由重复

  // POST /api/auth/refresh
  server.post(
    '/refresh',
    {
      schema: {
        summary: '刷新访问令牌',
        description: '使用 refreshToken 轮换签发新的 accessToken / refreshToken',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string', description: '刷新令牌' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = refreshSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { refreshToken: token } = parsed.data

      // 1. 验证 refresh token 签名 + 过期
      let payload: JWTPayload
      try {
        payload = await verifyRefreshToken(token)
      } catch {
        return reply.status(401).send(error(401, 'Invalid refresh token'))
      }

      // 2. 查库确认未被吊销
      const record = await findRefreshToken(token)
      if (!record) {
        return reply.status(401).send(error(401, 'Invalid refresh token'))
      }
      if (record.revokedAt) {
        // 2026-07-22 鲁棒性加固:RFC 6749 §10.4 重用检测
        // 已被吊销的 refresh token 再次出现 = 重用攻击,立即吊销整个 family 所有活跃 token
        if (payload.familyId) {
          try {
            const revokedCount = await revokeRefreshTokenFamily(payload.familyId)
            request.log.warn(
              { familyId: payload.familyId, userId: payload.userId, revokedCount },
              '[security] refresh token reuse detected, family revoked',
            )
          } catch (e) {
            request.log.error({ err: e }, '[security] family revocation failed')
          }
        }
        return reply.status(401).send(error(401, 'Invalid refresh token'))
      }

      // 3. 确认用户仍然存在且启用
      const user = await findUserById(payload.userId)
      if (!user || user.status !== 1) {
        return reply.status(401).send(error(401, '用户不存在或已被禁用'))
      }

      // 4. 吊销旧 refresh token（轮转）
      await revokeRefreshToken(token)

      // 5. 用同一 familyId 签发新 token 对
      request.skipResponseSanitization = true
      const tokens = await buildTokenPair({
        id: user.id,
        phone: user.phone,
        roleId: user.roleId,
        familyId: payload.familyId,
      })

      return reply.send(success(tokens))
    },
  )

  // GET /api/auth/me
  server.get(
    '/me',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      try {
        await authenticate(request)
      } catch (e) {
        const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
        const message = toUserFriendlyMessage(e) || 'Authentication required'
        return reply.status(statusCode).send(error(statusCode, message))
      }

      const userId = request.userId!
      const user = await findUserById(userId)
      if (!user) {
        return reply.status(404).send(error(404, '用户不存在'))
      }

      const permissions = await resolveUserPermissions(user.id, user.roleId)
      return reply.send(success({ user: publicUser(user, permissions) }))
    },
  )

  // POST /api/auth/logout
  server.post(
    '/logout',
    {
      schema: {
        summary: '退出登录',
        description: '吊销当前 refreshToken,完成退出登录',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string', description: '刷新令牌' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = logoutSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { refreshToken: token } = parsed.data

      const record = await findRefreshToken(token)
      if (record && !record.revokedAt) {
        await revokeRefreshToken(token)
      }

      return reply.send(success({ revoked: true }))
    },
  )

  // POST /api/auth/sms/send — 小程序别名（同 /send-code）
  server.post(
    '/sms/send',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsed = sendCodeSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { phone } = parsed.data
      cleanupExpiredCodes()
      const existing = codeStore.get(phone)
      const now = Date.now()
      if (existing && now - existing.sentAt < CODE_RESEND_INTERVAL_MS) {
        return reply.status(429).send(error(429, '验证码已发送,请 60 秒后重试'))
      }
      const code = generateCode()
      codeStore.set(phone, { code, expiresAt: now + CODE_TTL_MS, sentAt: now })
      request.log.info({ phone, scene: parsed.data.scene }, '验证码已生成')
      const isDev = process.env.NODE_ENV !== 'production'
      return reply.send(
        success(
          isDev
            ? { sent: true, code, expiresIn: CODE_TTL_MS / 1000 }
            : { sent: true, expiresIn: CODE_TTL_MS / 1000 },
        ),
      )
    },
  )

  // PUT /api/auth/password — 小程序别名(修改密码)
  server.put(
    '/password',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      try {
        await authenticate(request)
      } catch (e) {
        const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
        return reply
          .status(statusCode)
          .send(error(statusCode, toUserFriendlyMessage(e) || 'Authentication required'))
      }
      const body = (request.body as Record<string, string> | null) ?? {}
      const oldPassword = body.old_password ?? body.oldPassword
      const newPassword = body.new_password ?? body.newPassword
      if (!oldPassword || !newPassword) {
        return reply.status(400).send(error(400, '请提供原密码和新密码'))
      }
      if (newPassword.length < 6) return reply.status(400).send(error(400, '新密码至少 6 位'))
      const user = await findUserById(request.userId!)
      if (!user?.passwordHash || !(await verifyPassword(oldPassword, user.passwordHash))) {
        return reply.status(400).send(error(400, '原密码错误'))
      }
      await updateUser(request.userId!, { passwordHash: await hashPassword(newPassword) })
      // 2026-07-24 安全加固:密码修改后吊销所有 refresh token(与重置密码对齐)
      await revokeAllUserRefreshTokens(request.userId!)
      return reply.send(success({ updated: true }))
    },
  )

  // DELETE /api/auth/account — 小程序别名(注销账号)
  server.delete(
    '/account',
    { config: { rateLimit: { max: 3, timeWindow: '1 hour' } } },
    async (request, reply) => {
      try {
        await authenticate(request)
      } catch (e) {
        const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
        return reply
          .status(statusCode)
          .send(error(statusCode, toUserFriendlyMessage(e) || 'Authentication required'))
      }
      await cancelUserAccount(request.userId!)
      return reply.send(success({ cancelled: true }))
    },
  )

  // GET /api/auth/login-preferences — 读取用户登录偏好
  server.get(
    '/login-preferences',
    {
      preHandler: [authenticate],
      schema: {
        summary: '获取登录偏好',
        description: '读取当前用户的自动登录/自动续期偏好(autoRenew 默认开启)',
        tags: ['auth'],
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  autoLogin: { type: 'boolean' },
                  autoRenew: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const userId = request.userId!
      const { list } = await findUserPreferences(userId, 'security')
      return reply.send(success(parseLoginPreferences(list)))
    },
  )

  // PUT /api/auth/login-preferences — 更新用户登录偏好
  server.put(
    '/login-preferences',
    {
      preHandler: [authenticate],
      schema: {
        summary: '更新登录偏好',
        description: '更新当前用户的自动登录/自动续期偏好(至少传一个字段)',
        tags: ['auth'],
        body: {
          type: 'object',
          properties: {
            autoLogin: { type: 'boolean', description: '是否自动登录' },
            autoRenew: { type: 'boolean', description: '是否自动续期' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: {
                type: 'object',
                properties: {
                  autoLogin: { type: 'boolean' },
                  autoRenew: { type: 'boolean' },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = loginPreferencesSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { autoLogin, autoRenew } = parsed.data
      if (autoLogin === undefined && autoRenew === undefined) {
        return reply.status(400).send(error(400, '至少提供一个字段(autoLogin 或 autoRenew)'))
      }
      const userId = request.userId!
      if (autoLogin !== undefined) {
        await upsertUserPreference(userId, 'security', 'autoLogin', autoLogin ? '1' : '0')
      }
      if (autoRenew !== undefined) {
        await upsertUserPreference(userId, 'security', 'autoRenew', autoRenew ? '1' : '0')
      }
      const { list } = await findUserPreferences(userId, 'security')
      return reply.send(success(parseLoginPreferences(list)))
    },
  )

  // ===== QR 扫码登录 =====
  // 流程:PC 调 /qr/generate 生成 ticket → 展示二维码 → 移动端扫码后调 /qr/confirm 确认
  //      → PC 轮询 /qr/status 拿到 token 对 + userId 完成登录

  // Redis 客户端获取(防御式:测试环境可能未注册 redis 插件)
  const getRedis = (): Redis | null =>
    (server as unknown as { redis?: Redis }).redis ?? null

  // POST /qr/generate - PC 端生成扫码登录二维码(未鉴权)
  server.post(
    '/qr/generate',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (_request, reply) => {
      const redis = getRedis()
      if (!redis) {
        return reply.status(503).send(error(503, 'Redis 未配置,无法生成二维码'))
      }
      const ticket = `qr_${randomUUID()}`
      const now = new Date().toISOString()
      const state: QrLoginState = { status: 'pending', userId: null, createdAt: now }
      try {
        await redis.set(
          QR_LOGIN_KEY_PREFIX + ticket,
          JSON.stringify(state),
          'EX',
          QR_LOGIN_TTL_SECONDS,
        )
      } catch (e) {
        _request.log.error({ err: e }, '[qr] generate: redis set failed')
        return reply.status(500).send(error(500, '二维码生成失败,请稍后重试'))
      }
      const expiresAt = new Date(Date.now() + QR_LOGIN_TTL_SECONDS * 1000).toISOString()
      return reply.send(success({ ticket, qrContent: ticket, expiresAt }))
    },
  )

  // GET /qr/status - PC 端轮询扫码登录状态(未鉴权)
  server.get(
    '/qr/status',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsed = qrTicketSchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const redis = getRedis()
      if (!redis) {
        return reply.status(503).send(error(503, 'Redis 未配置'))
      }
      const { ticket } = parsed.data
      let raw: string | null
      try {
        raw = await redis.get(QR_LOGIN_KEY_PREFIX + ticket)
      } catch (e) {
        request.log.error({ err: e }, '[qr] status: redis get failed')
        return reply.status(500).send(error(500, '状态查询失败,请稍后重试'))
      }
      if (!raw) {
        // ticket 不存在或已过期(含已确认后被删除的一次性 key)
        return reply.send(success({ status: 'expired' as const }))
      }
      let state: QrLoginState
      try {
        state = JSON.parse(raw) as QrLoginState
      } catch {
        return reply.send(success({ status: 'expired' as const }))
      }
      if (state.status === 'pending') {
        return reply.send(success({ status: 'pending' as const }))
      }
      // state.status === 'confirmed':一次性删除 key,防止 token 被重复领取
      try {
        await redis.del(QR_LOGIN_KEY_PREFIX + ticket)
      } catch (e) {
        request.log.warn({ err: e }, '[qr] status: redis del failed (non-fatal)')
      }
      // 跳过响应脱敏,否则 token 字段会被 response-sanitizer 遮蔽为 '***'
      request.skipResponseSanitization = true
      return reply.send(
        success({ status: 'confirmed' as const, ...state.tokens, userId: state.userId }),
      )
    },
  )

  // POST /qr/confirm - 移动端扫码后确认登录(需鉴权)
  server.post(
    '/qr/confirm',
    {
      preHandler: [authenticate],
      schema: {
        summary: '扫码确认登录',
        description: '移动端已登录用户扫描 PC 端二维码后,确认授权 PC 端登录',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['ticket'],
          properties: {
            ticket: { type: 'string', description: 'PC 端二维码 ticket' },
          },
        },
      },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = qrTicketSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { ticket } = parsed.data
      const userId = request.userId!
      const redis = getRedis()
      if (!redis) {
        return reply.status(503).send(error(503, 'Redis 未配置'))
      }
      const key = QR_LOGIN_KEY_PREFIX + ticket
      let raw: string | null
      try {
        raw = await redis.get(key)
      } catch (e) {
        request.log.error({ err: e }, '[qr] confirm: redis get failed')
        return reply.status(500).send(error(500, '确认失败,请稍后重试'))
      }
      if (!raw) {
        return reply.status(404).send(error(404, '二维码已过期或不存在'))
      }
      // 加载用户信息,签发 token 对(复用 buildTokenPair,与正常登录一致)
      const user = await findUserById(userId)
      if (!user || user.status !== 1) {
        return reply.status(401).send(error(401, '用户不存在或已被禁用'))
      }
      const tokens = await buildTokenPair({
        id: user.id,
        phone: user.phone,
        roleId: user.roleId,
        familyId: createFamilyId(),
      })
      const confirmedState: QrLoginState = {
        status: 'confirmed',
        userId,
        tokens,
        createdAt: new Date().toISOString(),
      }
      try {
        // 保留剩余 TTL(用 ttl 续期,避免 confirm 时 key 已临近过期被写回 300s)
        const ttl = await redis.ttl(key)
        if (ttl > 0) {
          await redis.set(key, JSON.stringify(confirmedState), 'EX', ttl)
        } else {
          // key 已在读取后过期(竞态),按不存在处理
          return reply.status(404).send(error(404, '二维码已过期或不存在'))
        }
      } catch (e) {
        request.log.error({ err: e }, '[qr] confirm: redis set failed')
        return reply.status(500).send(error(500, '确认失败,请稍后重试'))
      }
      return reply.send(success({ confirmed: true, ticket }))
    },
  )
}
