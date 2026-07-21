/**
 * 插件市场后端路由(2026-07-22 立)
 *
 * 设计:
 *  - 零迁移:复用 user_preferences 表(group='plugins', key=pluginId, value=JSON)
 *  - 后端只管 installState,catalog 由前端静态数据提供
 *  - pluginId 用 Zod 校验(/^[a-zA-Z0-9_-]+$/)防注入
 *
 * 端点:
 *  - GET    /installed          查询当前用户所有插件安装态(未登录返回空 states)
 *  - POST   /:id/install        安装/启用(可选 pinned)
 *  - DELETE /:id/install        卸载/禁用
 *  - PATCH  /:id/preferences    更新偏好(pinned)
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import type { PluginInstallState } from '@ihui/types'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import {
  findUserPreferences,
  upsertUserPreference,
  deleteUserPreference,
} from '../db/user-preferences-queries.js'

const PLUGIN_GROUP = 'plugins'

/** pluginId 安全校验:仅允许字母/数字/下划线/连字符,长度 1-100 */
const pluginIdParam = z.object({
  id: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid plugin id'),
})

const installBodySchema = z.object({
  pinned: z.boolean().optional(),
})

const preferencesBodySchema = z.object({
  pinned: z.boolean().optional(),
})

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
    return true
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    reply
      .status(statusCode)
      .send(error(statusCode, (e as Error).message || 'Authentication required'))
    return false
  }
}

/** 解析 user_preferences.value(JSON 字符串)为 PluginInstallState,失败返回 null */
function parseInstallState(value: string | null): PluginInstallState | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<PluginInstallState>
    if (
      typeof parsed.installedAt === 'string' &&
      typeof parsed.pinned === 'boolean'
    ) {
      return { installedAt: parsed.installedAt, pinned: parsed.pinned }
    }
    return null
  } catch {
    return null
  }
}

export const pluginsRoutes: FastifyPluginAsync = async (server) => {
  // -------------------------------------------------------------------------
  // GET /installed - 查询当前用户所有插件安装态
  // 未登录:返回 authenticated=false + 空 states(不抛 401,前端隐藏操作按钮)
  // -------------------------------------------------------------------------
  server.get('/installed', async (request, reply) => {
    let authenticated = false
    let userId: string | undefined
    try {
      await authenticate(request)
      authenticated = true
      userId = request.userId
    } catch {
      // 未登录:返回未认证态,不抛错
    }

    if (!authenticated || !userId) {
      return reply.send(success({ states: {}, authenticated: false }))
    }

    const { list } = await findUserPreferences(userId, PLUGIN_GROUP)
    const states: Record<string, PluginInstallState> = {}
    for (const row of list) {
      const state = parseInstallState(row.value)
      if (state) states[row.key] = state
    }
    return reply.send(success({ states, authenticated: true }))
  })

  // -------------------------------------------------------------------------
  // POST /:id/install - 安装/启用插件(若已安装则更新 pinned)
  // -------------------------------------------------------------------------
  server.post<{ Params: { id: string }; Body: unknown }>(
    '/:id/install',
    async (request, reply) => {
      if (!(await requireAuth(request, reply))) return
      const userId = request.userId!

      const paramsResult = pluginIdParam.safeParse(request.params)
      if (!paramsResult.success) {
        return reply.status(400).send(error(400, 'Invalid plugin id'))
      }
      const pluginId = paramsResult.data.id

      const bodyResult = installBodySchema.safeParse(request.body ?? {})
      if (!bodyResult.success) {
        return reply.status(400).send(error(400, 'Invalid request body'))
      }
      const pinned = bodyResult.data.pinned ?? false

      // 读现有 state(若已安装,保留 installedAt;否则新建)
      const { list } = await findUserPreferences(userId, PLUGIN_GROUP)
      const existing = list.find((r) => r.key === pluginId)
      const prevState = parseInstallState(existing?.value ?? null)
      const state: PluginInstallState = {
        installedAt: prevState?.installedAt ?? new Date().toISOString(),
        pinned,
      }

      await upsertUserPreference(userId, PLUGIN_GROUP, pluginId, JSON.stringify(state))
      return reply.send(success({ pluginId, state }))
    },
  )

  // -------------------------------------------------------------------------
  // DELETE /:id/install - 卸载/禁用插件
  // -------------------------------------------------------------------------
  server.delete<{ Params: { id: string } }>(
    '/:id/install',
    async (request, reply) => {
      if (!(await requireAuth(request, reply))) return
      const userId = request.userId!

      const paramsResult = pluginIdParam.safeParse(request.params)
      if (!paramsResult.success) {
        return reply.status(400).send(error(400, 'Invalid plugin id'))
      }
      const pluginId = paramsResult.data.id

      await deleteUserPreference(userId, PLUGIN_GROUP, pluginId)
      return reply.send(success({ pluginId, removed: true as const }))
    },
  )

  // -------------------------------------------------------------------------
  // PATCH /:id/preferences - 更新插件偏好(目前仅支持 pinned)
  // -------------------------------------------------------------------------
  server.patch<{ Params: { id: string }; Body: unknown }>(
    '/:id/preferences',
    async (request, reply) => {
      if (!(await requireAuth(request, reply))) return
      const userId = request.userId!

      const paramsResult = pluginIdParam.safeParse(request.params)
      if (!paramsResult.success) {
        return reply.status(400).send(error(400, 'Invalid plugin id'))
      }
      const pluginId = paramsResult.data.id

      const bodyResult = preferencesBodySchema.safeParse(request.body ?? {})
      if (!bodyResult.success) {
        return reply.status(400).send(error(400, 'Invalid request body'))
      }

      // 必须先安装才能改偏好;未安装则返回 404
      const { list } = await findUserPreferences(userId, PLUGIN_GROUP)
      const existing = list.find((r) => r.key === pluginId)
      const prevState = parseInstallState(existing?.value ?? null)
      if (!prevState) {
        return reply.status(404).send(error(404, 'Plugin not installed'))
      }

      const state: PluginInstallState = {
        installedAt: prevState.installedAt,
        pinned: bodyResult.data.pinned ?? prevState.pinned,
      }
      await upsertUserPreference(userId, PLUGIN_GROUP, pluginId, JSON.stringify(state))
      return reply.send(success({ pluginId, state }))
    },
  )
}
