import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { verifyRefreshToken, createFamilyId, type JWTPayload } from '@ihui/auth'
import { authenticate } from '../plugins/auth.js'
import { issueTokenPair } from '../services/token-service.js'
import {
  findUserByPhone,
  findUserByAccount,
  findUserById,
  createUser,
  updateUser,
  cancelUserAccount,
  findRefreshToken,
  revokeRefreshToken,
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
import {
  codeStore,
  CODE_TTL_MS,
  CODE_RESEND_INTERVAL_MS,
  generateCode,
  cleanupExpiredCodes,
} from '../utils/code-store.js'

// =============================================================================
// Zod schemas
// =============================================================================

const registerSchema = z.object({
  phone: z.string().length(11, '手机号必须为 11 位'),
  password: z.string().min(6, '密码至少 6 位').max(72, '密码最多 72 位'),
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
async function resolveUserPermissions(userId: string, roleId: number | null): Promise<string[]> {
  if (roleId !== null && roleId >= ADMIN_ROLE_ID) return ADMIN_WILDCARD_PERMISSIONS
  return getUserPermissions(userId)
}

function publicUser(
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

// =============================================================================
// 路由
// =============================================================================

export const authRoutes: FastifyPluginAsync = async (server) => {
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
        rateLimit: { max: 10, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const parsed = resetPasswordSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { phone, code, newPassword } = parsed.data

      // 校验验证码
      cleanupExpiredCodes()
      const entry = codeStore.get(phone)
      if (!entry || entry.code !== code || entry.expiresAt < Date.now()) {
        return reply.status(400).send(error(400, '验证码错误或已过期'))
      }

      // 查找用户
      const user = await findUserByPhone(phone)
      if (!user) {
        return reply.status(404).send(error(404, '用户不存在'))
      }

      if (await isSystemAdminUser(user.id)) {
        return reply.status(403).send(error(403, '系统内置管理员密码不可重置'))
      }

      // 更新密码
      const passwordHash = await bcrypt.hash(newPassword, 10)
      await updateUser(user.id, { passwordHash })

      // 删除已使用的验证码
      codeStore.delete(phone)

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
        rateLimit: { max: 10, timeWindow: '1 minute' },
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
      const passwordHash = await bcrypt.hash(password, 10)
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
        rateLimit: { max: 10, timeWindow: '1 minute' },
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

      const ok = await bcrypt.compare(password, user.passwordHash)
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

      // 风控评估：异常 IP / 异地登录检测
      const risk = server.riskEngine.evaluateRisk({
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
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
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

      const ok = await bcrypt.compare(password, user.passwordHash)
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

      const risk = server.riskEngine.evaluateRisk({
        userId: String(user.id),
        ip: request.ip,
      })
      if (risk.action === 'DENY') {
        request.log.warn({ userId: user.id, ip: request.ip, hits: risk.hits }, '登录被风控拒绝')
        return reply.status(403).send(error(403, '登录请求被风控拦截，请联系客服'))
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
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
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
        return reply.status(401).send(error(401, '用户不存在,请先注册'))
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
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = wechatLoginSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      // 微信 OAuth 集成未配置 — 诚实返回 501,不假装支持
      return reply
        .status(501)
        .send(error(501, '微信登录暂未配置,请配置 WECHAT_APPID/WECHAT_SECRET 后启用'))
    },
  )

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
      if (!record || record.revokedAt) {
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
  server.get('/me', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }

    const userId = request.userId!
    const user = await findUserById(userId)
    if (!user) {
      return reply.status(404).send(error(404, '用户不存在'))
    }

    const permissions = await resolveUserPermissions(user.id, user.roleId)
    return reply.send(success({ user: publicUser(user, permissions) }))
  })

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

  // PUT /api/auth/password — 小程序别名（修改密码）
  server.put('/password', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply
        .status(statusCode)
        .send(error(statusCode, (e as Error).message || 'Authentication required'))
    }
    const body = (request.body as Record<string, string> | null) ?? {}
    const oldPassword = body.old_password ?? body.oldPassword
    const newPassword = body.new_password ?? body.newPassword
    if (!oldPassword || !newPassword) {
      return reply.status(400).send(error(400, '请提供原密码和新密码'))
    }
    if (newPassword.length < 6) return reply.status(400).send(error(400, '新密码至少 6 位'))
    const user = await findUserById(request.userId!)
    if (!user?.passwordHash || !bcrypt.compareSync(oldPassword, user.passwordHash)) {
      return reply.status(400).send(error(400, '原密码错误'))
    }
    await updateUser(request.userId!, { passwordHash: bcrypt.hashSync(newPassword, 10) })
    return reply.send(success({ updated: true }))
  })

  // DELETE /api/auth/account — 小程序别名（注销账号）
  server.delete('/account', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply
        .status(statusCode)
        .send(error(statusCode, (e as Error).message || 'Authentication required'))
    }
    await cancelUserAccount(request.userId!)
    return reply.send(success({ cancelled: true }))
  })
}
