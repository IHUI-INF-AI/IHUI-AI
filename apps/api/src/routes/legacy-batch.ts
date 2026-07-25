import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { authenticate } from '../plugins/auth.js'
import { z } from 'zod'
import { db } from '../db/index.js'
import { sql } from 'drizzle-orm'
import { lessons, examPapers, liveChannels } from '@ihui/database'

/**
 * 历史项目缺失端点补齐 — 批量查询模块(D9)。
 * 从原 legacy-completion.ts 拆分,注册 prefix 为 /api/legacy,完整路径保持不变。
 * - D9: 各模块 by-ids 批量查询(3端点 /batch/lessons|exams|channels)
 */
export const legacyBatchRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // ========== D9: 各模块 by-ids 批量查询 (统一端点) ==========
  fastify.post('/batch/lessons', { preHandler: authenticate }, async (request) => {
    const { ids } = z.object({ ids: z.array(z.string()).max(100) }).parse(request.body)
    const list = await db
      .select()
      .from(lessons)
      .where(sql`${lessons.id} = ANY(${ids}::uuid[])`)
    return { list }
  })

  fastify.post('/batch/exams', { preHandler: authenticate }, async (request) => {
    const { ids } = z.object({ ids: z.array(z.string()).max(100) }).parse(request.body)
    const list = await db
      .select()
      .from(examPapers)
      .where(sql`${examPapers.id} = ANY(${ids}::uuid[])`)
    return { list }
  })

  fastify.post('/batch/channels', { preHandler: authenticate }, async (request) => {
    const { ids } = z.object({ ids: z.array(z.string()).max(100) }).parse(request.body)
    const list = await db
      .select()
      .from(liveChannels)
      .where(sql`${liveChannels.id} = ANY(${ids}::uuid[])`)
    return { list }
  })
}
