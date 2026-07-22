import type { FastifyPluginAsync } from 'fastify'
import { eq, sql } from 'drizzle-orm'
import { existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { db } from '../db/index.js'
import { agents, docs, sdks, aiModelConfig } from '@ihui/database'
import { success } from '../utils/response.js'

// docs/ 目录路径(开发环境从根目录或 apps/api 启动均可,生产环境 = /app/docs)
const DOCS_DIR = existsSync(join(process.cwd(), 'docs'))
  ? join(process.cwd(), 'docs')
  : join(process.cwd(), '../../docs')

// 从 markdown 内容提取第一个 # 标题
function extractMarkdownTitle(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m)
  if (!match || !match[1]) return fallback
  return match[1].trim()
}

// 读取 docs/*.md 文件列表(运行时直读,合并到文档中心)
async function readFileDocs(): Promise<
  Array<{
    id: string
    title: string
    description: string
    category: string
    format: 'markdown'
    url: string
    updatedAt: string
  }>
> {
  try {
    const files = await readdir(DOCS_DIR)
    const mdFiles = files.filter((f) => f.endsWith('.md') && f !== 'README.md')
    return await Promise.all(
      mdFiles.map(async (file) => {
        const slug = file.replace(/\.md$/, '')
        const filePath = join(DOCS_DIR, file)
        const [content, stats] = await Promise.all([readFile(filePath, 'utf-8'), stat(filePath)])
        return {
          id: `file:${slug}`,
          title: extractMarkdownTitle(content, slug),
          description: '',
          category: 'guide',
          format: 'markdown' as const,
          url: '',
          updatedAt: stats.mtime.toISOString(),
        }
      }),
    )
  } catch {
    return []
  }
}

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
      const fileDocs = await readFileDocs()
      const apiCount = apiCountRow[0]?.count ?? 0

      return reply.send(
        success({
          apiCount,
          agentCount: agentRows.length,
          documentCount: docRows.length + fileDocs.length,
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
  // GET /documents - 文档集市列表(合并 DB docs + docs/*.md 工程文档)
  // -------------------------------------------------------------------------
  server.get('/documents', async (_request, reply) => {
    try {
      const [dbRows, fileDocs] = await Promise.all([
        db
          .select({
            id: docs.id,
            title: docs.title,
            category: docs.category,
            slug: docs.slug,
            updatedAt: docs.updatedAt,
          })
          .from(docs)
          .where(eq(docs.status, 'published'))
          .limit(200),
        readFileDocs(),
      ])
      const dbList = dbRows.map((r) => ({
        id: r.id,
        title: r.title,
        description: '',
        category: r.category,
        format: 'markdown' as const,
        url: `/docs/${r.slug}`,
        updatedAt: r.updatedAt ? r.updatedAt.toISOString() : '',
      }))
      // 合并:DB 优先,文件 slug 去重(DB 已有的 slug 不再从文件重复加载)
      const dbSlugs = new Set(dbList.map((d) => d.url.replace('/docs/', '')))
      const merged = [
        ...dbList,
        ...fileDocs.filter((d) => !dbSlugs.has(d.id.replace('file:', ''))),
      ]
      return reply.send(success(merged))
    } catch (e) {
      server.log.error(e)
      return reply.send(success([]))
    }
  })

  // -------------------------------------------------------------------------
  // GET /documents/:slug/content - 返回 markdown 内容(DB 优先,文件兜底)
  // -------------------------------------------------------------------------
  server.get('/documents/:slug/content', async (request, reply) => {
    try {
      const slug = basename((request.params as { slug: string }).slug)
      // 1. 先查 DB docs by slug
      const dbRows = await db
        .select({ content: docs.content })
        .from(docs)
        .where(eq(docs.slug, slug))
        .limit(1)
      if (dbRows.length > 0) {
        return reply.send(success({ content: dbRows[0]?.content ?? '', source: 'db' }))
      }
      // 2. 读 docs/${slug}.md 文件(basename 防 ../ 路径遍历)
      const content = await readFile(join(DOCS_DIR, `${slug}.md`), 'utf-8')
      return reply.send(success({ content, source: 'file' }))
    } catch {
      return reply.code(404).send(success({ content: '', source: 'none' }))
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
