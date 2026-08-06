import type { FastifyPluginAsync } from 'fastify'
import { generateKeyPairSync } from 'node:crypto'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { db, dbRead } from '../db/index.js'
import { oauthPrivateKeys, type OauthPrivateKey } from '@ihui/database'

/**
 * OAuth 私钥管理路由
 * 端点: /generate, /rotate, /revoke, /list, /active
 *
 * 2026-08-06 已实装: 由桩端点替换为真实业务实现(RSA 密钥对生成 / 轮转 / 吊销 / 列表 / 活跃查询)。
 * 安全约定: 所有响应仅返回元数据(白名单字段), 绝不返回 privateKey / encryptionKeyId。
 */

// =============================================================================
// Zod schemas
// =============================================================================

const generateBodySchema = z.object({
  provider: z.string().min(1, 'provider 不能为空'),
  scopes: z.array(z.string()).optional().default([]),
})

const keyIdBodySchema = z.object({
  keyId: z.string().min(1, 'keyId 不能为空'),
})

const activeQuerySchema = z.object({
  provider: z.string().optional(),
})

// =============================================================================
// Helpers
// =============================================================================

/** 对外暴露的密钥元数据(白名单字段, 不含 privateKey/encryptionKeyId)。 */
interface KeyMeta {
  keyId: string
  clientId: string
  publicKey: string | null
  keyType: string
  isActive: number
  createdAt: Date
  updatedAt: Date
}

/** 从表记录构造响应元数据。 */
function toKeyMeta(row: OauthPrivateKey): KeyMeta {
  return {
    keyId: row.id,
    clientId: row.clientId,
    publicKey: row.publicKey,
    keyType: row.keyType,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/** 生成 RSA-2048 PEM 密钥对(私钥 PKCS8 / 公钥 SPKI)。 */
function generateRsaKeyPair(): { privateKey: string; publicKey: string } {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
}

// =============================================================================
// 路由
// =============================================================================

export const oauthKeysRoutes: FastifyPluginAsync = async (server) => {
  // 所有端点需要认证
  server.addHook('preHandler', authenticate)

  // POST /generate - 生成新的 OAuth 私钥对
  server.post('/generate', async (request, reply) => {
    const parsed = generateBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { provider } = parsed.data
    try {
      const { privateKey, publicKey } = generateRsaKeyPair()
      // 轮转策略: 同一 provider 允许多把 active 密钥并存(由 /rotate 负责轮转)。
      // 新生成密钥直接置 active, 不自动禁用旧密钥 —— 避免高并发期间 generate/rotate
      // 交错执行时出现该 provider 短暂"无 active 可用"的空窗期; 旧密钥由 rotate 显式禁用。
      const [row] = await db
        .insert(oauthPrivateKeys)
        .values({
          clientId: provider,
          privateKey,
          publicKey,
          keyType: 'RSA',
          isActive: 1,
        })
        .returning()
      if (!row) return reply.status(500).send(error(500, '密钥生成失败'))
      return reply.send(success(toKeyMeta(row)))
    } catch (e) {
      request.log.error({ err: e }, 'oauth-keys /generate 失败')
      return reply.status(500).send(error(500, '密钥生成失败'))
    }
  })

  // POST /rotate - 轮转私钥(生成新密钥,旧密钥标记为非活跃)
  server.post('/rotate', async (request, reply) => {
    const parsed = keyIdBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { keyId } = parsed.data
    try {
      const [existing] = await db
        .select()
        .from(oauthPrivateKeys)
        .where(eq(oauthPrivateKeys.id, keyId))
        .limit(1)
      if (!existing) return reply.status(404).send(error(404, '密钥不存在'))
      // 旧密钥禁用保留(不删除), 供审计追溯及 JWKS 旧公钥验签
      await db
        .update(oauthPrivateKeys)
        .set({ isActive: 0, updatedAt: new Date() })
        .where(eq(oauthPrivateKeys.id, keyId))
      const { privateKey, publicKey } = generateRsaKeyPair()
      const [row] = await db
        .insert(oauthPrivateKeys)
        .values({
          clientId: existing.clientId,
          privateKey,
          publicKey,
          keyType: 'RSA',
          isActive: 1,
        })
        .returning()
      if (!row) return reply.status(500).send(error(500, '密钥轮转失败'))
      return reply.send(success(toKeyMeta(row)))
    } catch (e) {
      request.log.error({ err: e }, 'oauth-keys /rotate 失败')
      return reply.status(500).send(error(500, '密钥轮转失败'))
    }
  })

  // POST /revoke - 吊销私钥
  server.post('/revoke', async (request, reply) => {
    const parsed = keyIdBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { keyId } = parsed.data
    try {
      const [existing] = await db
        .select()
        .from(oauthPrivateKeys)
        .where(eq(oauthPrivateKeys.id, keyId))
        .limit(1)
      if (!existing) return reply.status(404).send(error(404, '密钥不存在'))
      await db
        .update(oauthPrivateKeys)
        .set({ isActive: 0, updatedAt: new Date() })
        .where(eq(oauthPrivateKeys.id, keyId))
      return reply.send(success({ keyId, revoked: true }))
    } catch (e) {
      request.log.error({ err: e }, 'oauth-keys /revoke 失败')
      return reply.status(500).send(error(500, '密钥吊销失败'))
    }
  })

  // GET /list - 列出所有私钥(按创建时间倒序,不含 privateKey)
  server.get('/list', async (request, reply) => {
    try {
      const rows = await dbRead
        .select()
        .from(oauthPrivateKeys)
        .orderBy(desc(oauthPrivateKeys.createdAt))
      return reply.send(success({ keys: rows.map(toKeyMeta) }))
    } catch (e) {
      request.log.error({ err: e }, 'oauth-keys /list 查询失败')
      return reply.status(500).send(error(500, '密钥列表查询失败'))
    }
  })

  // GET /active - 查询当前活跃的私钥
  server.get('/active', async (request, reply) => {
    const parsed = activeQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { provider } = parsed.data
    try {
      if (provider) {
        // 指定 provider: 返回该 provider 最新一把 active 密钥
        const [row] = await dbRead
          .select()
          .from(oauthPrivateKeys)
          .where(and(eq(oauthPrivateKeys.clientId, provider), eq(oauthPrivateKeys.isActive, 1)))
          .orderBy(desc(oauthPrivateKeys.createdAt))
          .limit(1)
        return reply.send(success({ key: row ? toKeyMeta(row) : null }))
      }
      // 未指定 provider: 每个 provider 取最新一把 active 密钥
      const rows = await dbRead
        .select()
        .from(oauthPrivateKeys)
        .where(eq(oauthPrivateKeys.isActive, 1))
        .orderBy(desc(oauthPrivateKeys.createdAt))
      const latestByClient = new Map<string, OauthPrivateKey>()
      for (const row of rows) {
        if (!latestByClient.has(row.clientId)) latestByClient.set(row.clientId, row)
      }
      return reply.send(success({ keys: [...latestByClient.values()].map(toKeyMeta) }))
    } catch (e) {
      request.log.error({ err: e }, 'oauth-keys /active 查询失败')
      return reply.status(500).send(error(500, '活跃密钥查询失败'))
    }
  })
}
