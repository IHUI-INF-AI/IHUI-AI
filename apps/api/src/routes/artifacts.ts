// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WATERMARK-PLACEHOLDER(本行由 scripts/watermark.mjs inject 替换为横幅)
 */

/**
 * G3 Beyond-Coding 泛化:Artifact 交付物导出端点(2026-10-30 立)。
 *
 * GET /api/artifacts?page=1&pageSize=50
 *  - 枚举当前用户产物:扫 tmp/artifacts/<id>/artifact.json,按 owner.json 归属过滤,
 *    返回 id/kind/name/version/created_at/session_id/payload_ref,created_at 倒序分页。
 *    根目录不存在/条目畸形/归属缺失一律静默跳过(空列表容错,不 500)。
 *
 * GET /api/artifacts/:id/download?fmt=html|md|csv
 *  - html_report → html(自包含 HTML 原样);
 *  - slides      → html 内联预览 或 md 大纲;
 *  - sheet       → csv;
 *  - doc         → md;
 *  - video_ref   → 无导出形态(400)。
 *
 * 存储落法(不建新表):payload 与元数据由 ai-service `create_artifact` 工具落在
 * 仓库根 `tmp/artifacts/<artifact_id>/`(artifact.json 最新元数据 + owner.json 归属
 * + v<n>.<ext> 版本化 payload)。本端点按 artifact_id 直查该目录,归属校验以
 * owner.json 的 user_id 为准(非本人一律 404,与产物枚举不可分辨);出口前复验
 * payload sha256 与元数据 checksum 一致,防盘上篡改/半写。
 * 渲染/转换复用 @ihui/shared/artifact 唯一实现,端内不抄第二份。
 *
 * 注册(由主线程挂 routes/index.ts):
 *   import { artifactRoutes } from './artifacts.js'
 *   server.register(artifactRoutes, { prefix: '/api' })
 */

import type { FastifyPluginAsync } from 'fastify'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, type Dirent } from 'node:fs'
import { basename, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import {
  artifactSchema,
  artifactToCsv,
  artifactToMarkdown,
  renderArtifactToHtml,
  type Artifact,
  type ArtifactWithPayload,
} from '@ihui/shared/artifact'
import { authenticate } from '../plugins/auth.js'
import { error, success } from '../utils/response.js'
import { buildSchema } from '../utils/swagger.js'

/** 产物根目录:env ARTIFACTS_DIR 优先;默认仓库根 tmp/artifacts(与 ai-service 同址)。 */
function artifactsRootDir(): string {
  if (process.env.ARTIFACTS_DIR) return resolve(process.env.ARTIFACTS_DIR)
  // src/routes/artifacts.ts 与 dist/routes/artifacts.js 到仓库根同为 4 级上跳
  const fromModule = resolve(fileURLToPath(import.meta.url), '../../../../tmp/artifacts')
  const fromCwd = join(process.cwd(), 'tmp', 'artifacts')
  return existsSync(fromModule) ? fromModule : fromCwd
}

const idParamSchema = z.object({ id: z.uuid({ error: '无效的产物 ID' }) })
const querySchema = z.object({
  fmt: z
    .transform((v) => (v === '' ? undefined : v))
    .pipe(z.enum(['html', 'md', 'csv']).optional()),
})
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})

/** 枚举端投影行:白名单式点名字段(不下发 checksum/size/mime/updated_at);
 *  payload_ref 是签名预览链的指针(ai-service /api/artifacts/token?file=...)。 */
interface ArtifactListItem {
  id: string
  kind: Artifact['kind']
  name: string
  version: number
  created_at: string
  session_id: string
  payload_ref: string
}

/** 扫产物根目录,收集归属 userId 的元数据行。
 *  容错口径:根目录不可读 / 子目录缺 artifact.json / 记录畸形或 id 与目录名不符 /
 *  owner.json 缺失或非本人 ⇒ 该条静默跳过(与下载端点"不可分辨"语义一致)。 */
function collectOwnedArtifacts(root: string, userId: string): ArtifactListItem[] {
  const items: ArtifactListItem[] = []
  let entries: Dirent[]
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch {
    return items // 根目录不存在/不可读 ⇒ 空列表(新环境零产物容错)
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dir = join(root, entry.name)
    let parsed
    try {
      parsed = artifactSchema.safeParse(
        JSON.parse(readFileSync(join(dir, 'artifact.json'), 'utf-8')),
      )
    } catch {
      continue // artifact.json 缺失/畸形
    }
    if (!parsed.success) continue
    const record = parsed.data
    if (record.id !== entry.name) continue // 目录名必须与记录 id 一致(防串目录/伪造)
    let ownerId = ''
    try {
      ownerId = String(JSON.parse(readFileSync(join(dir, 'owner.json'), 'utf-8')).user_id ?? '')
    } catch {
      ownerId = ''
    }
    if (!ownerId || ownerId !== userId) continue // 归属过滤(owner 缺失同样隐匿)
    items.push({
      id: record.id,
      kind: record.kind,
      name: record.title,
      version: record.version,
      created_at: record.created_at,
      session_id: record.session_id,
      payload_ref: record.payload_ref,
    })
  }
  return items
}

/** kind × fmt 支持矩阵(与功能规格逐字一致;不在表内一律 400)。 */
const SUPPORTED_FMTS: Readonly<Record<Artifact['kind'], readonly ('html' | 'md' | 'csv')[]>> = {
  html_report: ['html'],
  slides: ['html', 'md'],
  sheet: ['csv'],
  doc: ['md'],
  video_ref: [],
}
const DEFAULT_FMT: Partial<Record<Artifact['kind'], 'html' | 'md' | 'csv'>> = {
  html_report: 'html',
  slides: 'html',
  sheet: 'csv',
  doc: 'md',
}
const CONTENT_TYPE_BY_FMT: Record<'html' | 'md' | 'csv', string> = {
  html: 'text/html; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
}

/**
 * 带 errorCode 的错误信封(对齐 routes/auth.ts 的 registerErrorResponseSchema 先例):
 * buildSchema 默认 errorSchema 只声明 code/message,fast-json-stringify 序列化时
 * 会把未声明的 errorCode 剥掉,手工 catch 出栈的分型码必须显式声明才出得来。
 */
const artifactErrorResponseSchema = {
  type: 'object',
  properties: {
    code: { type: 'number' },
    message: { type: 'string' },
    errorCode: { type: 'string' },
  },
} as const

/** 标题 → 文件名安全片段(保留中英文数字,其余折下划线;空回落 artifact)。 */
function slugifyFilename(title: string): string {
  const slug = title
    .trim()
    .replace(/[\\/:*?"'<>|\s]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 60)
  return slug || 'artifact'
}

export const artifactRoutes: FastifyPluginAsync = async (app) => {
  // ---------------------------------------------------------- 产物枚举 ----
  app.get(
    '/artifacts',
    {
      schema: buildSchema({
        summary: '枚举当前用户产物列表',
        description:
          '扫描产物目录并按 owner 归属过滤,created_at 倒序分页;畸形/缺失/非本人条目静默跳过。',
        tags: ['artifacts'],
        // 错误信封显式声明以保留 errorCode(下载端点同先例:buildSchema 默认
        // errorSchema 只有 code/message,fast-json-stringify 会剥掉未声明键);
        // 200 不声明,走默认序列化原样透传 {code:0,data:{list,total,page,pageSize}} 信封。
        response: {
          400: artifactErrorResponseSchema,
          401: artifactErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      let userId: string
      try {
        userId = String((await authenticate(request)).userId)
      } catch (e) {
        const err = e as { statusCode?: number }
        const code = err.statusCode && err.statusCode >= 400 ? err.statusCode : 401
        return reply.status(code).send(error(code, '未登录或登录已失效'))
      }

      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '无效参数', 'VALIDATION_FAILED'))
      }
      const { page, pageSize } = parsed.data

      const items = collectOwnedArtifacts(artifactsRootDir(), userId)
      // created_at 倒序;同时间戳以 id 倒序作稳定次键(分页翻页不重不漏)
      items.sort((a, b) =>
        a.created_at !== b.created_at
          ? a.created_at < b.created_at
            ? 1
            : -1
          : a.id < b.id
            ? 1
            : -1,
      )
      const total = items.length
      const list = items.slice((page - 1) * pageSize, page * pageSize)
      // 分页键 list/total/page/pageSize(仓库存量主流:success({ list: 133 处 vs
      // paginatedSuccess 15 处;api-client PageData<T> 同源,不得改成 items)
      return reply.send(success({ list, total, page, pageSize }))
    },
  )

  // ------------------------------------------------------------ 导出下载 ----
  app.get(
    '/artifacts/:id/download',
    {
      schema: buildSchema({
        summary: '导出 Artifact 交付物',
        description:
          '按 fmt 导出产物:html_report→html;slides→html|md;sheet→csv;doc→md。非本人产物 404,出口前复验 sha256。',
        tags: ['artifacts'],
        // 200 为文件流字符串体(不过 JSON 序列化),只声明错误码信封以保留 errorCode
        response: {
          400: artifactErrorResponseSchema,
          401: artifactErrorResponseSchema,
          404: artifactErrorResponseSchema,
          500: artifactErrorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      let userId: string
      try {
        userId = String((await authenticate(request)).userId)
      } catch (e) {
        const err = e as { statusCode?: number }
        const code = err.statusCode && err.statusCode >= 400 ? err.statusCode : 401
        return reply.status(code).send(error(code, '未登录或登录已失效'))
      }

      const params = idParamSchema.safeParse(request.params)
      if (!params.success) {
        return reply
          .status(400)
          .send(error(400, params.error.issues[0]?.message ?? '无效参数', 'VALIDATION_FAILED'))
      }
      const query = querySchema.safeParse(request.query)
      if (!query.success) {
        return reply.status(400).send(error(400, 'fmt 仅支持 html/md/csv', 'VALIDATION_FAILED'))
      }

      // id 已过 uuid 校验,直接拼目录;artifact.json 缺失/畸形/非本人一律 404
      const dir = join(artifactsRootDir(), params.data.id)
      const recordFile = join(dir, 'artifact.json')
      if (!existsSync(recordFile)) {
        return reply.status(404).send(error(404, '产物不存在'))
      }
      let parsedRecord
      try {
        parsedRecord = artifactSchema.safeParse(JSON.parse(readFileSync(recordFile, 'utf-8')))
      } catch {
        parsedRecord = { success: false as const }
      }
      if (!parsedRecord.success) {
        return reply.status(404).send(error(404, '产物不存在'))
      }
      const record = parsedRecord.data

      const ownerFile = join(dir, 'owner.json')
      if (!existsSync(ownerFile)) {
        return reply.status(404).send(error(404, '产物不存在'))
      }
      let ownerId = ''
      try {
        ownerId = String(JSON.parse(readFileSync(ownerFile, 'utf-8')).user_id ?? '')
      } catch {
        ownerId = ''
      }
      if (!ownerId || ownerId !== userId) {
        // 归属校验:非本人会话产物按"不存在"处理(不泄露存在性)
        return reply.status(404).send(error(404, '产物不存在'))
      }

      const fmt = query.data.fmt ?? DEFAULT_FMT[record.kind]
      if (!fmt || !SUPPORTED_FMTS[record.kind].includes(fmt)) {
        return reply
          .status(400)
          .send(
            error(
              400,
              `${record.kind} 不支持导出为 ${query.data.fmt ?? '该'} 格式`,
              'UNSUPPORTED_FORMAT',
            ),
          )
      }

      // payload 只认目录内文件名(basename 去路径分隔符,防 payload_ref 被篡改为逃逸路径)
      const payloadPath = join(dir, basename(record.payload_ref.split(/[\\/]/).pop() ?? ''))
      if (isAbsolute(record.payload_ref) || !existsSync(payloadPath)) {
        return reply.status(404).send(error(404, '产物文件不存在'))
      }
      const buf = readFileSync(payloadPath)
      const digest = createHash('sha256').update(buf).digest('hex')
      if (digest !== record.checksum) {
        request.log.warn({ artifactId: record.id }, 'Artifact checksum 校验失败')
        return reply.status(500).send(error(500, '产物完整性校验失败', 'CHECKSUM_MISMATCH'))
      }

      let body: string
      try {
        if (fmt === 'html' && record.kind === 'html_report') {
          body = buf.toString('utf-8')
        } else if (record.kind === 'doc') {
          body = buf.toString('utf-8')
        } else {
          const payload = JSON.parse(buf.toString('utf-8')) as ArtifactWithPayload['payload']
          const hydrated: ArtifactWithPayload = { ...record, payload }
          if (fmt === 'html') body = renderArtifactToHtml(hydrated)
          else if (fmt === 'csv') body = artifactToCsv(hydrated)
          else body = artifactToMarkdown(hydrated)
        }
      } catch (e) {
        request.log.error({ err: e, artifactId: record.id }, 'Artifact 导出渲染失败')
        return reply.status(500).send(error(500, '产物导出失败', 'RENDER_FAILED'))
      }

      const asciiName = `artifact-v${record.version}.${fmt}`
      const utfName = `${slugifyFilename(record.title)}-v${record.version}.${fmt}`
      reply
        .header('Content-Type', CONTENT_TYPE_BY_FMT[fmt])
        .header(
          'Content-Disposition',
          `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(utfName)}`,
        )
        .send(body)
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
