import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { eq, sql } from 'drizzle-orm'
import { existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { db } from '../db/index.js'
import { agents, docs, sdks, aiModelConfig } from '@ihui/database'
import { success } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'

// docs/ 目录路径(开发环境从根目录或 apps/api 启动均可,生产环境 = /app/docs)
const DOCS_DIR = existsSync(join(process.cwd(), 'docs'))
  ? join(process.cwd(), 'docs')
  : join(process.cwd(), '../../docs')

// 文档中心对外可见的白名单(普通用户/匿名可看)。
// 其余 docs/*.md 含生产环境/凭证/守门策略等敏感信息,仅管理员可见。
const PUBLIC_DOC_SLUGS = new Set<string>([
  'AI_LEADERBOARD',
  'AI_SERVICE',
  'API_REFERENCE',
  'architecture',
  'AUTHENTICATION',
  'CHANGELOG',
  'CLI',
  'CONTRIBUTING',
  'DATABASE',
  'FAQ',
  'I18N',
  'MULTI_END',
  'PACKAGES',
  'PERFORMANCE',
  'RELEASE',
  'SDK',
  'SECURITY',
  'TESTING',
  'TROUBLESHOOTING',
  'UI_GUIDELINES',
])

// 从 markdown 内容提取第一个 # 标题
function extractMarkdownTitle(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m)
  if (!match || !match[1]) return fallback
  return match[1].trim()
}

// 从 markdown 内容提取摘要:去掉标题/代码块/链接/图片/表格标记,取前 ~120 字符
function extractExcerpt(content: string): string {
  const lines = content.split('\n')
  const bodyLines: string[] = []
  let inCodeBlock = false
  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue
    // 跳过标题行、引用块、分割线、表格分隔行、空行
    if (/^(#{1,6}\s|>\s|---|\*\*\*|\s*$)/.test(line)) continue
    if (/^\|[\s-:|]+\|?\s*$/.test(line)) continue // 表格分隔行 |---|---|
    bodyLines.push(line)
    if (bodyLines.length >= 3) break
  }
  const text = bodyLines
    .join(' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 链接保留文字
    .replace(/\|/g, ' ') // 表格列分隔符
    .replace(/[*`_~]/g, '') // 强调/代码标记
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > 120 ? text.slice(0, 120) + '…' : text
}

// 可选认证:尝试从 JWT 判定是否管理员(roleId >= 1)。失败/未登录返回 false,不抛错。
async function isAdmin(request: FastifyRequest): Promise<boolean> {
  try {
    const payload = await authenticate(request)
    return (payload.roleId ?? 0) >= 1
  } catch {
    return false
  }
}

// 递归扫描 docs/ 目录下所有 .md 文件,返回相对路径(用 / 分隔)
async function scanDocsRecursive(dir: string, base = ''): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const results: string[] = []
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      results.push(...(await scanDocsRecursive(join(dir, entry.name), rel)))
    } else if (entry.name.endsWith('.md') && entry.name !== 'README.md') {
      results.push(rel)
    }
  }
  return results.sort()
}

// 判断文档是否对普通用户公开:
// - 子目录文档(developer/*, user/*, enterprise-service/*)全部公开(用户指南/开发者文档/企业服务)
// - 顶层文档仅 PUBLIC_DOC_SLUGS 白名单内公开,其余敏感文档仅管理员可见
function isDocPublic(relPath: string): boolean {
  const parts = relPath.split('/')
  if (parts.length > 1) {
    const topDir = parts[0]
    return topDir === 'developer' || topDir === 'user' || topDir === 'enterprise-service'
  }
  return PUBLIC_DOC_SLUGS.has(relPath.replace(/\.md$/, ''))
}

// 从相对路径推导分类(用于前端分组展示)
function deriveCategory(relPath: string): string {
  const parts = relPath.split('/')
  if (parts.length > 1) {
    const topDir = parts[0]
    if (topDir === 'developer') {
      if (parts[1] === 'api') return 'api'
      if (parts[1] === 'getting-started') return 'getting-started'
      if (parts[1] === 'sdk') return 'sdk'
      if (parts[1] === 'integration') return 'integration'
      if (parts[1] === 'incentive-program') return 'incentive-program'
      return 'development'
    }
    if (topDir === 'user') {
      if (parts[1] === 'features') return 'user-feature'
      if (parts[1] === 'getting-started') return 'getting-started'
      if (parts[1] === 'guides') return 'guide'
      return 'user'
    }
    if (topDir === 'enterprise-service') return 'enterprise'
  }
  return 'guide'
}

// 读取 docs/ 下所有 .md 文件列表(递归,运行时直读,合并到文档中心)
// admin=true 返回全部,admin=false 只返回公开文档(子目录全公开 + 顶层白名单)
async function readFileDocs(admin: boolean): Promise<
  Array<{
    id: string
    title: string
    description: string
    excerpt: string
    category: string
    format: 'markdown'
    url: string
    updatedAt: string
  }>
> {
  try {
    const allFiles = await scanDocsRecursive(DOCS_DIR)
    const mdFiles = allFiles.filter((f) => admin || isDocPublic(f))
    return await Promise.all(
      mdFiles.map(async (relPath) => {
        const filePath = join(DOCS_DIR, relPath)
        // slug 用相对路径(去掉 .md),前端通过 slug 请求 content 时还原路径
        const slug = relPath.replace(/\.md$/, '')
        const [content, stats] = await Promise.all([readFile(filePath, 'utf-8'), stat(filePath)])
        return {
          id: `file:${slug}`,
          title: extractMarkdownTitle(content, slug),
          description: '',
          excerpt: extractExcerpt(content),
          category: deriveCategory(relPath),
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
  server.get('/stats', async (request, reply) => {
    try {
      const admin = await isAdmin(request)
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
      const fileDocs = await readFileDocs(admin)
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
  // 普通用户/匿名只看白名单文件,管理员(roleId>=1)看全部
  // -------------------------------------------------------------------------
  server.get('/documents', async (request, reply) => {
    try {
      const admin = await isAdmin(request)
      const [dbRows, fileDocs] = await Promise.all([
        db
          .select({
            id: docs.id,
            title: docs.title,
            category: docs.category,
            slug: docs.slug,
            content: docs.content,
            updatedAt: docs.updatedAt,
          })
          .from(docs)
          .where(eq(docs.status, 'published'))
          .limit(200),
        readFileDocs(admin),
      ])
      const dbList = dbRows.map((r) => ({
        id: r.id,
        title: r.title,
        description: '',
        excerpt: extractExcerpt(r.content ?? ''),
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
  // 文件文档:非管理员只能读公开文件(子目录全公开 + 顶层白名单),管理员可读全部
  // slug 可能含 /(子目录路径),用通配符路由 * 匹配
  // -------------------------------------------------------------------------
  server.get('/documents/*', async (request, reply) => {
    try {
      // Fastify 通配符 * 把 /documents/ 之后的所有路径段放到 request.params['*']
      // 例如 /api/feature-center/documents/developer/api/chat/content → params['*'] = 'developer/api/chat/content'
      const wildcard = (request.params as { '*': string })['*'] ?? ''
      // 必须以 /content 结尾
      const match = wildcard.match(/^(.+)\/content$/)
      if (!match || !match[1]) {
        return reply.code(404).send(success({ content: '', source: 'none' }))
      }
      const rawSlug = match[1]
      // 规范化路径,禁止 .. 和绝对路径(防路径遍历)
      const normalized = rawSlug.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
      if (normalized.includes('..') || normalized.includes('\0')) {
        return reply.code(404).send(success({ content: '', source: 'none' }))
      }
      // 1. 先查 DB docs by slug(只取 basename 部分,DB slug 不含 /)
      const dbSlug = basename(normalized)
      const dbRows = await db
        .select({ content: docs.content })
        .from(docs)
        .where(eq(docs.slug, dbSlug))
        .limit(1)
      if (dbRows.length > 0) {
        return reply.send(success({ content: dbRows[0]?.content ?? '', source: 'db' }))
      }
      // 2. 文件文档:非管理员只能读公开文件
      const relPath = `${normalized}.md`
      if (!isDocPublic(relPath)) {
        const admin = await isAdmin(request)
        if (!admin) {
          return reply.code(404).send(success({ content: '', source: 'none' }))
        }
      }
      const content = await readFile(join(DOCS_DIR, relPath), 'utf-8')
      return reply.send(success({ content, source: 'file' }))
    } catch {
      return reply.code(404).send(success({ content: '', source: 'none' }))
    }
  })

  // -------------------------------------------------------------------------
  // GET /documents/asset/* - 文档图片资源代理
  // markdown 中 ![](./images/xxx.png) 由前端改写为 /api/feature-center/documents/asset/<slug-dir>/images/xxx.png
  // 权限:仅公开子目录(developer/user/enterprise-service)下的资源可匿名访问,
  //      顶层敏感文档目录的图片需管理员(与文档白名单策略一致)
  // -------------------------------------------------------------------------
  const MIME_MAP: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  }
  server.get('/documents/asset/*', async (request, reply) => {
    try {
      const wildcard = (request.params as { '*': string })['*'] ?? ''
      const normalized = wildcard.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
      if (normalized.includes('..') || normalized.includes('\0')) {
        return reply.code(404).send()
      }
      // 权限:子目录公开,顶层需管理员
      const firstSeg = normalized.split('/')[0]
      const isPublicSubdir =
        firstSeg === 'developer' || firstSeg === 'user' || firstSeg === 'enterprise-service'
      if (!isPublicSubdir) {
        const admin = await isAdmin(request)
        if (!admin) return reply.code(404).send()
      }
      // 仅允许图片扩展名
      const ext = normalized.toLowerCase().match(/\.(png|jpe?g|gif|webp|svg)$/)
      if (!ext) return reply.code(404).send()
      const filePath = join(DOCS_DIR, normalized)
      const buf = await readFile(filePath)
      return reply.type(MIME_MAP[`.${ext[1]}`] ?? 'application/octet-stream').send(buf)
    } catch {
      return reply.code(404).send()
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
