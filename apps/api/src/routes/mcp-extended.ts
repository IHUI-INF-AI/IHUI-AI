/**
 * MCP 项目管理与集成扩展（6 端点）。
 * 前端 use-mcp.ts / use-mcp-integration.ts 调用但后端缺失。
 *
 * 端点清单：
 * 1. GET  /mcp/projects                  — 项目列表
 * 2. GET  /mcp/projects/:id              — 项目详情
 * 3. GET  /mcp/projects/:projectId/performance — 性能统计
 * 4. POST /mcp/projects/:projectId/use   — 使用记录
 * 5. GET  /mcp/integrations              — 集成列表
 * 6. POST /mcp/integrations/:id/toggle   — 启用/禁用
 *
 * 数据存储：system_configs 表 category='mcp_project' / 'mcp_integration'。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { success, error } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'

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
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
})

function parsePaging(q: { page?: string; pageSize?: string }): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(Number(q.page) || 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
  return { page, pageSize }
}

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

async function configList(
  category: string,
  page: number,
  pageSize: number,
): Promise<{ list: Record<string, unknown>[]; total: number; page: number; pageSize: number }> {
  const offset = (page - 1) * pageSize
  const rows = await db.execute(
    sql`SELECT id, value, created_at, updated_at FROM "system_configs" WHERE "category" = ${category} ORDER BY "created_at" DESC LIMIT ${pageSize} OFFSET ${offset}`,
  )
  const countRows = await db.execute(
    sql`SELECT count(*)::int AS count FROM "system_configs" WHERE "category" = ${category}`,
  )
  const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
  return {
    list: (rows as Record<string, unknown>[]).map(rowToConfig),
    total,
    page,
    pageSize,
  }
}

async function configById(id: string): Promise<Record<string, unknown> | null> {
  const rows = await db.execute(
    sql`SELECT id, value, created_at, updated_at FROM "system_configs" WHERE "id"::text = ${id} LIMIT 1`,
  )
  const r = (rows as Record<string, unknown>[])[0]
  return r ? rowToConfig(r) : null
}

async function configCreate(
  category: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const id = crypto.randomUUID()
  const value = JSON.stringify(body)
  const rows = await db.execute(
    sql`INSERT INTO "system_configs" (id, key, value, type, category) VALUES (${id}, ${id}, ${value}, ${'json'}, ${category}) RETURNING id, value, created_at, updated_at`,
  )
  const r = (rows as Record<string, unknown>[])[0]
  if (!r) return { id, ...body }
  return rowToConfig(r)
}

async function configUpdate(
  id: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const existing = await db.execute(
    sql`SELECT value FROM "system_configs" WHERE "id"::text = ${id} LIMIT 1`,
  )
  const exRow = (existing as Record<string, unknown>[])[0]
  if (!exRow) return null
  const merged = { ...parseJSONValue(exRow.value), ...body }
  const rows = await db.execute(
    sql`UPDATE "system_configs" SET "value" = ${JSON.stringify(merged)}, "updated_at" = NOW() WHERE "id"::text = ${id} RETURNING id, value, created_at, updated_at`,
  )
  const r = (rows as Record<string, unknown>[])[0]
  return r ? rowToConfig(r) : null
}

export const mcpExtendedRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // 1. GET /mcp/projects — 项目列表
  // ==========================================================================
  server.get('/mcp/projects', async (request, reply) => {
    await authenticate(request)
    const q = request.query as { page?: string; pageSize?: string }
    const { page, pageSize } = parsePaging(q)
    try {
      const result = await configList('mcp_project', page, pageSize)
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询 MCP 项目列表失败'))
    }
  })

  // POST /mcp/projects — 创建项目（前端 use-mcp.ts 调用）
  server.post('/mcp/projects', async (request, reply) => {
    await authenticate(request)
    const parsed = projectBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, 'name 为必填项'))
    try {
      const row = await configCreate('mcp_project', parsed.data)
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建 MCP 项目失败'))
    }
  })

  // ==========================================================================
  // 2. GET /mcp/projects/:id — 项目详情
  // ==========================================================================
  server.get('/mcp/projects/:id', async (request, reply) => {
    await authenticate(request)
    const parsed = idParam.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await configById(parsed.data.id)
      if (!row) return reply.status(404).send(error(404, 'MCP 项目不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询 MCP 项目详情失败'))
    }
  })

  // ==========================================================================
  // 3. GET /mcp/projects/:projectId/performance — 性能统计
  // ==========================================================================
  server.get('/mcp/projects/:projectId/performance', async (request, reply) => {
    await authenticate(request)
    const parsed = projectIdParam.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的项目 ID'))
    try {
      const project = await configById(parsed.data.projectId)
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
  // 4. POST /mcp/projects/:projectId/use — 使用记录（累计 stats.calls）
  // ==========================================================================
  server.post('/mcp/projects/:projectId/use', async (request, reply) => {
    await authenticate(request)
    const parsed = projectIdParam.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的项目 ID'))
    const body = (request.body as { success?: boolean; latencyMs?: number } | null) ?? {}
    try {
      const project = await configById(parsed.data.projectId)
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
      const updated = await configUpdate(parsed.data.projectId, {
        stats: {
          calls: newCalls,
          successCount: newSuccess,
          failCount: newFail,
          avgLatencyMs: newAvg,
          lastUsedAt: new Date().toISOString(),
        },
      })
      return reply.send(success(updated ?? { recorded: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '记录 MCP 使用失败'))
    }
  })

  // ==========================================================================
  // 5. GET /mcp/integrations — 集成列表
  // ==========================================================================
  server.get('/mcp/integrations', async (request, reply) => {
    await authenticate(request)
    const q = request.query as { page?: string; pageSize?: string }
    const { page, pageSize } = parsePaging(q)
    try {
      const result = await configList('mcp_integration', page, pageSize)
      return reply.send(success(result))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询 MCP 集成列表失败'))
    }
  })

  // POST /mcp/integrations — 创建集成（前端 use-mcp-integration.ts 调用）
  server.post('/mcp/integrations', async (request, reply) => {
    await authenticate(request)
    const parsed = integrationBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, 'name 为必填项'))
    try {
      const row = await configCreate('mcp_integration', {
        ...parsed.data,
        enabled: parsed.data.enabled ?? false,
      })
      return reply.status(201).send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '创建 MCP 集成失败'))
    }
  })

  // ==========================================================================
  // 6. POST /mcp/integrations/:id/toggle — 启用/禁用
  // ==========================================================================
  server.post('/mcp/integrations/:id/toggle', async (request, reply) => {
    await authenticate(request)
    const parsed = idParam.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const existing = await configById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, 'MCP 集成不存在'))
      const current = existing.enabled === true
      const updated = await configUpdate(parsed.data.id, { enabled: !current })
      return reply.send(success(updated ?? { id: parsed.data.id, enabled: !current }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '切换 MCP 集成状态失败'))
    }
  })
}
