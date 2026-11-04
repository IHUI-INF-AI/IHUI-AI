// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 行级归因读取面 — `/api/workspace/attribution`。
 *
 *   GET  /attribution?workspacePath=..&file=..   → 按行区间压缩后的归属(跨会话可见)
 *   PUT  /attribution                             → 落库某个文件的最新归属(写入侧调用)
 *
 * 可见性判据**不在本文件重写**:越权/跨工作区的判定只住 `@ihui/shared/attribution` 的
 * `queryAttribution` 一处(403 outside_workspace / 404 attribution_not_found),
 * 本文件只负责「先过现有工作区权限门,再交给唯一判据」。
 *
 * 存储复用 user_preferences(与 workspace-permissions 同一做法,零迁移):
 *   group = 'workspace_attribution',key = sha256(小写化的 workspacePath) 前 40 位,
 *   value = JSON { files: { '<工作区相对路径>': LineAttribution[] } }。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  queryAttribution,
  resolveWorkspaceRelativePath,
  type AttributionSource,
  type LineAttribution,
} from '@ihui/shared/attribution'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { permissionManager } from '../services/workspace-ai-service.js'
import { findUserPreferences, upsertUserPreference } from '../db/user-preferences-queries.js'

const ATTRIBUTION_GROUP = 'workspace_attribution'

const attributionRecordSchema = z.object({
  filePath: z.string().min(1),
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1),
  source: z.enum(['ai', 'human', 'ai-then-human']),
  origin: z.object({
    agentId: z.string().optional(),
    sessionId: z.string().optional(),
    toolCallId: z.string().optional(),
    model: z.string().optional(),
    at: z.string(),
  }),
  revision: z.number().int().min(0),
})

function workspaceKey(workspacePath: string): string {
  return createHash('sha256').update(workspacePath.trim().toLowerCase()).digest('hex').slice(0, 40)
}

interface AttributionDoc {
  files: Record<string, LineAttribution[]>
}

function parseDoc(value: string | null): AttributionDoc {
  if (!value) return { files: {} }
  try {
    const parsed = JSON.parse(value) as Partial<AttributionDoc>
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.files !== 'object' ||
      parsed.files === null
    ) {
      return { files: {} }
    }
    const files: Record<string, LineAttribution[]> = {}
    for (const [path, records] of Object.entries(parsed.files)) {
      if (Array.isArray(records)) files[path] = records as LineAttribution[]
    }
    return { files }
  } catch {
    return { files: {} }
  }
}

export const workspaceAttributionRoutes: FastifyPluginAsync = async (server) => {
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply): Promise<boolean> => {
    try {
      await authenticate(request)
      return true
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || '操作失败,请稍后重试'
      reply.status(statusCode).send(error(statusCode, message))
      return false
    }
  }

  /** 先过现有工作区权限门(与 workspace-ai 的 fs 端点同一判据),再交给归因唯一判据。 */
  const assertWorkspaceAccess = async (
    request: FastifyRequest,
    reply: FastifyReply,
    workspacePath: string,
    tool: string,
  ): Promise<boolean> => {
    if (!request.userId) {
      reply.status(401).send(error(401, '未登录'))
      return false
    }
    const decision = await permissionManager.checkWorkspace({
      userId: request.userId,
      workspacePath,
      tool,
      args: { workspacePath },
    })
    if (decision.allowed) return true
    const statusCode = decision.configured ? 403 : 401
    reply.status(statusCode).send(error(statusCode, decision.reason))
    return false
  }

  async function loadRecords(userId: string, workspacePath: string): Promise<LineAttribution[]> {
    const { list } = await findUserPreferences(userId, ATTRIBUTION_GROUP)
    const row = list.find((item) => item.key === workspaceKey(workspacePath))
    const doc = parseDoc(row?.value ?? null)
    return Object.values(doc.files).flat()
  }

  server.get('/attribution', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = z
      .object({ workspacePath: z.string().min(1), file: z.string().min(1) })
      .safeParse(request.query ?? {})
    if (!parsed.success) return reply.status(400).send(error(400, 'workspacePath 与 file 必填'))
    const { workspacePath, file } = parsed.data
    if (!(await assertWorkspaceAccess(request, reply, workspacePath, 'read'))) return
    const records = await loadRecords(request.userId!, workspacePath)
    const outcome = queryAttribution({ workspacePath, file, records })
    if (!outcome.ok) {
      const message =
        outcome.reason === 'outside_workspace'
          ? '目标文件不在当前工作区内,拒绝查询'
          : '该文件暂无 AI 归属记录'
      return reply.status(outcome.status).send(error(outcome.status, message))
    }
    return reply.send(success({ file: outcome.file, ranges: outcome.ranges }))
  })

  server.put('/attribution', async (request, reply) => {
    if (!(await requireAuth(request, reply))) return
    const parsed = z
      .object({
        workspacePath: z.string().min(1),
        filePath: z.string().min(1),
        records: z.array(attributionRecordSchema).max(20000),
      })
      .safeParse(request.body ?? {})
    if (!parsed.success) return reply.status(400).send(error(400, '归属记录参数不合法'))
    const { workspacePath, filePath, records } = parsed.data
    if (!(await assertWorkspaceAccess(request, reply, workspacePath, 'write'))) return
    // 写入侧同样过越权判据:只允许落到本工作区内的文件键
    const relative = resolveWorkspaceRelativePath(workspacePath, filePath)
    if (relative === null)
      return reply.status(403).send(error(403, '目标文件不在当前工作区内,拒绝写入归属'))

    const userId = request.userId!
    const { list } = await findUserPreferences(userId, ATTRIBUTION_GROUP)
    const row = list.find((item) => item.key === workspaceKey(workspacePath))
    const doc = parseDoc(row?.value ?? null)
    doc.files[relative] = records.map((record) => ({
      ...record,
      filePath: relative,
    })) as LineAttribution[]
    await upsertUserPreference(
      userId,
      ATTRIBUTION_GROUP,
      workspaceKey(workspacePath),
      JSON.stringify(doc),
    )
    return reply.send(
      success({
        file: relative,
        saved: records.length,
        sources: records.map((r) => r.source as AttributionSource),
      }),
    )
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
