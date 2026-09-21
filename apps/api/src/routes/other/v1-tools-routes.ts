// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * v1 工具(从 frontend-stub-other-routes.ts 拆分)。
 * GET /v1/tools/{list,categories,upload}
 */
import type { FastifyPluginAsync } from 'fastify'
import { eq, asc, desc, sql } from 'drizzle-orm'
import { success } from '../../utils/response.js'
import { dbRead } from '../../db/index.js'
import { tools } from '@ihui/database'
import { parsePagination } from './_shared.js'
import { requireCapabilityRules } from '../../utils/capability-guard.js'
import { openCapabilityRules } from '../../config/open-capability-registry.js'
import { requireOpenCapability } from '../../utils/open-capability-gate.js'

export const v1ToolsRoutes: FastifyPluginAsync = async (server) => {
  // O6 收口(原 O3 仅 declareCapability 登记、不强制):本族只读工具目录。
  // 人 JWT 通道行为不变(上游 otherRoutes 已 authenticate);机器凭据须持有 tools:read,
  // path→scope 映射取自开放登记表,本文件不再自持第二份真相。
  server.addHook(
    'preHandler',
    requireOpenCapability(requireCapabilityRules(openCapabilityRules('v1-tools-directory'))),
  )

  // GET /v1/tools/list — 工具列表
  server.get('/v1/tools/list', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const where = eq(tools.status, 'published')
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(tools)
        .where(where)
        .orderBy(asc(tools.sortOrder), desc(tools.rating))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(tools)
        .where(where),
    ])
    return reply.send(
      success({ list, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // GET /v1/tools/categories — 工具分类(去重)
  server.get('/v1/tools/categories', async (_request, reply) => {
    const rows = await dbRead
      .select({ category: tools.category })
      .from(tools)
      .where(eq(tools.status, 'published'))
      .groupBy(tools.category)
      .orderBy(asc(tools.category))
    return reply.send(success({ list: rows.map((r) => r.category) }))
  })

  // GET /v1/tools/upload — 工具上传配置
  server.get('/v1/tools/upload', async (_request, reply) => {
    return reply.send(
      success({
        uploadUrl: '/api/upload/init',
        maxFileSize: 100 * 1024 * 1024,
        allowedTypes: ['image/*', 'application/pdf', 'video/*'],
      }),
    )
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
