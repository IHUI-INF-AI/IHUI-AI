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

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import { existsSync, mkdirSync, unlinkSync, copyFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { eq, desc, max, and } from 'drizzle-orm'
import { authenticate } from '../plugins/auth.js'
import { db } from '../db/index.js'
import { fileVersions, files } from '@ihui/database'
import { findFileById } from '../db/workspace-queries.js'
import { compareFiles, getSimilarity } from '../services/diff-service.js'
import { success, error } from '../utils/response.js'

const VERSIONS_DIR = join(process.cwd(), 'uploads', 'versions')

function ensureVersionsDir(): void {
  if (!existsSync(VERSIONS_DIR)) mkdirSync(VERSIONS_DIR, { recursive: true })
}

/** 鉴权辅助：失败时发送响应并返回 false。 */
async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
    return true
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = (e as Error).message || 'Authentication required'
    reply.status(statusCode).send(error(statusCode, message))
    return false
  }
}

function serializeVersion(v: typeof fileVersions.$inferSelect) {
  return {
    id: v.id,
    fileId: v.fileId,
    version: v.version,
    size: v.size,
    path: v.path,
    uploadedBy: v.uploadedBy,
    changeLog: v.changeLog,
    createdAt: v.createdAt,
  }
}

export const fileVersionRoutes: FastifyPluginAsync = async (server) => {
  // POST /file-versions/create — 上传新版本（multipart: file + 表单字段 fileId/changeLog）
  server.post('/file-versions/create', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
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

    // 校验文件存在
    const file = await findFileById(fileId)
    if (!file) {
      return reply.status(404).send(error(404, '文件不存在'))
    }

    ensureVersionsDir()
    const versionId = randomUUID()
    const versionPath = join(VERSIONS_DIR, versionId)

    let totalSize = 0
    try {
      data.file.on('data', (chunk: Buffer) => {
        totalSize += chunk.length
      })
      await pipeline(data.file, createWriteStream(versionPath))
    } catch (err) {
      request.log.error({ err }, '版本文件保存失败')
      if (existsSync(versionPath)) unlinkSync(versionPath)
      return reply.status(500).send(error(500, '版本文件保存失败'))
    }

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
    if (!(await requireAuth(request, reply))) return
    const { fileId } = request.params as { fileId: string }

    const list = await db
      .select()
      .from(fileVersions)
      .where(eq(fileVersions.fileId, fileId))
      .orderBy(desc(fileVersions.version))

    return reply.send(success({ versions: list.map(serializeVersion) }))
  })

  // GET /file-versions/current/:fileId — 当前（最新）版本
  server.get('/file-versions/current/:fileId', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { fileId } = request.params as { fileId: string }

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
    if (!(await requireAuth(request, reply))) return
    const { versionId } = request.params as { versionId: string }

    const list = await db.select().from(fileVersions).where(eq(fileVersions.id, versionId)).limit(1)

    if (list.length === 0) {
      return reply.status(404).send(error(404, '版本不存在'))
    }
    const version = list[0]!
    if (!existsSync(version.path)) {
      return reply.status(404).send(error(404, '版本文件在磁盘上不存在'))
    }
    return reply.send(success({ version: serializeVersion(version) }))
  })

  // POST /file-versions/rollback/:versionId — 回滚到指定版本（以新版本号写入，成为当前版本）
  server.post('/file-versions/rollback/:versionId', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const userId = request.userId!
    const { versionId } = request.params as { versionId: string }

    const list = await db.select().from(fileVersions).where(eq(fileVersions.id, versionId)).limit(1)

    if (list.length === 0) {
      return reply.status(404).send(error(404, '版本不存在'))
    }
    const target = list[0]!
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
    if (!(await requireAuth(request, reply))) return
    const { versionId } = request.params as { versionId: string }

    const list = await db.select().from(fileVersions).where(eq(fileVersions.id, versionId)).limit(1)

    if (list.length === 0) {
      return reply.status(404).send(error(404, '版本不存在'))
    }
    const target = list[0]!

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
    await db.delete(fileVersions).where(eq(fileVersions.id, versionId))
    return reply.send(success({ versionId, deleted: true }))
  })

  // GET /file-versions/compare/:fileId?v1=&v2= — 对比两个版本
  server.get('/file-versions/compare/:fileId', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const { fileId } = request.params as { fileId: string }
    const query = request.query as { v1?: string; v2?: string }
    const v1 = Number(query.v1)
    const v2 = Number(query.v2)
    if (!Number.isFinite(v1) || !Number.isFinite(v2)) {
      return reply.status(400).send(error(400, 'v1 和 v2 为必填且须为数字'))
    }

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
