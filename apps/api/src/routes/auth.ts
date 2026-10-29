// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createHash, randomUUID } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { Redis } from 'ioredis'
// 2026-07-24 国安级升级:argon2id 密码哈希(抗 GPU/ASIC),兼容老 bcrypt 透明升级
import { hashPassword, verifyPassword } from '../utils/password-crypto.js'
import { transparentlyUpgradePasswordHash } from '../services/login-hash-upgrade.js'
import { config } from '../config/index.js'
import { verifyRefreshToken, createFamilyId, type JWTPayload } from '@ihui/auth'
import { authenticate } from '../plugins/auth.js'
import { issueTokenPair } from '../services/token-service.js'
import { assessRefreshReplay } from '../services/refresh-replay-policy.js'
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
import { recordSecurityEvent } from '../db/security-logs-queries.js'
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
import { setAuthCookies, clearAuthCookies } from '../utils/auth-cookies.js'
import { wechatAppCode2session, isWechatAppConfigured } from '../services/oauth-providers.js'
import { findThirdPartyAccount, createThirdPartyBinding } from '../db/oauth-queries.js'
import { findUserPreferences, upsertUserPreference } from '../db/user-preferences-queries.js'
import { toUserFriendlyMessage } from '@ihui/shared'
import {
  getCodeEntry,
  putCodeEntry,
  CODE_TTL_MS,
  CODE_RESEND_INTERVAL_MS,
  generateCode,
  verifyCode,
  type CodeEntry,
} from '../utils/code-store.js'
import { signChallengeToken, CHALLENGE_TOKEN_TTL_SECONDS } from '../services/totp-service.js'
// G-192:验证码回显收敛闸 + 按「标识 + IP」的发送频控(详见 utils/code-echo-guard.ts)
import {
  buildSendCodePayload,
  consumeSendQuota,
  refundSendQuota,
  sendCodePreSerialization,
} from '../utils/code-echo-guard.js'
import {
  deliverSmsCode,
  smsCodeTtlMs,
  isSmsConfigured,
  extractSmsSendGuard,
} from '../services/sms.js'
import { sendNoticeSmsToUser, sendNoticeSmsToPhone } from '../services/sms-notify.js'
import type { SmsScene } from '../services/sms-types.js'
import { ErrorCode } from '../errors/codes.js'
import { sendVerificationEmail } from '../services/email-service.js'
import {
  evaluateLoginRisk,
  evaluateRisk,
  recentRiskHitsByIp,
} from '../services/risk-engine-service.js'
import { verifyTurnstile } from '../services/turnstile-service.js'
import { db } from '../db/index.js'
import { userDevices } from '@ihui/database'
import {
  recordAuthLoginAttempt,
  recordAuthLoginSuccess,
  recordAuthLoginFailed,
  recordAuthLoginAnomaly,
} from '../plugins/business-metrics.js'
import { gateLoginIpWhitelist } from './user/ip-whitelist-guard.js'
import { QR_AGREEMENT_REQUIRED, isQrSessionAgreed } from '../services/qr-login-agreement.js'

/**
 * G-642(2026-09-29):设备指纹落库前归一 —— trim 首尾空白;归一后为空(如 " ")视为
 * 无指纹 ⇒ 不落库(不得把空白当有效身份);超长(>64,即 user_devices.fingerprint_hash
 * varchar(64) 硬上限)视为非法输入拒收 —— 截断会把不同设备折到同一键上,制造假"同设备"。
 */
export function normalizeDeviceFingerprint(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed.length > 64) return undefined
  return trimmed
}

// =============================================================================
// Zod schemas
// =============================================================================

const registerSchema = z.object({
  phone: z.string().length(11, '手机号必须为 11 位'),
  password: z.string().min(8, '密码至少 8 位').max(72, '密码最多 72 位'),
  // G-876:手机号真实性核验 —— code 必填(不许匿名占号),且必须是 register 场景发出的那枚。
  code: z.string({ error: '请填写短信验证码' }).regex(/^\d{6}$/, '验证码必须为 6 位'),
  invitationCode: z.string().optional(),
})

/** G-876:注册失败体带稳定 errorCode(落进 errors/codes.ts 既有枚举),客户端按码分型而非文本匹配。 */
const registerErrorResponseSchema = {
  type: 'object',
  properties: {
    code: { type: 'number' },
    message: { type: 'string' },
    errorCode: { type: 'string' },
  },
} as const
import { buildResponseSchema } from '../utils/api-schemas.js'

const loginSchema = z.object({
  account: z.string().min(1, '账号不能为空'),
  password: z.string().min(1, '密码不能为空'),
})

// P2-18:refreshToken 改为可选 —— httpOnly cookie 化后,前端 JS 读不到 refresh_token,
// 刷新/登出靠 cookie 自动附带,body 可缺省(handler 内已兼容 cookie 读取)。
const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
})

const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
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
    // 2026-10-26 海外登录策略:手机验证码登录仅限中国大陆号码,海外用户走 Google 授权。
    .regex(/^1[3-9]\d{9}$/, '仅支持中国大陆手机号登录，海外用户请使用 Google 登录'),
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
    identityType: string | null
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
    // 身份档位由 is_vip 派生(-1游客/0普通/1VIP/2操盘手);identity_type 列留作显式覆盖
    identityType:
      user.identityType && user.identityType !== 'normal'
        ? user.identityType
        : user.isVip === 2
          ? 'trader'
          : user.isVip === 1
            ? 'vip'
            : 'normal',
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

/** PC 端生成二维码时把「已同意条款」写入扫码会话(唯一真相源,判据见 qr-login-agreement)。 */
const qrGenerateSchema = z.object({
  agreementAccepted: z.boolean().optional(),
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
  | {
      status: 'pending'
      userId: null
      createdAt: string
      /** 生成二维码时由 PC 端写入;扫码确认与发 token 都读这一格(判据见 qr-login-agreement)。 */
      agreementAccepted?: boolean
    }
  | {
      status: 'confirmed'
      userId: string
      tokens: QrTokenPair
      createdAt: string
      agreementAccepted?: boolean
    }

// =============================================================================
// 路由
// =============================================================================

export const authRoutes: FastifyPluginAsync = async (server) => {
  // P0-30 配套(2026-08-01):登录端点 Turnstile 人机验证
  // 覆盖 /login /login/sms /login/email,未配置 TURNSTILE_SECRET_KEY 时 verifyTurnstile 内部放行
  // 客户端未提供 turnstileToken 时放行(兼容未启用 Turnstile 的旧客户端)
  server.addHook('preHandler', async (request, reply) => {
    // 2026-10-27 修复:routeOptions.url 是含注册前缀的全路径(如 /api/auth/login),
    // 原实现对 Set 里的裸路径做全等比较恒不命中 ⇒ 钩子自 2026-08-01 上线起从未执行过。
    // 改为后缀匹配,天然覆盖前缀。
    const loginPaths = ['/login', '/login/sms', '/login/email']
    const routeUrl = request.routeOptions?.url ?? ''
    if (!routeUrl || !loginPaths.some((p) => routeUrl.endsWith(p))) return

    const body = request.body as Record<string, unknown> | undefined
    const token = body?.turnstileToken
    if (typeof token !== 'string' || !token) {
      // 2026-10-27 加固:服务端启用了 Turnstile(TURNSTILE_SECRET_KEY 已配置)时,
      // 客户端"省略字段"= 绕过尝试,一律拒绝 —— 原写法不传 token 直接放行,
      // 等于脚本打 /login 可以完全跳过人机验证(密码喷洒敞口)。
      if (process.env.TURNSTILE_SECRET_KEY) {
        return reply.code(403).send(error(403, '人机验证失败,请重试'))
      }
      return
    }

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
          502: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
      config: {
        rateLimit: { max: 5, timeWindow: '1 minute' },
      },
      // G-192:回显判据不成立时,序列化层再剥一次 `data.code`(回归锁钉在响应体这一层)
      preSerialization: sendCodePreSerialization,
    },
    async (request, reply) => {
      const parsed = sendCodeSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { phone } = parsed.data

      // G-192:按「手机号 + IP」频控(计数覆盖取码尝试,含后续 60 秒重发拦截)
      const quota = await consumeSendQuota(phone, request.ip)
      if (!quota.allowed) {
        return reply
          .header('Retry-After', String(quota.retryAfterSec))
          .status(429)
          .send(error(429, '验证码请求过于频繁,请稍后再试'))
      }

      const existing = await getCodeEntry(phone)
      const now = Date.now()
      if (existing && now - existing.sentAt < CODE_RESEND_INTERVAL_MS) {
        return reply.status(429).send(error(429, '验证码已发送,请 60 秒后重试'))
      }

      // 有效期按场景取 —— 必须等于该场景模板文案里对用户的承诺
      const ttlMs = smsCodeTtlMs(parsed.data.scene)
      const code = generateCode()
      // G-876:把「用途场景」随码一起落库,注册路径据此只认 register 场景发出的码。
      // CodeEntry 本身不带 scene(utils/code-store 不在本票改动面),这里以扩展字段写入;
      // Redis 存的是整条 JSON,读取端按扩展字段判定即可。
      const entry: CodeEntry & { scene: SmsScene } = {
        code,
        expiresAt: now + ttlMs,
        sentAt: now,
        scene: parsed.data.scene,
      }
      await putCodeEntry(phone, entry)

      // 2026-10-22 根治:这里过去只写一行"验证码已生成"的日志,从不投递 ——
      // 响应却回"已发送",于是用户永远在等那条根本不会来的短信。现在真发,且发不出去就如实报错。
      const delivery = await deliverSmsCode(
        phone,
        code,
        parsed.data.scene,
        extractSmsSendGuard(request.headers, request.ip),
      )
      if (!delivery.sent) {
        // 没发出去就退还本标识 + IP 的取码配额,避免通道抖动一次就锁住用户 10 分钟
        await refundSendQuota(phone, request.ip)
        request.log.warn({ reason: delivery.reason, scene: parsed.data.scene }, '验证码投递失败')
        // IP/设备防刷命中与云侧失败必须区分:前者是客户端该退避,后者是通道问题
        if (delivery.reason?.startsWith('rate_limited')) {
          return reply.status(429).send(error(429, '请求过于频繁,请稍后再试'))
        }
        return reply.status(502).send(error(502, '验证码发送失败,请稍后重试'))
      }

      // G-192:默认不回显验证码;仅显式调试开关 + development 档 + loopback/内网三条件同时成立才回显
      return reply.send(success(buildSendCodePayload(request, code, ttlMs / 1000)))
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
        response: buildResponseSchema(400, 403, 404),
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
      // 原实现直接读存储比对,绕过了 verifyCode 的测试 bypass 与一次性删除
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

      // verifyCode 内部已原子消费掉验证码,这里不需要再手动删

      return reply.send(success({ reset: true }))
    },
  )

  // POST /api/auth/register
  server.post(
    '/register',
    {
      schema: {
        summary: '用户注册',
        description: '手机号 + 短信验证码 + 密码注册,可选邀请码',
        tags: ['auth'],
        body: {
          type: 'object',
          // 注:code 的「必填」由下面的 registerSchema(zod)判,不挂到 Fastify 原生 required ——
          // Fastify 的校验错误体是 {statusCode,error,message:string code},与本路由 400 信封
          // (code 为 number)不同形,交给序列化会变成 500 FST_ERR_FAILED_ERROR_SERIALIZATION。
          required: ['phone', 'password'],
          properties: {
            phone: { type: 'string', description: '手机号(11 位)' },
            password: { type: 'string', description: '密码(>=6 位,<=72 位)' },
            code: { type: 'string', description: '短信验证码(6 位,必填;由 zod 判)' },
            invitationCode: { type: 'string', description: '邀请码(可选)' },
          },
        },
        response: {
          ...buildResponseSchema(400, 403, 409),
          400: registerErrorResponseSchema,
          409: registerErrorResponseSchema,
          503: registerErrorResponseSchema,
        } as Record<number | string, unknown>,
      },
      config: {
        // 2026-08-02 安全加固:注册端点收紧到 3 次/小时,防机器人批量刷号。
        rateLimit: { max: 3, timeWindow: '1 hour' },
      },
    },
    async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          ...error(400, parsed.error.issues[0]?.message ?? '参数错误'),
          errorCode: ErrorCode.VALIDATION_FAILED.code,
        })
      }
      const { phone, password, code } = parsed.data

      // G-876(2026-10-24):手机号真实性核验。
      //  - 短信通道未配置 ⇒ 按同族既有「未配置态」契约 503 响亮失败(fail-closed),
      //    绝不静默放行无码注册(票面 §5「未验过不落库」);
      //  - 码必须一次性消费且限定 register 用途:非 register 场景发出的码不得拿来注册;
      //  - 校验先于 409 查询:未验码者不得借 409 文案枚举号码归属。
      if (!isSmsConfigured()) {
        return reply.status(503).send({
          ...error(
            503,
            '短信通道未配置:缺 ALI_SMS_* / TENCENT_SMS_* / SMS_API_BASE_URL ⇒ 注册当前不可用',
          ),
          errorCode: ErrorCode.CAPABILITY_UNAVAILABLE.code,
        })
      }

      const entry = await getCodeEntry(phone)
      // 用途锁:有未过期码但场景不是 register ⇒ 拒(不消费,不影响该码在原场景使用)
      if (entry && (entry as CodeEntry & { scene?: SmsScene }).scene !== 'register') {
        return reply.status(400).send({
          ...error(400, '验证码错误或已过期'),
          errorCode: ErrorCode.VALIDATION_FAILED.code,
        })
      }

      // 一次性 + 过期:verifyCode 在 Redis 用原子脚本比对并删除,内存兜底同一判据
      if (!(await verifyCode(phone, code))) {
        return reply.status(400).send({
          ...error(400, '验证码错误或已过期'),
          errorCode: ErrorCode.VALIDATION_FAILED.code,
        })
      }

      // 检查手机号是否已注册
      const existing = await findUserByPhone(phone)
      if (existing) {
        return reply.status(409).send({
          ...error(409, '该手机号已注册'),
          errorCode: ErrorCode.CONFLICT.code,
        })
      }

      // P0 资金安全修复(2026-09-06):注册接入风控,注入 IP/设备指纹 +
      // R004 批量注册需要的 sameIpRegisterCount 上下文(统计同 IP 近期风控命中)
      try {
        const sameIpRegisterCount = await recentRiskHitsByIp(request.ip)
        const risk = evaluateRisk({
          ip: request.ip,
          deviceFingerprint: (request.headers['x-device-fingerprint'] as string) ?? undefined,
          sameIpRegisterCount,
        })
        if (risk.action === 'DENY') {
          request.log.warn({ ip: request.ip, hits: risk.hits }, '注册被风控拒绝')
          return reply.status(403).send(error(403, '注册请求被风控拦截,请联系客服'))
        }
        if (risk.action === 'REVIEW') {
          request.log.info({ ip: request.ip, hits: risk.hits }, '注册进入人工复核(不阻断)')
        }
      } catch (e) {
        request.log.warn({ err: e }, '注册风控评估失败(不阻断注册)')
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
      // business_funnel_total{stage="register"}:用户行创建成功即注册事件成立。
      // 只观察,不参与任何分支/返回值;装饰器委托到 business-metrics.ts 的 recordFunnelSample,
      // 那一层有 safeRecord 兜底 ⇒ 埋点内部抛异常只会记 warn,不可能把注册带崩
      // (该容错型在 apps/api/tests/business-metrics-instrumentation.test.ts T5 上被真的造出来验过)。
      // channel 不传:本端点没有渠道入参 ⇒ 落 FUNNEL_DEFAULT_CHANNEL,不编渠道名。
      server.recordFunnel('register')

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

      const gate = await gateLoginIpWhitelist(request, reply, user.id)
      if (!gate.allowed) return gate.reply

      const tokens = await buildTokenPair({
        id: user.id,
        phone: user.phone,
        roleId: user.roleId,
        familyId,
      })

      const permissions = await resolveUserPermissions(user.id, user.roleId)
      setAuthCookies(reply, tokens, true)
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
        // 2026-08-28 E2E 修复:全量 E2E(623 用例 + global-setup seed + 多 spec 登录)
        // 并发打 /api/auth/login,per-IP 5 次/分钟持续触发 429(backend-contract.spec
        // 的 7s 退避追不上 60s 窗口)。dev 放宽到 200 次/分钟;production 保持 5 次/分钟。
        // (账号锁定防爆破机制 recordLoginFailure/getLockRemainingMs 独立生效,不受影响)
        rateLimit:
          // 档位判定走 config.isProductionGuard 单源(2026-10-27 收口,同 server.ts)
          !config.isProductionGuard
            ? { max: 200, timeWindow: '1 minute' }
            : { max: 5, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      // ihui_auth_login_attempt_total:登录入口打点(参数校验前)
      recordAuthLoginAttempt()
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
        recordAuthLoginFailed(ip)
        recordAuthLoginAnomaly('lockout')
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
        recordAuthLoginFailed(ip)
        return reply.status(401).send(error(401, '用户不存在或密码错误'))
      }

      // 2026-07-24 国安级升级:argon2id 替代 bcrypt(抗 GPU/ASIC),兼容老 bcrypt 透明升级
      const ok = await verifyPassword(password, user.passwordHash)
      if (!ok) {
        const remaining = await recordLoginFailure(account, ip)
        if (remaining === 0) {
          recordAuthLoginFailed(ip)
          recordAuthLoginAnomaly('lockout')
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
        recordAuthLoginFailed(ip)
        return reply
          .status(401)
          .send(error(401, `用户不存在或密码错误（剩余 ${remaining} 次重试机会）`))
      }

      if (user.status !== 1) {
        recordAuthLoginFailed(ip)
        return reply.status(403).send(error(403, '账号已被禁用'))
      }

      // 登录成功 → 清空失败计数
      await clearLoginFailures(account, ip)

      // 2026-07-24 国安级升级:透明升级老 bcrypt 哈希到 argon2id(抗 GPU/ASIC)
      // 登录成功后自动迁移,用户无感知,无需强制重置密码。
      // 2026-10-28:判据与"升级失败绝不阻断登录"的容错抽到 services/login-hash-upgrade.ts,
      // 由三个登录入口共用(此前只有这一处内联实现，另两个入口只验不升)。
      await transparentlyUpgradePasswordHash({
        userId: String(user.id),
        password,
        currentHash: user.passwordHash,
        log: request.log,
      })

      // 风控评估：异常 IP / 异地登录检测（命中异地登录/异常 IP 时异步触发登录异常通知）
      const risk = evaluateLoginRisk({
        userId: String(user.id),
        ip: request.ip,
      })
      if (risk.action === 'DENY') {
        recordAuthLoginAnomaly('deny')
        request.log.warn({ userId: user.id, ip: request.ip, hits: risk.hits }, '登录被风控拒绝')
        return reply.status(403).send(error(403, '登录请求被风控拦截，请联系客服'))
      }
      if (risk.action === 'CHALLENGE' || risk.action === 'REVIEW') {
        recordAuthLoginAnomaly(risk.action === 'CHALLENGE' ? 'challenge' : 'review')
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
      const gate = await gateLoginIpWhitelist(request, reply, user.id)
      if (!gate.allowed) return gate.reply
      const tokens = await buildTokenPair({
        id: user.id,
        phone: user.phone,
        roleId: user.roleId,
        familyId,
      })

      const permissions = await resolveUserPermissions(user.id, user.roleId)

      // P2-18:登录成功 → 设置 httpOnly auth cookie(access+refresh 均 httpOnly,
      // 前端 JS 读不到;请求自动携带,SSR/middleware/cookie 鉴权不受影响)
      setAuthCookies(reply, tokens, true)

      // 登录成功 → upsert 设备指纹到 user_devices 表(从 x-device-fingerprint header 取)
      // 指纹经 normalizeDeviceFingerprint 归一:空白/超长不落库(G-642);失败仅 log,不影响登录流程
      const fingerprint = normalizeDeviceFingerprint(request.headers['x-device-fingerprint'])
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

      recordAuthLoginSuccess()
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
      recordAuthLoginAttempt()
      const parsed = phoneLoginSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { phone, password } = parsed.data
      const ip = request.ip

      const lockRemaining = await getLockRemainingMs(phone, ip)
      if (lockRemaining > 0) {
        const retryAfterSec = Math.ceil(lockRemaining / 1000)
        recordAuthLoginFailed(ip)
        recordAuthLoginAnomaly('lockout')
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
        recordAuthLoginFailed(ip)
        return reply.status(401).send(error(401, '用户不存在或密码错误'))
      }

      // 2026-07-24 国安级升级:argon2id 替代 bcrypt(抗 GPU/ASIC),兼容老 bcrypt
      const ok = await verifyPassword(password, user.passwordHash)
      if (!ok) {
        const remaining = await recordLoginFailure(phone, ip)
        if (remaining === 0) {
          recordAuthLoginFailed(ip)
          recordAuthLoginAnomaly('lockout')
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
        recordAuthLoginFailed(ip)
        return reply
          .status(401)
          .send(error(401, `用户不存在或密码错误（剩余 ${remaining} 次重试机会）`))
      }

      if (user.status !== 1) {
        recordAuthLoginFailed(ip)
        return reply.status(403).send(error(403, '账号已被禁用'))
      }

      await clearLoginFailures(phone, ip)

      // 2026-10-28 普查发现：本入口（别名密码登录）此前只 verify 不升级哈希，
      // 与 /auth/login 行为不一致 —— 弱哈希一旦经此路登录就永远升不上去。现补同一出口调用。
      await transparentlyUpgradePasswordHash({
        userId: String(user.id),
        password,
        currentHash: user.passwordHash,
        log: request.log,
      })

      // 风控评估（命中异地登录/异常 IP 时异步触发登录异常通知）
      const risk = evaluateLoginRisk({
        userId: String(user.id),
        ip: request.ip,
      })
      if (risk.action === 'DENY') {
        recordAuthLoginAnomaly('deny')
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
      const gate = await gateLoginIpWhitelist(request, reply, user.id)
      if (!gate.allowed) return gate.reply
      const tokens = await buildTokenPair({
        id: user.id,
        phone: user.phone,
        roleId: user.roleId,
        familyId,
      })

      const permissions = await resolveUserPermissions(user.id, user.roleId)
      setAuthCookies(reply, tokens, true)
      recordAuthLoginSuccess()
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
      recordAuthLoginAttempt()
      const parsed = smsLoginSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { phone, code } = parsed.data

      // 2026-10-22:改用 verifyCode 原子消费。旧写法是"先读比对、查到用户之后才删",
      // 读与删之间隔着一次 await —— 进程内 Map 时代靠单线程侥幸免疫,换成 Redis 共享存储后
      // 这就是一枚跨进程可双重使用的登录码。与 /reset-password 早已定的口径也对齐了。
      const codeOk = await verifyCode(phone, code)
      if (!codeOk) {
        recordAuthLoginFailed(request.ip)
        return reply.status(401).send(error(401, '验证码错误或已过期'))
      }

      const user = await findUserByPhone(phone)
      if (!user) {
        // 2026-07-24 安全加固:统一返回"验证码错误"防用户枚举(CWE-204)
        // 攻击者无法通过响应区分"用户未注册"和"验证码错误"
        recordAuthLoginFailed(request.ip)
        return reply.status(401).send(error(401, '验证码错误或已过期'))
      }
      if (user.status !== 1) {
        recordAuthLoginFailed(request.ip)
        return reply.status(403).send(error(403, '账号已被禁用'))
      }

      // 2FA 一致性(2026-10-27 修旁路):短信验证码登录同样必须过 TOTP,
      // 否则"SIM 劫持/短信截获 + 密码未知"路径完全绕过两步验证。
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
      const gate = await gateLoginIpWhitelist(request, reply, user.id)
      if (!gate.allowed) return gate.reply
      const tokens = await buildTokenPair({
        id: user.id,
        phone: user.phone,
        roleId: user.roleId,
        familyId,
      })

      const permissions = await resolveUserPermissions(user.id, user.roleId)
      setAuthCookies(reply, tokens, true)
      recordAuthLoginSuccess()
      return reply.send(
        success({
          ...tokens,
          user: publicUser(user, permissions),
        }),
      )
    },
  )

  // POST /api/auth/login/wechat — 微信开放平台移动应用(App 内授权登录,react-native-wechat-lib)
  server.post(
    '/login/wechat',
    {
      schema: {
        summary: '微信登录(移动应用 App 内授权)',
        description:
          '使用 react-native-wechat-lib sendAuthRequest 返回的 code 登录,需配置 WECHAT_MOBILE_APP_ID/WECHAT_MOBILE_SECRET',
        tags: ['auth'],
        body: {
          type: 'object',
          required: ['code'],
          properties: {
            code: { type: 'string', description: '微信移动应用授权 code' },
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
      if (!isWechatAppConfigured()) {
        return reply
          .status(501)
          .send(
            error(501, '微信移动应用登录未配置,请配置 WECHAT_MOBILE_APP_ID/WECHAT_MOBILE_SECRET'),
          )
      }
      const session = await wechatAppCode2session(parsed.data.code).catch(() => null)
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
            nickname: session.nickname || '微信用户',
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
      const gate = await gateLoginIpWhitelist(request, reply, user.id)
      if (!gate.allowed) return gate.reply
      const tokens = await buildTokenPair({
        id: user.id,
        phone: user.phone,
        roleId: user.roleId,
        familyId,
      })
      const permissions = await resolveUserPermissions(user.id, user.roleId)
      setAuthCookies(reply, tokens, true)
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
          502: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      // G-192:回显判据不成立时,序列化层再剥一次 `data.code`(回归锁钉在响应体这一层)
      preSerialization: sendCodePreSerialization,
    },
    async (request, reply) => {
      const parsed = emailLoginQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { email } = parsed.data

      // G-192:按「邮箱 + IP」频控(与 /send-code 同口径)
      const quota = await consumeSendQuota(email, request.ip)
      if (!quota.allowed) {
        return reply
          .header('Retry-After', String(quota.retryAfterSec))
          .status(429)
          .send(error(429, '验证码请求过于频繁,请稍后再试'))
      }

      const user = await findUserByEmail(email)
      if (!user) {
        // 防枚举(CWE-204,2026-10-27):未注册邮箱返回与已注册一致的模糊响应,
        // 不发送真实邮件 —— 原 404「邮箱未注册」可被批量探测注册名单。
        return reply.send(success({ sent: true, message: '若邮箱已注册,验证码已发送' }))
      }

      const existing = await getCodeEntry(email)
      const now = Date.now()
      if (existing && now - existing.sentAt < CODE_RESEND_INTERVAL_MS) {
        return reply.status(429).send(error(429, '验证码已发送,请 60 秒后重试'))
      }

      const code = generateCode()
      await putCodeEntry(email, { code, expiresAt: now + CODE_TTL_MS, sentAt: now })

      // 2026-10-22 根治:与短信那条同型 —— 本路由摘要写着"发送验证码",实现里却只 log 一行
      // "邮箱验证码已生成"就回成功,邮件从来没发过。日志也不得写裸邮箱(PII)。
      const result = await sendVerificationEmail(email, code, 'login')
      if (!result.sent && !result.stub) {
        request.log.warn('邮箱验证码投递失败')
        return reply.status(502).send(error(502, '验证码发送失败,请稍后重试'))
      }

      // G-192:默认不回显验证码;仅显式调试开关 + development 档 + loopback/内网三条件同时成立才回显
      return reply.send(success(buildSendCodePayload(request, code, CODE_TTL_MS / 1000)))
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
        description:
          '使用 refreshToken 轮换签发新的 accessToken / refreshToken(支持 body 或 httpOnly cookie)',
        tags: ['auth'],
        body: {
          // 2026-08-26 修复:type 允许 ['object','null'] —— 注释声称"cookie 模式 body 可缺省",
          // 但 Fastify schema 校验对 undefined body 直接 400(JSON Schema type:'object' 不匹配 undefined),
          // 与 handler 的 cookie-only 设计矛盾(注释 2026-08-14 声明 body 可缺省但实际被 schema 拦截)。
          // 修复后无 body 的 POST 才真正走到 handler 走 cookie 路径。
          type: ['object', 'null'],
          // 2026-08-14 修复:refreshToken 不再 required —— httpOnly cookie 化后,前端 JS
          // 读不到 refresh_token,body 可缺省(handler 兼容 cookie 读取)。
          // 之前 required: ['refreshToken'] 让 schema 校验拒绝没 body 的请求 → 400
          // "required property" → 中文化兜底 "操作失败,请稍后重试" → 自动登录失效
          required: [],
          properties: {
            refreshToken: { type: 'string', description: '刷新令牌(body 模式,cookie 模式可缺省)' },
          },
        },
        response: buildResponseSchema(400, 401),
      },
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      // P2-18:refresh token 来源兼容 —— body.refreshToken 优先(旧前端/API 客户端),
      // 无则从 httpOnly refresh_token cookie 读(新前端 JS 读不到 cookie,靠自动附带)。
      const parsedBody = refreshSchema.safeParse(request.body)
      const bodyToken = parsedBody.success ? parsedBody.data.refreshToken : undefined
      const cookieToken = (request as unknown as { cookies?: Record<string, string> }).cookies
        ?.refresh_token
      const token = bodyToken || cookieToken
      if (!token) {
        return reply.status(400).send(error(400, 'refreshToken 必填(header/cookie 均缺失)'))
      }

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
        // RFC 6749 §10.4 重用检测 + 2026-09-30 宽限期(leeway)竞态放行。
        // 竞态来源:多标签页/多端共享同一账号时,15min access token 同批过期,各页签的
        // in-flight 去重(refreshAccessTokenOnce)只在单 JS 上下文生效 —— 两个页签几乎
        // 同时 POST /auth/refresh:先到者轮转 v1→v2;后到者带 v1 走进本分支,被旧逻辑
        // 判为"重用攻击"→ revokeRefreshTokenFamily 吊销全家。当下无症状(access 未过期,
        // /auth/me 照常 200),15min 后所有页签刷新全 401,自动登录丢失,只能重新登录。
        // 修复:吊销后 REFRESH_REUSE_LEEWAY_MS 内的重放视为并发竞态(非攻击),放行为
        // 正常轮转;超出宽限期的重放维持家族吊销。业界先例:AWS Cognito 默认 115s、
        // Auth0 refresh rotation leeway。
        // 固定窗口:放行分支跳过重复 revoke(L1310),revokedAt 保持首次吊销时间,
        // 避免"多次重放不断续窗"。三档裁决的唯一出口在
        // services/refresh-replay-policy.ts(race / stale-sibling / reuse)。
        const replay = await assessRefreshReplay(new Date(record.revokedAt), payload.familyId)
        if (replay.verdict === 'reuse') {
          if (payload.familyId) {
            try {
              const revokedCount = await revokeRefreshTokenFamily(payload.familyId)
              request.log.warn(
                {
                  familyId: payload.familyId,
                  userId: payload.userId,
                  revokedCount,
                  revokedAgeMs: replay.revokedAgeMs,
                },
                '[security] refresh token reuse detected, family revoked',
              )
            } catch (e) {
              request.log.error({ err: e }, '[security] family revocation failed')
            }
          }
          return reply.status(401).send(error(401, 'Invalid refresh token'))
        }
        if (replay.verdict === 'stale-sibling') {
          // 迟到的是陈旧副本(桌面 vault 旧值 / 停在旧页签的上下文 / 另一台设备 /
          // 刷新响应被 API 重启打断后浏览器仍留着旧 cookie),这一族还有活 token。
          // 2026-10-27 根治:此前这里 401 拒绝,把「凭据在、族也活着」的用户永久锁在门外
          // (生产日志连续 [security] stale ... rejected without revoking,每次只能手登并
          // 新建 family,年复一年累积上千条会话记录)。族还活着就说明会话没死,放行正常轮转:
          // 旧 token 已是吊销态(下方第 4 步跳过重复 revoke,窗口不滑动),新 token 续在同一
          // family。留 warn 便于观测旧副本的出现频率。
          request.log.warn(
            {
              familyId: payload.familyId,
              userId: payload.userId,
              revokedAgeMs: replay.revokedAgeMs,
            },
            '[auth] stale refresh token replay recovered by rotation (family still alive)',
          )
        } else {
          // race:宽限期内竞态放行,记 info 便于观测,不吊销家族,继续下方正常轮转流程
          request.log.info(
            {
              familyId: payload.familyId,
              userId: payload.userId,
              revokedAgeMs: replay.revokedAgeMs,
            },
            '[auth] refresh token replay within leeway, treated as multi-context race',
          )
        }
      }

      // 3. 确认用户仍然存在且启用
      const user = await findUserById(payload.userId)
      if (!user || user.status !== 1) {
        return reply.status(401).send(error(401, '用户不存在或已被禁用'))
      }

      // 4. 吊销旧 refresh token（轮转）
      // 宽限期竞态放行的 token 已处于"被吊销"状态,重复 revoke 只会把 revokedAt 刷成
      // now(窗口滑动,多次重放可不断续窗)—— 跳过,保持首次吊销时间,固定 30s 窗口。
      if (!record.revokedAt) {
        await revokeRefreshToken(token)
      }

      // 5. 用同一 familyId 签发新 token 对
      request.skipResponseSanitization = true
      const tokens = await buildTokenPair({
        id: user.id,
        phone: user.phone,
        roleId: user.roleId,
        familyId: payload.familyId,
      })

      // P2-18:刷新成功 → 更新 httpOnly auth cookie(新 refresh token 轮转进 cookie)
      setAuthCookies(reply, tokens, true)
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
        const message = toUserFriendlyMessage(e) || '操作失败,请稍后重试'
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

  // PUT /api/auth/me - 更新当前用户资料(G-962 批7 补后端,迁移自 D 盘历史死路径)
  server.put(
    '/me',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      try {
        await authenticate(request)
      } catch (e) {
        const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
        const message = toUserFriendlyMessage(e) || '操作失败,请稍后重试'
        return reply.status(statusCode).send(error(statusCode, message))
      }

      const userId = request.userId!
      const parsed = z
        .object({
          nickname: z.string().min(1).max(100).optional(),
          email: z.string().email().optional(),
          phone: z
            .string()
            .regex(/^1[3-9]\d{9}$/)
            .optional(),
          // 2026-10-27 安全加固:改绑 email/phone 属账号凭据变更,必须携带当前密码确认。
          // 原实现仅凭会话即可静默改绑 —— 借临时会话(XSS/借机)把受害者邮箱改成攻击者
          // 自己的,随后走邮箱验证码登录实现持久接管。
          currentPassword: z.string().min(1).max(200).optional(),
        })
        .safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { nickname, email, phone, currentPassword } = parsed.data
      if (nickname === undefined && email === undefined && phone === undefined) {
        return reply.status(400).send(error(400, '没有可更新的字段'))
      }

      const user = await findUserById(userId)
      if (!user) return reply.status(404).send(error(404, '用户不存在'))

      const rebinding =
        (email !== undefined && email !== user.email) ||
        (phone !== undefined && phone !== user.phone)
      if (rebinding) {
        if (
          !currentPassword ||
          !user.passwordHash ||
          !(await verifyPassword(currentPassword, user.passwordHash))
        ) {
          return reply.status(403).send(error(403, '改绑手机/邮箱需要验证当前密码'))
        }
      }

      if (email !== undefined && email !== user.email) {
        const byEmail = await findUserByEmail(email)
        if (byEmail && byEmail.id !== userId) {
          return reply.status(400).send(error(400, '邮箱已被使用'))
        }
      }
      if (phone !== undefined && phone !== user.phone) {
        const byPhone = await findUserByPhone(phone)
        if (byPhone && byPhone.id !== userId) {
          return reply.status(400).send(error(400, '手机号已被使用'))
        }
      }

      const updated = await updateUser(userId, { nickname, email, phone })
      if (rebinding) {
        // 改绑凭据后吊销全部 refresh token:旧会话(含潜在攻击者持有的)全部失效,
        // 阻断"改绑 → 邮箱/短信验证码登录"的持久接管链。当前请求方重新登录即可。
        await revokeAllUserRefreshTokens(userId)
        await recordSecurityEvent(
          { ip: request.ip, headers: request.headers, userId },
          'account.rebind',
          {
            emailChanged: email !== undefined && email !== user.email,
            phoneChanged: phone !== undefined && phone !== user.phone,
          },
        ).catch(() => {})
      }
      const permissions = await resolveUserPermissions(updated.id, updated.roleId)
      return reply.send(success({ user: publicUser(updated, permissions) }))
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
          // 2026-10-05 修复(生产实测):与 /refresh 2026-08-26 同型的漏修 —— P2-18 cookie 化后
          // 前端 JS 读不到 refresh_token,登出只能靠 httpOnly cookie 自动附带,但此处仍写
          // required: ['refreshToken'] + type: 'object':无 body 的 POST 被 Fastify 在校验层
          // 直接 400,handler 里的 cookie 兜底(logoutSchema/zod 侧早已 optional)永远走不到。
          // 实测后果:浏览器端"登出"=后端 400 + 会话未被吊销(refresh 仍 200,可续签);
          // 带 body refreshToken 的负向对照 200 且吊销生效(见下)——
          // 即吊销机制本身是好的,缺陷被钉死在这道 schema 门上。
          // 另注:共享层 use-auth.ts:127 的登出被 `if (logoutApi && rt)` 守着,cookie 化后
          // store 里 rt 为空 ⇒ 后端 logout 被整个跳过,本地"假登出"。
          type: ['object', 'null'],
          required: [],
          properties: {
            refreshToken: { type: 'string', description: '刷新令牌(body 模式,cookie 模式可缺省)' },
          },
        },
        response: buildResponseSchema(400),
      },
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      // 2026-10-05 修复(生产实测):无 body 的 POST 其 request.body 是 undefined,
      // logoutSchema(object) 对 undefined 判失败 ⇒ 这里 400 早退,cookie 兜底仍走不到。
      // 与 /refresh handler 同型:解析失败不早退,bodyToken 取 undefined 交给 cookie 路径。
      // (真正畸形 body —— 非对象非 null —— 仍会被 zod 拦成 400,见下面 issues 兜底。)
      const parsed = logoutSchema.safeParse(request.body ?? {})
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      // P2-18:refresh token 来源兼容 —— body.refreshToken 优先(旧前端),无则从 httpOnly cookie 读
      const bodyToken = parsed.success ? parsed.data.refreshToken : undefined
      const cookieToken = (request as unknown as { cookies?: Record<string, string> }).cookies
        ?.refresh_token
      const token = bodyToken || cookieToken

      // revoked 由库侧 RETURNING 派生(2026-09-27):旧形态是无条件常量 true ——
      // 不带 token / token 查无 / UPDATE 命中 0 行,三种"什么都没吊销"也与真吊销同形。
      let revokedIds: string[] = []
      if (token) {
        const record = await findRefreshToken(token)
        if (record && !record.revokedAt) {
          revokedIds = await revokeRefreshToken(token, 'logout')
        }
      }

      // P2-18:登出清除 httpOnly auth cookie(前端 JS 清不掉,必须服务端下发)
      clearAuthCookies(reply)

      return reply.send(success({ revoked: revokedIds.length > 0 }))
    },
  )

  // POST /api/auth/sms/send — 小程序别名（同 /send-code）
  server.post(
    '/sms/send',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      // G-192:回显判据不成立时,序列化层再剥一次 `data.code`(回归锁钉在响应体这一层)
      preSerialization: sendCodePreSerialization,
    },
    async (request, reply) => {
      const parsed = sendCodeSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { phone } = parsed.data

      // G-192:按「手机号 + IP」频控(与 /send-code 同口径)
      const quota = await consumeSendQuota(phone, request.ip)
      if (!quota.allowed) {
        return reply
          .header('Retry-After', String(quota.retryAfterSec))
          .status(429)
          .send(error(429, '验证码请求过于频繁,请稍后再试'))
      }

      const existing = await getCodeEntry(phone)
      const now = Date.now()
      if (existing && now - existing.sentAt < CODE_RESEND_INTERVAL_MS) {
        return reply.status(429).send(error(429, '验证码已发送,请 60 秒后重试'))
      }
      const ttlMs = smsCodeTtlMs(parsed.data.scene)
      const code = generateCode()
      // G-876:把「用途场景」随码一起落库,注册路径据此只认 register 场景发出的码。
      // CodeEntry 本身不带 scene(utils/code-store 不在本票改动面),这里以扩展字段写入;
      // Redis 存的是整条 JSON,读取端按扩展字段判定即可。
      const entry: CodeEntry & { scene: SmsScene } = {
        code,
        expiresAt: now + ttlMs,
        sentAt: now,
        scene: parsed.data.scene,
      }
      await putCodeEntry(phone, entry)
      // 与 /send-code 同口径:真投递,失败如实报错(这支是小程序登录实际在打的端点)
      const delivery = await deliverSmsCode(
        phone,
        code,
        parsed.data.scene,
        extractSmsSendGuard(request.headers, request.ip),
      )
      if (!delivery.sent) {
        // 没发出去就退还本标识 + IP 的取码配额,避免通道抖动一次就锁住用户 10 分钟
        await refundSendQuota(phone, request.ip)
        request.log.warn({ reason: delivery.reason, scene: parsed.data.scene }, '验证码投递失败')
        // IP/设备防刷命中与云侧失败必须区分:前者是客户端该退避,后者是通道问题
        if (delivery.reason?.startsWith('rate_limited')) {
          return reply.status(429).send(error(429, '请求过于频繁,请稍后再试'))
        }
        return reply.status(502).send(error(502, '验证码发送失败,请稍后重试'))
      }
      // G-192:默认不回显验证码;仅显式调试开关 + development 档 + loopback/内网三条件同时成立才回显
      return reply.send(success(buildSendCodePayload(request, code, ttlMs / 1000)))
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
          .send(error(statusCode, toUserFriendlyMessage(e) || '操作失败,请稍后重试'))
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
      // updated 由委托侧 UPDATE … RETURNING 的行存在性派生(守门 134),不再回字面量 true。
      const nextPasswordHash = await hashPassword(newPassword)
      const updatedUser = await updateUser(request.userId!, { passwordHash: nextPasswordHash })
      // 2026-07-24 安全加固:密码修改后吊销所有 refresh token(与重置密码对齐)
      await revokeAllUserRefreshTokens(request.userId!)
      // 安全类短信:改密后必须让用户知道(不受通知偏好约束),失败不影响改密结果。
      // bizId 用新密码哈希的短摘要而不是 Date.now():同一改密请求重试时键不变,幂等闸才能去重。
      void sendNoticeSmsToUser(request.userId!, 'password-changed', {
        bizType: 'auth',
        bizId: `pwd:${request.userId!}:${createHash('sha256').update(nextPasswordHash).digest('hex').slice(0, 12)}`,
      })
      // updated 由委托侧 UPDATE … RETURNING 的命中行存在性派生(守门 134),不再回字面量 true。
      return reply.send(success({ updated: Boolean(updatedUser.id) }))
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
          .send(error(statusCode, toUserFriendlyMessage(e) || '操作失败,请稍后重试'))
      }
      // 注销会清空 PII(含手机号),所以先取号、注销成功后再用捕获的号码发确认短信
      const phoneBeforeCancel = (await findUserById(request.userId!))?.phone ?? null
      await cancelUserAccount(request.userId!)
      if (phoneBeforeCancel) {
        // 注销是一次性事件,bizId 必须稳定(重复调用/重试都指向同一事件)。
        void sendNoticeSmsToPhone(phoneBeforeCancel, 'account-cancel', {
          bizType: 'auth',
          bizId: `cancel:${request.userId!}`,
        })
      }
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
  const getRedis = (): Redis | null => (server as unknown as { redis?: Redis }).redis ?? null

  // POST /qr/generate - PC 端生成扫码登录二维码(未鉴权)
  server.post(
    '/qr/generate',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      // 协议同意由 PC 端在进入扫码面板时采集(复用共享协议弹窗),随会话一并落 Redis。
      // 缺省/非法值不阻断出码,但 `agreementAccepted` 只会是 false ⇒ 后续确认/领取 token
      // 都会被 isQrSessionAgreed 拒掉(fail-closed),不会出现"未同意仍换到 token"。
      const parsed = qrGenerateSchema.safeParse(request.body ?? {})
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const redis = getRedis()
      if (!redis) {
        return reply.status(503).send(error(503, 'Redis 未配置,无法生成二维码'))
      }
      const ticket = `qr_${randomUUID()}`
      const now = new Date().toISOString()
      const state: QrLoginState = {
        status: 'pending',
        userId: null,
        createdAt: now,
        agreementAccepted: parsed.data.agreementAccepted === true,
      }
      try {
        await redis.set(
          QR_LOGIN_KEY_PREFIX + ticket,
          JSON.stringify(state),
          'EX',
          QR_LOGIN_TTL_SECONDS,
        )
      } catch (e) {
        request.log.error({ err: e }, '[qr] generate: redis set failed')
        return reply.status(500).send(error(500, '二维码生成失败,请稍后重试'))
      }
      const expiresAt = new Date(Date.now() + QR_LOGIN_TTL_SECONDS * 1000).toISOString()
      return reply.send(success({ ticket, qrContent: ticket, expiresAt }))
    },
  )

  // GET /qr/status - PC 端轮询扫码登录状态(未鉴权)
  // 限流必须比 PC 端轮询频率(2s/次 = 30 次/分钟)高一倍:原 max=30 与轮询等量,
  // 一次偶发的第 31 帧(双标签页、代理重试)即 429,面板会当成终态把码停轮。
  server.get(
    '/qr/status',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
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
      // 发 token 前的最后一道闸:会话未同意条款 ⇒ 不交付 token(旧版本遗留的
      // confirmed 票据、或被直接改写的 Redis 值都在这里被拦住)。判据单源见
      // services/qr-login-agreement.ts,与 /qr/confirm 共用,不在此另写一份。
      if (!isQrSessionAgreed(state)) {
        try {
          await redis.del(QR_LOGIN_KEY_PREFIX + ticket)
        } catch (e) {
          request.log.warn({ err: e }, '[qr] status: redis del failed (non-fatal)')
        }
        return reply
          .status(403)
          .send(
            error(403, '该扫码登录会话未同意用户协议与隐私政策,请重新扫码', QR_AGREEMENT_REQUIRED),
          )
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
      // 2026-10-27 加固:此处原先只看 key 在不在,不校验状态 ⇒ 已被 A 确认过的票据
      // 可被第二台设备(B)重复确认,写回 B 的 token 对,而 PC 端轮询拿到的是"最后写入"
      // 那一枚 —— 等于 A 授权、B 换脸。非 pending 一律拒签(409)。
      let state: QrLoginState
      try {
        state = JSON.parse(raw) as QrLoginState
      } catch {
        return reply.status(404).send(error(404, '二维码已过期或不存在'))
      }
      if (state.status !== 'pending') {
        return reply.status(409).send(error(409, '该二维码已被使用,请在电脑端刷新后重新扫码'))
      }
      // 扫码确认即发 token 的起点:会话未同意条款 ⇒ 拒绝确认,不签发任何凭据。
      // 判据与 /qr/status 共用 services/qr-login-agreement.ts,不得在此另写一份。
      if (!isQrSessionAgreed(state)) {
        return reply
          .status(403)
          .send(
            error(403, '请先在电脑端同意用户协议与隐私政策,再扫码确认登录', QR_AGREEMENT_REQUIRED),
          )
      }
      // 加载用户信息,签发 token 对(复用 buildTokenPair,与正常登录一致)
      const user = await findUserById(userId)
      if (!user || user.status !== 1) {
        return reply.status(401).send(error(401, '用户不存在或已被禁用'))
      }
      // 判定用的是扫码那台已登录设备的来源 IP；PC 端取回执的 /qr/status 腿看不见它的 IP
      const gate = await gateLoginIpWhitelist(request, reply, userId)
      if (!gate.allowed) return gate.reply
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
        agreementAccepted: state.agreementAccepted === true,
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
