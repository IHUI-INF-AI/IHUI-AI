// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文件版本管理路由。
 *
 * 迁移自旧架构 server/app/api/v1/version/routes.py。
 *
 * 功能：版本创建 / 列表 / 详情 / 回滚 / 删除 / 当前版本 / 对比。
 * 使用 packages/database/src/schema/files.ts 中的 file_versions 表。
 * 对比能力复用 services/diff-service.ts（基于 LCS 的文本 diff + 二进制哈希对比）。
 *
 * 注册（server.ts）：server.register(fileVersionRoutes, { prefix: '/api' })
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { createWriteStream } from 'node:fs'
import { existsSync, mkdirSync, unlinkSync, copyFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { eq, desc, max, and } from 'drizzle-orm'
import { checkAuth } from '../plugins/auth.js'
import { db } from '../db/index.js'
import { fileVersions, files, type FileVersion } from '@ihui/database'
import { findFileById } from '../db/workspace-queries.js'
import { canAccessFile } from '../db/file-queries.js'
import { compareFiles, getSimilarity } from '../services/diff-service.js'
import { success, error } from '../utils/response.js'
import {
  validateUploadFile,
  MAX_MULTIPART_UPLOAD_SIZE,
  extractExt,
  ALLOWED_EXTENSIONS,
} from '../utils/file-type-validator.js'

// P2 修复(2026-08-06):文件版本属私有资源,写入 uploads/private/versions(静态白名单只暴露 public/)
const VERSIONS_DIR = join(process.cwd(), 'uploads', 'private', 'versions')

function ensureVersionsDir(): void {
  if (!existsSync(VERSIONS_DIR)) mkdirSync(VERSIONS_DIR, { recursive: true })
}

/**
 * 版本行的对外形态。
 *
 * O21(2026-09-23 安全 P0)「出口剥 path」:**不再**外泄 `v.path` —— 它存的是服务端磁盘绝对路径
 * (`uploads/private/versions/<uuid>`),回显给客户端等于把落盘位置与文件名交给攻击者,
 * 而该路径既不可用于下载(下载走 `GET /api/files/:id` 鉴权),也无任何调用方读取
 * (全仓 grep `/file-versions` 零调用方;web 端 `FileVersion` 声明里也没有 `path`)。
 */
function serializeVersion(v: typeof fileVersions.$inferSelect) {
  return {
    id: v.id,
    fileId: v.fileId,
    version: v.version,
    size: v.size,
    uploadedBy: v.uploadedBy,
    changeLog: v.changeLog,
    createdAt: v.createdAt,
  }
}

/**
 * 属主校验结论:ok=false 时由调用方按 status/message 直接回复;ok=true 时**带回 files 行**,
 * 使需要读该行字段的调用方(如 create 要取原文件名判扩展名)不必二次查询 —— 二次查询会开
 * TOCTOU 窗口,且让"闸门"与"用的还是不是同一行"脱钩。
 */
type FileRow = NonNullable<Awaited<ReturnType<typeof findFileById>>>
type FileAccess = { ok: true; file: FileRow } | { ok: false; status: 403 | 404; message: string }

/**
 * O21(2026-09-23 安全 P0):文件版本面的属主/成员谓词,判据一律走 `canAccessFile`
 * (上传者 ∪ 项目 owner ∪ project_members,见 `db/file-queries.ts:28-40`)。
 *
 * **不得**改用 `idorGuard('file')`:它以 `files.uploadedBy` 单列判定,而该列
 * `onDelete:'set null'` 可空 —— 上传者一注销就恒 403,且会把正常共享成员一并拒掉,
 * 比现网模型**更弱**(O21 ② 实测结论)。
 *
 * 404/403 文案与 `routes/files.ts` 同族端点逐字一致(404 '文件不存在' / 403 '无权访问该文件'),
 * 保持仓内既有约定,不新造档位。
 */
async function checkFileAccess(userId: string, fileId: string): Promise<FileAccess> {
  const file = await findFileById(fileId)
  if (!file) return { ok: false, status: 404, message: '文件不存在' }
  if (!(await canAccessFile(userId, file)))
    return { ok: false, status: 403, message: '无权访问该文件' }
  return { ok: true, file }
}

/** 版本行只存 fileId,按 versionId 入口的端点须先取行再反查 files 判属主。 */
async function findVersionById(versionId: string): Promise<FileVersion | undefined> {
  const rows = await db.select().from(fileVersions).where(eq(fileVersions.id, versionId)).limit(1)
  return rows[0]
}

export const fileVersionRoutes: FastifyPluginAsync = async (server) => {
  const fileIdParam = z.object({ fileId: z.string() })
  const versionIdParam = z.object({ versionId: z.string() })
  const compareQuery = z.object({ v1: z.coerce.number(), v2: z.coerce.number() })

  // POST /file-versions/create — 上传新版本（multipart: file + 表单字段 fileId/changeLog）
  server.post('/file-versions/create', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const data = await request.file()
    if (!data) {
      return reply.status(400).send(error(400, '未检测到上传文件'))
    }

    // 从表单字段读取 fileId / changeLog
    const fileIdRaw = (data.fields as Record<string, { value?: string } | undefined>).fileId
    const changeLogRaw = (data.fields as Record<string, { value?: string } | undefined>).changeLog
    const fileId = typeof fileIdRaw?.value === 'string' ? fileIdRaw.value : ''
    const changeLog = typeof changeLogRaw?.value === 'string' ? changeLogRaw.value : null

    if (!fileId) {
      return reply.status(400).send(error(400, 'fileId 为必填'))
    }

    // O21b(2026-09-23):此处原本只判"文件存在",任意登录用户都能向**他人 fileId**
    // 写版本行并落盘(本文件其余 6 个端点已在 O21 ② 补过谓词,create 被漏在外面)。
    // 闸门必须排在读 multipart buffer 与任何写盘之前,否则越方已付磁盘代价。
    const access = await checkFileAccess(request.userId!, fileId)
    if (!access.ok) {
      return reply.status(access.status).send(error(access.status, access.message))
    }
    const file = access.file

    // P0 安全加固(2026-08-02):读取 buffer 后校验,不再流式直接写盘
    // 防 CWE-434 恶意文件上传 + CWE-400 大文件 DoS
    const buffer = await data.toBuffer()
    if (buffer.length === 0) {
      return reply.status(400).send(error(400, '文件内容为空'))
    }
    if (buffer.length > MAX_MULTIPART_UPLOAD_SIZE) {
      return reply.status(400).send(error(400, '文件大小超过 100MB 限制'))
    }

    // 文件类型校验:白名单内走 magic number + MIME 一致性校验;
    // 白名单外校验新版本扩展名与原文件一致(防止上传可执行文件覆盖文档)
    const uploadFilename = data.filename ?? file.name ?? 'version'
    const uploadExt = extractExt(uploadFilename)
    const originalExt = extractExt(file.name ?? '')
    if (ALLOWED_EXTENSIONS.includes(uploadExt)) {
      const declaredMime = data.mimetype ?? 'application/octet-stream'
      const validation = validateUploadFile(
        buffer,
        uploadFilename,
        declaredMime,
        MAX_MULTIPART_UPLOAD_SIZE,
      )
      if (!validation.ok) {
        return reply.status(400).send(error(400, validation.reason))
      }
    } else {
      // 非白名单扩展名:校验新版本与原文件扩展名一致(防止类型替换攻击)
      if (uploadExt !== originalExt) {
        return reply
          .status(400)
          .send(error(400, `版本文件扩展名(.${uploadExt})与原文件(.${originalExt})不一致`))
      }
    }

    ensureVersionsDir()
    const versionId = randomUUID()
    const versionPath = join(VERSIONS_DIR, versionId)

    try {
      await new Promise<void>((resolve, reject) => {
        const stream = createWriteStream(versionPath)
        stream.on('error', reject)
        stream.on('finish', resolve)
        stream.end(buffer)
      })
    } catch (err) {
      request.log.error({ err }, '版本文件保存失败')
      if (existsSync(versionPath)) unlinkSync(versionPath)
      return reply.status(500).send(error(500, '版本文件保存失败'))
    }

    const totalSize = buffer.length

    // 计算下一个版本号（当前最大版本 + 1）
    const maxRow = await db
      .select({ maxVer: max(fileVersions.version) })
      .from(fileVersions)
      .where(eq(fileVersions.fileId, fileId))
    const nextVer = ((maxRow[0]?.maxVer ?? 0) as number) + 1

    const [created] = await db
      .insert(fileVersions)
      .values({
        fileId,
        version: nextVer,
        size: totalSize,
        path: versionPath,
        uploadedBy: userId,
        changeLog,
      })
      .returning()

    return reply.status(201).send(success({ version: serializeVersion(created!) }))
  })

  // GET /file-versions/list/:fileId — 版本列表（按版本号倒序）
  server.get('/file-versions/list/:fileId', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { fileId } = fileIdParam.parse(request.params)

    // O21 ②:补齐属主谓词,跨属主不得读到他人文件的版本清单
    const access = await checkFileAccess(request.userId!, fileId)
    if (!access.ok) {
      return reply.status(access.status).send(error(access.status, access.message))
    }

    const list = await db
      .select()
      .from(fileVersions)
      .where(eq(fileVersions.fileId, fileId))
      .orderBy(desc(fileVersions.version))

    return reply.send(success({ versions: list.map(serializeVersion) }))
  })

  // GET /file-versions/current/:fileId — 当前（最新）版本
  server.get('/file-versions/current/:fileId', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { fileId } = fileIdParam.parse(request.params)

    // O21 ②:补齐属主谓词
    const access = await checkFileAccess(request.userId!, fileId)
    if (!access.ok) {
      return reply.status(access.status).send(error(access.status, access.message))
    }

    const list = await db
      .select()
      .from(fileVersions)
      .where(eq(fileVersions.fileId, fileId))
      .orderBy(desc(fileVersions.version))
      .limit(1)

    if (list.length === 0) {
      return reply.status(404).send(error(404, '该文件暂无版本记录'))
    }
    return reply.send(success({ version: serializeVersion(list[0]!) }))
  })

  // GET /file-versions/:versionId — 版本详情
  server.get('/file-versions/:versionId', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { versionId } = versionIdParam.parse(request.params)

    const version = await findVersionById(versionId)

    if (!version) {
      return reply.status(404).send(error(404, '版本不存在'))
    }
    // O21 ②:由 version.fileId 反查 files 行判属主,跨属主读不到别人的版本
    const access = await checkFileAccess(request.userId!, version.fileId)
    if (!access.ok) {
      return reply.status(access.status).send(error(access.status, access.message))
    }
    if (!existsSync(version.path)) {
      return reply.status(404).send(error(404, '版本文件在磁盘上不存在'))
    }
    return reply.send(success({ version: serializeVersion(version) }))
  })

  // POST /file-versions/rollback/:versionId — 回滚到指定版本（以新版本号写入，成为当前版本）
  server.post('/file-versions/rollback/:versionId', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const { versionId } = versionIdParam.parse(request.params)

    const list = await db.select().from(fileVersions).where(eq(fileVersions.id, versionId)).limit(1)

    if (list.length === 0) {
      return reply.status(404).send(error(404, '版本不存在'))
    }
    const target = list[0]!
    // O21 ②:回滚会 `update files set path` 改写**文件指向**并落盘新文件,是这一面最重的写副作用,
    // 必须先由 target.fileId 反查 files 判属主,否则任意登录用户可把他人文件的当前内容换掉。
    const access = await checkFileAccess(request.userId!, target.fileId)
    if (!access.ok) {
      return reply.status(access.status).send(error(access.status, access.message))
    }
    if (!existsSync(target.path)) {
      return reply.status(404).send(error(404, '版本文件在磁盘上不存在'))
    }

    ensureVersionsDir()
    const newVersionId = randomUUID()
    const newPath = join(VERSIONS_DIR, newVersionId)
    copyFileSync(target.path, newPath)
    const size = statSync(newPath).size

    const maxRow = await db
      .select({ maxVer: max(fileVersions.version) })
      .from(fileVersions)
      .where(eq(fileVersions.fileId, target.fileId))
    const nextVer = ((maxRow[0]?.maxVer ?? 0) as number) + 1

    const [created] = await db
      .insert(fileVersions)
      .values({
        fileId: target.fileId,
        version: nextVer,
        size,
        path: newPath,
        uploadedBy: userId,
        changeLog: `回滚至版本 ${target.version}`,
      })
      .returning()

    // 同步更新 files 表的 path 指向新版本文件
    await db.update(files).set({ path: newPath }).where(eq(files.id, target.fileId))

    return reply.send(success({ version: serializeVersion(created!) }))
  })

  // DELETE /file-versions/:versionId — 删除指定版本（当前最新版本不可删）
  server.delete('/file-versions/:versionId', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { versionId } = versionIdParam.parse(request.params)

    const list = await db.select().from(fileVersions).where(eq(fileVersions.id, versionId)).limit(1)

    if (list.length === 0) {
      return reply.status(404).send(error(404, '版本不存在'))
    }
    const target = list[0]!

    // O21 ②:删除会 unlink 磁盘文件,跨属主不得执行(先反查 files 判属主)
    const access = await checkFileAccess(request.userId!, target.fileId)
    if (!access.ok) {
      return reply.status(access.status).send(error(access.status, access.message))
    }

    // 查询当前最新版本号
    const latestRow = await db
      .select({ maxVer: max(fileVersions.version) })
      .from(fileVersions)
      .where(eq(fileVersions.fileId, target.fileId))
    const latestVer = (latestRow[0]?.maxVer ?? 0) as number
    if (target.version === latestVer) {
      return reply.status(400).send(error(400, '不能删除当前最新版本'))
    }

    if (existsSync(target.path)) {
      try {
        unlinkSync(target.path)
      } catch {
        /* ignore */
      }
    }
    const removed = await db
      .delete(fileVersions)
      .where(eq(fileVersions.id, versionId))
      .returning({ id: fileVersions.id })
    return reply.send(success({ versionId, deleted: removed.length > 0 }))
  })

  // GET /file-versions/compare/:fileId?v1=&v2= — 对比两个版本
  server.get('/file-versions/compare/:fileId', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const { fileId } = fileIdParam.parse(request.params)

    // O21 ②:比对会把两个版本的正文逐行倒进响应,跨属主读不到
    const access = await checkFileAccess(request.userId!, fileId)
    if (!access.ok) {
      return reply.status(access.status).send(error(access.status, access.message))
    }

    const parsed = compareQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, 'v1 和 v2 为必填且须为数字'))
    }
    const { v1, v2 } = parsed.data

    const versions = await db
      .select()
      .from(fileVersions)
      .where(and(eq(fileVersions.fileId, fileId)))
      .orderBy(desc(fileVersions.version))

    const va = versions.find((v) => v.version === v1)
    const vb = versions.find((v) => v.version === v2)
    if (!va || !vb) {
      return reply.status(404).send(error(404, '指定的版本不存在'))
    }
    if (!existsSync(va.path) || !existsSync(vb.path)) {
      return reply.status(404).send(error(404, '版本文件在磁盘上不存在'))
    }

    const diff = compareFiles(va.path, vb.path)
    const similarity = getSimilarity(va.path, vb.path)
    return reply.send(
      success({
        comparison: {
          version1: { version: va.version, size: va.size },
          version2: { version: vb.version, size: vb.size },
          additions: diff.additions,
          deletions: diff.deletions,
          changes: diff.changes,
          similarity,
          changesList: diff.changesList,
        },
      }),
    )
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
