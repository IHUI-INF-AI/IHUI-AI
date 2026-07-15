import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import * as dns from 'node:dns'
import { db } from '../db/index.js'
import { zhsUserAgentContext, docs } from '@ihui/database'
import { success, error } from '../utils/response.js'

const idParamSchema = z.object({ id: z.string().min(1) })

const BLOCKED_HOSTNAMES = new Set(['localhost', 'ip6-localhost', 'metadata.google.internal'])

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false
  }
  const [a = -1, b = -1] = parts
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

function isPrivateIPv6(ip: string): boolean {
  const v = ip.toLowerCase()
  if (v === '::1') return true
  if (v.startsWith('fe80:')) return true
  if (v.startsWith('fc') || v.startsWith('fd')) return true
  return false
}

async function isPrivateOrLoopback(url: string): Promise<boolean> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return true
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (BLOCKED_HOSTNAMES.has(hostname)) return true
  if (hostname.includes(':')) return isPrivateIPv6(hostname)
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return isPrivateIPv4(hostname)
  try {
    const addrs = await dns.promises.lookup(hostname, { all: true })
    if (addrs.length === 0) return true
    for (const { address, family } of addrs) {
      const blocked = family === 6 ? isPrivateIPv6(address) : isPrivateIPv4(address)
      if (blocked) return true
    }
    return false
  } catch {
    return true
  }
}

function parsePaging(q: { page?: string; pageSize?: string }): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(Number(q.page) || 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
  return { page, pageSize }
}

const plugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // -------------------------------------------------------------------------
  // remote — 远程代理配置（存储于 system_configs 表，category='remote_proxy'）
  // -------------------------------------------------------------------------
  const remoteCreateSchema = z.object({
    name: z.string().min(1).max(128),
    url: z.string().url().optional(),
    method: z.string().max(16).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.unknown().optional(),
    description: z.string().nullable().optional(),
  })
  const remoteUpdateSchema = remoteCreateSchema.partial()
  const proxySchema = z.object({
    url: z.string().url(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).default('GET'),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.unknown().optional(),
  })

  server.get('/remote/list', async (req, reply) => {
    const q = req.query as { page?: string; pageSize?: string }
    const { page, pageSize } = parsePaging(q)
    const offset = (page - 1) * pageSize
    try {
      const rows = await db.execute(sql`
        SELECT * FROM system_configs
        WHERE category = 'remote_proxy'
        ORDER BY created_at DESC
        LIMIT ${pageSize} OFFSET ${offset}
      `)
      const countRows = await db.execute(sql`
        SELECT count(*)::int AS count FROM system_configs WHERE category = 'remote_proxy'
      `)
      const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
      return reply.send(success({ list: rows as Record<string, unknown>[], total, page, pageSize }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询远程代理失败'))
    }
  })

  server.get('/remote/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const rows = await db.execute(sql`
        SELECT * FROM system_configs
        WHERE id::text = ${parsed.data.id} AND category = 'remote_proxy'
        LIMIT 1
      `)
      const row = (rows as Record<string, unknown>[])[0]
      if (!row) return reply.status(404).send(error(404, '远程代理不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询远程代理失败'))
    }
  })

  server.post('/remote', async (req, reply) => {
    const b = remoteCreateSchema.safeParse(req.body)
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    const value = JSON.stringify({
      url: b.data.url,
      method: b.data.method,
      headers: b.data.headers,
      body: b.data.body,
    })
    try {
      const rows = await db.execute(sql`
        INSERT INTO system_configs (id, category, key, value, type, description, is_public)
        VALUES (gen_random_uuid(), 'remote_proxy', ${b.data.name}, ${value}, 'json', ${b.data.description ?? null}, false)
        RETURNING *
      `)
      const row = (rows as Record<string, unknown>[])[0]
      if (!row) return reply.status(500).send(error(500, '创建远程代理失败'))
      return reply.status(201).send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建远程代理失败'))
    }
  })

  server.put('/remote/:id', async (req, reply) => {
    const p = idParamSchema.safeParse(req.params)
    if (!p.success) return reply.status(400).send(error(400, '无效的 ID'))
    const b = remoteUpdateSchema.safeParse(req.body)
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    try {
      const existing = await db.execute(sql`
        SELECT * FROM system_configs WHERE id::text = ${p.data.id} AND category = 'remote_proxy' LIMIT 1
      `)
      const existingRow = (existing as Record<string, unknown>[])[0]
      if (!existingRow) return reply.status(404).send(error(404, '远程代理不存在'))
      let oldConfig: Record<string, unknown> = {}
      try {
        oldConfig = JSON.parse((existingRow.value as string) || '{}') as Record<string, unknown>
      } catch {
        oldConfig = {}
      }
      const newValue = JSON.stringify({
        url: b.data.url ?? oldConfig.url,
        method: b.data.method ?? oldConfig.method,
        headers: b.data.headers ?? oldConfig.headers,
        body: b.data.body ?? oldConfig.body,
      })
      const newKey = b.data.name ?? (existingRow.key as string)
      const newDesc =
        b.data.description !== undefined
          ? b.data.description
          : (existingRow.description as string | null)
      const rows = await db.execute(sql`
        UPDATE system_configs
        SET key = ${newKey}, value = ${newValue}, description = ${newDesc}, updated_at = NOW()
        WHERE id::text = ${p.data.id} AND category = 'remote_proxy'
        RETURNING *
      `)
      const row = (rows as Record<string, unknown>[])[0]
      return reply.send(success(row ?? { id: p.data.id, updated: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新远程代理失败'))
    }
  })

  server.delete('/remote/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      await db.execute(sql`
        DELETE FROM system_configs WHERE id::text = ${parsed.data.id} AND category = 'remote_proxy'
      `)
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除远程代理失败'))
    }
  })

  server.post('/remote/proxy', async (req, reply) => {
    const b = proxySchema.safeParse(req.body)
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    const blocked = await isPrivateOrLoopback(b.data.url)
    if (blocked) {
      return reply.status(400).send(error(400, 'URL not allowed: potential SSRF'))
    }
    try {
      const resp = await fetch(b.data.url, {
        method: b.data.method,
        headers: b.data.headers ?? {},
        body:
          b.data.body !== undefined && b.data.method !== 'GET'
            ? JSON.stringify(b.data.body)
            : undefined,
        signal: AbortSignal.timeout(10000),
      })
      const MAX_RESPONSE_BYTES = 10 * 1024 * 1024
      const reader = resp.body?.getReader()
      const chunks: Uint8Array[] = []
      let total = 0
      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            total += value.byteLength
            if (total > MAX_RESPONSE_BYTES) {
              await reader.cancel()
              return reply.status(413).send(error(413, '响应体超过 10MB 限制'))
            }
            chunks.push(value)
          }
        }
      }
      const text = Buffer.concat(chunks).toString('utf-8')
      let respBody: unknown = text
      const ct = resp.headers.get('content-type') || ''
      if (ct.includes('application/json')) {
        try {
          respBody = JSON.parse(text)
        } catch {
          /* keep text */
        }
      }
      return reply.status(resp.status).send(success({ status: resp.status, body: respBody }))
    } catch (e) {
      req.log.error(e)
      return reply
        .status(502)
        .send({ error: 'proxy_failed', message: e instanceof Error ? e.message : String(e) })
    }
  })

  // -------------------------------------------------------------------------
  // user_agent_context — 用户 Agent 上下文（Drizzle schema: zhs_user_agent_context）
  // -------------------------------------------------------------------------
  server.get('/user-agent-context/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      userUuid?: string
      userId?: string
      agentId?: string
      sessionId?: string
    }
    const { page, pageSize } = parsePaging(q)
    const conds = []
    if (q.userUuid) conds.push(eq(zhsUserAgentContext.userUuid, q.userUuid))
    if (q.userId) conds.push(eq(zhsUserAgentContext.userId, q.userId))
    if (q.agentId) conds.push(eq(zhsUserAgentContext.agentId, q.agentId))
    if (q.sessionId) conds.push(eq(zhsUserAgentContext.sessionId, q.sessionId))
    const where = conds.length ? and(...conds) : undefined
    try {
      const [list, totalRows] = await Promise.all([
        db
          .select()
          .from(zhsUserAgentContext)
          .where(where)
          .orderBy(desc(zhsUserAgentContext.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(zhsUserAgentContext)
          .where(where),
      ])
      return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询用户 Agent 上下文失败'))
    }
  })
  server.get('/user-agent-context/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    const numId = Number(parsed.data.id)
    if (!Number.isFinite(numId)) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const rows = await db
        .select()
        .from(zhsUserAgentContext)
        .where(eq(zhsUserAgentContext.id, numId))
        .limit(1)
      if (!rows[0]) return reply.status(404).send(error(404, '上下文记录不存在'))
      return reply.send(success(rows[0]))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询用户 Agent 上下文失败'))
    }
  })
  server.post('/user-agent-context', async (req, reply) => {
    try {
      const rows = await db
        .insert(zhsUserAgentContext)
        .values(req.body as typeof zhsUserAgentContext.$inferInsert)
        .returning()
      return reply.status(201).send(success(rows[0]))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建用户 Agent 上下文失败'))
    }
  })
  server.put('/user-agent-context/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    const numId = Number(parsed.data.id)
    if (!Number.isFinite(numId)) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const rows = await db
        .update(zhsUserAgentContext)
        .set(req.body as Partial<typeof zhsUserAgentContext.$inferInsert>)
        .where(eq(zhsUserAgentContext.id, numId))
        .returning()
      if (!rows[0]) return reply.status(404).send(error(404, '上下文记录不存在'))
      return reply.send(success(rows[0]))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新用户 Agent 上下文失败'))
    }
  })
  server.delete('/user-agent-context/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    const numId = Number(parsed.data.id)
    if (!Number.isFinite(numId)) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      await db.delete(zhsUserAgentContext).where(eq(zhsUserAgentContext.id, numId))
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除用户 Agent 上下文失败'))
    }
  })

  // -------------------------------------------------------------------------
  // docs — 文档路由（Drizzle schema: docs）
  // -------------------------------------------------------------------------
  server.get('/docs/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      category?: string
      status?: string
    }
    const { page, pageSize } = parsePaging(q)
    const conds = []
    if (q.category) conds.push(eq(docs.category, q.category))
    if (q.status) conds.push(eq(docs.status, q.status))
    const where = conds.length ? and(...conds) : undefined
    try {
      const [list, totalRows] = await Promise.all([
        db
          .select()
          .from(docs)
          .where(where)
          .orderBy(desc(docs.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(docs)
          .where(where),
      ])
      return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询文档失败'))
    }
  })
  server.get('/docs/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const rows = await db.select().from(docs).where(eq(docs.id, parsed.data.id)).limit(1)
      if (!rows[0]) return reply.status(404).send(error(404, '文档不存在'))
      return reply.send(success(rows[0]))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询文档失败'))
    }
  })
}

export default plugin
