// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { generateKeyPairSync } from 'node:crypto'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { db, dbRead, type Database } from '../db/index.js'
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
  // oauth_private_keys.id 是 uuid 列：/rotate 与 /revoke 都把它喂进 eq()/update().where()，
  // 非 uuid 串让 Postgres 抛 22P02 ⇒ 500。原只校验 min(1)，漏掉格式。
  keyId: z.uuid({ error: 'keyId 格式不正确' }),
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

/**
 * B68(2026-11-02) 读路径:副本优先,失败显式降级主库一次。
 *
 * 判据(为什么降级是安全的、为什么不是"吞错"):
 *  - 本查询是只读、幂等、无参数的单表元数据读取,重放一次不产生任何副作用;
 *  - `dbRead` 的故障转移要等健康探测连续 3 次失败(探测 15s/次 ⇒ 约 45s 窗口),
 *    窗口内副本单次读失败会直接落到本路由 catch(500)—— 副本抖动被放大成用户面 5xx;
 *  - 只降级一次:主库也失败就原样抛回调用方,由既有 catch 出 500 + `err` 进日志,
 *    不丢原始错误、不静默返回空列表。
 */
async function listKeysReplicaFirst(request: FastifyRequest): Promise<OauthPrivateKey[]> {
  const run = (client: Database) =>
    client.select().from(oauthPrivateKeys).orderBy(desc(oauthPrivateKeys.createdAt))
  try {
    return await run(dbRead)
  } catch (err) {
    request.log.warn({ err }, 'oauth-keys /list 读副本查询失败,降级主库重试')
    return await run(db)
  }
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
      // revoked 由本写链的 RETURNING 命中集派生(2026-09-27):上面的存在性预读只防得住
      // "根本没这行",防不住"读到之后 UPDATE 命中 0 行"(读-判-写窗口内行被并发删除)。
      const revokedRows = await db
        .update(oauthPrivateKeys)
        .set({ isActive: 0, updatedAt: new Date() })
        .where(eq(oauthPrivateKeys.id, keyId))
        .returning({ id: oauthPrivateKeys.id })
      return reply.send(success({ keyId, revoked: revokedRows.length > 0 }))
    } catch (e) {
      request.log.error({ err: e }, 'oauth-keys /revoke 失败')
      return reply.status(500).send(error(500, '密钥吊销失败'))
    }
  })

  // GET /list - 列出所有私钥(按创建时间倒序,不含 privateKey)
  //
  // B68(2026-11-02) 压力闸豁免(只落这一条路由,不动全局 shed 策略):
  // api_logs 一手现场的 `GET /api/oauth-keys/list -> 503 | FastifyError: Service Unavailable`
  // 不是读副本故障(副本失败在本路由是 500,见 listKeysReplicaFirst),而是
  // `@fastify/under-pressure` 在事件循环延迟超 server.ts 的 maxEventLoopDelay=1000ms 时
  // 对**全站**路由统一 `handlePressure()` 的结果。本端点是单表只读元数据查询
  // (无写、无 CPU、无外部调用),既不是延迟的成因,也没有被 shed 的价值 ——
  // 用 under-pressure 官方支持的 per-route `config.pressureHandler` 放行(返回 undefined
  // 即 next()),其余路由(含本文件写端点与 /active)仍照常被压力闸裁掉。
  server.get(
    '/list',
    {
      config: {
        // 留一行 warn:以后查"这条路由为何没被 503"有据可依,不必再靠读插件源码倒推。
        pressureHandler: (request, _reply, type, value) => {
          request.log.warn({ pressureType: type, pressureValue: value }, 'oauth-keys /list 压力闸豁免放行')
        },
      },
    },
    async (request, reply) => {
      try {
        const rows = await listKeysReplicaFirst(request)
        return reply.send(success({ keys: rows.map(toKeyMeta) }))
      } catch (e) {
        request.log.error({ err: e }, 'oauth-keys /list 查询失败')
        return reply.status(500).send(error(500, '密钥列表查询失败'))
      }
    },
  )

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
