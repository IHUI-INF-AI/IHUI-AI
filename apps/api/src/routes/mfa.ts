/**
 * MFA 路由 — 国安级双因素认证端点。
 *
 * 7 个端点(均需 authenticate):
 * GET  /status          查询当前 MFA 状态
 * POST /setup           生成 secret + QR URI(未启用状态)
 * POST /enable          验证首个 TOTP 后启用,返回恢复码
 * POST /disable         验证密码后禁用
 * POST /verify          验证 TOTP(用于敏感操作二次确认)
 * POST /recovery-codes  重新生成恢复码
 * POST /recovery        使用恢复码(返回新 access token)
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users } from '@ihui/database'
import { findUserById } from '../db/queries.js'
import { success, error } from '../utils/response.js'
import { checkAuth } from '../plugins/auth.js'
import { logger } from '../utils/logger.js'
import { verifyPassword } from '../utils/password-crypto.js'
import { signAccessToken, type JWTPayload } from '@ihui/auth'
import {
  generateSecret,
  generateQRCodeURI,
  generateQRCodeDataUrl,
  verifyTOTP,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyRecoveryCode,
  encryptSecret,
  decryptSecret,
} from '../services/mfa-service.js'

// ============ Zod schemas ============

const enableSchema = z.object({
  secret: z.string().min(1, 'secret 不能为空'),
  token: z.string().length(6, 'token 必须为 6 位数字'),
})

const verifySchema = z.object({
  token: z.string().length(6, 'token 必须为 6 位数字'),
})

const disableSchema = z.object({
  password: z.string().min(1, 'password 不能为空'),
})

const recoverySchema = z.object({
  code: z.string().min(1, 'code 不能为空'),
})

const mfaRoutes: FastifyPluginAsync = async (server) => {
  // GET /status — 查询当前 MFA 状态
  server.get('/status', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const user = await findUserById(userId)
    if (!user) {
      return reply.status(404).send(error(404, '用户不存在'))
    }
    return reply.send(
      success({
        enabled: user.twoFactorEnabled,
        enabledAt: user.twoFactorEnabledAt ?? null,
        backupCodesRemaining: user.twoFactorBackupCodes?.length ?? 0,
      }),
    )
  })

  // POST /setup — 生成 secret + QR URI(未启用状态)
  server.post('/setup', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const user = await findUserById(userId)
    if (!user) {
      return reply.status(404).send(error(404, '用户不存在'))
    }
    if (user.twoFactorEnabled) {
      return reply.status(400).send(error(400, 'MFA 已启用,请先禁用后再重新设置'))
    }
    const account = user.email ?? user.phone ?? userId
    const secret = generateSecret()
    const qrUri = generateQRCodeURI(secret, account)
    const qrDataUrl = await generateQRCodeDataUrl(qrUri)
    return reply.send(success({ secret, qrUri, qrDataUrl }))
  })

  // POST /enable — 验证首个 TOTP 后启用,返回恢复码(明文只返回一次)
  server.post('/enable', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const parsed = enableSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { secret, token } = parsed.data
    const user = await findUserById(userId)
    if (!user) {
      return reply.status(404).send(error(404, '用户不存在'))
    }
    if (user.twoFactorEnabled) {
      return reply.status(400).send(error(400, 'MFA 已启用'))
    }
    // 验证首个 TOTP
    if (!verifyTOTP(token, secret)) {
      return reply.status(400).send(error(400, 'TOTP 验证失败,请确认时间同步'))
    }
    // 生成恢复码 + 加密密钥
    const recoveryCodes = generateRecoveryCodes(10)
    const recoveryHashes = recoveryCodes.map(hashRecoveryCode)
    const encryptedSecret = encryptSecret(secret)
    await db
      .update(users)
      .set({
        twoFactorSecret: encryptedSecret,
        twoFactorEnabled: true,
        twoFactorBackupCodes: recoveryHashes,
        twoFactorEnabledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
    logger.info('MFA 已启用', { userId })
    return reply.send(success({ enabled: true, recoveryCodes }))
  })

  // POST /disable — 验证密码后禁用
  server.post('/disable', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const parsed = disableSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const user = await findUserById(userId)
    if (!user || !user.passwordHash) {
      return reply.status(404).send(error(404, '用户不存在'))
    }
    // 验证密码
    const ok = await verifyPassword(parsed.data.password, user.passwordHash)
    if (!ok) {
      return reply.status(400).send(error(400, '密码错误'))
    }
    await db
      .update(users)
      .set({
        twoFactorSecret: null,
        twoFactorEnabled: false,
        twoFactorBackupCodes: [],
        twoFactorEnabledAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
    logger.info('MFA 已禁用', { userId })
    return reply.send(success({ enabled: false }))
  })

  // POST /verify — 验证 TOTP(用于敏感操作二次确认)
  server.post('/verify', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const parsed = verifySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const user = await findUserById(userId)
    if (!user || !user.twoFactorEnabled) {
      return reply.status(400).send(error(400, 'MFA 未启用'))
    }
    if (!user.twoFactorSecret) {
      return reply.status(400).send(error(400, 'MFA 密钥未设置'))
    }
    let secretBase32: string
    try {
      secretBase32 = decryptSecret(user.twoFactorSecret)
    } catch {
      return reply.status(500).send(error(500, 'MFA 密钥解密失败'))
    }
    const valid = verifyTOTP(parsed.data.token, secretBase32)
    return reply.send(success({ valid }))
  })

  // POST /recovery-codes — 重新生成恢复码(明文只返回一次)
  server.post('/recovery-codes', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const user = await findUserById(userId)
    if (!user || !user.twoFactorEnabled) {
      return reply.status(400).send(error(400, 'MFA 未启用'))
    }
    const recoveryCodes = generateRecoveryCodes(10)
    const recoveryHashes = recoveryCodes.map(hashRecoveryCode)
    await db
      .update(users)
      .set({ twoFactorBackupCodes: recoveryHashes, updatedAt: new Date() })
      .where(eq(users.id, userId))
    logger.info('MFA 恢复码已重新生成', { userId })
    return reply.send(success({ recoveryCodes }))
  })

  // POST /recovery — 使用恢复码(返回新 access token)
  server.post('/recovery', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const parsed = recoverySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const user = await findUserById(userId)
    if (!user || !user.twoFactorEnabled) {
      return reply.status(400).send(error(400, 'MFA 未启用'))
    }
    const hashes = user.twoFactorBackupCodes ?? []
    if (!verifyRecoveryCode(parsed.data.code, hashes)) {
      return reply.status(400).send(error(400, '恢复码无效或已使用'))
    }
    // 消费恢复码:移除已使用的哈希
    const usedHash = hashRecoveryCode(parsed.data.code)
    const remaining = hashes.filter((h) => h !== usedHash)
    await db
      .update(users)
      .set({ twoFactorBackupCodes: remaining, updatedAt: new Date() })
      .where(eq(users.id, userId))
    // 签发新 access token
    const payload: JWTPayload = {
      userId: user.id,
      phone: user.phone ?? '',
      familyId: user.familyId ?? '',
      roleId: user.roleId ?? 0,
    }
    const accessToken = await signAccessToken(payload)
    logger.info('MFA 恢复码已使用', { userId, remaining: remaining.length })
    return reply.send(success({ accessToken, backupCodesRemaining: remaining.length }))
  })
}

export default mfaRoutes
