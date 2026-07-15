import type { FastifyPluginAsync } from 'fastify'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { agents, docs, sdks, aiModelConfig } from '@ihui/database'
import { success } from '../utils/response.js'

/**
 * Feature Center 开放平台聚合路由。
 * 提供集市概览统计 + 5 个集市列表（API/Agent/文档/模型/SDK）。
 * 数据来源于现有业务表，做字段映射后返回前端期望的结构。
 */
export const featureCenterRoutes: FastifyPluginAsync = async (server) => {
  // -------------------------------------------------------------------------
  // GET /stats - 集市概览统计
  // -------------------------------------------------------------------------
  server.get('/stats', async (_request, reply) => {
    try {
      const [apiCountRow, agentRows, docRows, sdkRows] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(aiModelConfig)
          .where(eq(aiModelConfig.enabled, true)),
        db
          .select({ agentId: agents.agentId })
          .from(agents)
          .where(eq(agents.status, 'published'))
          .limit(1000),
        db.select({ id: docs.id }).from(docs).where(eq(docs.status, 'published')).limit(1000),
        db.select({ id: sdks.id }).from(sdks).where(eq(sdks.status, 'active')).limit(1000),
      ])
      const apiCount = apiCountRow[0]?.count ?? 0

      return reply.send(
        success({
          apiCount,
          agentCount: agentRows.length,
          documentCount: docRows.length,
          modelCount: apiCount,
          sdkCount: sdkRows.length,
        }),
      )
    } catch (e) {
      server.log.error(e)
      return reply.send(
        success({
          apiCount: 0,
          agentCount: 0,
          documentCount: 0,
          modelCount: 0,
          sdkCount: 0,
        }),
      )
    }
  })

  // -------------------------------------------------------------------------
  // GET /apis - API 集市列表
  // -------------------------------------------------------------------------
  server.get('/apis', async (_request, reply) => {
    try {
      const rows = await db
        .select({
          id: aiModelConfig.id,
          name: aiModelConfig.name,
          description: aiModelConfig.description,
          version: aiModelConfig.providerCode,
          category: aiModelConfig.apiFormat,
        })
        .from(aiModelConfig)
        .where(eq(aiModelConfig.enabled, true))
        .limit(200)
      const list = rows.map((r) => ({
        id: String(r.id),
        name: r.name,
        description: r.description ?? '',
        version: r.version,
        category: r.category,
        endpoints: [],
      }))
      return reply.send(success(list))
    } catch (e) {
      server.log.error(e)
      return reply.send(success([]))
    }
  })

  // -------------------------------------------------------------------------
  // GET /agents - Agent 集市列表
  // -------------------------------------------------------------------------
  server.get('/agents', async (_request, reply) => {
    try {
      const rows = await db
        .select({
          agentId: agents.agentId,
          name: agents.name,
          description: agents.description,
          agentModel: agents.agentModel,
        })
        .from(agents)
        .where(eq(agents.status, 'published'))
        .limit(200)
      const list = rows.map((r) => ({
        id: r.agentId,
        name: r.name,
        description: r.description ?? '',
        category: r.agentModel ?? '对话',
        capabilities: r.agentModel ? [r.agentModel] : [],
      }))
      return reply.send(success(list))
    } catch (e) {
      server.log.error(e)
      return reply.send(success([]))
    }
  })

  // -------------------------------------------------------------------------
  // GET /documents - 文档集市列表
  // -------------------------------------------------------------------------
  server.get('/documents', async (_request, reply) => {
    try {
      const rows = await db
        .select({
          id: docs.id,
          title: docs.title,
          category: docs.category,
          slug: docs.slug,
          updatedAt: docs.updatedAt,
        })
        .from(docs)
        .where(eq(docs.status, 'published'))
        .limit(200)
      const list = rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: '',
        category: r.category,
        format: 'markdown' as const,
        url: `/docs/${r.slug}`,
        updatedAt: r.updatedAt ? r.updatedAt.toISOString() : '',
      }))
      return reply.send(success(list))
    } catch (e) {
      server.log.error(e)
      return reply.send(success([]))
    }
  })

  // -------------------------------------------------------------------------
  // GET /models - 模型集市列表
  // -------------------------------------------------------------------------
  server.get('/models', async (_request, reply) => {
    try {
      const rows = await db
        .select({
          id: aiModelConfig.id,
          name: aiModelConfig.name,
          providerCode: aiModelConfig.providerCode,
          description: aiModelConfig.description,
        })
        .from(aiModelConfig)
        .where(eq(aiModelConfig.enabled, true))
        .limit(200)
      const list = rows.map((r) => ({
        id: String(r.id),
        name: r.name,
        provider: r.providerCode,
        description: r.description ?? '',
        capabilities: [],
        inputPrice: 0,
        outputPrice: 0,
        contextLength: 0,
      }))
      return reply.send(success(list))
    } catch (e) {
      server.log.error(e)
      return reply.send(success([]))
    }
  })

  // -------------------------------------------------------------------------
  // GET /sdks - SDK 集市列表
  // -------------------------------------------------------------------------
  server.get('/sdks', async (_request, reply) => {
    try {
      const rows = await db
        .select({
          id: sdks.id,
          name: sdks.name,
          language: sdks.language,
          version: sdks.version,
          description: sdks.description,
          downloadUrl: sdks.downloadUrl,
          documentationUrl: sdks.documentationUrl,
        })
        .from(sdks)
        .where(eq(sdks.status, 'active'))
        .limit(200)
      const list = rows.map((r) => ({
        id: r.id,
        name: r.name,
        language: r.language,
        version: r.version,
        description: r.description ?? '',
        downloadUrl: r.downloadUrl ?? '',
        docsUrl: r.documentationUrl ?? '',
      }))
      return reply.send(success(list))
    } catch (e) {
      server.log.error(e)
      return reply.send(success([]))
    }
  })
}
