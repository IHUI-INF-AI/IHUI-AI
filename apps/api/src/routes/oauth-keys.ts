import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { oauthPrivateKeys } from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { generateApiKey } from '../utils/crypto-random.js'

// =============================================================================
// OAuth 私钥管理(多租户 JWT/RS256 签名密钥轮转)
// 迁移自 D 盘 coze_zhs_py/routers/oauth_keys.py
// =============================================================================

const ADMIN_ROLE_ID = 1

async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    reply
      .status(statusCode)
      .send(error(statusCode, (e as Error).message || 'Authentication required'))
    return false
  }
  const roleId = request.jwtPayload?.roleId ?? 0
  if (roleId < ADMIN_ROLE_ID) {
    reply.status(403).send(error(403, '需要管理员权限'))
    return false
  }
  return true
}

const generateSchema = z.object({
  clientId: z.string().min(1).max(100),
  keyType: z.enum(['RSA', 'EC', 'HMAC']).default('RSA'),
})

const rotateSchema = z.object({
  clientId: z.string().min(1).max(100),
  keyType: z.enum(['RSA', 'EC', 'HMAC']).default('RSA'),
})

const revokeSchema = z.object({
  id: z.string().uuid('无效的密钥 ID'),
})

const listQuery = z.object({
  clientId: z.string().min(1).max(100).optional(),
  isActive: z.preprocess(
    (v) => (v === undefined || v === null || v === '' ? undefined : v === 'true' ? 1 : 0),
    z.number().int().min(0).max(1).optional(),
  ),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

// 占位密钥生成(生产环境应使用 crypto 生成真实 RSA/EC 密钥对,或对接 KMS)
function placeholderKey(keyType: string): { privateKey: string; publicKey: string } {
  if (keyType === 'HMAC') {
    // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成 HMAC secret,
    // Math.random 可预测 -> 攻击者可重放 JWT/signature 劫持会话
    return {
      privateKey: `hmac-secret-${generateApiKey()}`,
      publicKey: '',
    }
  }
  // RSA/EC 占位:实际应由 KMS 或 crypto.generateKeyPair 生成
  return {
    privateKey: `-----BEGIN PRIVATE KEY-----\nplaceholder-${keyType}-${Date.now()}\n-----END PRIVATE KEY-----`,
    publicKey: `-----BEGIN PUBLIC KEY-----\nplaceholder-${keyType}-${Date.now()}\n-----END PUBLIC KEY-----`,
  }
}

export const oauthKeysRoutes: FastifyPluginAsync = async (server) => {
  // POST /generate - 生成新私钥(管理员)
  server.post('/generate', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const parsed = generateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { clientId, keyType } = parsed.data
    const { privateKey, publicKey } = placeholderKey(keyType)
    const [key] = await db
      .insert(oauthPrivateKeys)
      .values({ clientId, privateKey, publicKey, keyType, isActive: 1 })
      .returning()
    return reply.status(201).send(success({ key: { ...key, privateKey: '[REDACTED]' } }))
  })

  // POST /rotate - 轮转密钥(旧密钥置 isActive=0,生成新密钥)
  server.post('/rotate', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const parsed = rotateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { clientId, keyType } = parsed.data
    // 旧密钥全部置 0
    await db
      .update(oauthPrivateKeys)
      .set({ isActive: 0, updatedAt: new Date() })
      .where(eq(oauthPrivateKeys.clientId, clientId))
    // 生成新密钥
    const { privateKey, publicKey } = placeholderKey(keyType)
    const [key] = await db
      .insert(oauthPrivateKeys)
      .values({ clientId, privateKey, publicKey, keyType, isActive: 1 })
      .returning()
    return reply.send(success({ rotated: true, key: { ...key, privateKey: '[REDACTED]' } }))
  })

  // POST /revoke - 吊销密钥(置 isActive=0,不物理删除)
  server.post('/revoke', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const parsed = revokeSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [key] = await db
      .update(oauthPrivateKeys)
      .set({ isActive: 0, updatedAt: new Date() })
      .where(eq(oauthPrivateKeys.id, parsed.data.id))
      .returning()
    if (!key) return reply.status(404).send(error(404, '密钥不存在'))
    return reply.send(success({ revoked: true, id: key.id }))
  })

  // GET /list - 密钥列表(管理员,支持 clientId/isActive 过滤)
  server.get('/list', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const parsed = listQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { clientId, isActive, page, pageSize } = parsed.data
    const conds = []
    if (clientId) conds.push(eq(oauthPrivateKeys.clientId, clientId))
    if (isActive !== undefined) conds.push(eq(oauthPrivateKeys.isActive, isActive))
    const where = conds.length ? and(...conds) : undefined
    const [list, totalRows] = await Promise.all([
      db
        .select({
          id: oauthPrivateKeys.id,
          clientId: oauthPrivateKeys.clientId,
          publicKey: oauthPrivateKeys.publicKey,
          keyType: oauthPrivateKeys.keyType,
          isActive: oauthPrivateKeys.isActive,
          createdAt: oauthPrivateKeys.createdAt,
          updatedAt: oauthPrivateKeys.updatedAt,
        })
        .from(oauthPrivateKeys)
        .where(where)
        .orderBy(desc(oauthPrivateKeys.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(oauthPrivateKeys)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  // GET /active - 当前激活密钥(管理员,按 clientId 过滤)
  server.get('/active', async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return
    const clientId = (request.query as { clientId?: string })?.clientId
    if (!clientId) return reply.status(400).send(error(400, 'clientId 参数必填'))
    const [key] = await db
      .select({
        id: oauthPrivateKeys.id,
        clientId: oauthPrivateKeys.clientId,
        publicKey: oauthPrivateKeys.publicKey,
        keyType: oauthPrivateKeys.keyType,
        isActive: oauthPrivateKeys.isActive,
        createdAt: oauthPrivateKeys.createdAt,
        updatedAt: oauthPrivateKeys.updatedAt,
      })
      .from(oauthPrivateKeys)
      .where(and(eq(oauthPrivateKeys.clientId, clientId), eq(oauthPrivateKeys.isActive, 1)))
      .limit(1)
    if (!key) return reply.status(404).send(error(404, '无激活密钥'))
    return reply.send(success({ key }))
  })
}
