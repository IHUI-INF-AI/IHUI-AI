// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { eq, sql } from 'drizzle-orm'
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join, resolve, sep } from 'node:path'
import { db } from '../db/index.js'
import { agents, docs, sdks, aiModelConfig, users } from '@ihui/database'
import { success } from '../utils/response.js'
import { AppError } from '../errors/AppError.js'
import { authenticate } from '../plugins/auth.js'
import { canonicalMimeOfExtension } from '../utils/file-type-validator.js'
import { fetchProviderHealth, isProviderHardUnavailable } from '../lib/llm-provider-health.js'

// docs/ 目录路径(开发环境从根目录或 apps/api 启动均可,生产环境 = /app/docs)
const DOCS_DIR = existsSync(join(process.cwd(), 'docs'))
  ? join(process.cwd(), 'docs')
  : join(process.cwd(), '../../docs')

/**
 * 文档批注存储目录(2026-11-27 立)。
 *
 * 刻意放 docs/ 之外:文档中心的 scanDocsRecursive 会扫到 json,落进 docs/.annotations
 * 会把批注内容当“文档”列出来。data/ 不在任何 public 文件白名单内,后续迁 DB 时也只换
 * 这一层读写实现,API/前端契约不变。文件按 documentId 的 sha256 命名,不拼用户路径。
 */
const ANNOTATIONS_DIR = resolve(DOCS_DIR, '..', 'data', 'document-annotations')

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

// 递归扫描 docs/ 目录,返回相对路径(用 / 分隔);accept 决定哪些文件名收进结果
async function scanDocsRecursive(
  dir: string,
  base: string,
  accept: (name: string) => boolean,
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const results: string[] = []
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      results.push(...(await scanDocsRecursive(join(dir, entry.name), rel, accept)))
    } else if (accept(entry.name)) {
      results.push(rel)
    }
  }
  return results.sort()
}

// 文档中心可浏览的非 Markdown 文件档(办公/表格/文本/图片/归档)。
// 刻意不收源码脚本(mjs/sh/ts 等):它们是仓库工具,不是文档中心的"文件"。
const DOC_FILE_EXTS: ReadonlySet<string> = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'odt',
  'ods',
  'odp',
  'rtf',
  'epub',
  'csv',
  'tsv',
  'txt',
  'json',
  'html',
  'htm',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'svg',
  'avif',
  'mp3',
  'm4a',
  'wav',
  'aac',
  'flac',
  'ogg',
  'mp4',
  'webm',
  'mov',
  'm4v',
  'glb',
  'gltf',
  'obj',
  'stl',
  'log',
  'jsonl',
  'zip',
])

/** 小写无点扩展名(文件名无点 ⇒ 空串)。 */
function extOfName(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/** 文件档 → 文档中心列表的 format 徽章(与 apps/web 的 previewKindOf 同义,只做展示分组)。 */
function docFormatOf(
  ext: string,
): 'pdf' | 'office' | 'delimited' | 'text' | 'image' | 'audio' | 'video' | 'three' | 'download' {
  if (ext === 'pdf') return 'pdf'
  if (
    ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'epub'].includes(ext)
  ) {
    return 'office'
  }
  if (ext === 'csv' || ext === 'tsv') return 'delimited'
  if (['txt', 'json', 'jsonl', 'log', 'html', 'htm'].includes(ext)) return 'text'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(ext)) return 'image'
  if (['mp3', 'm4a', 'wav', 'aac', 'flac'].includes(ext)) return 'audio'
  if (['mp4', 'webm', 'ogg', 'mov', 'm4v'].includes(ext)) return 'video'
  if (['glb', 'gltf', 'obj', 'stl'].includes(ext)) return 'three'
  return 'download'
}

/** 文件档 Content-Type:已登记档走上表白名单的 canonical MIME,svg/html 单独兜底。 */
function docMimeOf(ext: string): string {
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'avif') return 'image/avif'
  if (ext === 'html' || ext === 'htm') return 'text/plain; charset=utf-8'
  return canonicalMimeOfExtension(ext) ?? 'application/octet-stream'
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
  const lastDot = relPath.lastIndexOf('.')
  const slug = lastDot > 0 ? relPath.slice(0, lastDot) : relPath
  return PUBLIC_DOC_SLUGS.has(slug)
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

// 读取 docs/ 下可浏览的文件列表(递归,运行时直读,合并到文档中心)
// Markdown 按正文索引;其余文档型文件(pdf/office/表格/文本/图片/归档)按文件直出,
// 前端用同一套 UniversalFilePreview 预览。
// admin=true 返回全部,admin=false 只返回公开文档(子目录全公开 + 顶层白名单)
type DocListFormat =
  | 'markdown'
  | 'pdf'
  | 'office'
  | 'delimited'
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'three'
  | 'download'

interface DocListItem {
  id: string
  title: string
  description: string
  excerpt: string
  category: string
  format: DocListFormat
  url: string
  updatedAt: string
}

async function readFileDocs(admin: boolean): Promise<DocListItem[]> {
  try {
    const [mdFiles, docFiles] = await Promise.all([
      scanDocsRecursive(DOCS_DIR, '', (name) => name.endsWith('.md') && name !== 'README.md'),
      scanDocsRecursive(DOCS_DIR, '', (name) => DOC_FILE_EXTS.has(extOfName(name))),
    ])
    const visibleMd = mdFiles.filter((f) => admin || isDocPublic(f))
    const visibleDocs = docFiles.filter((f) => admin || isDocPublic(f))

    const mdItems = await Promise.all(
      visibleMd.map(async (relPath): Promise<DocListItem | null> => {
        try {
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
            format: 'markdown',
            url: '',
            updatedAt: stats.mtime.toISOString(),
          }
        } catch {
          return null
        }
      }),
    )

    const fileItems = await Promise.all(
      visibleDocs.map(async (relPath): Promise<DocListItem | null> => {
        try {
          const stats = await stat(join(DOCS_DIR, relPath))
          const ext = extOfName(basename(relPath))
          return {
            id: `file:${relPath}`,
            title: basename(relPath).replace(/\.[^.]+$/, ''),
            description: relPath,
            excerpt: '',
            category: deriveCategory(relPath),
            format: docFormatOf(ext),
            url: `/api/feature-center/documents/file/${relPath
              .split('/')
              .map(encodeURIComponent)
              .join('/')}`,
            updatedAt: stats.mtime.toISOString(),
          }
        } catch {
          return null
        }
      }),
    )

    return [...mdItems, ...fileItems].filter((item): item is DocListItem => item !== null)
  } catch {
    return []
  }
}

/**
 * 文档批注持久化(2026-11-27 立,接 D91 四类锚点)。
 *
 * 先做“可直接协作”的服务端落盘:同一 documentId 下所有登录用户共享线程,
 * 支持主批注 + 回复 + resolved 状态。当前用 data/document-annotations/<sha256>.json
 * 作为单实例真相;契约保持稳定,后续换 Postgres 时只改 read/write。
 * 文档权限仍按 docs 的公共/管理员边界判定,不能借批注接口读 compliance 材料。
 */
type DocumentAnnotationStatus = 'open' | 'resolved'

interface StoredDocumentAnnotation {
  id: string
  parentId: string | null
  userId: string
  author: string
  body: string
  label: string
  anchorKind: string | null
  anchor: Record<string, unknown> | null
  excerpt: string | null
  status: DocumentAnnotationStatus
  /** human = 人工批注;ai = AI 预审官结论。旧数据缺省按 human。 */
  origin?: 'human' | 'ai'
  /** AI 预审去重键;同一文档同一位置同一结论不重复落库。 */
  aiKey?: string
  createdAt: string
  updatedAt: string
}

interface DocumentAnnotationStore {
  version: 1
  documentId: string
  annotations: StoredDocumentAnnotation[]
}

interface DocumentAnnotationDto extends Omit<StoredDocumentAnnotation, 'userId'> {
  documentId: string
}

function annotationFilePath(documentId: string): string {
  const digest = createHash('sha256').update(documentId).digest('hex')
  return join(ANNOTATIONS_DIR, `${digest}.json`)
}

async function readAnnotationStore(documentId: string): Promise<DocumentAnnotationStore> {
  const file = annotationFilePath(documentId)
  try {
    const raw = JSON.parse(await readFile(file, 'utf8')) as Partial<DocumentAnnotationStore>
    if (!Array.isArray(raw.annotations)) throw new Error('invalid annotation store')
    return {
      version: 1,
      documentId,
      annotations: raw.annotations.filter(
        (item): item is StoredDocumentAnnotation =>
          !!item &&
          typeof item === 'object' &&
          typeof item.id === 'string' &&
          typeof item.body === 'string' &&
          (item.status === 'open' || item.status === 'resolved'),
      ),
    }
  } catch (error) {
    // 只把“文件还不存在”当作空线程；解析失败/权限/磁盘错误必须上报，
    // 否则一次写入会把损坏文件静默覆盖成空线程，等于丢光历史批注。
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { version: 1, documentId, annotations: [] }
    }
    throw error
  }
}

async function writeAnnotationStore(store: DocumentAnnotationStore): Promise<void> {
  await mkdir(ANNOTATIONS_DIR, { recursive: true })
  const file = annotationFilePath(store.documentId)
  const temp = `${file}.${randomUUID()}.tmp`
  await writeFile(temp, JSON.stringify(store), 'utf8')
  try {
    await rename(temp, file)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    // Windows 上目标已存在时 rename 可能拒绝覆盖;只对这一档删旧后重试一次。
    if (code !== 'EEXIST' && code !== 'EPERM') throw error
    await rm(file, { force: true })
    await rename(temp, file)
  }
}

// 同一 documentId 的读改写必须串行；否则两个用户同时批注会各自读到旧数组，
// 后写覆盖先写，表现为“刚发的评论消失”。多实例部署时仍应迁移到数据库事务。
const annotationLocks = new Map<string, Promise<void>>()

async function withAnnotationLock<T>(documentId: string, task: () => Promise<T>): Promise<T> {
  const previous = annotationLocks.get(documentId) ?? Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const queued = previous.then(
    () => gate,
    () => gate,
  )
  annotationLocks.set(documentId, queued)
  await previous.catch(() => undefined)
  try {
    return await task()
  } finally {
    release()
    if (annotationLocks.get(documentId) === queued) annotationLocks.delete(documentId)
  }
}

function toAnnotationDto(
  documentId: string,
  annotation: StoredDocumentAnnotation,
): DocumentAnnotationDto {
  const { userId: _userId, ...rest } = annotation
  return { ...rest, documentId }
}

async function authorOf(userId: string): Promise<string> {
  try {
    const rows = await db
      .select({ nickname: users.nickname, username: users.username })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    const row = rows[0]
    return row?.nickname?.trim() || row?.username?.trim() || '用户'
  } catch {
    return '用户'
  }
}

async function requireDocumentUser(
  request: FastifyRequest,
): Promise<{ userId: string; roleId: number }> {
  const payload = await authenticate(request)
  if (!payload.userId) throw new AppError('请先登录', 401, 'UNAUTHORIZED')
  return { userId: payload.userId, roleId: payload.roleId ?? 0 }
}

function requireDocumentId(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) {
    throw new AppError('documentId 无效', 400, 'INVALID_DOCUMENT_ID')
  }
  if (!value.startsWith('file:') && !value.startsWith('doc:')) {
    throw new AppError('documentId 无效', 400, 'INVALID_DOCUMENT_ID')
  }
  if (value.startsWith('file:')) {
    const relPath = value.slice(5)
    if (!relPath || relPath.startsWith('/') || relPath.includes('..')) {
      throw new AppError('documentId 无效', 400, 'INVALID_DOCUMENT_ID')
    }
  }
  return value
}

/** 文档本身不在公共白名单时,只有管理员能读写其批注。 */
async function assertDocumentReadable(documentId: string, roleId: number): Promise<void> {
  if (!documentId.startsWith('file:')) return
  const relPath = documentId.slice(5)
  if (!isDocPublic(relPath) && roleId < 1) {
    throw new AppError('无权访问该文档', 403, 'DOCUMENT_FORBIDDEN')
  }
}

function trimmedText(value: unknown, field: string, max: number, required = true): string {
  if (value === undefined || value === null) {
    if (required) throw new AppError(`${field}不能为空`, 400, 'VALIDATION_FAILED')
    return ''
  }
  if (typeof value !== 'string') throw new AppError(`${field}格式错误`, 400, 'VALIDATION_FAILED')
  const text = value.trim()
  if (required && !text) throw new AppError(`${field}不能为空`, 400, 'VALIDATION_FAILED')
  if (text.length > max) throw new AppError(`${field}超长`, 400, 'VALIDATION_FAILED')
  return text
}

function optionalAnchor(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('anchor 格式错误', 400, 'VALIDATION_FAILED')
  }
  const anchor = value as Record<string, unknown>
  if (JSON.stringify(anchor).length > 8000) {
    throw new AppError('anchor 超长', 400, 'VALIDATION_FAILED')
  }
  return anchor
}

/**
 * Feature Center 开放平台聚合路由。
 * 提供集市概览统计 + 5 个集市列表（API/Agent/文档/模型/SDK）。
 * 数据来源于现有业务表，做字段映射后返回前端期望的结构。
 */
export const featureCenterRoutes: FastifyPluginAsync = async (server) => {
  // -------------------------------------------------------------------------
  // 文档批注 / 评论线程(必须先于 /documents/* 通配注册,Fastify 静态段优先,
  // 但把静态路由靠前可以让读代码的人也一眼看到边界)。
  // -------------------------------------------------------------------------
  server.get('/documents/annotations', async (request, reply) => {
    const { roleId } = await requireDocumentUser(request)
    const query = request.query as { documentId?: unknown }
    const documentId = requireDocumentId(query.documentId)
    await assertDocumentReadable(documentId, roleId)
    const store = await readAnnotationStore(documentId)
    return reply.send(success(store.annotations.map((item) => toAnnotationDto(documentId, item))))
  })

  server.post('/documents/annotations', async (request, reply) => {
    const { userId, roleId } = await requireDocumentUser(request)
    const body = (request.body ?? {}) as Record<string, unknown>
    const documentId = requireDocumentId(body.documentId)
    await assertDocumentReadable(documentId, roleId)

    const text = trimmedText(body.body, '批注内容', 4000)
    const label = trimmedText(body.label, '批注位置', 200, false)
    const excerpt = trimmedText(body.excerpt, '引用文本', 2000, false)
    const anchor = optionalAnchor(body.anchor)
    const anchorKind =
      anchor && typeof anchor.kind === 'string'
        ? anchor.kind
        : trimmedText(body.anchorKind, '锚点类型', 24, false) || null
    const parentIdInput =
      body.parentId === undefined || body.parentId === null
        ? null
        : trimmedText(body.parentId, '父批注', 64)

    const annotation = await withAnnotationLock(documentId, async () => {
      const store = await readAnnotationStore(documentId)
      let parentId: string | null = null
      if (parentIdInput) {
        const parent = store.annotations.find((item) => item.id === parentIdInput)
        if (!parent) throw new AppError('父批注不存在', 404, 'ANNOTATION_NOT_FOUND')
        // 回复统一挂到线程根,避免前端拿到三层树还要递归。
        parentId = parent.parentId ?? parent.id
      }

      const now = new Date().toISOString()
      const created: StoredDocumentAnnotation = {
        id: randomUUID(),
        parentId,
        userId,
        author: await authorOf(userId),
        body: text,
        label: parentId ? '' : label,
        anchorKind: parentId ? null : anchorKind,
        anchor: parentId ? null : anchor,
        excerpt: parentId ? null : excerpt || null,
        status: 'open',
        origin: 'human',
        createdAt: now,
        updatedAt: now,
      }
      store.annotations.push(created)
      await writeAnnotationStore(store)
      return created
    })
    return reply.send(success(toAnnotationDto(documentId, annotation)))
  })

  /**
   * AI 预审官落库:接收已在服务端结构化校验过的 findings,按 位置 + 结论 去重。
   * 故意不信任客户端的 author/userId,AI 线程统一署名,且 origin=ai 方便侧栏识别。
   */
  server.post('/documents/annotations/ai', async (request, reply) => {
    const { userId, roleId } = await requireDocumentUser(request)
    const body = (request.body ?? {}) as Record<string, unknown>
    const documentId = requireDocumentId(body.documentId)
    await assertDocumentReadable(documentId, roleId)

    const label = trimmedText(body.label, '批注位置', 200, false)
    const anchor = optionalAnchor(body.anchor)
    const anchorKind =
      anchor && typeof anchor.kind === 'string'
        ? anchor.kind
        : trimmedText(body.anchorKind, '锚点类型', 24, false) || null
    if (!anchor) throw new AppError('AI 预审缺少锚点', 400, 'VALIDATION_FAILED')

    const findingsInput = body.findings
    if (!Array.isArray(findingsInput) || findingsInput.length === 0 || findingsInput.length > 5) {
      throw new AppError('findings 数量无效', 400, 'VALIDATION_FAILED')
    }
    const findings = findingsInput.map((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new AppError(`findings[${index}] 格式错误`, 400, 'VALIDATION_FAILED')
      }
      const value = item as Record<string, unknown>
      const title = trimmedText(value.title, `findings[${index}].title`, 80)
      const detail = trimmedText(value.detail, `findings[${index}].detail`, 1000)
      const evidence = trimmedText(value.evidence, `findings[${index}].evidence`, 300, false)
      const suggestion = trimmedText(value.suggestion, `findings[${index}].suggestion`, 600, false)
      const severity =
        value.severity === 'high' || value.severity === 'medium' || value.severity === 'low'
          ? value.severity
          : 'medium'
      return { title, detail, evidence, suggestion, severity }
    })

    const created = await withAnnotationLock(documentId, async () => {
      const store = await readAnnotationStore(documentId)
      const now = new Date().toISOString()
      const rows: StoredDocumentAnnotation[] = []
      for (const finding of findings) {
        const aiKey = createHash('sha256')
          .update(
            JSON.stringify({
              documentId,
              anchorKind,
              anchor,
              title: finding.title,
              detail: finding.detail,
            }),
          )
          .digest('hex')
        if (store.annotations.some((item) => item.aiKey === aiKey)) continue
        const bodyText = [
          `${finding.severity === 'high' ? '【高】' : finding.severity === 'low' ? '【低】' : '【中】'}${finding.title}`,
          finding.detail,
          finding.evidence ? `证据: ${finding.evidence}` : '',
          finding.suggestion ? `建议: ${finding.suggestion}` : '',
        ]
          .filter(Boolean)
          .join('\n\n')
        const row: StoredDocumentAnnotation = {
          id: randomUUID(),
          parentId: null,
          userId,
          author: 'AI 审阅官',
          body: bodyText,
          label,
          anchorKind,
          anchor,
          excerpt: finding.evidence || null,
          status: 'open',
          origin: 'ai',
          aiKey,
          createdAt: now,
          updatedAt: now,
        }
        store.annotations.push(row)
        rows.push(row)
      }
      if (rows.length > 0) await writeAnnotationStore(store)
      return { rows, skipped: findings.length - rows.length }
    })

    return reply.send(
      success({
        created: created.rows.map((item) => toAnnotationDto(documentId, item)),
        skipped: created.skipped,
      }),
    )
  })

  server.patch('/documents/annotations/:id', async (request, reply) => {
    const { userId, roleId } = await requireDocumentUser(request)
    const params = request.params as { id?: string }
    const body = (request.body ?? {}) as Record<string, unknown>
    const documentId = requireDocumentId(body.documentId)
    await assertDocumentReadable(documentId, roleId)
    const id = trimmedText(params.id, '批注 id', 64)
    const status = body.status
    if (status !== 'open' && status !== 'resolved') {
      throw new AppError('状态无效', 400, 'VALIDATION_FAILED')
    }

    const updated = await withAnnotationLock(documentId, async () => {
      const store = await readAnnotationStore(documentId)
      const target = store.annotations.find((item) => item.id === id)
      if (!target) throw new AppError('批注不存在', 404, 'ANNOTATION_NOT_FOUND')
      if (target.parentId) throw new AppError('只能处理主批注', 400, 'VALIDATION_FAILED')
      if (target.userId !== userId && roleId < 1) {
        throw new AppError('无权修改该批注', 403, 'ANNOTATION_FORBIDDEN')
      }
      target.status = status
      target.updatedAt = new Date().toISOString()
      await writeAnnotationStore(store)
      return target
    })
    return reply.send(success(toAnnotationDto(documentId, updated)))
  })

  server.delete('/documents/annotations/:id', async (request, reply) => {
    const { userId, roleId } = await requireDocumentUser(request)
    const params = request.params as { id?: string }
    const body = (request.body ?? {}) as Record<string, unknown>
    const documentId = requireDocumentId(body.documentId)
    await assertDocumentReadable(documentId, roleId)
    const id = trimmedText(params.id, '批注 id', 64)

    await withAnnotationLock(documentId, async () => {
      const store = await readAnnotationStore(documentId)
      const target = store.annotations.find((item) => item.id === id)
      if (!target) throw new AppError('批注不存在', 404, 'ANNOTATION_NOT_FOUND')
      if (target.userId !== userId && roleId < 1) {
        throw new AppError('无权删除该批注', 403, 'ANNOTATION_FORBIDDEN')
      }
      // 删回复只删这一条；删主批注才把整条线程(所有回复)一起清掉。
      store.annotations = target.parentId
        ? store.annotations.filter((item) => item.id !== target.id)
        : store.annotations.filter((item) => item.id !== target.id && item.parentId !== target.id)
      await writeAnnotationStore(store)
    })
    return reply.send(success({ id }))
  })

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
      // DB 只承载运营录入的 markdown;仓库文件档不依赖数据库。此前 Promise.all
      // 在 DB 不可用时整段 catch 成空列表,会把 docs/ 下的 PDF/Office/图片一起藏掉。
      const dbQuery = db
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
        .limit(200)
      const [dbRows, files] = await Promise.all([
        Promise.resolve(dbQuery).then(
          (rows) => rows,
          (reason: unknown) => {
            server.log.warn({ err: reason }, '[feature-center] DB 文档查询失败,仅返回文件档')
            return null
          },
        ),
        readFileDocs(admin),
      ])
      const dbList = (dbRows ?? []).map((r) => ({
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
      const merged = [...dbList, ...files.filter((d) => !dbSlugs.has(d.id.replace('file:', '')))]
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
      // 2026-10-27 安全加固:两个洞一并堵死 ——
      //   ① 原实现只要 **basename** 命中就直接返回,于是任意子路径(如
      //      /documents/x/PRODUCTION_SECRETS/content)都能读到顶层敏感文档,
      //      绕开下方 PUBLIC_DOC_SLUGS 白名单;现要求整条路径就是单段 slug。
      //   ② DB 分支不判 status,草稿/未发布文档按 slug 可被匿名读;现只放 published,
      //      其余仅管理员可见(与文件分支同一口径)。
      const dbSlug = basename(normalized)
      if (normalized === dbSlug) {
        const dbRows = await db
          .select({ content: docs.content, status: docs.status })
          .from(docs)
          .where(eq(docs.slug, dbSlug))
          .limit(1)
        const hit = dbRows[0]
        if (hit) {
          if (hit.status === 'published' || (await isAdmin(request))) {
            return reply.send(success({ content: hit.content ?? '', source: 'db' }))
          }
          return reply.code(404).send(success({ content: '', source: 'none' }))
        }
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
      // 2026-10-31 R12:SVG 可承载脚本,顶层直出必须断源 + 禁嗅探(与 ai-feed sandbox 口径同源)。
      return reply
        .type(MIME_MAP[`.${ext[1]}`] ?? 'application/octet-stream')
        .header('X-Content-Type-Options', 'nosniff')
        .header('Content-Security-Policy', 'sandbox')
        .send(buf)
    } catch {
      return reply.code(404).send()
    }
  })

  // -------------------------------------------------------------------------
  // GET /documents/file/* - 文档中心非 Markdown 文件直出(预览/下载)
  // 权限与列表同源:子目录(developer/user/enterprise-service)公开,顶层仅管理员;
  // 只放行 DOC_FILE_EXTS 白名单,html 一律按纯文本下发(不执行),svg 走 sandbox CSP。
  // -------------------------------------------------------------------------
  server.get('/documents/file/*', async (request, reply) => {
    try {
      const wildcard = (request.params as { '*': string })['*'] ?? ''
      let relPath = wildcard
      try {
        relPath = decodeURIComponent(wildcard)
      } catch {
        return reply.code(404).send()
      }
      relPath = relPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
      if (!relPath || relPath.includes('..') || relPath.includes('\0')) {
        return reply.code(404).send()
      }
      const ext = extOfName(basename(relPath))
      if (!DOC_FILE_EXTS.has(ext)) return reply.code(404).send()

      if (!isDocPublic(relPath)) {
        const admin = await isAdmin(request)
        if (!admin) return reply.code(404).send()
      }

      const root = resolve(DOCS_DIR)
      const filePath = resolve(root, relPath)
      if (!filePath.startsWith(root + sep)) return reply.code(404).send()
      const stats = await stat(filePath)
      if (!stats.isFile()) return reply.code(404).send()

      const isHtml = ext === 'html' || ext === 'htm'
      const res = reply
        .header('Content-Type', docMimeOf(ext))
        .header('Content-Length', String(stats.size))
        .header('X-Content-Type-Options', 'nosniff')
      if (isHtml || ext === 'svg') {
        res.header('Content-Security-Policy', 'sandbox')
      }
      return res.send(createReadStream(filePath))
    } catch {
      return reply.code(404).send()
    }
  })

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
      // 可用+配额铁律(2026-08-27):按 ai-service provider 健康度剔除硬不可用模型。
      // G-726(2026-09-29):失败代理(空表)换成显式的 known 事实 ——
      // known:false(非 2xx / 网络 / 超时 / 解析失败)= 本轮没问到,全保留;
      // 保留的只是"不剔除"这一行为,不再被读成"全部健康"(本响应不输出健康字段)。
      // known:true 而某 code 未上报 ⇒ 仍走 isProviderHardUnavailable 的宽松分支,与改动前同形。
      const health = await fetchProviderHealth()
      const visibleRows = health.known
        ? rows.filter(
            (r) => !isProviderHardUnavailable(r.providerCode ?? undefined, health.providers),
          )
        : rows
      const list = visibleRows.map((r) => ({
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
