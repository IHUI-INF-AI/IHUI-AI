// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { isAbsolute, join, parse, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { randomUUID } from 'node:crypto'
import { authenticate } from '../plugins/auth.js'
import { db } from '../db/index.js'
import { agentRuntimeSessions } from '@ihui/database'
import { attributeError } from '@ihui/shared/utils/error-attribution'
import { validateUploadFile } from '../utils/file-type-validator.js'
import {
  listProjectsByUserWithFileCount,
  findProjectById,
  createProject,
  updateProject,
  deleteProject,
  listFilesByProject,
  findFileById,
  findFileByIdIncludeTrashed,
  findFileOwnershipBatch,
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
// 批量写的 affected 一律由库确认集合经唯一出口推出,不得由请求侧自算(2026-09-26 静默失真修复)
import { batchWriteOutcome } from '../utils/batch-outcome.js'
import { canAccessFile } from '../db/file-queries.js'
import type { FileVersion } from '@ihui/database'
import { getBulkhead } from '../plugins/resilience-extended.js'
import {
  getRegisteredWorkspaceRoots,
  isInsideRoot,
  realpathOrResolve,
} from '../utils/workspace-roots.js'
import { listPermissionsByUser } from '../db/workspace-permission-queries.js'
// Workspace wire 类型(adjacent tagging,与 ACP 协议对齐)
import type {
  BeginPromptData,
  EndPromptData,
  CreateSessionData,
  SessionCreatedData,
  PromptStartedData,
  PromptCompletedData,
  WorkspaceEvent,
} from '@ihui/types'
// 权限档 wire 清单唯一来源(G-164:此前本文件两处 z.enum 各抄了一份,加档位必漏)
import {
  PERMISSION_MODES,
  PERMISSION_MODE_WIRE_VALUES,
  permissionModeWire,
  type PermissionModeWire,
} from '@ihui/types/permission-mode'
import { buildResponseSchema } from '../utils/api-schemas.js'

// =============================================================================
// 上传目录
// =============================================================================

// P2 修复(2026-08-06):工作区文件属私有资源,写入 uploads/private(静态白名单只暴露
// uploads/public,该目录不对外提供);读取走 GET /api/files/:id 鉴权下载(基于 DB path 定位)。
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads', 'private')

function ensureUploadDir(): void {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true })
}

// =============================================================================
// ACP 会话登记(F-280)
// =============================================================================

/**
 * F-280:这是**进程内最小会话登记,不是持久化**。
 *
 * 此前 begin/end 对任意 sessionId 都回成功(纯 stub)。现在只有 create 时真实
 * 校验过 workspaceRoot 并登记过的会话才被承认;begin/end 只认这份登记。
 * 跨实例/进程重启后登记自然消失 ⇒ 404 —— 这比"假成功"更真实,也无需新增表/迁移。
 * 条目带 TTL + 上限并惰性清理,避免长跑进程无界增长。
 */
interface AcpSessionRecord {
  sessionId: string
  userId: string
  /** realpath 归一后的工作区根,begin/end 比对用 */
  workspaceRoot: string
  createdAt: number
}

const ACP_SESSION_TTL_MS = 2 * 60 * 60 * 1000
const ACP_SESSION_MAX_ENTRIES = 1000
const acpSessions = new Map<string, AcpSessionRecord>()

/** 惰性清理:过期条目删除,超出上限时按插入序淘汰最旧 */
function pruneAcpSessions(now: number): void {
  for (const [id, record] of acpSessions) {
    if (now - record.createdAt > ACP_SESSION_TTL_MS) acpSessions.delete(id)
  }
  while (acpSessions.size > ACP_SESSION_MAX_ENTRIES) {
    const oldest = acpSessions.keys().next().value
    if (oldest === undefined) break
    acpSessions.delete(oldest)
  }
}

function readAcpSession(sessionId: string, now = Date.now()): AcpSessionRecord | undefined {
  const record = acpSessions.get(sessionId)
  if (!record) return undefined
  if (now - record.createdAt > ACP_SESSION_TTL_MS) {
    acpSessions.delete(sessionId)
    return undefined
  }
  return record
}

/** 语法闸(400):非绝对路径 / 文件系统根 / `..` 回跳 / NUL */
function acpWorkspaceRootSyntaxError(raw: string): string | null {
  if (raw.includes('\0')) return '工作区路径包含非法字符'
  if (!isAbsolute(raw)) return '工作区路径必须是绝对路径'
  const resolved = resolve(raw)
  if (parse(resolved).root === resolved) return '工作区路径不能是文件系统根目录'
  if (raw.split(/[\\/]+/).includes('..')) return '工作区路径不得包含 .. 回跳'
  return null
}

/**
 * 归属闸(403):realpath 归一后必须同时落在
 *   ① 服务端登记根 `IHUI_WORKSPACE_ROOTS`;
 *   ② 调用者本人 `workspace_permissions` 登记的工作区(并再按①收窄)。
 * 空白名单一律拒绝(fail-closed),与 utils/workspace-roots 同口径。
 */
async function resolveAcpWorkspaceRoot(userId: string, raw: string): Promise<string | null> {
  const registered = getRegisteredWorkspaceRoots()
  if (registered.length === 0) return null
  const real = realpathOrResolve(raw)
  if (!registered.some((root) => isInsideRoot(real, root))) return null

  const permissions = await listPermissionsByUser(userId)
  const owned = permissions
    .map((row) => realpathOrResolve(row.workspacePath))
    .filter((candidate) => registered.some((root) => isInsideRoot(candidate, root)))
  if (!owned.some((root) => isInsideRoot(real, root))) return null
  return real
}

/** 日志面只保留数值/标识,绝不能带 prompt 或附件正文 */
function acpAttachmentBytes(attachments: BeginPromptData['attachments']): number {
  return (attachments ?? []).reduce((sum, item) => sum + Buffer.byteLength(item.content ?? ''), 0)
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
  fileIds: z.array(z.uuid()).min(1, '至少选择一个文件').max(100, '单次最多操作 100 个文件'),
})

const idParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

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

/**
 * O21 ②(2026-09-23 安全 P0)「出口剥 path」:版本行对外形态,与 `serializeFile` 同口径
 * —— **不**输出 `path`(服务端磁盘绝对路径)。此前 `/files/:id/versions*` 直接把
 * `findFileVersions` 的整行(含 path)倒给客户端,泄漏落盘位置与文件名。
 */
function serializeFileVersion(v: FileVersion) {
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

// =============================================================================
// 路由
// =============================================================================

export const workspaceRoutes: FastifyPluginAsync = async (server) => {
  // F-425::id 最终进 uuid 列,非法字面量直达 SQL 会 22P02 ⇒ 500;收紧为 uuid 形状闸
  const idParam = z.object({ id: z.uuid({ error: '无效的 ID' }) })

  // 鉴权失败统一处理
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || '操作失败,请稍后重试'
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
        response: buildResponseSchema(401),
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

    const removed = await deleteProject(id)
    return reply.send(success({ deleted: removed.length > 0 }))
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
  // 2026-10-28 DDoS P2:项目文件上限 20MB,显式放开脱离全局 2MiB(handler 内再精确闸)。
  server.post('/projects/:id/files', { bodyLimit: 21 * 1024 * 1024 }, async (request, reply) => {
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

        // 2026-07-24 安全加固:文件类型校验 + 大小限制(防 CWE-434 任意文件上传)
        const PROJECT_FILE_MAX_SIZE = 20 * 1024 * 1024 // 20MB
        const buffer = await data.toBuffer()
        const valid = validateUploadFile(buffer, originalName, mimeType, PROJECT_FILE_MAX_SIZE)
        if (!valid.ok) {
          return reply.status(400).send(error(400, valid.reason))
        }

        // 临时文件路径：uploads/<uuid>，写入完成后重命名为最终路径
        const fileId = randomUUID()
        const tmpPath = join(UPLOAD_DIR, `${fileId}.tmp`)
        const finalPath = join(UPLOAD_DIR, fileId)

        try {
          await pipeline(Readable.from(buffer), createWriteStream(tmpPath))
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
          size: buffer.length,
          mimeType,
          uploadedBy: userId,
        })

        return reply.status(201).send(success({ file: serializeFile(file) }))
      })
    } catch (err) {
      // Bulkhead 并发上限拒绝(成因判据走错误归因唯一出口 G-816012)
      const attribution = attributeError(err)
      if (
        attribution.errorSource === 'capacity' &&
        attribution.failureReason === 'concurrency-limit'
      ) {
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

    const removed = await hardDeleteFile(id)
    return reply.send(success({ deleted: removed !== undefined }))
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
    // F-79:一次 `id IN (...)` 查询取回全部目标行,再按请求顺序逐项判定(存在性→归属),
    // 往返次数与文件数无关;403/404 文案与「首个不满足者即整体拒绝、零写入」语义逐字不变。
    const ownedRows = await findFileOwnershipBatch(parsed.data.fileIds, false)
    const projectUserByFileId = new Map(ownedRows.map((r) => [r.id, r.projectUserId]))
    for (const fid of parsed.data.fileIds) {
      if (!projectUserByFileId.has(fid)) {
        return reply.status(404).send(error(404, `文件 ${fid} 不存在或已删除`))
      }
      if (projectUserByFileId.get(fid) !== userId) {
        return reply.status(403).send(error(403, '无权操作部分文件'))
      }
    }

    // 2026-09-26 修「改了 0 行与改成功同形」:deleted 由 batchSoftDelete 的 RETURNING 命中集
    // 经 batchWriteOutcome 推出,校验通过后被并发删除的行不再被读成成功;missedIds 逐条点名。
    // 既有响应键 deleted 与 status code 不变,只新增 missedIds。
    const confirmedIds = await batchSoftDelete(parsed.data.fileIds, userId)
    const { affected, missedIds } = batchWriteOutcome(parsed.data.fileIds, confirmedIds)
    return reply.send(success({ deleted: affected, missedIds }))
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
    // F-79:同 batch-delete,一次批量查询完成全部归属校验(含回收站文件)。
    const ownedRows = await findFileOwnershipBatch(parsed.data.fileIds, true)
    const projectUserByFileId = new Map(ownedRows.map((r) => [r.id, r.projectUserId]))
    for (const fid of parsed.data.fileIds) {
      if (!projectUserByFileId.has(fid)) {
        return reply.status(404).send(error(404, `文件 ${fid} 不存在`))
      }
      if (projectUserByFileId.get(fid) !== userId) {
        return reply.status(403).send(error(403, '无权操作部分文件'))
      }
    }

    // 2026-09-26 同 batch-delete:restored 由 batchRestore 的 RETURNING 命中集经唯一出口推出。
    const confirmedIds = await batchRestore(parsed.data.fileIds)
    const { affected, missedIds } = batchWriteOutcome(parsed.data.fileIds, confirmedIds)
    return reply.send(success({ restored: affected, missedIds }))
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
    // O21 ②:补齐属主/成员谓词(上传者 ∪ 项目 owner ∪ project_members),
    // 此前此处只判"文件存在",任意登录用户可枚举他人文件的全部版本历史。
    if (!(await canAccessFile(request.userId, file))) {
      return reply.status(403).send(error(403, '无权访问该文件'))
    }
    const versions = await findFileVersions(parsed.data.id)
    return reply.send(success({ list: versions.map(serializeFileVersion) }))
  })

  // GET /files/:id/versions/:version - 获取特定版本
  server.get('/files/:id/versions/:version', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const params = z
      .object({ id: z.uuid(), version: z.coerce.number().int().min(1) })
      .safeParse(request.params)
    if (!params.success) {
      return reply.status(400).send(error(400, params.error.issues[0]?.message ?? '参数错误'))
    }
    // O21 ②:此端点原先连 files 行都不读,直接按 id 取版本 —— 先定位文件再判属主,
    // 顺序与上方 /files/:id/versions 一致(不存在 404 → 非属主 403 → 版本缺失 404)。
    const file = await findFileById(params.data.id)
    if (!file) {
      return reply.status(404).send(error(404, '文件不存在'))
    }
    if (!(await canAccessFile(request.userId, file))) {
      return reply.status(403).send(error(403, '无权访问该文件'))
    }
    const versions = await findFileVersions(params.data.id)
    const version = versions.find((v) => v.version === params.data.version)
    if (!version) {
      return reply.status(404).send(error(404, '版本不存在'))
    }
    return reply.send(success({ version: serializeFileVersion(version) }))
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
        response: buildResponseSchema(401, 403, 404),
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
      const removed = await softDeleteFile(id, userId)
      return reply.send(success({ deleted: removed.length > 0 }))
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

    // 2026-09-27 修「恢复了 0 行也回成功」:上面的存在性 / 归属 / 回收站三道闸只防住
    // "根本没执行写",防不住"写了但命中 0 行"(并发永久删除即此) —— ack 改由 UPDATE 自己的
    // RETURNING 命中集合派生,键名与状态码逐字不变。
    const restoredIds = await restoreFile(id)
    return reply.send(success({ restored: restoredIds.length > 0 }))
  })

  // ===========================================================================
  // ACP 风格 Workspace wire 端点(使用 @ihui/types 的 workspace 类型)
  // 渐进式迁移:新端点用 workspace.ts wire 类型,旧端点保持
  // ===========================================================================

  /**
   * ACP 端点权限档入参面 = wire(kebab)∪ 规范档(camel),与 workspace-permissions.ts
   * 存值迁移第①步同形态。此前 `z.enum(PERMISSION_MODE_WIRE_VALUES)` 只收 kebab,
   * camel 客户端一律 400。两份清单都从注册表派生,本文件不再出现第二份字面量;
   * 归一规则同第①步:判定/落库走规范档,出参与对下游转发走 wire。
   * `manual` 有规范档语义但无 wire 映射 → 仍拒,不因"接受 camel"而漏放行。
   */
  const acpModeInputValues = [
    ...new Set<string>([...PERMISSION_MODE_WIRE_VALUES, ...PERMISSION_MODES]),
  ]
  const acpModeInputSchema = z.enum(acpModeInputValues, {
    error: (iss) => `非法权限档: ${String(iss.input)}(取值 ${acpModeInputValues.join(' / ')})`,
  })

  /** 可选 mode → wire 拼写:未提供保持 undefined;null = 合法但无 wire 映射(manual),调用方须 400。 */
  const resolveAcpSessionMode = (raw: string | undefined): PermissionModeWire | null | undefined =>
    raw === undefined ? undefined : permissionModeWire(raw)

  const beginPromptSchema = z.object({
    sessionId: z.string().min(1),
    prompt: z.string().min(1),
    attachments: z
      .array(
        z.object({
          kind: z.enum(['file', 'image', 'text']),
          path: z.string().optional(),
          content: z.string().optional(),
          mimeType: z.string().optional(),
        }),
      )
      .optional(),
    mode: acpModeInputSchema.optional(),
  })

  const endPromptSchema = z.object({
    sessionId: z.string().min(1),
  })

  const createSessionSchemaACP = z.object({
    workspaceRoot: z.string().min(1),
    initialPrompt: z.string().optional(),
    modelId: z.string().optional(),
    mode: acpModeInputSchema.optional(),
  })

  // POST /workspace/acp/sessions - 创建 ACP 会话
  // 请求:CreateSessionData,响应:SessionCreatedData(adjacent tagging)
  server.post('/workspace/acp/sessions', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return
    const userId = request.userId

    const parsed = createSessionSchemaACP.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const modeWire = resolveAcpSessionMode(parsed.data.mode)
    if (modeWire === null) {
      return reply
        .status(400)
        .send(error(400, `非法权限档: ${String(parsed.data.mode)}(manual 无落库/会话语义,不接受)`))
    }
    // 跨界前归一:CreateSessionData.mode 只允许 wire 拼写,camel 入参不得原样泄进下游
    const data: CreateSessionData = { ...parsed.data, mode: modeWire }

    // F-280:workspaceRoot 是客户端自报字符串,必须先过语法闸(400)与归属闸(403)。
    // 归属闸 = 本人 workspace_permissions × 服务端 IHUI_WORKSPACE_ROOTS,realpath 归一后判定。
    const syntaxError = acpWorkspaceRootSyntaxError(data.workspaceRoot)
    if (syntaxError) {
      return reply.status(400).send(error(400, syntaxError))
    }
    const workspaceRoot = await resolveAcpWorkspaceRoot(userId, data.workspaceRoot)
    if (workspaceRoot === null) {
      return reply.status(403).send(error(403, '工作区未在服务端登记或不属于当前用户'))
    }

    const sessionId = randomUUID()
    const now = Date.now()

    // F-432:会话行照旧落库(运行记录/审计);注意它**不是** begin/end 的续用依据,
    // 续用只认下面的进程内登记 —— 跨实例/重启后登记消失即 404。
    try {
      await db.insert(agentRuntimeSessions).values({
        id: sessionId,
        botId: 'workspace-acp',
        userId,
        status: 'active',
        messages: [],
        metadata: {
          source: 'workspace-acp',
          workspaceRoot: data.workspaceRoot,
          ...(data.mode !== undefined ? { mode: data.mode } : {}),
        },
      })
    } catch (e) {
      request.log.error({ err: e, sessionId }, 'ACP 会话落库失败')
      return reply.status(500).send(error(500, '会话创建失败,请稍后重试'))
    }

    // F-280:登记 { sessionId, userId, workspaceRoot, createdAt };TTL + 上限内自清理。
    pruneAcpSessions(now)
    acpSessions.set(sessionId, { sessionId, userId, workspaceRoot, createdAt: now })

    // wire 类型响应(adjacent tagging,与 ACP 协议对齐)
    const event: WorkspaceEvent = {
      type: 'session_created',
      data: {
        sessionId,
        workspaceRoot: data.workspaceRoot,
        createdAt: now,
      } satisfies SessionCreatedData,
    }

    return reply.status(201).send(success(event))
  })

  // POST /workspace/acp/sessions/:id/begin-prompt - 开始 prompt
  // 请求:BeginPromptData,响应:PromptStartedData
  server.post('/workspace/acp/sessions/:id/begin-prompt', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = idParam.parse(request.params)
    const body = (request.body ?? {}) as Record<string, unknown>
    const parsed = beginPromptSchema.safeParse({ ...body, sessionId: id })
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const modeWire = resolveAcpSessionMode(parsed.data.mode)
    if (modeWire === null) {
      return reply
        .status(400)
        .send(error(400, `非法权限档: ${String(parsed.data.mode)}(manual 无落库/会话语义,不接受)`))
    }
    // F-280:只认进程内登记;不存在与不属于本人同形 404(不泄露存在性)
    const record = readAcpSession(id)
    if (!record || record.userId !== request.userId) {
      return reply.status(404).send(error(404, '会话不存在或无权限'))
    }
    // 客户端若自带 workspaceRoot,必须与会话登记一致,否则 400
    if (
      typeof body.workspaceRoot === 'string' &&
      realpathOrResolve(body.workspaceRoot) !== record.workspaceRoot
    ) {
      return reply.status(400).send(error(400, 'workspaceRoot 与会话登记不一致'))
    }
    // 跨界前归一:BeginPromptData.mode 只允许 wire 拼写
    const data: BeginPromptData = { ...parsed.data, mode: modeWire }
    const promptId = randomUUID()
    const now = Date.now()

    const event: WorkspaceEvent = {
      type: 'prompt_started',
      data: {
        sessionId: data.sessionId,
        promptId,
        prompt: data.prompt,
        startedAt: now,
      } satisfies PromptStartedData,
    }

    // F-280:日志只留长度/数量等数值,不得出现 prompt 或附件正文
    request.log.info(
      {
        event: 'prompt_started',
        acp: {
          type: 'begin_prompt',
          sessionId: data.sessionId,
          promptId,
          mode: data.mode,
          promptLength: data.prompt.length,
          attachmentCount: data.attachments?.length ?? 0,
          attachmentBytes: acpAttachmentBytes(data.attachments),
        },
      },
      'ACP begin_prompt',
    )
    return reply.send(success(event))
  })

  // POST /workspace/acp/sessions/:id/end-prompt - 结束 prompt
  // 请求:EndPromptData,响应:PromptCompletedData
  server.post('/workspace/acp/sessions/:id/end-prompt', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const { id } = idParam.parse(request.params)
    const body = (request.body ?? {}) as Record<string, unknown>
    const parsed = endPromptSchema.safeParse({ ...body, sessionId: id })
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    // F-280:与 begin 同口径,结束任意 id 也不得假报 prompt_completed
    const record = readAcpSession(id)
    if (!record || record.userId !== request.userId) {
      return reply.status(404).send(error(404, '会话不存在或无权限'))
    }
    if (
      typeof body.workspaceRoot === 'string' &&
      realpathOrResolve(body.workspaceRoot) !== record.workspaceRoot
    ) {
      return reply.status(400).send(error(400, 'workspaceRoot 与会话登记不一致'))
    }
    const data: EndPromptData = parsed.data
    const promptId = (body.promptId as string | undefined) ?? randomUUID()
    const now = Date.now()

    // 会话随 end 结束:再次 begin/end 均 404(不做"已结束仍成功"的假象)
    acpSessions.delete(id)

    const event: WorkspaceEvent = {
      type: 'prompt_completed',
      data: {
        sessionId: data.sessionId,
        promptId,
        completedAt: now,
      } satisfies PromptCompletedData,
    }

    request.log.info(
      {
        event: 'prompt_completed',
        acp: {
          type: 'end_prompt',
          sessionId: data.sessionId,
          promptId,
        },
      },
      'ACP end_prompt',
    )
    return reply.send(success(event))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
