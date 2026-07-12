import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
} from 'node:fs'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { randomUUID } from 'node:crypto'
import { authenticate } from '../plugins/auth.js'
import {
  listProjectsByUserWithFileCount,
  findProjectById,
  createProject,
  updateProject,
  deleteProject,
  listFilesByProject,
  findFileById,
  findFileByIdIncludeTrashed,
  createFile,
  softDeleteFile,
  restoreFile,
  hardDeleteFile,
  findTrashedFiles,
  batchSoftDelete,
  batchRestore,
  findFileVersions,
} from '../db/workspace-queries.js'
import { success, error } from '../utils/response.js'
import { getBulkhead } from '../plugins/resilience-extended.js'

// =============================================================================
// 上传目录
// =============================================================================

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads')

function ensureUploadDir(): void {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })
}

// =============================================================================
// Zod schemas
// =============================================================================

const createProjectSchema = z.object({
  name: z.string().min(1, '项目名称不能为空').max(128, '项目名称最多 128 字符'),
  description: z.string().max(2000).optional(),
})

const updateProjectSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(2000).optional(),
  status: z.number().int().optional(),
})

const batchFileIdsSchema = z.object({
  fileIds: z
    .array(z.string().uuid())
    .min(1, '至少选择一个文件')
    .max(100, '单次最多操作 100 个文件'),
})

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

// =============================================================================
// 序列化辅助
// =============================================================================

function serializeProject(p: {
  id: string
  userId: string
  name: string
  description: string | null
  status: number | null
  createdAt: Date
  updatedAt: Date
  fileCount?: number
}) {
  return {
    id: p.id,
    userId: p.userId,
    name: p.name,
    description: p.description ?? '',
    status: p.status ?? 1,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    ...(p.fileCount !== undefined ? { fileCount: Number(p.fileCount) } : {}),
  }
}

function serializeFile(f: {
  id: string
  projectId: string
  name: string
  path: string
  size: number | bigint
  mimeType: string
  uploadedBy: string | null
  createdAt: Date
  deletedAt?: Date | null
  deletedBy?: string | null
}) {
  return {
    id: f.id,
    projectId: f.projectId,
    name: f.name,
    size: Number(f.size),
    mimeType: f.mimeType,
    uploadedBy: f.uploadedBy,
    createdAt: f.createdAt,
    ...(f.deletedAt !== undefined ? { deletedAt: f.deletedAt } : {}),
    ...(f.deletedBy !== undefined ? { deletedBy: f.deletedBy } : {}),
  }
}

// =============================================================================
// 路由
// =============================================================================

export const workspaceRoutes: FastifyPluginAsync = async (server) => {
  const idParam = z.object({ id: z.string() })
  // 鉴权失败统一处理
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  // GET /projects - 列出当前用户的项目
  server.get(
    '/projects',
    {
      schema: {
        summary: '项目列表',
        description: '列出当前用户的所有项目(含文件数量)',
        tags: ['workspace'],
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return // requireAuth 已响应
      const userId = request.userId

      const rows = await listProjectsByUserWithFileCount(userId)
      return reply.send(success({ projects: rows.map(serializeProject) }))
    },
  )

  // POST /projects - 创建项目
  server.post(
    '/projects',
    {
      schema: {
        summary: '创建项目',
        description: '创建新项目',
        tags: ['workspace'],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', maxLength: 128, description: '项目名称' },
            description: { type: 'string', maxLength: 2000, description: '描述(可选)' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const userId = request.userId

      const parsed = createProjectSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const project = await createProject({
        name: parsed.data.name,
        description: parsed.data.description,
        userId,
      })

      return reply
        .status(201)
        .send(success({ project: serializeProject({ ...project, fileCount: 0 }) }))
    },
  )

  // GET /projects/:id - 获取项目详情
  server.get('/projects/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const project = await findProjectById(id)
    if (!project) {
      return reply.status(404).send(error(404, '项目不存在'))
    }
    if (project.userId !== userId) {
      return reply.status(403).send(error(403, '无权访问该项目'))
    }

    return reply.send(success({ project: serializeProject(project) }))
  })

  // PATCH /projects/:id - 更新项目
  server.patch('/projects/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const parsed = updateProjectSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const existing = await findProjectById(id)
    if (!existing) {
      return reply.status(404).send(error(404, '项目不存在'))
    }
    if (existing.userId !== userId) {
      return reply.status(403).send(error(403, '无权修改该项目'))
    }

    const updated = await updateProject(id, parsed.data)
    return reply.send(success({ project: serializeProject(updated) }))
  })

  // DELETE /projects/:id - 删除项目（仅 owner）
  server.delete('/projects/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const existing = await findProjectById(id)
    if (!existing) {
      return reply.status(404).send(error(404, '项目不存在'))
    }
    if (existing.userId !== userId) {
      return reply.status(403).send(error(403, '无权删除该项目'))
    }

    // 删除项目关联的文件（磁盘）
    const projectFiles = await listFilesByProject(id)
    for (const f of projectFiles) {
      try {
        if (existsSync(f.path)) unlinkSync(f.path)
      } catch {
        // 忽略磁盘清理错误
      }
    }

    await deleteProject(id)
    return reply.send(success({ deleted: true }))
  })

  // GET /projects/:id/files - 列出项目文件
  server.get('/projects/:id/files', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const project = await findProjectById(id)
    if (!project) {
      return reply.status(404).send(error(404, '项目不存在'))
    }
    if (project.userId !== userId) {
      return reply.status(403).send(error(403, '无权访问该项目'))
    }

    const fileList = await listFilesByProject(id)
    return reply.send(success({ files: fileList.map(serializeFile) }))
  })

  // POST /projects/:id/files - 上传文件（multipart）
  server.post('/projects/:id/files', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const project = await findProjectById(id)
    if (!project) {
      return reply.status(404).send(error(404, '项目不存在'))
    }
    if (project.userId !== userId) {
      return reply.status(403).send(error(403, '无权访问该项目'))
    }

    try {
      return await getBulkhead('file-upload', 3, 10).execute(async () => {
        const data = await request.file()
        if (!data) {
          return reply.status(400).send(error(400, '未检测到上传文件'))
        }

        const originalName = data.filename ?? 'unnamed'
        const mimeType = data.mimetype ?? 'application/octet-stream'
        ensureUploadDir()

        // 临时文件路径：uploads/<uuid>，写入完成后重命名为最终路径
        const fileId = randomUUID()
        const tmpPath = join(UPLOAD_DIR, `${fileId}.tmp`)
        const finalPath = join(UPLOAD_DIR, fileId)

        let totalSize = 0
        try {
          const writeStream = createWriteStream(tmpPath)
          // 边写边统计大小
          data.file.on('data', (chunk: Buffer) => {
            totalSize += chunk.length
          })
          await pipeline(data.file, writeStream)
          renameSync(tmpPath, finalPath)
        } catch (err) {
          // 清理临时文件
          try {
            if (existsSync(tmpPath)) unlinkSync(tmpPath)
          } catch {
            // ignore
          }
          request.log.error({ err }, '文件上传失败')
          return reply.status(500).send(error(500, '文件上传失败'))
        }

        const file = await createFile({
          projectId: id,
          name: originalName,
          path: finalPath,
          size: totalSize,
          mimeType,
          uploadedBy: userId,
        })

        return reply.status(201).send(success({ file: serializeFile(file) }))
      })
    } catch (err) {
      // Bulkhead 并发上限拒绝
      if ((err as Error).message.includes('Bulkhead rejected')) {
        return reply.status(503).send(error(503, '文件上传并发数已达上限,请稍后重试'))
      }
      throw err
    }
  })

  // GET /files/trash - 回收站：列出当前用户已删除的文件
  // 注意：必须在 /files/:id 之前注册，避免 trash 被当作 :id
  server.get('/files/trash', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const trashed = await findTrashedFiles(userId)
    return reply.send(success({ files: trashed.map(serializeFile) }))
  })

  // DELETE /files/trash/:id - 永久删除（从数据库删除 + 删磁盘文件）
  // 注意：必须在 /files/:id 之前注册，避免 trash 被当作 :id
  server.delete('/files/trash/:id', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const file = await findFileByIdIncludeTrashed(id)
    if (!file) {
      return reply.status(404).send(error(404, '文件不存在'))
    }

    const project = await findProjectById(file.projectId)
    if (!project || project.userId !== userId) {
      return reply.status(403).send(error(403, '无权删除该文件'))
    }

    // 删除磁盘文件
    try {
      if (existsSync(file.path)) unlinkSync(file.path)
    } catch {
      // 忽略磁盘清理错误
    }

    await hardDeleteFile(id)
    return reply.send(success({ deleted: true }))
  })

  // POST /files/batch-delete - 批量软删除（移入回收站）
  // 注意：必须在 /files/:id 之前注册，避免 batch-delete 被当作 :id
  server.post('/files/batch-delete', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const parsed = batchFileIdsSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    // 校验所有文件归属当前用户（且未被删除）
    for (const fid of parsed.data.fileIds) {
      const file = await findFileById(fid)
      if (!file) {
        return reply.status(404).send(error(404, `文件 ${fid} 不存在或已删除`))
      }
      const project = await findProjectById(file.projectId)
      if (!project || project.userId !== userId) {
        return reply.status(403).send(error(403, '无权操作部分文件'))
      }
    }

    await batchSoftDelete(parsed.data.fileIds, userId)
    return reply.send(success({ deleted: parsed.data.fileIds.length }))
  })

  // POST /files/batch-restore - 批量恢复（从回收站恢复）
  // 注意：必须在 /files/:id 之前注册，避免 batch-restore 被当作 :id
  server.post('/files/batch-restore', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const parsed = batchFileIdsSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    // 校验所有文件归属当前用户
    for (const fid of parsed.data.fileIds) {
      const file = await findFileByIdIncludeTrashed(fid)
      if (!file) {
        return reply.status(404).send(error(404, `文件 ${fid} 不存在`))
      }
      const project = await findProjectById(file.projectId)
      if (!project || project.userId !== userId) {
        return reply.status(403).send(error(403, '无权操作部分文件'))
      }
    }

    await batchRestore(parsed.data.fileIds)
    return reply.send(success({ restored: parsed.data.fileIds.length }))
  })

  // GET /files/:id/versions - 文件版本历史
  // 注意：放在 /files/:id 之前注册，避免冲突
  server.get('/files/:id/versions', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // 校验文件存在
    const file = await findFileById(parsed.data.id)
    if (!file) {
      return reply.status(404).send(error(404, '文件不存在'))
    }
    const versions = await findFileVersions(parsed.data.id)
    return reply.send(success({ list: versions }))
  })

  // GET /files/:id/versions/:version - 获取特定版本
  server.get('/files/:id/versions/:version', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const params = z
      .object({ id: z.string().uuid(), version: z.coerce.number().int().min(1) })
      .safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, params.error.issues[0]?.message ?? '参数错误'))
    }
    const versions = await findFileVersions(params.data.id)
    const version = versions.find((v) => v.version === params.data.version)
    if (!version) {
      return reply.status(404).send(error(404, '版本不存在'))
    }
    return reply.send(success({ version }))
  })

  // GET /files/:id - 下载文件
  server.get(
    '/files/:id',
    {
      schema: {
        summary: '下载文件',
        description: '下载指定文件(返回二进制流)',
        tags: ['workspace'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid', description: '文件 ID' },
          },
        },
        response: {
          200: {
            type: 'string',
            format: 'binary',
            description: '文件二进制流',
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          403: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const userId = request.userId

      const { id } = idParam.parse(request.params)
      const file = await findFileById(id)
      if (!file) {
        return reply.status(404).send(error(404, '文件不存在'))
      }

      // 校验项目归属
      const project = await findProjectById(file.projectId)
      if (!project || project.userId !== userId) {
        return reply.status(403).send(error(403, '无权访问该文件'))
      }

      if (!existsSync(file.path)) {
        return reply.status(404).send(error(404, '文件已被移除'))
      }

      return reply
        .header('Content-Type', file.mimeType || 'application/octet-stream')
        .header(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        )
        .header('Content-Length', String(file.size))
        .send(createReadStream(file.path))
    },
  )

  // DELETE /files/:id - 删除文件（软删除，移入回收站）
  server.delete(
    '/files/:id',
    {
      schema: {
        summary: '删除文件',
        description: '软删除文件(移入回收站,不删磁盘文件)',
        tags: ['workspace'],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid', description: '文件 ID' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              code: { type: 'number' },
              message: { type: 'string' },
              data: { type: 'object', additionalProperties: true },
            },
          },
          401: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          403: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { code: { type: 'number' }, message: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      await requireAuth(request, reply)
      if (!request.userId) return
      const userId = request.userId

      const { id } = idParam.parse(request.params)
      const file = await findFileById(id)
      if (!file) {
        return reply.status(404).send(error(404, '文件不存在'))
      }

      const project = await findProjectById(file.projectId)
      if (!project || project.userId !== userId) {
        return reply.status(403).send(error(403, '无权删除该文件'))
      }

      // 软删除：仅标记 deletedAt/deletedBy，不删磁盘文件
      await softDeleteFile(id, userId)
      return reply.send(success({ deleted: true }))
    },
  )

  // POST /files/:id/restore - 恢复文件（从回收站恢复）
  server.post('/files/:id/restore', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const { id } = idParam.parse(request.params)
    const file = await findFileByIdIncludeTrashed(id)
    if (!file) {
      return reply.status(404).send(error(404, '文件不存在'))
    }

    const project = await findProjectById(file.projectId)
    if (!project || project.userId !== userId) {
      return reply.status(403).send(error(403, '无权操作该文件'))
    }

    if (!file.deletedAt) {
      return reply.status(400).send(error(400, '文件未在回收站中'))
    }

    await restoreFile(id)
    return reply.send(success({ restored: true }))
  })
}
