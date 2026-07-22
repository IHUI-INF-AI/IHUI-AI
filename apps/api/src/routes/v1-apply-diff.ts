/**
 * v1 Apply Diff 路由 — Inline Diff 卡片 Apply 工作流的后端入口。
 *
 * 2026-07-22 立 P3 深度层:聊天面板 edit_file/write_file 工具调用的 Accept 按钮
 * 调用本接口,把 newContent 写入文件系统(走 fsBridge.write 沙箱 + workspace 权限校验)。
 *
 * 路径:POST /v1/ai/apply-diff(在 server.ts 用 prefix:'/api' 注册 → /api/v1/ai/apply-diff)
 *
 * 请求体:
 *   - path: string         目标文件路径(绝对或相对 workspacePath)
 *   - oldContent: string   旧内容(用于二次校验,可选;若提供且与磁盘不一致 → 409)
 *   - newContent: string   新内容(全量写入)
 *   - workspacePath: string 工作区根路径(沙箱校验必需,前端从 activeWorkspace.path 传)
 *
 * 响应:{ code: 0, message: 'success', data: { applied: boolean, path: string } }
 *
 * 注意:任务契约原 body 为 {path, oldContent, newContent},此处扩展 workspacePath 字段,
 * 原因是 fsBridge.write + permissionManager.checkWorkspace 均依赖 workspacePath 做沙箱边界
 * 校验,缺它无法防路径穿越。前端 use-apply-diff.ts 已同步传 workspacePath。
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { fsBridge, permissionManager } from '../services/workspace-ai-service.js'

export const aiApplyDiffRoutes: FastifyPluginAsync = async (server) => {
  // 鉴权:复用 packages/auth 的 authenticate(同 workspace-ai.ts 模式)
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  }

  // 权限推送函数复用(同 workspace-ai.ts)
  const pushFn =
    typeof server.pushNotification === 'function'
      ? (userId: string, payload: unknown) => server.pushNotification(userId, payload)
      : null
  if (pushFn) permissionManager.setPushFn(pushFn)

  // workspace 权限拦截 helper(同 workspace-ai.ts,返回 null=放行 / Error=已写 403)
  const assertWorkspacePermission = async (
    request: FastifyRequest,
    reply: FastifyReply,
    ctx: { workspacePath: string; tool: string; args: Record<string, unknown> },
  ): Promise<Error | null> => {
    if (!request.userId) return new Error('未登录')
    const decision = await permissionManager.checkWorkspace({
      userId: request.userId,
      workspacePath: ctx.workspacePath,
      tool: ctx.tool,
      args: ctx.args,
    })
    if (decision.allowed) return null
    const statusCode = decision.mode === 'unset' ? 401 : 403
    reply.status(statusCode).send(error(statusCode, decision.reason))
    return new Error(decision.reason)
  }

  const applyDiffSchema = z.object({
    path: z.string().min(1),
    oldContent: z.string(),
    newContent: z.string(),
    workspacePath: z.string().min(1),
  })

  server.post('/v1/ai/apply-diff', async (request, reply) => {
    await requireAuth(request, reply)
    if (!request.userId) return

    const parsed = applyDiffSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply
        .status(400)
        .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const body = parsed.data

    if (
      (await assertWorkspacePermission(request, reply, {
        workspacePath: body.workspacePath,
        tool: 'fs.write',
        args: { path: body.path },
      })) !== null
    ) {
      return
    }

    try {
      // 二次校验:oldContent 非空时与磁盘当前内容比对,不一致 → 409(避免覆盖他人改动)
      if (body.oldContent) {
        try {
          const readResult = fsBridge.read({
            path: body.path,
            workspacePath: body.workspacePath,
          })
          if (readResult.content !== body.oldContent) {
            return reply
              .status(409)
              .send(
                error(
                  409,
                  '文件已被修改,与 Apply 时的旧内容不一致,请刷新 diff 后重试',
                ),
              )
          }
        } catch {
          // 文件不存在:write_file 新建场景,跳过 oldContent 校验
        }
      }

      const result = fsBridge.write({
        path: body.path,
        workspacePath: body.workspacePath,
        content: body.newContent,
        createDirs: true,
      })

      return reply.send(
        success({ applied: true, path: result.path }),
      )
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })
}

export default aiApplyDiffRoutes
