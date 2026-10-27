// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { authenticate } from '../plugins/auth.js'
import { isSystemAdmin } from '../plugins/require-permission.js'
import { z } from 'zod'
import { db } from '../db/index.js'
import { sql, and, eq } from 'drizzle-orm'
import { lessons, examPapers, liveChannels } from '@ihui/database'

/**
 * 历史项目缺失端点补齐 — 批量查询模块(D9)。
 * 从原 legacy-completion.ts 拆分,注册 prefix 为 /api/legacy,完整路径保持不变。
 * - D9: 各模块 by-ids 批量查询(3端点 /batch/lessons|exams|channels)
 *
 * 安全(2026-10-27 加固,P1):原实现只按 id 取行、不判发布状态 —— 任何登录用户只要拿到
 * (或猜到)一个未发布课程/试卷/频道的 id,就能通过批量端点把标题、正文、试卷题目等
 * 一次性捞出来。现统一要求 isPublished,管理员(roleId≥1)不受限,保持后台预览能力。
 */
/** 管理员放行全量,普通用户只看已发布(返回 undefined = 不加条件) */
function publishedOnly(request: FastifyRequest, column: AnyPgColumn) {
  if (isSystemAdmin(request, { includeInternalChannel: false })) return undefined
  return eq(column, true)
}

export const legacyBatchRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // ========== D9: 各模块 by-ids 批量查询 (统一端点) ==========
  fastify.post('/batch/lessons', { preHandler: authenticate }, async (request) => {
    const { ids } = z.object({ ids: z.array(z.string()).max(100) }).parse(request.body)
    const list = await db
      .select()
      .from(lessons)
      .where(
        and(sql`${lessons.id} = ANY(${ids}::uuid[])`, publishedOnly(request, lessons.isPublished)),
      )
    return { list }
  })

  fastify.post('/batch/exams', { preHandler: authenticate }, async (request) => {
    const { ids } = z.object({ ids: z.array(z.string()).max(100) }).parse(request.body)
    const list = await db
      .select()
      .from(examPapers)
      .where(
        and(
          sql`${examPapers.id} = ANY(${ids}::uuid[])`,
          publishedOnly(request, examPapers.isPublished),
        ),
      )
    return { list }
  })

  fastify.post('/batch/channels', { preHandler: authenticate }, async (request) => {
    const { ids } = z.object({ ids: z.array(z.string()).max(100) }).parse(request.body)
    const list = await db
      .select()
      .from(liveChannels)
      .where(
        and(
          sql`${liveChannels.id} = ANY(${ids}::uuid[])`,
          publishedOnly(request, liveChannels.isPublished),
        ),
      )
    return { list }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
