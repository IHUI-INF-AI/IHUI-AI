// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agent 任务管理路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 路径前缀:/admin/agent-task
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { agentTasks } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../../utils/response.js'
import { withAuditBoth } from '../../utils/audit.js'
import { buildKanbanColumns } from '../agents-kanban.js'
import { mapStatus, isTransitionAllowed } from '../../services/agent-task-status.js'
import {
  startLockHeartbeat,
  releaseTaskLockFromRow,
  releaseTaskLockByTaskId,
} from '../../services/workspace-lock-heartbeat.js'
import { acquireWorkspaceLock } from '../../services/workspace-lock.js'
import { broadcastSSEEvent } from '../../services/agent-sse-bus.js'
import { idParamSchema } from './_shared.js'

const createAgentTaskSchema = z.object({
  agentId: z.uuid(),
  ruleId: z.uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  status: z.string().max(20).optional(),
  priority: z.number().int().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  result: z.record(z.string(), z.unknown()).optional(),
  scheduledAt: z.coerce
    .date()
    .refine((d) => !isNaN(d.getTime()), '无效日期')
    .optional(),
  startedAt: z.coerce
    .date()
    .refine((d) => !isNaN(d.getTime()), '无效日期')
    .optional(),
  completedAt: z.coerce
    .date()
    .refine((d) => !isNaN(d.getTime()), '无效日期')
    .optional(),
  errorMessage: z.string().optional(),
})
const updateAgentTaskSchema = createAgentTaskSchema.partial()

export const agentTaskRoutes: FastifyPluginAsync = async (server) => {
  server.get('/admin/agent-task/kanban', { preHandler: requireAdmin }, async (_request, reply) => {
    const columns = await buildKanbanColumns()
    return reply.send(success(columns))
  })
  server.post('/admin/agent-task', { preHandler: requireAdmin }, async (request, reply) => {
    const body = parseOrThrow(createAgentTaskSchema, request.body)
    const [row] = await db
      .insert(agentTasks)
      .values(withAuditBoth({ ...body }, request.userId ?? null))
      .returning()
    return reply.status(201).send(success(row))
  })
  server.put('/admin/agent-task/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateAgentTaskSchema, request.body)

    const [current] = await db.select().from(agentTasks).where(eq(agentTasks.id, id)).limit(1)
    if (!current) return reply.status(404).send(error(404, '任务不存在'))

    // P0-2:status 变更须走统一状态机校验(原先 admin PUT 可任意改 status 绕过流转图)
    if (body.status !== undefined && body.status !== current.status) {
      const from = mapStatus(current.status)
      const to = mapStatus(body.status)
      if (!isTransitionAllowed(from, to)) {
        return reply.status(409).send(error(409, `非法状态流转: ${from} → ${to}`))
      }
      // P0-2:进入 in_progress 且有工作区 → 与 transition 同款抢锁
      if (to === 'in_progress') {
        const payload = current.payload ?? {}
        const workspace =
          current.workspacePath ??
          (typeof payload.workspacePath === 'string' ? payload.workspacePath : undefined)
        if (workspace) {
          const lockInfo = await acquireWorkspaceLock(workspace, `task:${id}`)
          if (!lockInfo) {
            return reply
              .status(409)
              .send(error(409, `工作区 ${workspace} 已被占用,无法置为 in_progress`))
          }
          body.payload = { ...payload, ...(body.payload ?? {}), workspaceLockToken: lockInfo.token }
          startLockHeartbeat(id, workspace, lockInfo.token)
        }
      }
      // P0-2:离开 in_progress → 统一释放原语(停心跳+释放+清审计字段+广播)
      if (from === 'in_progress' && to !== 'in_progress') {
        await releaseTaskLockFromRow(current)
      }
    }

    const [row] = await db
      .update(agentTasks)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(agentTasks.id, id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '任务不存在'))
    // P0-2:状态变更广播 SSE(与 kanban transition 对齐,前端看板实时刷新)
    if (body.status !== undefined && body.status !== current.status) {
      broadcastSSEEvent({
        type: 'task_status_changed',
        taskId: id,
        payload: {
          fromStatus: mapStatus(current.status),
          toStatus: mapStatus(body.status),
          task: { id, status: mapStatus(body.status), teamId: row.teamId ?? undefined },
        },
        timestamp: new Date().toISOString(),
      })
    }
    return reply.send(success(row))
  })
  server.delete('/admin/agent-task/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    // P0-2:删除前统一释放锁(停心跳 + 凭 token 释放 + 清审计字段 + 广播),
    // 防止 payload 里的 workspaceLockToken 随行删除而锁悬挂
    await releaseTaskLockByTaskId(id)
    const [row] = await db.delete(agentTasks).where(eq(agentTasks.id, id)).returning()
    if (!row) return reply.status(404).send(error(404, '任务不存在'))
    return reply.send(success({ id, deleted: true }))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
