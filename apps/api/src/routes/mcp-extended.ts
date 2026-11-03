// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MCP 项目管理与集成扩展（11 端点）。
 * 调用方现读(2026-11-01):`apps/cli/src/commands/mcp-market.ts` 的 install/remove 打
 * `POST/DELETE /api/mcp/projects`。头注此前写"前端 use-mcp.ts / use-mcp-integration.ts
 * 调用但后端缺失"—— 那两份**钩子文件不存在**(现读 `apps/web` 下名字以 `use-mcp` 开头的
 * 源文件只有 `src/hooks/use-mcp-status-broadcast.ts` 一枚,且它不碰本面)。留这种假说辞的代价
 * 是下一个人会去补一条根本不存在的前端调用链,或反过来把"不能让前端列表变空"当成
 * 不能收权属的理由。
 *
 * 端点清单：
 * 1.  GET    /mcp/projects                       — 项目列表
 * 2.  POST   /mcp/projects                       — 创建项目
 * 3.  GET    /mcp/projects/:id                   — 项目详情
 * 4.  DELETE /mcp/projects/:id                   — 删除项目
 * 5.  GET    /mcp/projects/:projectId/performance — 性能统计
 * 6.  GET    /mcp/projects/:projectId/use        — 使用统计（读）
 * 7.  POST   /mcp/projects/:projectId/use        — 使用记录（写）
 * 8.  GET    /mcp/integrations                   — 集成列表
 * 9.  POST   /mcp/integrations                   — 创建集成
 * 10. DELETE /mcp/integrations/:id               — 删除集成
 * 11. POST   /mcp/integrations/:id/toggle        — 启用/禁用
 *
 * 数据存储：system_configs 表 category='mcp_project' / 'mcp_integration'。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { success, error } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'

const idParam = z.object({ id: z.string().min(1) })
const projectIdParam = z.object({ projectId: z.string().min(1) })

const projectBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  endpoint: z.string().max(500).optional(),
  status: z.string().max(32).optional(),
  tags: z.array(z.string().max(64)).max(20).optional(),
})

const integrationBody = z.object({
  name: z.string().min(1).max(200),
  type: z.string().max(64).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
})

import { parsePaging } from '../utils/paging.js'

function parseJSONValue(s: unknown): Record<string, unknown> {
  if (typeof s !== 'string') return {}
  try {
    const v = JSON.parse(s)
    return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function rowToConfig(r: Record<string, unknown>): Record<string, unknown> {
  return {
    ...parseJSONValue(r.value),
    id: r.id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

/**
 * 归属判据(2026-11-01 安全强化):这两族条目是**用户各自的项目/集成**(调用方 =
 * `apps/cli/src/commands/mcp-market.ts` 的 install/remove),但 `system_configs` 没有 owner 列。
 * 现读该表已有 `updated_by uuid → users.id`(`packages/database/src/schema/system.ts` 的
 * `updatedBy`),本族把它**复用为属主**:创建时盖章、之后每条读写都带它做谓词。
 * 不加迁移、不建列。代价逐条写在头注里(语义是"最后改的人",而按本文件的写法能改的人
 * 定义上就是属主本人,所以不漂;FK 是 `onDelete: set null`,用户注销后条目会变孤儿)。
 */
const MCP_USER_SCOPED_CATEGORIES = ['mcp_project', 'mcp_integration'] as const

async function configList(
  category: string,
  page: number,
  pageSize: number,
  userId: string,
): Promise<{ list: Record<string, unknown>[]; total: number; page: number; pageSize: number }> {
  const offset = (page - 1) * pageSize
  const rows = await db.execute(
    sql`SELECT id, value, created_at, updated_at FROM "system_configs" WHERE "category" = ${category} AND "updated_by" = ${userId} ORDER BY "created_at" DESC LIMIT ${pageSize} OFFSET ${offset}`,
  )
  const countRows = await db.execute(
    sql`SELECT count(*)::int AS count FROM "system_configs" WHERE "category" = ${category} AND "updated_by" = ${userId}`,
  )
  const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
  return {
    list: (rows as Record<string, unknown>[]).map(rowToConfig),
    total,
    page,
    pageSize,
  }
}

async function configById(id: string, userId: string): Promise<Record<string, unknown> | null> {
  const rows = await db.execute(
    sql`SELECT id, value, created_at, updated_at FROM "system_configs" WHERE "id"::text = ${id} AND "updated_by" = ${userId} LIMIT 1`,
  )
  const r = (rows as Record<string, unknown>[])[0]
  return r ? rowToConfig(r) : null
}

async function configCreate(
  category: string,
  body: Record<string, unknown>,
  userId: string,
): Promise<Record<string, unknown>> {
  const id = crypto.randomUUID()
  const value = JSON.stringify(body)
  const rows = await db.execute(
    sql`INSERT INTO "system_configs" (id, key, value, type, category, "updated_by") VALUES (${id}, ${id}, ${value}, ${'json'}, ${category}, ${userId}) RETURNING id, value, created_at, updated_at`,
  )
  const r = (rows as Record<string, unknown>[])[0]
  if (!r) return { id, ...body }
  return rowToConfig(r)
}

async function configUpdate(
  id: string,
  body: Record<string, unknown>,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const existing = await db.execute(
    sql`SELECT value FROM "system_configs" WHERE "id"::text = ${id} AND "updated_by" = ${userId} LIMIT 1`,
  )
  const exRow = (existing as Record<string, unknown>[])[0]
  if (!exRow) return null
  const merged = { ...parseJSONValue(exRow.value), ...body }
  const rows = await db.execute(
    sql`UPDATE "system_configs" SET "value" = ${JSON.stringify(merged)}, "updated_at" = NOW() WHERE "id"::text = ${id} AND "updated_by" = ${userId} RETURNING id, value, created_at, updated_at`,
  )
  const r = (rows as Record<string, unknown>[])[0]
  return r ? rowToConfig(r) : null
}

/**
 * 删除必须**同时**限定 category 与属主。
 *
 * 此前它是裸 id:`DELETE FROM "system_configs" WHERE "id"::text = ${id}` —— 而 `system_configs`
 * 是一整张混装表,库里现读还有 `relay_commission`、`home_schema` 这类**管理员配置**行。
 * 也就是任一登录用户只要拿到(或猜到)一枚 uuid,就能删掉不属于自己、甚至不属于 mcp 族的行。
 * 那条跨面误删路比"读到他人条目"更严重,且与 mcp 族有没有数据无关 —— 所以这一格的修法
 * 不能只加属主,必须把射程收回本族两个 category。
 */
async function configDelete(id: string, userId: string): Promise<boolean> {
  const rows = await db.execute(
    sql`DELETE FROM "system_configs" WHERE "id"::text = ${id} AND "updated_by" = ${userId} AND "category" IN (${MCP_USER_SCOPED_CATEGORIES[0]}, ${MCP_USER_SCOPED_CATEGORIES[1]}) RETURNING id`,
  )
  return (rows as Record<string, unknown>[]).length > 0
}

export const mcpExtendedRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // 1. GET /mcp/projects — 项目列表
  // ==========================================================================
  server.get('/mcp/projects', async (request, reply) => {
    const { userId } = await authenticate(request)
    const q = request.query as { page?: string; pageSize?: string }
    const { page, pageSize } = parsePaging(q)
    try {
      const result = await configList('mcp_project', page, pageSize, userId)
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询 MCP 项目列表失败'))
    }
  })

  // ==========================================================================
  // 2. POST /mcp/projects — 创建项目（CLI mcp-market install 调用）
  // ==========================================================================
  server.post('/mcp/projects', async (request, reply) => {
    const { userId } = await authenticate(request)
    const parsed = projectBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, 'name 为必填项'))
    try {
      const row = await configCreate('mcp_project', parsed.data, userId)
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建 MCP 项目失败'))
    }
  })

  // ==========================================================================
  // 3. GET /mcp/projects/:id — 项目详情
  // ==========================================================================
  server.get('/mcp/projects/:id', async (request, reply) => {
    const { userId } = await authenticate(request)
    const parsed = idParam.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await configById(parsed.data.id, userId)
      if (!row) return reply.status(404).send(error(404, 'MCP 项目不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询 MCP 项目详情失败'))
    }
  })

  // ==========================================================================
  // 4. DELETE /mcp/projects/:id — 删除项目（CLI mcp-market remove 调用）
  // ==========================================================================
  server.delete('/mcp/projects/:id', async (request, reply) => {
    const { userId } = await authenticate(request)
    const parsed = idParam.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const ok = await configDelete(parsed.data.id, userId)
      if (!ok) return reply.status(404).send(error(404, 'MCP 项目不存在'))
      return reply.send(success({ id: parsed.data.id, deleted: ok }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除 MCP 项目失败'))
    }
  })

  // ==========================================================================
  // 5. GET /mcp/projects/:projectId/performance — 性能统计
  // ==========================================================================
  server.get('/mcp/projects/:projectId/performance', async (request, reply) => {
    const { userId } = await authenticate(request)
    const parsed = projectIdParam.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的项目 ID'))
    try {
      const project = await configById(parsed.data.projectId, userId)
      if (!project) return reply.status(404).send(error(404, 'MCP 项目不存在'))
      const stats = (project.stats as Record<string, unknown> | undefined) ?? {}
      return reply.send(
        success({
          projectId: parsed.data.projectId,
          calls: stats.calls ?? 0,
          successCount: stats.successCount ?? 0,
          failCount: stats.failCount ?? 0,
          avgLatencyMs: stats.avgLatencyMs ?? 0,
          lastUsedAt: stats.lastUsedAt ?? null,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询 MCP 项目性能失败'))
    }
  })

  // ==========================================================================
  // 6. GET /mcp/projects/:projectId/use — 使用统计（读，前端 useMcpUse 调用）
  // ==========================================================================
  server.get('/mcp/projects/:projectId/use', async (request, reply) => {
    const { userId } = await authenticate(request)
    const parsed = projectIdParam.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的项目 ID'))
    try {
      const project = await configById(parsed.data.projectId, userId)
      if (!project) return reply.status(404).send(error(404, 'MCP 项目不存在'))
      const stats = (project.stats as Record<string, unknown> | undefined) ?? {}
      return reply.send(
        success({
          projectId: parsed.data.projectId,
          toolCalls:
            (stats.toolCalls as number | undefined) ?? (stats.calls as number | undefined) ?? 0,
          resourceReads: (stats.resourceReads as number | undefined) ?? 0,
          promptsUsed: (stats.promptsUsed as number | undefined) ?? 0,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询 MCP 使用统计失败'))
    }
  })

  // ==========================================================================
  // 7. POST /mcp/projects/:projectId/use — 使用记录（写，累计 stats）
  // ==========================================================================
  server.post('/mcp/projects/:projectId/use', async (request, reply) => {
    const { userId } = await authenticate(request)
    const parsed = projectIdParam.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的项目 ID'))
    const body = (request.body as { success?: boolean; latencyMs?: number } | null) ?? {}
    try {
      const project = await configById(parsed.data.projectId, userId)
      if (!project) return reply.status(404).send(error(404, 'MCP 项目不存在'))
      const stats = (project.stats as Record<string, unknown> | undefined) ?? {}
      const calls = (stats.calls as number | undefined) ?? 0
      const successCount = (stats.successCount as number | undefined) ?? 0
      const failCount = (stats.failCount as number | undefined) ?? 0
      const avgLatencyMs = (stats.avgLatencyMs as number | undefined) ?? 0
      const newCalls = calls + 1
      const ok = body.success !== false
      const newSuccess = ok ? successCount + 1 : successCount
      const newFail = ok ? failCount : failCount + 1
      const newAvg =
        body.latencyMs !== undefined && typeof body.latencyMs === 'number'
          ? Math.round((avgLatencyMs * calls + body.latencyMs) / newCalls)
          : avgLatencyMs
      const updated = await configUpdate(
        parsed.data.projectId,
        {
          stats: {
            calls: newCalls,
            successCount: newSuccess,
            failCount: newFail,
            avgLatencyMs: newAvg,
            lastUsedAt: new Date().toISOString(),
          },
        },
        userId,
      )
      return reply.send(success(updated ?? { recorded: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '记录 MCP 使用失败'))
    }
  })

  // ==========================================================================
  // 8. GET /mcp/integrations — 集成列表
  // ==========================================================================
  server.get('/mcp/integrations', async (request, reply) => {
    const { userId } = await authenticate(request)
    const q = request.query as { page?: string; pageSize?: string }
    const { page, pageSize } = parsePaging(q)
    try {
      const result = await configList('mcp_integration', page, pageSize, userId)
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询 MCP 集成列表失败'))
    }
  })

  // ==========================================================================
  // 9. POST /mcp/integrations — 创建集成（当前无调用方在册,见头注）
  // ==========================================================================
  server.post('/mcp/integrations', async (request, reply) => {
    const { userId } = await authenticate(request)
    const parsed = integrationBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, 'name 为必填项'))
    try {
      const row = await configCreate(
        'mcp_integration',
        {
          ...parsed.data,
          enabled: parsed.data.enabled ?? false,
        },
        userId,
      )
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建 MCP 集成失败'))
    }
  })

  // ==========================================================================
  // 10. DELETE /mcp/integrations/:id — 删除集成（当前无调用方在册,见头注）
  // ==========================================================================
  server.delete('/mcp/integrations/:id', async (request, reply) => {
    const { userId } = await authenticate(request)
    const parsed = idParam.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const ok = await configDelete(parsed.data.id, userId)
      if (!ok) return reply.status(404).send(error(404, 'MCP 集成不存在'))
      return reply.send(success({ id: parsed.data.id, deleted: ok }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除 MCP 集成失败'))
    }
  })

  // ==========================================================================
  // 11. POST /mcp/integrations/:id/toggle — 启用/禁用
  // ==========================================================================
  server.post('/mcp/integrations/:id/toggle', async (request, reply) => {
    const { userId } = await authenticate(request)
    const parsed = idParam.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const existing = await configById(parsed.data.id, userId)
      if (!existing) return reply.status(404).send(error(404, 'MCP 集成不存在'))
      const current = existing.enabled === true
      const updated = await configUpdate(parsed.data.id, { enabled: !current }, userId)
      return reply.send(success(updated ?? { id: parsed.data.id, enabled: !current }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '切换 MCP 集成状态失败'))
    }
  })

  // ==========================================================================
  // 12. POST /mcp/slash-commands/reload — 控制帧 `reload_plugins`
  // ==========================================================================
  // 竞品原帧 `request({type:"reload_plugins"})` 的语义 = 宿主显式调用 + 必须把
  // **重载后的命令列表**回灌给宿主(竞品那句 replaceLatestCommands(e.commands))。
  // 我方插件面的对位物 = 技能贡献的命令集(本仓插件能力以技能形态承载),所以这一帧
  // 走 ai-service 的 `POST /api/mcp/slash-commands/reload`,拿回「最新命令列表 + 技能差额」。
  //
  // 为什么包一层 envelope:ai-service 那一路由返的是裸 JSON(与同文件其它 slash-commands
  // 路由同形),而本仓 api 侧的响应统一是 {code,message,data};api-client 的 fetchApi
  // 两种都吃,但统一包起来才能让端内 `res.data` 拿到形状一致的一份。
  server.post('/mcp/slash-commands/reload', async (request, reply) => {
    await authenticate(request)
    const body = request.body === undefined ? {} : request.body
    try {
      const resp = await aiServiceFetch(request, '/api/mcp/slash-commands/reload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const raw = await resp.text()
      if (!resp.ok) {
        request.log.error(`reload_plugins 上游失败: ${resp.status} ${raw.slice(0, 200)}`)
        return reply.status(502).send(error(502, '插件面重载服务暂不可用'))
      }
      let data: unknown
      try {
        data = JSON.parse(raw)
      } catch {
        return reply.status(502).send(error(502, '插件面重载返回不可解析'))
      }
      return reply.send(success(data))
    } catch (e) {
      request.log.error(e)
      // 与上面 `!resp.ok` 同为「上游这一格失败」,必须给同一个状态码:调用方拿两种码
      // 无从区分也用不上,只会让排障多一层杂音。同族 meta-learner 代理的外层 catch
      // 亦为 502,这里跟着对齐,不另立一套。
      return reply.status(502).send(error(502, '插件面重载服务暂不可用'))
    }
  })

  // ==========================================================================
  // 13. POST /mcp/external/servers/:name/clear-auth — 控制帧 `mcp_clear_auth`
  // ==========================================================================
  // 竞品原帧 `request({type:"mcp_clear_auth", serverName})`:按 serverName 逐台撤回
  // **用户自授权**的 OAuth 凭据(没有「全清」出口)。归属判定在 ai-service 侧
  // (can_mutate:只允许动自己注册的;部署级谁都动不了),本层只做透传 + 状态码映射。
  server.post('/mcp/external/servers/:name/clear-auth', async (request, reply) => {
    await authenticate(request)
    const { name } = request.params as { name: string }
    try {
      const resp = await aiServiceFetch(
        request,
        `/api/mcp/external/servers/${encodeURIComponent(name)}/clear-auth`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.body ?? {}),
        },
      )
      const raw = await resp.text()
      let payload: unknown = raw
      try {
        payload = JSON.parse(raw)
      } catch {
        // 保留原始 text
      }
      if (!resp.ok) {
        const detail =
          payload !== null && typeof payload === 'object' && 'error' in payload
            ? String((payload as { error: unknown }).error)
            : null
        return reply.status(resp.status).send(error(resp.status, detail ?? '清除 MCP 凭据失败'))
      }
      return reply.send(success(payload))
    } catch (e) {
      request.log.error(e)
      // 同族已从 503 收敛到 502:这一格是「连不上 ai-service」,与上面上游非 2xx 同属
      // 代理层失败,给同一个码更好排障(上面的 !resp.ok 会如实透出 403/404,那些才是
      // 「鉴权/归属」的结论,不能被这一格盖掉)。
      return reply.status(502).send(error(502, '清除 MCP 凭据服务暂不可用'))
    }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
