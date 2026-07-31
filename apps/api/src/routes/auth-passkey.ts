/**
 * Passkey (WebAuthn/FIDO2) 认证路由。
 *
 * 4 个端点:
 * 1. POST /auth/passkey/register/options — 已登录用户生成注册选项(Bearer JWT 鉴权)
 * 2. POST /auth/passkey/register/verify  — 验证注册响应 + 存 credential 到 DB(Bearer JWT 鉴权)
 * 3. POST /auth/passkey/auth/options     — 未登录用户生成认证选项(challenge 存 Redis)
 * 4. POST /auth/passkey/auth/verify      — 验证认证响应 + 签发 JWT
 *
 * Challenge 存储方案:
 * - key: `passkey:challenge:<challengeId>`(challengeId = crypto.randomBytes(16).hex)
 * - value: JSON { challenge: string, userId?: string }(register 阶段携带 userId)
 * - TTL: 5 分钟(300 秒)
 *
 * 主 agent 集成位置:routes/index.ts 中 `server.register(authPasskeyRoutes, { prefix: '/api' })`
 *
 * ⚠️ 依赖 @simplewebauthn/server(由 provider 懒加载,主 agent 需安装)
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import {
  signAccessToken,
  signRefreshToken,
  createFamilyId,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  type JWTPayload,
} from '@ihui/auth'
import { db } from '../db/index.js'
import { userPasskeys } from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { findUserById, saveRefreshToken } from '../db/queries.js'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  getPasskeyConfig,
} from '@ihui/auth'
import type {
  StoredPasskeyCredential,
  VerifiedRegistrationResult,
  VerifiedAuthenticationResult,
} from '@ihui/auth'

// ============================================================
// Redis challenge 存储常量
// ============================================================

const CHALLENGE_TTL_SECONDS = 300 // 5 分钟
const CHALLENGE_KEY_PREFIX = 'passkey:challenge:'

interface StoredChallenge {
  challenge: string
  /** 仅 register 阶段携带(关联当前登录用户),auth 阶段为 undefined。 */
  userId?: string
}

// ============================================================
// Zod schemas
// ============================================================

const registerVerifySchema = z.object({
  challengeId: z.string().min(1),
  /** 客户端 navigator.credentials.create 返回的 attestation response(原样转发)。 */
  response: z.record(z.string(), z.unknown()),
  /** 用户自定义名称(MacBook Pro / iPhone 等,可选)。 */
  name: z.string().max(100).optional(),
})

const authVerifySchema = z.object({
  challengeId: z.string().min(1),
  /** 客户端 navigator.credentials.get 返回的 assertion response(原样转发)。 */
  response: z.record(z.string(), z.unknown()),
})

// ============================================================
// 辅助函数
// ============================================================

/** 从 options 响应中提取 challenge 字段(@simplewebauthn/server 返回的 options 对象含 challenge)。 */
function extractChallenge(options: unknown): string | undefined {
  if (typeof options === 'object' && options !== null) {
    const challenge = (options as Record<string, unknown>).challenge
    if (typeof challenge === 'string') return challenge
  }
  return undefined
}

/** 从认证响应中提取 credentialId(response.id 字段,base64url 字符串)。 */
function extractCredentialId(response: unknown): string | undefined {
  if (typeof response === 'object' && response !== null) {
    const id = (response as Record<string, unknown>).id
    if (typeof id === 'string') return id
  }
  return undefined
}

/** 生成 challengeId(16 字节 CSPRNG hex,32 字符)。 */
function generateChallengeId(): string {
  return randomBytes(16).toString('hex')
}

/** 签发 JWT token 对(复用 auth-extended.ts 的 buildTokenPair 逻辑,避免跨文件依赖)。 */
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

// ============================================================
// 路由定义
// ============================================================

const authPasskeyRoutes: FastifyPluginAsync = async (server) => {
  // 所有 passkey 端点响应中可能携带 token,跳过响应脱敏
  server.addHook('onRequest', async (request) => {
    request.skipResponseSanitization = true
  })

  // ------------------------------------------------------------
  // 1. POST /auth/passkey/register/options — 生成注册选项
  // ------------------------------------------------------------
  server.post(
    '/auth/passkey/register/options',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const userId = request.userId!
      const user = await findUserById(userId)
      if (!user) return reply.status(404).send(error(404, '用户不存在'))
      if (user.status !== 1) return reply.status(403).send(error(403, '账号已被禁用'))
      if (!user.email)
        return reply.status(400).send(error(400, '当前账号未绑定邮箱,无法注册 Passkey'))

      // 查询用户已有 Passkey(用于 excludeCredentials,防止重复注册同一设备)
      const existing = await db
        .select({
          credentialId: userPasskeys.credentialId,
          transports: userPasskeys.transports,
        })
        .from(userPasskeys)
        .where(eq(userPasskeys.userId, userId))

      try {
        const options = await generateRegistrationOptions(
          userId,
          user.email,
          existing.map((e) => ({
            credentialId: e.credentialId,
            transports: (e.transports ?? undefined) as string[] | undefined,
          })),
        )

        const challenge = extractChallenge(options)
        if (!challenge) {
          return reply.status(500).send(error(500, '生成注册选项失败:challenge 缺失'))
        }

        // challenge 存 Redis(携带 userId,verify 阶段校验同一用户)
        const challengeId = generateChallengeId()
        const stored: StoredChallenge = { challenge, userId }
        await server.redis.set(
          `${CHALLENGE_KEY_PREFIX}${challengeId}`,
          JSON.stringify(stored),
          'EX',
          CHALLENGE_TTL_SECONDS,
        )

        return reply.send(success({ options, challengeId }))
      } catch (e) {
        request.log.error(e)
        return reply
          .status(500)
          .send(
            error(500, `生成 Passkey 注册选项失败: ${e instanceof Error ? e.message : String(e)}`),
          )
      }
    },
  )

  // ------------------------------------------------------------
  // 2. POST /auth/passkey/register/verify — 验证注册响应 + 存 credential
  // ------------------------------------------------------------
  server.post(
    '/auth/passkey/register/verify',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = registerVerifySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { challengeId, response, name } = parsed.data
      const userId = request.userId!

      // 从 Redis 取 challenge
      const challengeKey = `${CHALLENGE_KEY_PREFIX}${challengeId}`
      const storedRaw = await server.redis.get(challengeKey)
      if (!storedRaw) {
        return reply.status(400).send(error(400, 'challenge 不存在或已过期,请重新获取注册选项'))
      }

      let stored: StoredChallenge
      try {
        stored = JSON.parse(storedRaw) as StoredChallenge
      } catch {
        await server.redis.del(challengeKey)
        return reply.status(500).send(error(500, 'challenge 数据损坏,请重新获取注册选项'))
      }

      // 校验 challenge 关联的 userId 与当前登录用户一致(防篡改)
      if (stored.userId !== userId) {
        await server.redis.del(challengeKey)
        return reply.status(403).send(error(403, 'challenge 与当前用户不匹配'))
      }

      const cfg = getPasskeyConfig()
      let result: VerifiedRegistrationResult
      try {
        result = await verifyRegistrationResponse(response, stored.challenge, cfg.origins, cfg.rpID)
      } catch (e) {
        await server.redis.del(challengeKey)
        request.log.error(e)
        return reply
          .status(400)
          .send(error(400, `Passkey 注册验证失败: ${e instanceof Error ? e.message : String(e)}`))
      }

      // challenge 一次性使用,立即删除
      await server.redis.del(challengeKey)

      if (!result.verified || !result.credentialId || !result.credentialPublicKey) {
        return reply.status(400).send(error(400, 'Passkey 注册验证失败'))
      }

      // 检查 credentialId 是否已存在(防止客户端重放)
      const existingCred = await db
        .select({ id: userPasskeys.id })
        .from(userPasskeys)
        .where(eq(userPasskeys.credentialId, result.credentialId))
        .limit(1)
      if (existingCred.length > 0) {
        return reply.status(409).send(error(409, '该 Passkey 凭证已存在,请勿重复注册'))
      }

      // 存 credential 到 DB
      await db.insert(userPasskeys).values({
        userId,
        credentialId: result.credentialId,
        publicKey: result.credentialPublicKey,
        counter: result.counter ?? 0,
        transports: undefined, // attestation 响应中 transports 由客户端单独提供,provider 未提取
        deviceType: result.deviceType,
        aaguid: result.aaguid,
        name: name ?? null,
      })

      return reply.send(success({ verified: true, credentialId: result.credentialId }))
    },
  )

  // ------------------------------------------------------------
  // 3. POST /auth/passkey/auth/options — 生成认证选项(未登录)
  // ------------------------------------------------------------
  server.post(
    '/auth/passkey/auth/options',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      // 未登录场景:allowedCredentials 传空数组,启用 discoverable credentials
      // (客户端 browser 会自动弹出所有匹配 RP ID 的 Passkey 供用户选择)
      try {
        const options = await generateAuthenticationOptions([])
        const challenge = extractChallenge(options)
        if (!challenge) {
          return reply.status(500).send(error(500, '生成认证选项失败:challenge 缺失'))
        }

        // challenge 存 Redis(不携带 userId,verify 阶段通过 credentialId 反查用户)
        const challengeId = generateChallengeId()
        const stored: StoredChallenge = { challenge }
        await server.redis.set(
          `${CHALLENGE_KEY_PREFIX}${challengeId}`,
          JSON.stringify(stored),
          'EX',
          CHALLENGE_TTL_SECONDS,
        )

        return reply.send(success({ options, challengeId }))
      } catch (e) {
        request.log.error(e)
        return reply
          .status(500)
          .send(
            error(500, `生成 Passkey 认证选项失败: ${e instanceof Error ? e.message : String(e)}`),
          )
      }
    },
  )

  // ------------------------------------------------------------
  // 4. POST /auth/passkey/auth/verify — 验证认证响应 + 签发 JWT
  // ------------------------------------------------------------
  server.post(
    '/auth/passkey/auth/verify',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = authVerifySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { challengeId, response } = parsed.data

      // 从 Redis 取 challenge
      const challengeKey = `${CHALLENGE_KEY_PREFIX}${challengeId}`
      const storedRaw = await server.redis.get(challengeKey)
      if (!storedRaw) {
        return reply.status(400).send(error(400, 'challenge 不存在或已过期,请重新获取认证选项'))
      }

      let stored: StoredChallenge
      try {
        stored = JSON.parse(storedRaw) as StoredChallenge
      } catch {
        await server.redis.del(challengeKey)
        return reply.status(500).send(error(500, 'challenge 数据损坏,请重新获取认证选项'))
      }

      // 从响应中提取 credentialId,查 DB 找已存储的 credential
      const credentialId = extractCredentialId(response)
      if (!credentialId) {
        await server.redis.del(challengeKey)
        return reply.status(400).send(error(400, '认证响应缺少 credentialId'))
      }

      const credRows = await db
        .select()
        .from(userPasskeys)
        .where(eq(userPasskeys.credentialId, credentialId))
        .limit(1)
      const credRow = credRows[0]
      if (!credRow) {
        await server.redis.del(challengeKey)
        return reply.status(404).send(error(404, 'Passkey 凭证不存在,请先注册'))
      }

      const storedCred: StoredPasskeyCredential = {
        credentialId: credRow.credentialId,
        publicKey: credRow.publicKey ?? Buffer.alloc(0),
        counter: credRow.counter,
        transports: (credRow.transports ?? undefined) as string[] | undefined,
      }

      const cfg = getPasskeyConfig()
      let result: VerifiedAuthenticationResult
      try {
        result = await verifyAuthenticationResponse(
          response,
          stored.challenge,
          storedCred,
          cfg.origins,
          cfg.rpID,
        )
      } catch (e) {
        await server.redis.del(challengeKey)
        request.log.error(e)
        return reply
          .status(400)
          .send(error(400, `Passkey 认证验证失败: ${e instanceof Error ? e.message : String(e)}`))
      }

      // challenge 一次性使用,立即删除
      await server.redis.del(challengeKey)

      if (!result.verified) {
        return reply.status(401).send(error(401, 'Passkey 认证失败'))
      }

      // 更新 counter(防重放,必须每次递增)+ lastUsedAt
      if (typeof result.newCounter === 'number') {
        await db
          .update(userPasskeys)
          .set({
            counter: result.newCounter,
            lastUsedAt: new Date(),
          })
          .where(eq(userPasskeys.id, credRow.id))
      }

      // 查用户 + 签发 JWT
      const user = await findUserById(credRow.userId)
      if (!user) return reply.status(404).send(error(404, '用户不存在'))
      if (user.status !== 1) return reply.status(403).send(error(403, '账号已被禁用'))

      const tokens = await buildTokenPair({
        id: user.id,
        phone: user.phone,
        roleId: user.roleId,
        familyId: user.familyId,
      })

      return reply.send(
        success({
          userId: user.id,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          refreshExpiresIn: tokens.refreshExpiresIn,
          tokenType: 'Bearer',
          user: {
            id: user.id,
            email: user.email ?? '',
            phone: user.phone ?? '',
            nickname: user.nickname ?? '',
            avatar: user.avatar ?? '',
            isVip: Boolean(user.isVip),
            roleId: user.roleId ?? 0,
          },
        }),
      )
    },
  )
}

export default authPasskeyRoutes
