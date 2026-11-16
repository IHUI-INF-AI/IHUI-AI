// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agent 参数组合路由(2026-11-13 立,遵循统一工程规范)
 *
 * 落库:`user_preferences`(group='agent_combo',key=组合 id,value=组合 JSON),零迁移。
 * 纪律:
 *  - 服务端**重跑**共享校验器(客户端校验永远可绕过);
 *  - key 必须等于 body.id(路由与内容不一致直接拒绝,避免 PUT /a 写进 /b);
 *  - 只做 CRUD,不执行任何内容 —— 组合是"参数快照",套用在前端生效。
 *
 * 端点:
 *  - GET    /            当前用户全部组合(未登录返回空 + authenticated=false)
 *  - PUT    /:id         新建/覆盖
 *  - DELETE /:id         删除
 */

import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { z } from 'zod'
import {
  AGENT_COMBO_ID_RE,
  AGENT_COMBO_LIMITS,
  parseAgentComboRecord,
  validateAgentCombo,
  type AgentCombo,
  type AgentComboListResponse,
} from '@ihui/types'
import { authenticate, checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import {
  findUserPreferences,
  upsertUserPreference,
  deleteUserPreference,
  USER_PREFERENCE_GROUPS,
} from '../db/user-preferences-queries.js'

const COMBO_GROUP = USER_PREFERENCE_GROUPS.agentCombo

const comboIdParam = z.object({
  id: z.string().regex(AGENT_COMBO_ID_RE, 'Invalid combo id'),
})

export const agentCombosRoutes: FastifyPluginAsync = async (server) => {
  // GET / — 当前用户全部组合
  server.get('/', async (request, reply) => {
    let userId: string | undefined
    try {
      await authenticate(request)
      userId = request.userId
    } catch {
      // 未登录:返回空清单,前端据此隐藏保存入口
    }
    if (!userId) {
      const body: AgentComboListResponse = { combos: [], authenticated: false }
      return reply.send(success(body))
    }

    const { list } = await findUserPreferences(userId, COMBO_GROUP)
    const combos: AgentCombo[] = []
    for (const row of list) {
      const record = parseAgentComboRecord(row.value)
      if (record) combos.push(record)
    }
    combos.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    const body: AgentComboListResponse = { combos, authenticated: true }
    return reply.send(success(body))
  })

  // PUT /:id — 新建/覆盖
  server.put<{ Params: { id: string }; Body: unknown }>(
    '/:id',
    async (request: FastifyRequest<{ Params: { id: string }; Body: unknown }>, reply) => {
      if (!(await checkAuth(request, reply))) return
      const userId = request.userId!
      const params = comboIdParam.safeParse(request.params)
      if (!params.success) return reply.status(400).send(error(400, 'Invalid combo id'))

      const validation = validateAgentCombo(request.body, { expectedId: params.data.id })
      if (!validation.ok) {
        const summary = validation.errors
          .slice(0, 3)
          .map((item) => `${item.path}: ${item.message}`)
          .join('; ')
        return reply
          .status(400)
          .send(error(400, `组合校验失败 — ${summary}`, 'INVALID_AGENT_COMBO'))
      }

      const { list } = await findUserPreferences(userId, COMBO_GROUP)
      const existing = list.find((item) => item.key === params.data.id)
      if (!existing && list.length >= AGENT_COMBO_LIMITS.maxCombos) {
        return reply
          .status(409)
          .send(
            error(
              409,
              `组合数量已达上限(${AGENT_COMBO_LIMITS.maxCombos} 个),请先删除不再使用的组合`,
            ),
          )
      }

      const now = new Date().toISOString()
      const previous = parseAgentComboRecord(existing?.value ?? null)
      const record: AgentCombo = {
        ...validation.value,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      }

      await upsertUserPreference(userId, COMBO_GROUP, record.id, JSON.stringify(record))
      return reply.send(success({ combo: record }))
    },
  )

  // DELETE /:id
  server.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const params = comboIdParam.safeParse(request.params)
    if (!params.success) return reply.status(400).send(error(400, 'Invalid combo id'))

    await deleteUserPreference(userId, COMBO_GROUP, params.data.id)
    return reply.send(success({ id: params.data.id, removed: true as const }))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
