import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  createFamilyId,
  type JWTPayload,
} from '@ihui/auth'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import {
  findUserByPhone,
  findUserByEmail,
  findUserByUsername,
  findUserById,
  createUser,
  updateUser,
  checkPhoneExists,
  cancelUserAccount,
  saveRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
} from '../db/queries.js'
import {
  findOAuthAppByClientId,
  createOAuthApp,
  listOAuthApps,
  deleteOAuthApp,
  createOAuthSession,
  findSessionByCode,
  markSessionUsed,
  listUserSessions,
  deleteSession,
  listActiveScopeMeta,
  findThirdPartyAccount,
  listUserBindings,
  createThirdPartyBinding,
  removeBinding,
  removeBindingByPlatform,
  createUserSk,
  listUserSk,
  updateUserSk,
  deleteUserSk,
  createAuditLog,
} from '../db/oauth-queries.js'
import { sendSmsCode, isSmsConfigured } from '../services/sms.js'
import {
  generateCaptchaKey,
  generateCaptchaCode,
  generateCaptchaImage,
  verifyCaptcha,
} from '../services/captcha.js'
import { saveCaptcha, findCaptcha, deleteCaptcha } from '../db/captcha-queries.js'
import {
  exchangeGoogleCode,
  verifyGoogleIdToken,
  isGoogleConfigured,
  jscode2session,
  getPhoneNumber,
  isWechatMiniConfigured,
  wecomCode2session,
  isWecomConfigured,
  isDingtalkConfigured,
  buildDingtalkAuthUrl,
  exchangeDingtalkCode,
  getDingtalkUserInfo,
  generateState,
  generateAuthCode,
  generateClientId,
  generateClientSecret,
  generateUserSk,
} from '../services/oauth-providers.js'

const ACCESS_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60 // 7d
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60 // 30d

async function buildTokenPair(user: {
  id: string
  phone: string | null
  roleId: number | null
  familyId: string | null
}): Promise<{
  accessToken: string
  refreshToken: string
  expiresIn: number
  refreshExpiresIn: number
}> {
  const familyId = user.familyId ?? createFamilyId()
  const payload: JWTPayload = {
    userId: user.id,
    phone: user.phone ?? '',
    familyId,
    roleId: user.roleId ?? 0,
  }
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(payload),
    signRefreshToken(payload),
  ])
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000)
  await saveRefreshToken(refreshToken, user.id, familyId, expiresAt)
  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
  }
}

const loginByEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
})

const loginByUsernameSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

const emailCodeSchema = z.object({
  email: z.string().email(),
})

const smsCodeSchema = z.object({
  phone: z.string().min(1),
})

const smsVerifySchema = z.object({
  phone: z.string().min(1),
  code: z.string().length(6),
})

const smsRegisterSchema = z.object({
  phone: z.string().min(1),
  code: z.string().length(6),
  password: z.string().min(6),
  nickname: z.string().min(1).max(50).optional(),
})

const captchaVerifySchema = z.object({
  captchaKey: z.string().min(1),
  code: z.string().min(1),
})

const oauthAppCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  redirectUris: z.array(z.string().url()).min(1),
  scopes: z.array(z.string()).optional(),
  icon: z.string().optional(),
})

const bindingRemoveSchema = z.object({
  uuid: z.string().min(1),
  platform: z.string().min(1),
})

export const authExtendedRoutes: FastifyPluginAsync = async (server) => {
  // 邮箱登录
  server.post('/auth/login/email', async (request, reply) => {
    const parsed = loginByEmailSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { email, code } = parsed.data
    const { verifyCode } = await import('../utils/code-store.js')
    if (!verifyCode(email, code)) return reply.status(400).send(error(400, '验证码错误或已过期'))
    let user = await findUserByEmail(email)
    if (!user) {
      const emailPrefix = email.split('@')[0] ?? 'user'
      user = await createUser({
        email,
        nickname: `用户${emailPrefix.slice(0, 20)}`,
        roleId: 0,
        status: 1,
      })
    } else if (user.status !== 1) {
      return reply.status(403).send(error(403, '账号已被禁用'))
    }
    const { accessToken, refreshToken } = await buildTokenPair(user)
    return reply.send(success({ userId: user.id, accessToken, refreshToken, tokenType: 'Bearer' }))
  })

  // 用户名登录
  server.post('/auth/login/username', async (request, reply) => {
    const parsed = loginByUsernameSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { username, password } = parsed.data
    const user = await findUserByUsername(username)
    if (!user || !user.passwordHash || !bcrypt.compareSync(password, user.passwordHash)) {
      return reply.status(401).send(error(401, '用户名或密码错误'))
    }
    if (user.status !== 1) return reply.status(403).send(error(403, '账号已被禁用'))
    const { accessToken, refreshToken } = await buildTokenPair(user)
    return reply.send(success({ userId: user.id, accessToken, refreshToken, tokenType: 'Bearer' }))
  })

  // 邮箱验证码
  server.post('/auth/email/code', async (request, reply) => {
    const parsed = emailCodeSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const result = await sendSmsCode(parsed.data.email)
    if (!result.success) return reply.status(429).send(error(429, result.msg))
    return reply.send(success({ sent: true }))
  })

  // 检查手机号
  server.get('/auth/exist/:phone', async (request, reply) => {
    const { phone } = request.params as { phone: string }
    return reply.send(success({ exists: await checkPhoneExists(phone) }))
  })

  // 用户信息
  server.get('/auth/info', async (request, reply) => {
    await authenticate(request)
    const user = await findUserById(request.userId!)
    if (!user) return reply.status(404).send(error(404, '用户不存在'))
    return reply.send(
      success({
        id: user.id,
        phone: user.phone,
        email: user.email,
        nickname: user.nickname,
        avatar: user.avatar,
        gender: user.gender,
        isVip: user.isVip,
      }),
    )
  })

  // 更新资料
  server.put('/auth/profile', async (request, reply) => {
    await authenticate(request)
    const { nickname, email, gender } = request.body as {
      nickname?: string
      email?: string
      gender?: number
    }
    if (nickname !== undefined || email !== undefined) {
      await updateUser(request.userId!, { nickname, email })
    }
    if (gender !== undefined) {
      const { db } = await import('../db/index.js')
      const { users } = await import('@ihui/database')
      const { eq } = await import('drizzle-orm')
      await db
        .update(users)
        .set({ gender, updatedAt: new Date() })
        .where(eq(users.id, request.userId!))
    }
    return reply.send(success({ updated: true }))
  })

  // 修改密码
  server.put('/auth/profile/password', async (request, reply) => {
    await authenticate(request)
    const { old_password, new_password } = request.body as {
      old_password: string
      new_password: string
    }
    if (new_password.length < 6) return reply.status(400).send(error(400, '新密码至少 6 位'))
    const user = await findUserById(request.userId!)
    if (!user?.passwordHash || !bcrypt.compareSync(old_password, user.passwordHash)) {
      return reply.status(400).send(error(400, '旧密码错误'))
    }
    await updateUser(request.userId!, { passwordHash: bcrypt.hashSync(new_password, 10) })
    return reply.send(success({ updated: true }))
  })

  // 注销
  server.delete('/auth/cancel', async (request, reply) => {
    await authenticate(request)
    await cancelUserAccount(request.userId!)
    return reply.send(success({ cancelled: true }))
  })

  // Google OAuth
  server.get('/auth/google/pc/wxCode', async (request, reply) => {
    const { code } = request.query as { code: string }
    if (!isGoogleConfigured())
      return reply.send(success({ mock: true, msg: 'Google OAuth 未配置' }))
    const info = await exchangeGoogleCode(code)
    return reply.send(success(info))
  })

  server.get('/auth/google/android/wxCode', async (request, reply) => {
    const { id_token } = request.query as { id_token: string }
    if (!isGoogleConfigured())
      return reply.send(success({ mock: true, msg: 'Google OAuth 未配置' }))
    const info = await verifyGoogleIdToken(id_token)
    return reply.send(success(info))
  })

  server.get('/auth/google/config', async (_request, reply) => {
    return reply.send(success({ configured: isGoogleConfigured() }))
  })

  // 微信小程序登录
  server.get('/auth/wechat/mini/login', async (request, reply) => {
    const { code } = request.query as { code: string }
    if (!isWechatMiniConfigured())
      return reply.send(success({ mock: true, msg: '微信小程序未配置' }))
    const session = await jscode2session(code)
    const binding = await findThirdPartyAccount('wechat', session.openId)
    if (!binding) {
      return reply.send(
        success({ needPhone: true, openId: session.openId, unionId: session.unionId }),
      )
    }
    const user = await findUserById(binding.userId)
    if (!user) return reply.status(404).send(error(404, '用户不存在'))
    if (user.status !== 1) return reply.status(403).send(error(403, '账号已被禁用'))
    const { accessToken, refreshToken } = await buildTokenPair(user)
    return reply.send(success({ userId: user.id, accessToken, refreshToken }))
  })

  server.post('/auth/wechat/mini/phone', async (request, reply) => {
    await authenticate(request)
    const { code } = request.query as { code: string }
    if (!isWechatMiniConfigured()) return reply.send(success({ mock: true }))
    const phone = await getPhoneNumber(code)
    let user = await findUserByPhone(phone)
    if (!user) {
      user = await createUser({
        phone,
        nickname: `用户${phone.slice(-4)}`,
        roleId: 0,
        status: 1,
      })
    }
    return reply.send(success({ userId: user.id, phone }))
  })

  server.post('/auth/wechat/mini/rebind', async (request, reply) => {
    await authenticate(request)
    const { code } = request.query as { code: string }
    if (!isWechatMiniConfigured()) return reply.send(success({ mock: true }))
    const session = await jscode2session(code)
    const existing = await findThirdPartyAccount('wechat', session.openId)
    if (existing && existing.userId !== request.userId) {
      return reply.status(409).send(error(409, '该微信已绑定其他账号'))
    }
    await removeBindingByPlatform(request.userId!, 'wechat')
    await createThirdPartyBinding({
      userId: request.userId!,
      openId: session.openId,
      unionId: session.unionId,
      platform: 'wechat',
    })
    return reply.send(success({ rebound: true }))
  })

  // 企业微信
  server.get('/auth/login/enterprise/pc/wxCode', async (request, reply) => {
    const { code } = request.query as { code: string }
    if (!isWecomConfigured()) return reply.send(success({ mock: true, msg: '企业微信未配置' }))
    const session = await wecomCode2session(code)
    return reply.send(success(session))
  })

  // 钉钉扫码登录 — 授权 URL
  server.get('/auth/dingtalk/auth-url', async (_request, reply) => {
    if (!isDingtalkConfigured())
      return reply.send(success({ mock: true, msg: '钉钉 OAuth 未配置' }))
    const state = generateState()
    const authUrl = buildDingtalkAuthUrl(state)
    return reply.send(success({ authUrl, state }))
  })

  // 钉钉扫码登录 — code 换用户信息 → 查/建用户 → 颁发 JWT
  server.get('/auth/dingtalk/login', async (request, reply) => {
    const { code } = request.query as { code: string }
    if (!isDingtalkConfigured())
      return reply.send(success({ mock: true, msg: '钉钉 OAuth 未配置' }))
    const dingtalkToken = await exchangeDingtalkCode(code)
    const info = await getDingtalkUserInfo(dingtalkToken)
    const binding = await findThirdPartyAccount('dingtalk', info.openId)
    if (!binding) {
      return reply.send(
        success({
          needPhone: true,
          openId: info.openId,
          unionId: info.unionId,
          nick: info.nick,
          avatar: info.avatarUrl,
        }),
      )
    }
    const user = await findUserById(binding.userId)
    if (!user) return reply.status(404).send(error(404, '用户不存在'))
    if (user.status !== 1) return reply.status(403).send(error(403, '账号已被禁用'))
    const { accessToken, refreshToken } = await buildTokenPair(user)
    return reply.send(success({ userId: user.id, accessToken, refreshToken }))
  })

  // 图形验证码
  server.get('/auth/captcha', async (_request, reply) => {
    const captchaKey = generateCaptchaKey()
    const code = generateCaptchaCode()
    const img = generateCaptchaImage(code)
    await saveCaptcha(captchaKey, code)
    return reply.send(success({ captchaKey, img }))
  })

  server.post('/auth/captcha/verify', async (request, reply) => {
    const parsed = captchaVerifySchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const stored = await findCaptcha(parsed.data.captchaKey)
    if (!stored) return reply.status(400).send(error(400, '验证码不存在或已过期'))
    const ok = verifyCaptcha(stored.code, parsed.data.code)
    await deleteCaptcha(parsed.data.captchaKey)
    if (!ok) return reply.status(400).send(error(400, '验证码错误'))
    return reply.send(success({ verified: true }))
  })

  // SMS
  server.post('/auth/sms/code', async (request, reply) => {
    const parsed = smsCodeSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const result = await sendSmsCode(parsed.data.phone)
    if (!result.success) return reply.status(429).send(error(429, result.msg))
    return reply.send(success({ sent: true }))
  })

  // SMS Proxy — 独立短信代理端点（解决旧前端 CORS 直连问题）
  server.post('/sms-proxy/send', async (request, reply) => {
    const parsed = smsCodeSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const result = await sendSmsCode(parsed.data.phone)
    if (!result.success) return reply.status(429).send(error(429, result.msg))
    return reply.send(success({ sent: true }))
  })

  /**
   * 校验短信验证码。
   * @body { phone: string, code: string }
   * @returns { valid: boolean } 验证通过返回 true，否则 false（验证码一次性使用）
   */
  server.post('/sms-proxy/verify', async (request, reply) => {
    const parsed = smsVerifySchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { verifyCode } = await import('../utils/code-store.js')
    const valid = verifyCode(parsed.data.phone, parsed.data.code)
    if (!valid) return reply.status(400).send(error(400, '验证码错误或已过期'))
    return reply.send(success({ valid: true }))
  })

  /**
   * 短信验证码注册新用户。
   * @body { phone: string, code: string, password: string, nickname?: string }
   * @returns 创建的用户信息（不含密码哈希）
   */
  server.post('/sms-proxy/register', async (request, reply) => {
    const parsed = smsRegisterSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { phone, code, password, nickname } = parsed.data
    const { verifyCode } = await import('../utils/code-store.js')
    if (!verifyCode(phone, code)) {
      return reply.status(400).send(error(400, '验证码错误或已过期'))
    }
    if (await checkPhoneExists(phone)) {
      return reply.status(409).send(error(409, '该手机号已注册'))
    }
    const user = await createUser({
      phone,
      passwordHash: bcrypt.hashSync(password, 10),
      nickname: nickname ?? `用户${phone.slice(-4)}`,
      roleId: 0,
      status: 1,
    })
    return reply.status(201).send(
      success({
        id: user.id,
        phone: user.phone,
        nickname: user.nickname,
      }),
    )
  })

  /**
   * 获取短信服务配置信息（不含密钥）。
   * @returns { configured, provider, apiBaseUrlSet }
   */
  server.get('/sms-proxy/config', async (_request, reply) => {
    const provider =
      process.env.ALI_SMS_ACCESS_KEY_ID && process.env.ALI_SMS_ACCESS_KEY_SECRET
        ? 'aliyun'
        : process.env.SMS_API_BASE_URL
          ? 'proxy'
          : 'dev'
    return reply.send(
      success({
        configured: isSmsConfigured(),
        provider,
        apiBaseUrlSet: Boolean(process.env.SMS_API_BASE_URL),
      }),
    )
  })

  // OAuth2 授权
  server.get('/auth/oauth/authorize', async (request, reply) => {
    await authenticate(request)
    const { client_id, redirect_uri, state, scope, code_challenge, code_challenge_method } =
      request.query as {
        client_id: string
        redirect_uri: string
        state: string
        scope?: string
        code_challenge?: string
        code_challenge_method?: string
      }
    if (!state) return reply.status(400).send(error(400, 'state 不能为空'))
    const app = await findOAuthAppByClientId(client_id)
    if (!app || app.isActive !== 1) return reply.status(404).send(error(404, '应用不存在或已禁用'))
    const redirectUris = (app.redirectUris as string[]) ?? []
    if (!redirectUris.includes(redirect_uri))
      return reply.status(400).send(error(400, 'redirect_uri 不在白名单'))
    const code = generateAuthCode()
    await createOAuthSession({
      code,
      clientId: client_id,
      userId: request.userId!,
      state,
      scope,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method,
    })
    await createAuditLog({
      event: 'authorize',
      clientId: client_id,
      userId: request.userId!,
      status: 'success',
    })
    const sep = redirect_uri.includes('?') ? '&' : '?'
    return reply.send(
      success({ code, state, redirect_uri: `${redirect_uri}${sep}code=${code}&state=${state}` }),
    )
  })

  server.post('/auth/oauth/token', async (request, reply) => {
    const { code, client_id, client_secret, state } = request.body as {
      code: string
      client_id: string
      client_secret: string
      state?: string
    }
    const app = await findOAuthAppByClientId(client_id)
    if (!app || app.clientSecret !== client_secret) {
      return reply.status(401).send(error(401, '应用凭证错误'))
    }
    const session = await findSessionByCode(code)
    if (!session || session.isUsed || session.expiresAt < new Date()) {
      return reply.status(400).send(error(400, '授权码无效或已过期'))
    }
    if (state && session.state !== state) return reply.status(400).send(error(400, 'state 不匹配'))
    await markSessionUsed(code)
    const user = await findUserById(session.userId)
    if (!user) return reply.status(404).send(error(404, '用户不存在'))
    const { accessToken } = await buildTokenPair(user)
    await createAuditLog({
      event: 'token',
      clientId: client_id,
      userId: user.id,
      status: 'success',
    })
    return reply.send(success({ access_token: accessToken, token_type: 'Bearer' }))
  })

  // OAuth2 应用管理
  server.post('/auth/oauth/apps/create', async (request, reply) => {
    await authenticate(request)
    const parsed = oauthAppCreateSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const clientId = generateClientId()
    const clientSecret = generateClientSecret()
    const app = await createOAuthApp({
      clientId,
      clientSecret,
      name: parsed.data.name,
      description: parsed.data.description,
      redirectUris: parsed.data.redirectUris,
      scopes: parsed.data.scopes,
      icon: parsed.data.icon,
      ownerUuid: request.userId!,
    })
    return reply.send(success(app))
  })

  server.get('/auth/oauth/apps/list', async (request, reply) => {
    await authenticate(request)
    const { page = '1', limit = '20' } = request.query as { page: string; limit: string }
    const result = await listOAuthApps(request.userId!, parseInt(page, 10), parseInt(limit, 10))
    return reply.send(success(result))
  })

  server.delete('/auth/oauth/apps/:clientId', async (request, reply) => {
    await authenticate(request)
    const { clientId } = request.params as { clientId: string }
    await deleteOAuthApp(clientId, request.userId!)
    return reply.send(success({ deleted: true }))
  })

  // 已授权应用
  server.get('/auth/oauth/my-authorized', async (request, reply) => {
    await authenticate(request)
    const sessions = await listUserSessions(request.userId!)
    return reply.send(success({ items: sessions }))
  })

  server.delete('/auth/oauth/my-authorized/:sessionId', async (request, reply) => {
    await authenticate(request)
    const { sessionId } = request.params as { sessionId: string }
    await deleteSession(sessionId)
    return reply.send(success({ deleted: true }))
  })

  // Scope 元数据
  server.get('/auth/oauth/scope-meta', async (_request, reply) => {
    const scopes = await listActiveScopeMeta()
    return reply.send(success({ items: scopes }))
  })

  // 第三方绑定
  server.get('/auth/bindings', async (request, reply) => {
    await authenticate(request)
    const bindings = await listUserBindings(request.userId!)
    return reply.send(success({ items: bindings }))
  })

  server.delete('/auth/bindings/:id', async (request, reply) => {
    await authenticate(request)
    const { id } = request.params as { id: string }
    await removeBinding(id, request.userId!)
    return reply.send(success({ deleted: true }))
  })

  server.post('/auth/bindings/remove', async (request, reply) => {
    await authenticate(request)
    const parsed = bindingRemoveSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    if (parsed.data.uuid !== request.userId) {
      return reply.status(403).send(error(403, '无权操作此绑定'))
    }
    await removeBindingByPlatform(parsed.data.uuid, parsed.data.platform)
    return reply.send(success({ removed: true }))
  })

  // 用户 SK
  server.post('/auth/user-sk/create', async (request, reply) => {
    await authenticate(request)
    const key = generateUserSk()
    const sk = await createUserSk(request.userId!, key)
    return reply.send(success(sk))
  })

  server.get('/auth/user-sk/list', async (request, reply) => {
    await authenticate(request)
    const { page = '1', limit = '20' } = request.query as { page: string; limit: string }
    const result = await listUserSk(request.userId!, parseInt(page, 10), parseInt(limit, 10))
    return reply.send(success(result))
  })

  server.put('/auth/user-sk/:skId', async (request, reply) => {
    await authenticate(request)
    const { skId } = request.params as { skId: string }
    const { status } = request.body as { status: number }
    await updateUserSk(skId, request.userId!, status)
    return reply.send(success({ updated: true }))
  })

  server.delete('/auth/user-sk/:skId', async (request, reply) => {
    await authenticate(request)
    const { skId } = request.params as { skId: string }
    await deleteUserSk(skId, request.userId!)
    return reply.send(success({ deleted: true }))
  })

  // 注：实名认证端点已迁移到独立路由文件 auth-identity.ts（M-67）

  // ============================================================================
  // OAuth 核心端点（迁移自 coze_zhs_py oauth_auth.py，共 20 端点）
  // 已有: GET /auth/oauth/authorize（授权页面）、POST /auth/oauth/token（令牌交换）
  // 以下补齐缺失的 18 个端点
  // ============================================================================

  // --- 设备码流程（device_code → user_code → 授权 → token）---
  // 设备码映射存储（内存,带 TTL。单实例足够；多实例可改 Redis）
  const DEVICE_CODE_TTL_MS = 15 * 60 * 1000
  const deviceCodeStore = new Map<
    string,
    {
      userCode: string
      clientId: string
      userId: string | null
      expiresAt: number
    }
  >()

  const oauthDeviceSchema = z.object({
    client_id: z.string().min(1),
    client_secret: z.string().optional(),
    scope: z.string().optional(),
  })

  // POST /oauth/device — 设备码授权
  server.post('/oauth/device', async (request, reply) => {
    const parsed = oauthDeviceSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const app = await findOAuthAppByClientId(parsed.data.client_id)
    if (!app || app.isActive !== 1) return reply.status(404).send(error(404, '应用不存在或已禁用'))
    const deviceCode = randomBytes(16).toString('hex')
    const userCode = Math.random().toString(36).slice(2, 8).toUpperCase()
    deviceCodeStore.set(deviceCode, {
      userCode,
      clientId: parsed.data.client_id,
      userId: null,
      expiresAt: Date.now() + DEVICE_CODE_TTL_MS,
    })
    return reply.send(
      success({
        device_code: deviceCode,
        user_code: userCode,
        verification_uri: '/oauth/sms-login',
        expires_in: DEVICE_CODE_TTL_MS / 1000,
        interval: 5,
      }),
    )
  })

  const oauthDeviceTokenSchema = z.object({
    device_code: z.string().min(1),
    client_id: z.string().min(1),
  })

  // POST /oauth/device/token — 设备码换 token（轮询）
  server.post('/oauth/device/token', async (request, reply) => {
    const parsed = oauthDeviceTokenSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const entry = deviceCodeStore.get(parsed.data.device_code)
    if (!entry) return reply.status(400).send(error(400, 'device_code 无效'))
    if (Date.now() > entry.expiresAt) {
      deviceCodeStore.delete(parsed.data.device_code)
      return reply.status(400).send(error(400, 'device_code 已过期'))
    }
    if (!entry.userId) return reply.status(428).send(error(428, 'authorization_pending'))
    const user = await findUserById(entry.userId)
    if (!user) return reply.status(404).send(error(404, '用户不存在'))
    deviceCodeStore.delete(parsed.data.device_code)
    const { accessToken, refreshToken, expiresIn } = await buildTokenPair(user)
    await createAuditLog({
      event: 'device_token',
      clientId: entry.clientId,
      userId: user.id,
      status: 'success',
    })
    return reply.send(
      success({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: expiresIn,
      }),
    )
  })

  const oauthRefreshSchema = z.object({
    refresh_token: z.string().min(1),
    client_id: z.string().optional(),
  })

  // POST /oauth/device/refresh — 刷新设备 token
  server.post('/oauth/device/refresh', async (request, reply) => {
    const parsed = oauthRefreshSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    try {
      const payload = await verifyRefreshToken(parsed.data.refresh_token)
      const stored = await findRefreshToken(parsed.data.refresh_token)
      if (!stored || stored.revokedAt)
        return reply.status(400).send(error(400, 'refresh_token 无效'))
      const user = await findUserById(payload.userId)
      if (!user) return reply.status(404).send(error(404, '用户不存在'))
      await revokeRefreshToken(parsed.data.refresh_token)
      const { accessToken, refreshToken, expiresIn } = await buildTokenPair(user)
      return reply.send(
        success({
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'Bearer',
          expires_in: expiresIn,
        }),
      )
    } catch {
      return reply.status(400).send(error(400, 'refresh_token 无效或已过期'))
    }
  })

  // --- Web 授权流程（POST 版本，与已有 GET /auth/oauth/authorize 互补）---

  const oauthWebAuthorizeSchema = z.object({
    client_id: z.string().min(1),
    redirect_uri: z.string().url(),
    state: z.string().min(1),
    scope: z.string().optional(),
  })

  // POST /oauth/web/authorize — Web 授权
  server.post('/oauth/web/authorize', async (request, reply) => {
    await authenticate(request)
    const parsed = oauthWebAuthorizeSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const app = await findOAuthAppByClientId(parsed.data.client_id)
    if (!app || app.isActive !== 1) return reply.status(404).send(error(404, '应用不存在或已禁用'))
    const redirectUris = (app.redirectUris as string[]) ?? []
    if (!redirectUris.includes(parsed.data.redirect_uri))
      return reply.status(400).send(error(400, 'redirect_uri 不在白名单'))
    const code = generateAuthCode()
    await createOAuthSession({
      code,
      clientId: parsed.data.client_id,
      userId: request.userId!,
      state: parsed.data.state,
      scope: parsed.data.scope,
    })
    const sep = parsed.data.redirect_uri.includes('?') ? '&' : '?'
    return reply.send(
      success({
        code,
        state: parsed.data.state,
        redirect_uri: `${parsed.data.redirect_uri}${sep}code=${code}&state=${parsed.data.state}`,
      }),
    )
  })

  const oauthTokenExchangeSchema = z.object({
    code: z.string().min(1),
    client_id: z.string().min(1),
    client_secret: z.string().min(1),
    state: z.string().optional(),
  })

  // POST /oauth/web/token — Web 换 token
  server.post('/oauth/web/token', async (request, reply) => {
    const parsed = oauthTokenExchangeSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const app = await findOAuthAppByClientId(parsed.data.client_id)
    if (!app || app.clientSecret !== parsed.data.client_secret)
      return reply.status(401).send(error(401, '应用凭证错误'))
    const session = await findSessionByCode(parsed.data.code)
    if (!session || session.isUsed || session.expiresAt < new Date())
      return reply.status(400).send(error(400, '授权码无效或已过期'))
    await markSessionUsed(parsed.data.code)
    const user = await findUserById(session.userId)
    if (!user) return reply.status(404).send(error(404, '用户不存在'))
    const { accessToken, refreshToken, expiresIn } = await buildTokenPair(user)
    await createAuditLog({
      event: 'web_token',
      clientId: parsed.data.client_id,
      userId: user.id,
      status: 'success',
    })
    return reply.send(
      success({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: expiresIn,
      }),
    )
  })

  // POST /oauth/web/refresh — 刷新 Web token
  server.post('/oauth/web/refresh', async (request, reply) => {
    const parsed = oauthRefreshSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    try {
      const payload = await verifyRefreshToken(parsed.data.refresh_token)
      const stored = await findRefreshToken(parsed.data.refresh_token)
      if (!stored || stored.revokedAt)
        return reply.status(400).send(error(400, 'refresh_token 无效'))
      const user = await findUserById(payload.userId)
      if (!user) return reply.status(404).send(error(404, '用户不存在'))
      await revokeRefreshToken(parsed.data.refresh_token)
      const { accessToken, refreshToken, expiresIn } = await buildTokenPair(user)
      return reply.send(
        success({
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'Bearer',
          expires_in: expiresIn,
        }),
      )
    } catch {
      return reply.status(400).send(error(400, 'refresh_token 无效或已过期'))
    }
  })

  // --- PKCE 授权流程 ---

  const oauthPkceAuthorizeSchema = z.object({
    client_id: z.string().min(1),
    redirect_uri: z.string().url(),
    state: z.string().min(1),
    scope: z.string().optional(),
    code_challenge: z.string().min(1),
    code_challenge_method: z.literal('S256'),
  })

  // POST /oauth/pkce/authorize — PKCE 授权
  server.post('/oauth/pkce/authorize', async (request, reply) => {
    await authenticate(request)
    const parsed = oauthPkceAuthorizeSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const app = await findOAuthAppByClientId(parsed.data.client_id)
    if (!app || app.isActive !== 1) return reply.status(404).send(error(404, '应用不存在或已禁用'))
    const redirectUris = (app.redirectUris as string[]) ?? []
    if (!redirectUris.includes(parsed.data.redirect_uri))
      return reply.status(400).send(error(400, 'redirect_uri 不在白名单'))
    const code = generateAuthCode()
    await createOAuthSession({
      code,
      clientId: parsed.data.client_id,
      userId: request.userId!,
      state: parsed.data.state,
      scope: parsed.data.scope,
      codeChallenge: parsed.data.code_challenge,
      codeChallengeMethod: parsed.data.code_challenge_method,
    })
    const sep = parsed.data.redirect_uri.includes('?') ? '&' : '?'
    return reply.send(
      success({
        code,
        state: parsed.data.state,
        redirect_uri: `${parsed.data.redirect_uri}${sep}code=${code}&state=${parsed.data.state}`,
      }),
    )
  })

  const oauthPkceTokenSchema = z.object({
    code: z.string().min(1),
    client_id: z.string().min(1),
    code_verifier: z.string().min(1),
  })

  // POST /oauth/pkce/token — PKCE 换 token
  server.post('/oauth/pkce/token', async (request, reply) => {
    const parsed = oauthPkceTokenSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const session = await findSessionByCode(parsed.data.code)
    if (!session || session.isUsed || session.expiresAt < new Date())
      return reply.status(400).send(error(400, '授权码无效或已过期'))
    if (!session.codeChallenge || !session.codeChallengeMethod)
      return reply.status(400).send(error(400, '该授权码非 PKCE 流程'))
    // S256: base64url(sha256(code_verifier)) === code_challenge
    const { createHash } = await import('node:crypto')
    const computed = createHash('sha256').update(parsed.data.code_verifier).digest('base64url')
    if (computed !== session.codeChallenge)
      return reply.status(400).send(error(400, 'code_verifier 校验失败'))
    await markSessionUsed(parsed.data.code)
    const user = await findUserById(session.userId)
    if (!user) return reply.status(404).send(error(404, '用户不存在'))
    const { accessToken, refreshToken, expiresIn } = await buildTokenPair(user)
    await createAuditLog({
      event: 'pkce_token',
      clientId: parsed.data.client_id,
      userId: user.id,
      status: 'success',
    })
    return reply.send(
      success({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: expiresIn,
      }),
    )
  })

  // POST /oauth/pkce/refresh — 刷新 PKCE token
  server.post('/oauth/pkce/refresh', async (request, reply) => {
    const parsed = oauthRefreshSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    try {
      const payload = await verifyRefreshToken(parsed.data.refresh_token)
      const stored = await findRefreshToken(parsed.data.refresh_token)
      if (!stored || stored.revokedAt)
        return reply.status(400).send(error(400, 'refresh_token 无效'))
      const user = await findUserById(payload.userId)
      if (!user) return reply.status(404).send(error(404, '用户不存在'))
      await revokeRefreshToken(parsed.data.refresh_token)
      const { accessToken, refreshToken, expiresIn } = await buildTokenPair(user)
      return reply.send(
        success({
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'Bearer',
          expires_in: expiresIn,
        }),
      )
    } catch {
      return reply.status(400).send(error(400, 'refresh_token 无效或已过期'))
    }
  })

  // --- JWT 授权 ---

  const oauthJwtTokenSchema = z.object({
    client_id: z.string().min(1),
    client_secret: z.string().optional(),
    assertion: z.string().min(1),
    grant_type: z.literal('urn:ietf:params:oauth:grant-type:jwt-bearer'),
  })

  // POST /oauth/jwt/token — JWT 授权（private_key_jwt）
  server.post('/oauth/jwt/token', async (request, reply) => {
    const parsed = oauthJwtTokenSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const app = await findOAuthAppByClientId(parsed.data.client_id)
    if (!app || app.isActive !== 1) return reply.status(404).send(error(404, '应用不存在或已禁用'))
    if (parsed.data.client_secret && app.clientSecret !== parsed.data.client_secret)
      return reply.status(401).send(error(401, '应用凭证错误'))
    // 校验 assertion（JWT格式: header.payload.signature）
    const parts = parsed.data.assertion.split('.')
    if (parts.length !== 3) return reply.status(400).send(error(400, 'assertion 格式无效'))
    try {
      const payloadJson = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString()) as {
        sub?: string
        exp?: number
      }
      if (payloadJson.exp && payloadJson.exp * 1000 < Date.now())
        return reply.status(400).send(error(400, 'assertion 已过期'))
      const userId = payloadJson.sub
      if (!userId) return reply.status(400).send(error(400, 'assertion 缺少 sub'))
      const user = await findUserById(userId)
      if (!user) return reply.status(404).send(error(404, '用户不存在'))
      const { accessToken, refreshToken, expiresIn } = await buildTokenPair(user)
      await createAuditLog({
        event: 'jwt_token',
        clientId: parsed.data.client_id,
        userId: user.id,
        status: 'success',
      })
      return reply.send(
        success({
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'Bearer',
          expires_in: expiresIn,
        }),
      )
    } catch {
      return reply.status(400).send(error(400, 'assertion 解析失败'))
    }
  })

  // --- 确认授权 / 多路径兼容 / 调试 ---

  const oauthConfirmSchema = z.object({
    user_code: z.string().min(1),
  })

  // POST /oauth/authorize/confirm — 确认授权（设备码流程用户确认）
  server.post('/oauth/authorize/confirm', async (request, reply) => {
    await authenticate(request)
    const parsed = oauthConfirmSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    let deviceEntry: {
      key: string
      value: { userCode: string; clientId: string; userId: string | null; expiresAt: number }
    } | null = null
    for (const [key, value] of deviceCodeStore) {
      if (value.userCode === parsed.data.user_code) {
        deviceEntry = { key, value }
        break
      }
    }
    if (!deviceEntry) return reply.status(404).send(error(404, 'user_code 无效'))
    if (Date.now() > deviceEntry.value.expiresAt) {
      deviceCodeStore.delete(deviceEntry.key)
      return reply.status(400).send(error(400, 'user_code 已过期'))
    }
    deviceEntry.value.userId = request.userId!
    return reply.send(success({ confirmed: true, user_code: parsed.data.user_code }))
  })

  const oauthAccessTokenSchema = z.object({
    client_id: z.string().min(1),
    client_secret: z.string().min(1),
    code: z.string().min(1),
  })

  // POST /oauth/access_token — 访问令牌（多路径兼容，同 /auth/oauth/token）
  server.post('/oauth/access_token', async (request, reply) => {
    const parsed = oauthAccessTokenSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const app = await findOAuthAppByClientId(parsed.data.client_id)
    if (!app || app.clientSecret !== parsed.data.client_secret)
      return reply.status(401).send(error(401, '应用凭证错误'))
    const session = await findSessionByCode(parsed.data.code)
    if (!session || session.isUsed || session.expiresAt < new Date())
      return reply.status(400).send(error(400, '授权码无效或已过期'))
    await markSessionUsed(parsed.data.code)
    const user = await findUserById(session.userId)
    if (!user) return reply.status(404).send(error(404, '用户不存在'))
    const { accessToken, expiresIn } = await buildTokenPair(user)
    await createAuditLog({
      event: 'access_token',
      clientId: parsed.data.client_id,
      userId: user.id,
      status: 'success',
    })
    return reply.send(
      success({ access_token: accessToken, token_type: 'Bearer', expires_in: expiresIn }),
    )
  })

  // POST /oauth/token/exchange — 令牌交换（多路径兼容）
  server.post('/oauth/token/exchange', async (request, reply) => {
    const body = request.body as Record<string, string | undefined>
    const grantType = body.grant_type
    // authorization_code 流程
    if (grantType === 'authorization_code' || body.code) {
      const parsed = oauthTokenExchangeSchema.safeParse(request.body)
      if (!parsed.success)
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      const app = await findOAuthAppByClientId(parsed.data.client_id)
      if (!app || app.clientSecret !== parsed.data.client_secret)
        return reply.status(401).send(error(401, '应用凭证错误'))
      const session = await findSessionByCode(parsed.data.code)
      if (!session || session.isUsed || session.expiresAt < new Date())
        return reply.status(400).send(error(400, '授权码无效或已过期'))
      await markSessionUsed(parsed.data.code)
      const user = await findUserById(session.userId)
      if (!user) return reply.status(404).send(error(404, '用户不存在'))
      const { accessToken, refreshToken, expiresIn } = await buildTokenPair(user)
      return reply.send(
        success({
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'Bearer',
          expires_in: expiresIn,
        }),
      )
    }
    // refresh_token 流程
    if (grantType === 'refresh_token' || body.refresh_token) {
      const parsed = oauthRefreshSchema.safeParse(request.body)
      if (!parsed.success)
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      try {
        const payload = await verifyRefreshToken(parsed.data.refresh_token)
        const stored = await findRefreshToken(parsed.data.refresh_token)
        if (!stored || stored.revokedAt)
          return reply.status(400).send(error(400, 'refresh_token 无效'))
        const user = await findUserById(payload.userId)
        if (!user) return reply.status(404).send(error(404, '用户不存在'))
        await revokeRefreshToken(parsed.data.refresh_token)
        const { accessToken, refreshToken, expiresIn } = await buildTokenPair(user)
        return reply.send(
          success({
            access_token: accessToken,
            refresh_token: refreshToken,
            token_type: 'Bearer',
            expires_in: expiresIn,
          }),
        )
      } catch {
        return reply.status(400).send(error(400, 'refresh_token 无效或已过期'))
      }
    }
    return reply.status(400).send(error(400, '不支持的 grant_type'))
  })

  // GET /oauth/token/test — 测试令牌
  server.get('/oauth/token/test', async (request, reply) => {
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer '))
      return reply.status(401).send(error(401, '缺少 Bearer token'))
    const token = authHeader.slice(7)
    try {
      const { verifyAccessToken } = await import('@ihui/auth')
      const payload = await verifyAccessToken(token)
      return reply.send(success({ valid: true, userId: payload.userId, roleId: payload.roleId }))
    } catch {
      return reply.status(401).send(error(401, 'token 无效或已过期'))
    }
  })

  // POST /oauth/debug/callback — 调试回调
  server.post('/oauth/debug/callback', async (request, reply) => {
    const body = request.body as Record<string, unknown>
    await createAuditLog({
      event: 'debug_callback',
      status: 'success',
      detail: JSON.stringify(body),
    })
    return reply.send(success({ received: true, echoed: body }))
  })

  // GET /oauth/sms-config — 短信配置（同 /sms-proxy/config，多路径兼容）
  server.get('/oauth/sms-config', async (_request, reply) => {
    const provider =
      process.env.ALI_SMS_ACCESS_KEY_ID && process.env.ALI_SMS_ACCESS_KEY_SECRET
        ? 'aliyun'
        : process.env.SMS_API_BASE_URL
          ? 'proxy'
          : 'dev'
    return reply.send(
      success({
        configured: isSmsConfigured(),
        provider,
        apiBaseUrlSet: Boolean(process.env.SMS_API_BASE_URL),
      }),
    )
  })

  // POST /oauth/debug/create-test-session — 创建测试会话
  server.post('/oauth/debug/create-test-session', async (request, reply) => {
    if (process.env.NODE_ENV === 'production')
      return reply.status(403).send(error(403, '生产环境禁止调试端点'))
    await authenticate(request)
    const { client_id } = request.body as { client_id?: string }
    const code = generateAuthCode()
    await createOAuthSession({
      code,
      clientId: client_id ?? 'test_client',
      userId: request.userId!,
      state: 'test_state',
    })
    return reply.send(success({ code, state: 'test_state', message: '测试会话已创建,5分钟内有效' }))
  })

  // GET /oauth/sms-login — 短信登录页（返回页面配置信息,前端渲染）
  server.get('/oauth/sms-login', async (_request, reply) => {
    return reply.send(
      success({
        page: 'sms-login',
        smsConfigured: isSmsConfigured(),
        sendCodeEndpoint: '/api/auth/sms/code',
        verifyEndpoint: '/api/sms-proxy/verify',
      }),
    )
  })
}
