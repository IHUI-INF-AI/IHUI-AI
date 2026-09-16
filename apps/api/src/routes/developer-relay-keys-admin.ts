// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/developer/relay/keys 批量管理端点(2026-09-16 立,深度对标补强 C)。
 *
 * 端点:
 * 1. POST /developer/relay/keys/bulk — 批量编辑(限流/过期/IP 黑白名单/三窗口限额)
 *
 * 独立文件原因:与 developer-relay.ts(用户侧中转站端点)并行开发,避免同文件冲突;
 * 注册由主会话统一接线到 routes/index.ts(prefix /api)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { success, error } from '../utils/response.js'
import { bulkUpdateKeys } from '../services/developer-api-keys-service.js'
import { db, dbRead } from '../db/index.js'
import { developerApiKeys, keyRateWindowCounts } from '@ihui/database'
import {
  getUserConcurrencyCurrent,
  getUserConcurrencyLimit,
} from '../services/user-concurrency-service.js'

const bulkPatchSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(100),
    patch: z
      .object({
        rateLimit: z.number().int().min(1).max(100000).nullable().optional(),
        expiresAt: z.iso.datetime().nullable().optional(),
        allowedIps: z.array(z.string().max(64)).max(50).nullable().optional(),
        blockedIps: z.array(z.string().max(64)).max(50).nullable().optional(),
        rateLimit5h: z.number().int().min(1).max(1000000).nullable().optional(),
        rateLimit1d: z.number().int().min(1).max(1000000).nullable().optional(),
        rateLimit7d: z.number().int().min(1).max(1000000).nullable().optional(),
      })
      .refine((p) => Object.keys(p).length > 0, { message: 'patch 至少一个字段' }),
  })
  .refine((d) => d.ids.length > 0, { message: 'ids 必填' })

const developerRelayKeysAdminRoutes: FastifyPluginAsync = async (server) => {
  // 1. 批量编辑(归属内 Key,越权 id 自动落空)
  server.post('/developer/relay/keys/bulk', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const parsed = bulkPatchSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const result = await bulkUpdateKeys(userId, parsed.data.ids, parsed.data.patch)
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '批量编辑失败'))
    }
  })

  // 2. 重置 Key 的窗口用量计数(L,2026-09-16 立,对标竞品 resetRateLimitUsage)
  //    客服场景:窗口计数异常/误触发上限时手动清零。归属校验 + 返回清除条数。
  server.post('/developer/relay/keys/:id/reset-windows', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    const id = (request.params as { id?: string }).id
    if (!id) return reply.status(400).send(error(400, '参数错误'))
    try {
      const [keyRow] = await dbRead
        .select({ id: developerApiKeys.id })
        .from(developerApiKeys)
        .where(and(eq(developerApiKeys.id, id), eq(developerApiKeys.userId, userId)))
        .limit(1)
      if (!keyRow) return reply.status(404).send(error(404, 'API Key 不存在或无权操作'))
      const cleared = await db
        .delete(keyRateWindowCounts)
        .where(eq(keyRateWindowCounts.keyId, id))
        .returning({ id: keyRateWindowCounts.id })
      return reply.send(success({ cleared: cleared.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '重置窗口用量失败'))
    }
  })

  // 3. 当前用户实时并发查询(M,2026-09-16 立,对标竞品 currentConcurrency 展示)
  server.get('/developer/relay/keys/concurrency', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))
    return reply.send(
      success({
        current: getUserConcurrencyCurrent(userId),
        limit: getUserConcurrencyLimit(),
      }),
    )
  })
}

export default developerRelayKeysAdminRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
